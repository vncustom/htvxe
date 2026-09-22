import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, notifications } from "../../src/db/schema";
import { STATUS } from "../../src/lib/status";
import { toDatetimeLocal } from "../../src/lib/tz";
import { createTestDb, truncateAll, type TestDb } from "../helpers/db";
import { seedBasicFixture, sessionOf } from "../helpers/seed";
import { buildTestApp, sessionCookie, testEnv, testExecutionCtx } from "../helpers/app";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  await truncateAll(testDb.pg);
});

const FORM = "application/x-www-form-urlencoded";
const form = (data: Record<string, string>) => new URLSearchParams(data).toString();

async function bookingStatus(id: string): Promise<string> {
  const [row] = await testDb.db.select().from(bookings).where(eq(bookings.id, id));
  return row.status;
}

describe("vòng đời 1 đơn công tác — đi qua HTTP thật (Hono routes + rbac + DB)", () => {
  it("tạo → Ban duyệt → Đội xe điều xe → lái xe bắt đầu → kết thúc → Hoàn thành", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const app = buildTestApp(testDb.db);
    const env = testEnv();
    const execCtx = testExecutionCtx();
    // Phải là thời điểm tương lai thật — route chặn tạo đơn cho quá khứ.
    const startTimeLocal = toDatetimeLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000));

    // 1. Nhân viên tạo đơn
    const createRes = await app.request(
      "/don",
      {
        method: "POST",
        headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.nhanVien)) },
        body: form({ startTime: startTimeLocal, diemDen: "Cần Thơ", noiDung: "Ghi hình sự kiện" }),
      },
      env,
      execCtx,
    );
    expect(createRes.status).toBe(302);
    const location = createRes.headers.get("location") ?? "";
    expect(location).toMatch(/^\/don\/[0-9a-f-]{36}$/);
    const bookingId = location.split("/").pop()!;
    expect(await bookingStatus(bookingId)).toBe(STATUS.CHO_BAN_DUYET);

    // 2. Chủ đơn không tự duyệt được đơn của mình
    const forbiddenApprove = await app.request(
      `/don/${bookingId}/approve`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.nhanVien)) }, body: form({ decision: "duyet" }) },
      env,
      execCtx,
    );
    expect(forbiddenApprove.status).toBe(403);
    expect(await bookingStatus(bookingId)).toBe(STATUS.CHO_BAN_DUYET);

    // 3. Trưởng ban đúng đơn vị (dsBan) duyệt
    const approveRes = await app.request(
      `/don/${bookingId}/approve`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.truongBan)) }, body: form({ decision: "duyet" }) },
      env,
      execCtx,
    );
    expect(approveRes.status).toBe(302);
    expect(await bookingStatus(bookingId)).toBe(STATUS.CHO_DOI_XE);

    // 4. Đội xe điều xe + lái xe
    const dispatchRes = await app.request(
      `/don/${bookingId}/dispatch`,
      {
        method: "POST",
        headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.toTruong)) },
        body: form({ vehicleId: fx.veh.id, driverUsername: fx.driver.username }),
      },
      env,
      execCtx,
    );
    expect(dispatchRes.status).toBe(302);
    expect(await bookingStatus(bookingId)).toBe(STATUS.DA_DIEU_XE);

    // 5. Lái xe bắt đầu chuyến — chỉ định rõ giờ xuất bến = hiện tại, tránh mặc định
    // theo bk.startTime (tương lai) khiến bước "kết thúc" (mặc định giờ hiện tại) bị
    // coi là kết thúc trước khi xuất bến.
    const startRes = await app.request(
      `/chuyen/${bookingId}/bat-dau`,
      {
        method: "POST",
        headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.driver)) },
        body: form({ odoStart: "1000", gioXuatBen: toDatetimeLocal(new Date()) }),
      },
      env,
      execCtx,
    );
    expect(startRes.status).toBe(302);
    expect(await bookingStatus(bookingId)).toBe(STATUS.DANG_CHAY);

    // 6. Tài xế khác không được đóng hộ chuyến người khác
    const forbiddenEnd = await app.request(
      `/chuyen/${bookingId}/ket-thuc`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.driver2)) }, body: form({ odoEnd: "1080" }) },
      env,
      execCtx,
    );
    expect(forbiddenEnd.status).toBe(403);

    // 7. Lái xe đúng người kết thúc chuyến
    const endRes = await app.request(
      `/chuyen/${bookingId}/ket-thuc`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.driver)) }, body: form({ odoEnd: "1080" }) },
      env,
      execCtx,
    );
    expect(endRes.status).toBe(302);
    expect(await bookingStatus(bookingId)).toBe(STATUS.HOAN_THANH);

    // 8. Chủ đơn nhận thông báo trong suốt vòng đời (Ban duyệt, điều xe...)
    const notifs = await testDb.db.select().from(notifications).where(eq(notifications.username, fx.nhanVien.username));
    expect(notifs.length).toBeGreaterThan(0);

    // 9. Trang chi tiết đơn (loadBooking — 1 JOIN gộp) hiển thị đủ dữ liệu cuối
    const detailRes = await app.request(
      `/don/${bookingId}`,
      { headers: { Cookie: await sessionCookie(sessionOf(fx.nhanVien)) } },
      env,
      execCtx,
    );
    expect(detailRes.status).toBe(200);
    const html = await detailRes.text();
    expect(html).toContain(fx.veh.plateNo);
    expect(html).toContain(fx.driver.fullName);
    expect(html).toContain(fx.truongBan.fullName);
  });

  it("Đội xe từ chối → chủ đơn Sửa & gửi lại → quay lại đúng hàng chờ Đội xe", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const app = buildTestApp(testDb.db);
    const env = testEnv();
    const execCtx = testExecutionCtx();
    const startTimeLocal = toDatetimeLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000));

    const createRes = await app.request(
      "/don",
      {
        method: "POST",
        headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.nhanVien)) },
        body: form({ startTime: startTimeLocal, diemDen: "Cần Thơ", noiDung: "Việc gấp" }),
      },
      env,
      execCtx,
    );
    const bookingId = (createRes.headers.get("location") ?? "").split("/").pop()!;

    await app.request(
      `/don/${bookingId}/approve`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.truongBan)) }, body: form({ decision: "duyet" }) },
      env,
      execCtx,
    );
    expect(await bookingStatus(bookingId)).toBe(STATUS.CHO_DOI_XE);

    await app.request(
      `/don/${bookingId}/dispatch`,
      { method: "POST", headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.toTruong)) }, body: form({ decision: "tu_choi" }) },
      env,
      execCtx,
    );
    expect(await bookingStatus(bookingId)).toBe(STATUS.DOI_XE_TU_CHOI);

    const editRes = await app.request(
      `/don/${bookingId}/sua`,
      {
        method: "POST",
        headers: { "Content-Type": FORM, Cookie: await sessionCookie(sessionOf(fx.nhanVien)) },
        body: form({ startTime: startTimeLocal, diemDen: "Cần Thơ (đổi giờ)", noiDung: "Việc gấp" }),
      },
      env,
      execCtx,
    );
    expect(editRes.status).toBe(302);
    // Bị Đội xe từ chối -> gửi lại quay thẳng về Chờ Đội xe (giữ nguyên lượt Ban đã duyệt).
    expect(await bookingStatus(bookingId)).toBe(STATUS.CHO_DOI_XE);
  });

  it("không tạo được đơn khi chưa đăng nhập — chuyển hướng /login", async () => {
    const app = buildTestApp(testDb.db);
    const res = await app.request("/don/moi", {}, testEnv(), testExecutionCtx());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("chặn trang quản trị nếu không phải admin", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const app = buildTestApp(testDb.db);
    const res = await app.request(
      "/quan-tri",
      { headers: { Cookie: await sessionCookie(sessionOf(fx.nhanVien)) } },
      testEnv(),
      testExecutionCtx(),
    );
    expect(res.status).toBe(403);
  });
});
