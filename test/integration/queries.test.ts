import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookingApprovals, bookingDispatch, bookings, tripLogs } from "../../src/db/schema";
import { findBusyInWindow, genBookingCode, getBadges, loadBooking } from "../../src/lib/queries";
import { STATUS } from "../../src/lib/status";
import { createTestDb, truncateAll, type TestDb } from "../helpers/db";
import { seedBasicFixture, sessionOf } from "../helpers/seed";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

beforeEach(async () => {
  await truncateAll(testDb.pg);
});

async function insertBooking(fx: Awaited<ReturnType<typeof seedBasicFixture>>, over: Partial<typeof bookings.$inferInsert> = {}) {
  const [bk] = await testDb.db
    .insert(bookings)
    .values({
      code: over.code ?? `HTV-2026-${Math.floor(Math.random() * 900000 + 100000)}`,
      requesterUsername: fx.nhanVien.username,
      donViYeuCau: fx.donVi,
      startTime: new Date("2026-03-05T01:00:00Z"),
      diemDen: "Cần Thơ",
      noiDung: "Công tác",
      ...over,
    })
    .returning();
  return bk;
}

describe("genBookingCode", () => {
  it("sinh mã đầu tiên trong năm là 000001", async () => {
    const code = await genBookingCode(testDb.db, new Date("2026-01-01T00:00:00Z"));
    expect(code).toBe("HTV-2026-000001");
  });

  it("tăng dần theo mã lớn nhất đã có trong năm", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await insertBooking(fx, { code: "HTV-2026-000005" });
    const code = await genBookingCode(testDb.db, new Date("2026-06-01T00:00:00Z"));
    expect(code).toBe("HTV-2026-000006");
  });

  it("không lẫn mã của năm khác", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await insertBooking(fx, { code: "HTV-2025-000099", startTime: new Date("2025-01-10T00:00:00Z") });
    const code = await genBookingCode(testDb.db, new Date("2026-01-01T00:00:00Z"));
    expect(code).toBe("HTV-2026-000001");
  });
});

describe("loadBooking — 1 JOIN gộp thay cho dò tuần tự", () => {
  it("trả về null khi id không tồn tại", async () => {
    expect(await loadBooking(testDb.db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("trả về null khi đơn đã bị soft-delete", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const bk = await insertBooking(fx, { deletedAt: new Date() });
    expect(await loadBooking(testDb.db, bk.id)).toBeNull();
  });

  it("requester có dữ liệu, các nhánh chưa phát sinh (approval/dispatch/tripLog) trả null", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const bk = await insertBooking(fx);

    const data = await loadBooking(testDb.db, bk.id);
    expect(data).not.toBeNull();
    expect(data!.bk.code).toBe(bk.code);
    expect(data!.requester?.username).toBe(fx.nhanVien.username);
    expect(data!.requester?.fullName).toBe(fx.nhanVien.fullName);
    expect(data!.approval).toBeNull();
    expect(data!.approverName).toBeNull();
    expect(data!.dispatch).toBeNull();
    expect(data!.vehicle).toBeNull();
    expect(data!.driver).toBeNull();
    expect(data!.dispatcherName).toBeNull();
    expect(data!.tripLog).toBeNull();
  });

  it("gộp đủ approval + dispatch + vehicle + driver + dispatcherName + tripLog", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const bk = await insertBooking(fx, { status: STATUS.HOAN_THANH });

    await testDb.db.insert(bookingApprovals).values({
      bookingId: bk.id,
      approverUsername: fx.truongBan.username,
      quyetDinh: "duyet",
      ghiChu: "Đồng ý",
    });
    await testDb.db.insert(bookingDispatch).values({
      bookingId: bk.id,
      vehicleId: fx.veh.id,
      driverUsername: fx.driver.username,
      dispatchedBy: fx.toTruong.username,
    });
    await testDb.db.insert(tripLogs).values({
      bookingId: bk.id,
      driverUsername: fx.driver.username,
      odoStart: 100,
      odoEnd: 150,
      soKm: 50,
      daDongChuyen: true,
    });

    const data = await loadBooking(testDb.db, bk.id);
    expect(data!.approval?.quyetDinh).toBe("duyet");
    expect(data!.approval?.ghiChu).toBe("Đồng ý");
    expect(data!.approverName).toBe(fx.truongBan.fullName);
    expect(data!.dispatch?.driverUsername).toBe(fx.driver.username);
    expect(data!.vehicle?.plateNo).toBe(fx.veh.plateNo);
    expect(data!.driver?.fullName).toBe(fx.driver.fullName);
    expect(data!.dispatcherName).toBe(fx.toTruong.fullName);
    expect(data!.tripLog?.soKm).toBe(50);
  });

  it("approval/dispatch đã soft-delete (Sửa & gửi lại) không lộ ra ở bản ghi hiện tại", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const bk = await insertBooking(fx, { status: STATUS.CHO_BAN_DUYET });

    await testDb.db.insert(bookingApprovals).values({
      bookingId: bk.id,
      approverUsername: fx.truongBan.username,
      quyetDinh: "tu_choi",
      deletedAt: new Date(),
    });

    const data = await loadBooking(testDb.db, bk.id);
    expect(data!.approval).toBeNull();
    expect(data!.approverName).toBeNull();
  });
});

describe("findBusyInWindow", () => {
  async function dispatchedBooking(
    fx: Awaited<ReturnType<typeof seedBasicFixture>>,
    start: Date,
    end: Date | null,
    status: string,
    vehicleId: string,
    driverUsername: string,
  ) {
    const bk = await insertBooking(fx, { startTime: start, endTime: end, status });
    await testDb.db.insert(bookingDispatch).values({ bookingId: bk.id, vehicleId, driverUsername, dispatchedBy: fx.toTruong.username });
    return bk;
  }

  it("phát hiện trùng khi khung giờ giao nhau (cùng xe hoặc cùng lái xe)", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await dispatchedBooking(
      fx,
      new Date("2026-03-05T01:00:00Z"),
      new Date("2026-03-05T03:00:00Z"),
      STATUS.DA_DIEU_XE,
      fx.veh.id,
      fx.driver.username,
    );

    const busy = await findBusyInWindow(testDb.db, new Date("2026-03-05T02:00:00Z"), new Date("2026-03-05T04:00:00Z"));
    expect(busy).toHaveLength(1);
    expect(busy[0].vehicleId).toBe(fx.veh.id);
  });

  it("không báo trùng khi khung giờ không giao nhau", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await dispatchedBooking(
      fx,
      new Date("2026-03-05T01:00:00Z"),
      new Date("2026-03-05T02:00:00Z"),
      STATUS.DA_DIEU_XE,
      fx.veh.id,
      fx.driver.username,
    );
    const busy = await findBusyInWindow(testDb.db, new Date("2026-03-05T03:00:00Z"), new Date("2026-03-05T04:00:00Z"));
    expect(busy).toHaveLength(0);
  });

  it("loại trừ đúng booking đang sửa qua excludeId", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const start = new Date("2026-03-05T01:00:00Z");
    const end = new Date("2026-03-05T03:00:00Z");
    const bk = await dispatchedBooking(fx, start, end, STATUS.DA_DIEU_XE, fx.veh.id, fx.driver.username);
    const busy = await findBusyInWindow(testDb.db, start, end, bk.id);
    expect(busy).toHaveLength(0);
  });

  it("bỏ qua đơn không ở trạng thái đã điều xe/đang chạy", async () => {
    const fx = await seedBasicFixture(testDb.db);
    const start = new Date("2026-03-05T01:00:00Z");
    const end = new Date("2026-03-05T03:00:00Z");
    await dispatchedBooking(fx, start, end, STATUS.HOAN_THANH, fx.veh.id, fx.driver.username);
    const busy = await findBusyInWindow(testDb.db, start, end);
    expect(busy).toHaveLength(0);
  });
});

describe("getBadges", () => {
  it("đếm đơn chờ duyệt chỉ cho đúng trưởng/phó ban của donViYeuCau", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await insertBooking(fx, { status: STATUS.CHO_BAN_DUYET });

    expect((await getBadges(testDb.db, sessionOf(fx.truongBan))).duyet).toBe(1);
    expect((await getBadges(testDb.db, sessionOf(fx.truongBanKhac))).duyet).toBe(0);
  });

  it("đếm đơn chờ điều xe cho Đội xe", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await insertBooking(fx, { status: STATUS.CHO_DOI_XE });
    expect((await getBadges(testDb.db, sessionOf(fx.toTruong))).dieuXe).toBe(1);
    expect((await getBadges(testDb.db, sessionOf(fx.nhanVien))).dieuXe).toBe(0);
  });

  it("đếm donCuaToi cho chủ đơn khi đơn vừa bị từ chối / được điều xe", async () => {
    const fx = await seedBasicFixture(testDb.db);
    await insertBooking(fx, { status: STATUS.BAN_TU_CHOI });
    await insertBooking(fx, { status: STATUS.DA_DIEU_XE });
    await insertBooking(fx, { status: STATUS.CHO_BAN_DUYET }); // chưa cần xem

    const badges = await getBadges(testDb.db, sessionOf(fx.nhanVien));
    expect(badges.donCuaToi).toBe(2);
  });
});
