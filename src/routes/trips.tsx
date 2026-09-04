import { Hono } from "hono";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Env } from "../env";
import { bookingDispatch, bookings, odometerEvents, tripLogs, users, vehicles } from "../db/schema";
import { must } from "../lib/session";
import { pageCtx } from "../lib/page";
import { isDoiXe } from "../lib/rbac";
import { STATUS } from "../lib/status";
import { KM_DAILY_WARN } from "../lib/odometer";
import { Layout, StatusPill, Alert, vi } from "../lib/ui";
import { fmtDateTime, fromDatetimeLocal, toDatetimeLocal } from "../lib/tz";

export const trips = new Hono<Env>();

const intOrNull = (v: unknown): number | null => {
  const t = String(v ?? "").trim().replace(/[.,\s]/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
};
const str = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

trips.get("/chuyen-cua-toi", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!s.isDriver) return c.text("Trang dành cho lái xe.", 403);
  const msg = c.req.query("ok");
  const warn = c.req.query("warn");

  const driverU = alias(users, "driver_u");

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      diemXuatPhat: bookings.diemXuatPhat,
      diemDen: bookings.diemDen,
      noiDung: bookings.noiDung,
      bienTap: bookings.bienTap,
      bienTapUsername: bookings.bienTapUsername,
      quayPhim: bookings.quayPhim,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      currentOdometer: vehicles.currentOdometer,
      odoStart: tripLogs.odoStart,
      gioXuatBen: tripLogs.gioXuatBen,
      driverName: driverU.fullName,
      driverPhone: driverU.phone,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .innerJoin(driverU, eq(driverU.username, bookingDispatch.driverUsername))
    .leftJoin(tripLogs, eq(tripLogs.bookingId, bookings.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        isNull(bookingDispatch.deletedAt),
        eq(bookingDispatch.driverUsername, s.username),
        inArray(bookings.status, [STATUS.DA_DIEU_XE, STATUS.DANG_CHAY]),
      ),
    )
    .orderBy(asc(bookings.startTime));

  // SĐT biên tập: ưu tiên username đã tag (chính xác), fallback khớp mờ theo họ tên (dữ liệu cũ).
  const bienTapUsernames = [...new Set(rows.map((r) => r.bienTapUsername).filter((x): x is string => !!x))];
  const bienTapNames = [...new Set(rows.map((r) => r.bienTap).filter((x): x is string => !!x))];
  const phoneByUsername = new Map<string, string>();
  const phoneByName = new Map<string, string>();
  if (bienTapUsernames.length) {
    const eds = await db
      .select({ username: users.username, phone: users.phone })
      .from(users)
      .where(and(inArray(users.username, bienTapUsernames), isNull(users.deletedAt)));
    for (const e of eds) if (e.phone) phoneByUsername.set(e.username, e.phone);
  }
  if (bienTapNames.length) {
    const eds = await db
      .select({ fullName: users.fullName, phone: users.phone })
      .from(users)
      .where(and(inArray(users.fullName, bienTapNames), isNull(users.deletedAt)));
    for (const e of eds) if (e.phone && !phoneByName.has(e.fullName)) phoneByName.set(e.fullName, e.phone);
  }

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/chuyen-cua-toi" title="Chuyến của tôi">
      <h2>Chuyến của tôi</h2>
      <Alert kind="ok" msg={msg} />
      <Alert kind="warn" msg={warn} />
      {rows.length === 0 ? <p class="muted">Chưa có chuyến nào.</p> : null}
      {rows.map((r) => (
        <div class="card">
          <h3>
            {r.code} <StatusPill status={r.status} />
          </h3>
          <table style="margin:8px 0">
            <tbody>
              <tr><th style="width:130px">Hành trình</th><td>{r.diemXuatPhat} → {r.diemDen} · {fmtDateTime(r.startTime)}</td></tr>
              <tr><th>Xe</th><td><b>{r.vehicleName}</b> ({r.plateNo})</td></tr>
              <tr><th>Lái xe</th><td>{r.driverName}{r.driverPhone ? ` · ☎ ${r.driverPhone}` : ""}</td></tr>
              <tr><th>Biên tập</th><td>{r.bienTap ? (() => {
                const phone = (r.bienTapUsername && phoneByUsername.get(r.bienTapUsername)) || phoneByName.get(r.bienTap);
                return `${r.bienTap}${phone ? ` · ☎ ${phone}` : ""}`;
              })() : "—"}</td></tr>
              {r.quayPhim ? <tr><th>Quay phim</th><td>{r.quayPhim}</td></tr> : null}
              <tr><th>Nội dung</th><td>{r.noiDung}</td></tr>
            </tbody>
          </table>

          {r.status === STATUS.DA_DIEU_XE ? (
            <form method="post" action={`/chuyen/${r.id}/bat-dau`}>
              <div class="row">
                <div>
                  <label>Số km lúc xuất bến *</label>
                  <input name="odoStart" inputmode="numeric" value={r.currentOdometer || ""} required />
                </div>
                <div>
                  <label>Giờ xuất bến</label>
                  <input type="datetime-local" name="gioXuatBen" value={toDatetimeLocal(r.startTime)} />
                </div>
              </div>
              <div style="margin-top:10px"><button class="ok">Bắt đầu chuyến</button></div>
            </form>
          ) : (
            <form method="post" action={`/chuyen/${r.id}/ket-thuc`}>
              <p class="muted">Đã đi lúc {fmtDateTime(r.gioXuatBen)} · km đầu {vi(r.odoStart)}</p>
              <div class="row">
                <div>
                  <label>Số km lúc về *</label>
                  <input name="odoEnd" inputmode="numeric" required />
                </div>
                <div>
                  <label>Giờ kết thúc</label>
                  <input type="datetime-local" name="gioKetThuc" />
                </div>
              </div>
              <label>Ghi chú</label>
              <input name="ghiChuLaiXe" />
              <div style="margin-top:10px"><button class="ok">Đóng chuyến</button></div>
            </form>
          )}
        </div>
      ))}
    </Layout>,
  );
});

trips.post("/chuyen/:id/bat-dau", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();

  const row = await db
    .select({
      status: bookings.status,
      startTime: bookings.startTime,
      driverUsername: bookingDispatch.driverUsername,
      vehicleId: bookingDispatch.vehicleId,
      currentOdometer: vehicles.currentOdometer,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .where(eq(bookings.id, id))
    .limit(1);
  const bk = row[0];
  if (!bk || (bk.driverUsername !== s.username && !isDoiXe(s)))
    return c.text("Không có quyền.", 403);
  if (bk.status !== STATUS.DA_DIEU_XE) return c.text("Chuyến không ở trạng thái 'Đã điều xe'.", 409);

  const odoStart = intOrNull(f.get("odoStart"));
  if (odoStart == null) return c.text("Nhập số km lúc xuất bến.", 400);

  const [openOther] = await db
    .select({ code: bookings.code })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(bookings.status, STATUS.DANG_CHAY),
        ne(bookings.id, id),
        eq(bookingDispatch.vehicleId, bk.vehicleId),
        isNull(bookingDispatch.deletedAt),
      ),
    )
    .limit(1);
  if (openOther)
    return c.redirect(`/chuyen-cua-toi?warn=${encodeURIComponent(`Xe đang có chuyến chưa đóng (${openOther.code}). Đóng chuyến đó trước.`)}`);

  const gioRaw = String(f.get("gioXuatBen") ?? "");
  const gioXuatBen = gioRaw ? fromDatetimeLocal(gioRaw) : bk.startTime;

  await db
    .insert(tripLogs)
    .values({ bookingId: id, driverUsername: bk.driverUsername, odoStart, gioXuatBen, updatedBy: s.username })
    .onConflictDoUpdate({
      target: tripLogs.bookingId,
      set: { odoStart, gioXuatBen, updatedBy: s.username, deletedAt: null },
    });
  await db.update(bookings).set({ status: STATUS.DANG_CHAY, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
  await db.insert(odometerEvents).values({ vehicleId: bk.vehicleId, bookingId: id, loai: "start", odoValue: odoStart, byUsername: s.username });

  const warn =
    bk.currentOdometer > 0 && odoStart !== bk.currentOdometer
      ? `Số km nhập (${vi(odoStart)}) khác số hệ thống ghi cho xe (${vi(bk.currentOdometer)}).`
      : "";
  return c.redirect(`/chuyen-cua-toi?ok=${encodeURIComponent("Đã bắt đầu chuyến.")}${warn ? `&warn=${encodeURIComponent(warn)}` : ""}`);
});

trips.post("/chuyen/:id/ket-thuc", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();

  const row = await db
    .select({
      status: bookings.status,
      driverUsername: bookingDispatch.driverUsername,
      vehicleId: bookingDispatch.vehicleId,
      odoStart: tripLogs.odoStart,
      gioXuatBen: tripLogs.gioXuatBen,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .leftJoin(tripLogs, eq(tripLogs.bookingId, bookings.id))
    .where(eq(bookings.id, id))
    .limit(1);
  const bk = row[0];
  if (!bk || (bk.driverUsername !== s.username && !isDoiXe(s))) return c.text("Không có quyền.", 403);
  if (bk.status !== STATUS.DANG_CHAY) return c.text("Chuyến không ở trạng thái 'Đang chạy'.", 409);
  if (bk.odoStart == null) return c.text("Chưa có số km lúc đi.", 409);

  const odoEnd = intOrNull(f.get("odoEnd"));
  if (odoEnd == null) return c.text("Nhập số km lúc về.", 400);
  if (odoEnd < bk.odoStart)
    return c.redirect(`/chuyen-cua-toi?warn=${encodeURIComponent(`Số km về (${vi(odoEnd)}) phải ≥ km đi (${vi(bk.odoStart)}).`)}`);

  const soKm = odoEnd - bk.odoStart;
  const gioRaw = String(f.get("gioKetThuc") ?? "");
  const gioKetThuc = gioRaw ? fromDatetimeLocal(gioRaw) : new Date();

  await db
    .update(tripLogs)
    .set({ odoEnd, gioKetThuc, soKm, ghiChuLaiXe: str(f.get("ghiChuLaiXe")), daDongChuyen: true, updatedBy: s.username })
    .where(eq(tripLogs.bookingId, id));
  await db.update(bookings).set({ status: STATUS.HOAN_THANH, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
  await db.update(vehicles).set({ currentOdometer: odoEnd, updatedAt: new Date(), updatedBy: s.username }).where(eq(vehicles.id, bk.vehicleId));
  await db.insert(odometerEvents).values({ vehicleId: bk.vehicleId, bookingId: id, loai: "end", odoValue: odoEnd, byUsername: s.username });

  let warn = "";
  if (soKm > KM_DAILY_WARN) warn = `Quãng đường ${vi(soKm)} km vượt ngưỡng ${vi(KM_DAILY_WARN)} km.`;
  if (bk.gioXuatBen && gioKetThuc <= bk.gioXuatBen)
    warn = `${warn} Giờ kết thúc không sau giờ xuất bến — đã lưu, nên kiểm tra lại.`.trim();
  return c.redirect(
    `/chuyen-cua-toi?ok=${encodeURIComponent(`Đã đóng chuyến. Quãng đường ${vi(soKm)} km.`)}${warn ? `&warn=${encodeURIComponent(warn)}` : ""}`,
  );
});
