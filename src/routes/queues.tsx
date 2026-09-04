import { Hono } from "hono";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Env } from "../env";
import { bookingDispatch, bookings, users, vehicles } from "../db/schema";
import { pageCtx } from "../lib/page";
import { getOpenTrips } from "../lib/queries";
import { isBanLeader, isDoiXe } from "../lib/rbac";
import { STATUS } from "../lib/status";
import { Layout, vi } from "../lib/ui";
import { fmtDateTime } from "../lib/tz";

export const queues = new Hono<Env>();

queues.get("/duyet", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isBanLeader(s) || !s.dsBan) return c.text("Chỉ Trưởng/Phó ban duyệt đơn.", 403);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(isNull(bookings.deletedAt), eq(bookings.status, STATUS.CHO_BAN_DUYET), eq(bookings.donViYeuCau, s.dsBan)))
    .orderBy(asc(bookings.startTime));
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/duyet" title="Duyệt đơn">
      <h2>Duyệt đơn — Ban {s.dsBan} ({rows.length})</h2>
      {rows.length === 0 ? <p class="muted">Không có đơn chờ duyệt.</p> : (
        <table>
          <thead><tr><th>Mã</th><th>Thời gian</th><th>Đến</th><th>Nội dung</th><th>Người tạo</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.code}</td>
                <td>{fmtDateTime(r.startTime)}</td>
                <td>{r.diemDen}</td>
                <td>{r.noiDung}</td>
                <td>{r.requesterUsername}</td>
                <td><a class="btn" href={`/don/${r.id}`}>Xem / duyệt</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>,
  );
});

queues.get("/dieu-xe", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe.", 403);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(isNull(bookings.deletedAt), eq(bookings.status, STATUS.CHO_DOI_XE)))
    .orderBy(asc(bookings.startTime));
  const open = await getOpenTrips(db);

  const daDieu = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      startTime: bookings.startTime,
      diemXuatPhat: bookings.diemXuatPhat,
      diemDen: bookings.diemDen,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      driverName: users.fullName,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .innerJoin(users, eq(users.username, bookingDispatch.driverUsername))
    .where(and(isNull(bookings.deletedAt), eq(bookings.status, STATUS.DA_DIEU_XE), isNull(bookingDispatch.deletedAt)))
    .orderBy(asc(bookings.startTime));

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/dieu-xe" title="Điều xe">
      <h2>Điều xe</h2>
      {daDieu.length ? (
        <div class="card">
          <h3>Đã điều xe, chưa chạy ({daDieu.length})</h3>
          <table>
            <thead><tr><th>Mã</th><th>Thời gian</th><th>Hành trình</th><th>Xe</th><th>Lái xe</th><th></th></tr></thead>
            <tbody>
              {daDieu.map((r) => (
                <tr>
                  <td>{r.code}</td>
                  <td>{fmtDateTime(r.startTime)}</td>
                  <td>{r.diemXuatPhat} → {r.diemDen}</td>
                  <td>{r.vehicleName} ({r.plateNo})</td>
                  <td>{r.driverName}</td>
                  <td><a class="btn sec" href={`/don/${r.id}`}>Điều chỉnh</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {open.length ? (
        <div class="card">
          <h3>Xe đang chạy chưa đóng chuyến ({open.length})</h3>
          <table>
            <thead><tr><th>Mã</th><th>Xe</th><th>Lái xe</th><th>Từ</th><th>Giờ chạy</th><th></th></tr></thead>
            <tbody>
              {open.map((t) => (
                <tr style={t.overdue ? "background:#fef2f2" : ""}>
                  <td>{t.code}</td>
                  <td>{t.vehicleName} ({t.plateNo})</td>
                  <td>{t.driverName}</td>
                  <td>{fmtDateTime(t.since)}</td>
                  <td>{t.hours.toFixed(1)}h {t.overdue ? <b style="color:#dc2626">QUÁ GIỜ</b> : ""}</td>
                  <td><a class="btn sec" href={`/don/${t.id}`}>Xem</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h3>Chờ điều xe ({rows.length})</h3>
      {rows.length === 0 ? <p class="muted">Không có đơn chờ.</p> : (
        <table>
          <thead><tr><th>Mã</th><th>Thời gian</th><th>Hành trình</th><th>Nội dung</th><th>Số người</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.code}</td>
                <td>{fmtDateTime(r.startTime)}</td>
                <td>{r.diemXuatPhat} → {r.diemDen}</td>
                <td>{r.noiDung}</td>
                <td>{vi(r.soNguoi)}</td>
                <td><a class="btn" href={`/don/${r.id}`}>Điều xe</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>,
  );
});
