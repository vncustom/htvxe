import { Hono } from "hono";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Env } from "../env";
import type { DB } from "../db/client";
import { alertAcks, bookingDispatch, bookings, tripLogs, users, vehicles } from "../db/schema";
import { pageCtx } from "../lib/page";
import { must } from "../lib/session";
import { isAdmin, isDoiXe, isLanhDaoDai, roleLabel } from "../lib/rbac";
import { findOdoGaps, type OdoTripRow } from "../lib/odometer";
import { Layout, vi } from "../lib/ui";
import { fmtDateTime, instantFromVN, vnParts } from "../lib/tz";

export const extra = new Hono<Env>();

/* ================= Công-tơ-mét ================= */

extra.get("/cong-to-met", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isDoiXe(s) && !isAdmin(s)) return c.text("Không có quyền.", 403);
  const daxem = c.req.query("daxem") === "1";

  const vehs = await db.select().from(vehicles).where(isNull(vehicles.deletedAt)).orderBy(asc(vehicles.name));

  const trips = await db
    .select({
      vehicleId: bookingDispatch.vehicleId,
      bookingId: tripLogs.bookingId,
      code: bookings.code,
      odoStart: tripLogs.odoStart,
      odoEnd: tripLogs.odoEnd,
      soKm: tripLogs.soKm,
      gioXuatBen: tripLogs.gioXuatBen,
      gioKetThuc: tripLogs.gioKetThuc,
    })
    .from(tripLogs)
    .innerJoin(bookings, eq(bookings.id, tripLogs.bookingId))
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .where(and(isNull(tripLogs.deletedAt), eq(tripLogs.daDongChuyen, true)));

  const now = Date.now();
  const D30 = 30 * 864e5;
  const byVeh = new Map<string, OdoTripRow[]>();
  for (const t of trips) {
    const arr = byVeh.get(t.vehicleId) ?? [];
    arr.push(t);
    byVeh.set(t.vehicleId, arr);
  }

  const gaps = vehs.flatMap((v) =>
    findOdoGaps(v.id, byVeh.get(v.id) ?? []).map((g) => ({ ...g, vname: `${v.name} (${v.plateNo})` })),
  );
  const acks = await db.select().from(alertAcks).where(and(eq(alertAcks.kind, "odo_gap"), isNull(alertAcks.deletedAt)));
  const ackByRef = new Map(acks.map((a) => [a.refId, a]));
  const visible = daxem ? gaps : gaps.filter((g) => !ackByRef.has(g.nextBookingId));

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/cong-to-met" title="Công-tơ-mét">
      <h2>Công-tơ-mét</h2>
      <table>
        <thead><tr><th>Xe</th><th>Số km hiện tại</th><th>Số chuyến</th><th>Tổng km (chuyến)</th><th>km 30 ngày</th></tr></thead>
        <tbody>
          {vehs.map((v) => {
            const ts = byVeh.get(v.id) ?? [];
            const totKm = ts.reduce((a, t) => a + (t.soKm ?? 0), 0);
            const km30 = ts.filter((t) => t.gioKetThuc && now - t.gioKetThuc.getTime() < D30).reduce((a, t) => a + (t.soKm ?? 0), 0);
            return (
              <tr>
                <td><a href={`/cong-to-met/xe/${v.id}`}>{v.name} ({v.plateNo})</a></td>
                <td>{vi(v.currentOdometer)}</td>
                <td>{ts.length}</td>
                <td>{vi(totKm)}</td>
                <td>{vi(km30)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>
        Cảnh báo km chạy ngoài đơn
        {" "}
        {daxem ? <a href="/cong-to-met">(ẩn cảnh báo đã biết)</a> : <a href="/cong-to-met?daxem=1">(xem cả đã biết)</a>}
      </h3>
      {visible.length === 0 ? <p class="muted">Không có{daxem ? "" : " cảnh báo mới"}.</p> : (
        <table>
          <thead><tr><th>Xe</th><th>Chuyến trước (km về)</th><th>Chuyến sau (km đi)</th><th>Chênh (km)</th><th></th></tr></thead>
          <tbody>
            {visible.map((g) => {
              const acked = ackByRef.get(g.nextBookingId);
              return (
                <tr style={acked ? "" : "background:#fef2f2"}>
                  <td>{g.vname}</td>
                  <td>{g.prevCode} · {vi(g.prevEnd)}</td>
                  <td>{g.nextCode} · {vi(g.nextStart)}</td>
                  <td><b style={acked ? "" : "color:#dc2626"}>{vi(g.gapKm)}</b></td>
                  <td>
                    {acked ? (
                      <>
                        <span class="muted">Đã biết ({acked.ackedBy})</span>{" "}
                        <form method="post" action="/cong-to-met/unack" style="display:inline">
                          <input type="hidden" name="refId" value={g.nextBookingId} />
                          <button class="sec" style="padding:3px 8px;font-size:12px">Bỏ ẩn</button>
                        </form>
                      </>
                    ) : (
                      <form method="post" action="/cong-to-met/ack" style="display:inline">
                        <input type="hidden" name="refId" value={g.nextBookingId} />
                        <button class="sec" style="padding:3px 8px;font-size:12px">Biết rồi</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isAdmin(s) ? (
        <>
          <h3>Đặt lại số km gốc của xe</h3>
          <div class="card">
            <p class="muted" style="margin-top:0">Chỉ quản trị được đặt lại số gốc. Đội xe điều chỉnh km qua từng chuyến đã đóng.</p>
            <form method="post" action="/cong-to-met/set-odo" class="row">
              <div>
                <label>Xe</label>
                <select name="vehicleId" required>{vehs.map((v) => <option value={v.id}>{v.name} ({v.plateNo})</option>)}</select>
              </div>
              <div>
                <label>Số km</label>
                <input name="odoValue" inputmode="numeric" required />
              </div>
              <div style="display:flex;align-items:flex-end"><button>Lưu</button></div>
            </form>
          </div>
        </>
      ) : null}
    </Layout>,
  );
});

extra.post("/cong-to-met/set-odo", async (c) => {
  const s = must(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị được đặt lại số km gốc.", 403);
  const db = c.get("db");
  const f = await c.req.formData();
  const vehicleId = String(f.get("vehicleId") ?? "");
  const t = String(f.get("odoValue") ?? "").replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(t)) return c.text("Số km không hợp lệ.", 400);
  await db.update(vehicles).set({ currentOdometer: Number(t), updatedAt: new Date(), updatedBy: s.username }).where(eq(vehicles.id, vehicleId));
  return c.redirect("/cong-to-met");
});

extra.post("/cong-to-met/ack", async (c) => {
  const s = must(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe.", 403);
  const db = c.get("db");
  const f = await c.req.formData();
  const refId = String(f.get("refId") ?? "");
  if (!refId) return c.text("Thiếu refId.", 400);
  await db
    .insert(alertAcks)
    .values({ kind: "odo_gap", refId, ackedBy: s.username })
    .onConflictDoUpdate({ target: [alertAcks.kind, alertAcks.refId], set: { ackedBy: s.username, ackedAt: new Date(), deletedAt: null } });
  return c.redirect("/cong-to-met");
});

extra.post("/cong-to-met/unack", async (c) => {
  const s = must(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe.", 403);
  const db = c.get("db");
  const f = await c.req.formData();
  const refId = String(f.get("refId") ?? "");
  await db.update(alertAcks).set({ deletedAt: new Date() }).where(and(eq(alertAcks.kind, "odo_gap"), eq(alertAcks.refId, refId)));
  return c.redirect("/cong-to-met?daxem=1");
});

/** Dòng thời gian công-tơ-mét của 1 xe — tô đỏ chỗ đứt quãng. */
extra.get("/cong-to-met/xe/:id", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isDoiXe(s) && !isAdmin(s)) return c.text("Không có quyền.", 403);
  const id = c.req.param("id");
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!v) return c.notFound();

  const trips = await db
    .select({
      code: bookings.code,
      driverUsername: bookingDispatch.driverUsername,
      odoStart: tripLogs.odoStart,
      odoEnd: tripLogs.odoEnd,
      soKm: tripLogs.soKm,
      gioXuatBen: tripLogs.gioXuatBen,
      gioKetThuc: tripLogs.gioKetThuc,
    })
    .from(tripLogs)
    .innerJoin(bookings, eq(bookings.id, tripLogs.bookingId))
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .where(and(isNull(tripLogs.deletedAt), eq(bookingDispatch.vehicleId, id), eq(tripLogs.daDongChuyen, true)))
    .orderBy(asc(tripLogs.odoStart));

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/cong-to-met" title={`Công-tơ-mét ${v.name}`}>
      <h2>{v.name} ({v.plateNo}) — dòng thời gian công-tơ-mét</h2>
      <p><a href="/cong-to-met">← Danh sách xe</a></p>
      <table>
        <thead><tr><th>Chuyến</th><th>Lái xe</th><th>Xuất bến</th><th>Km đi</th><th>Km về</th><th>Km chạy</th></tr></thead>
        <tbody>
          {trips.map((t, i) => {
            const prev = trips[i - 1];
            const gap = prev && prev.odoEnd != null && t.odoStart != null ? t.odoStart - prev.odoEnd : 0;
            return (
              <>
                {gap > 1 ? (
                  <tr style="background:#fef2f2">
                    <td colspan={6}><b style="color:#dc2626">⚠ Chênh {vi(gap)} km ngoài đơn trước chuyến {t.code}</b></td>
                  </tr>
                ) : null}
                <tr>
                  <td>{t.code}</td>
                  <td>{t.driverUsername}</td>
                  <td>{fmtDateTime(t.gioXuatBen)}</td>
                  <td>{vi(t.odoStart)}</td>
                  <td>{vi(t.odoEnd)}</td>
                  <td>{vi(t.soKm)}</td>
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </Layout>,
  );
});

/* ================= Thống kê ================= */

/** Mặc định = trọn tháng hiện tại (ngày 1 -> ngày cuối tháng), giờ VN. */
function monthRange(): { tu: string; den: string } {
  const p = vnParts(new Date());
  const mm = String(p.month).padStart(2, "0");
  const lastDay = new Date(p.year, p.month, 0).getDate();
  return { tu: `${p.year}-${mm}-01`, den: `${p.year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

async function statRows(db: DB, from: Date, to: Date) {
  return db
    .select({
      driver: bookingDispatch.driverUsername,
      driverName: users.fullName,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      soKm: tripLogs.soKm,
      gioXuatBen: tripLogs.gioXuatBen,
      gioKetThuc: tripLogs.gioKetThuc,
      isPhatSinh: bookings.isPhatSinh,
    })
    .from(tripLogs)
    .innerJoin(bookings, eq(bookings.id, tripLogs.bookingId))
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .innerJoin(users, eq(users.username, bookingDispatch.driverUsername))
    .where(and(isNull(tripLogs.deletedAt), eq(tripLogs.daDongChuyen, true), gte(tripLogs.gioKetThuc, from), lte(tripLogs.gioKetThuc, to)));
}

extra.get("/thong-ke", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isDoiXe(s) && !isAdmin(s) && !isLanhDaoDai(s)) return c.text("Không có quyền.", 403);
  const def = monthRange();
  const tu = c.req.query("tu") || def.tu;
  const den = c.req.query("den") || def.den;
  const rows = await statRows(db, instantFromVN(tu, "00:00"), instantFromVN(den, "23:59"));

  type Agg = { name: string; trips: number; phatSinh: number; km: number; hours: number };
  const perDriver = new Map<string, Agg>();
  const perVeh = new Map<string, { name: string; trips: number; km: number }>();
  for (const r of rows) {
    const d = perDriver.get(r.driver) ?? { name: r.driverName, trips: 0, phatSinh: 0, km: 0, hours: 0 };
    d.trips++;
    if (r.isPhatSinh) d.phatSinh++;
    d.km += r.soKm ?? 0;
    if (r.gioXuatBen && r.gioKetThuc) d.hours += Math.max(0, (r.gioKetThuc.getTime() - r.gioXuatBen.getTime()) / 3.6e6);
    perDriver.set(r.driver, d);

    const key = r.plateNo;
    const v = perVeh.get(key) ?? { name: `${r.vehicleName} (${r.plateNo})`, trips: 0, km: 0 };
    v.trips++;
    v.km += r.soKm ?? 0;
    perVeh.set(key, v);
  }

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/thong-ke" title="Thống kê">
      <h2>Thống kê</h2>
      <form class="row no-print" method="get" style="margin-bottom:14px">
        <div><label>Từ ngày</label><input type="date" name="tu" value={tu} /></div>
        <div><label>Đến ngày</label><input type="date" name="den" value={den} /></div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <button>Xem</button>
          <a class="btn sec" href={`/thong-ke/export?loai=lai-xe&tu=${tu}&den=${den}`}>CSV lái xe</a>
          <a class="btn sec" href={`/thong-ke/export?loai=xe&tu=${tu}&den=${den}`}>CSV xe</a>
        </div>
      </form>

      <h3>Theo lái xe</h3>
      <table>
        <thead><tr><th>Lái xe</th><th>Chuyến</th><th>Phát sinh</th><th>Tổng km</th><th>Giờ chạy</th><th></th></tr></thead>
        <tbody>
          {[...perDriver.entries()].sort((a, b) => b[1].km - a[1].km).map(([username, d]) => (
            <tr>
              <td>{d.name}</td><td>{d.trips}</td><td>{d.phatSinh}</td><td>{vi(d.km)}</td><td>{d.hours.toFixed(1)}</td>
              <td><a href={`/thong-ke/lai-xe/${username}?tu=${tu}&den=${den}`}>Chi tiết</a></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Theo xe</h3>
      <table>
        <thead><tr><th>Xe</th><th>Chuyến</th><th>Tổng km</th></tr></thead>
        <tbody>
          {[...perVeh.values()].sort((a, b) => b.km - a.km).map((v) => (
            <tr><td>{v.name}</td><td>{v.trips}</td><td>{vi(v.km)}</td></tr>
          ))}
        </tbody>
      </table>
    </Layout>,
  );
});

/** Lối tắt cho lái xe: xem thống kê của chính mình. */
extra.get("/thong-ke/toi", (c) => {
  const s = must(c);
  if (!s.isDriver) return c.text("Trang dành cho lái xe.", 403);
  return c.redirect(`/thong-ke/lai-xe/${encodeURIComponent(s.username)}`);
});

extra.get("/thong-ke/lai-xe/:username", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const username = c.req.param("username");
  const priv = isDoiXe(s) || isAdmin(s) || isLanhDaoDai(s);
  const self = s.isDriver && s.username === username;
  if (!priv && !self) return c.text("Không có quyền.", 403);
  const [driver] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!driver) return c.notFound();
  const def = monthRange();
  const tu = c.req.query("tu") || def.tu;
  const den = c.req.query("den") || def.den;

  const rows = await db
    .select({
      code: bookings.code,
      diemDen: bookings.diemDen,
      isPhatSinh: bookings.isPhatSinh,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      odoStart: tripLogs.odoStart,
      odoEnd: tripLogs.odoEnd,
      soKm: tripLogs.soKm,
      gioXuatBen: tripLogs.gioXuatBen,
      gioKetThuc: tripLogs.gioKetThuc,
    })
    .from(tripLogs)
    .innerJoin(bookings, eq(bookings.id, tripLogs.bookingId))
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .where(
      and(
        isNull(tripLogs.deletedAt),
        eq(bookingDispatch.driverUsername, username),
        eq(tripLogs.daDongChuyen, true),
        gte(tripLogs.gioKetThuc, instantFromVN(tu, "00:00")),
        lte(tripLogs.gioKetThuc, instantFromVN(den, "23:59")),
      ),
    )
    .orderBy(asc(tripLogs.gioXuatBen));

  const totalKm = rows.reduce((a, r) => a + (r.soKm ?? 0), 0);
  const totalHours = rows.reduce(
    (a, r) => a + (r.gioXuatBen && r.gioKetThuc ? Math.max(0, (r.gioKetThuc.getTime() - r.gioXuatBen.getTime()) / 3.6e6) : 0),
    0,
  );

  const phatSinh = rows.filter((r) => r.isPhatSinh).length;

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path={self && !priv ? "/thong-ke/toi" : "/thong-ke"} title={`Thống kê ${driver.fullName}`}>
      <div class="pagehead">
        <h2>{self && !priv ? "Thống kê của tôi" : `${driver.fullName} (${driver.username})`}</h2>
        {priv ? <a class="btn sec" href={`/thong-ke?tu=${tu}&den=${den}`}>← Thống kê chung</a> : null}
      </div>

      <form class="weeknav no-print" method="get" action={`/thong-ke/lai-xe/${encodeURIComponent(username)}`}>
        <div><label style="margin:0">Từ ngày</label><input type="date" name="tu" value={tu} /></div>
        <div><label style="margin:0">Đến ngày</label><input type="date" name="den" value={den} /></div>
        <button>Xem</button>
      </form>

      <div class="card">
        <p style="margin:0">
          <b>{tu}</b> → <b>{den}</b>
        </p>
        <p style="margin:8px 0 0;font-size:16px">
          <b>{rows.length}</b> chuyến{phatSinh ? ` (${phatSinh} phát sinh)` : ""} ·{" "}
          <b>{vi(totalKm)}</b> km · <b>{totalHours.toFixed(1)}</b> giờ chạy
        </p>
      </div>

      {rows.length === 0 ? (
        <p class="muted">Chưa có chuyến nào đã đóng trong khoảng này.</p>
      ) : (
        <div class="tablewrap">
          <table>
            <thead><tr><th>Chuyến</th><th>Đến</th><th>Xe</th><th>Xuất bến</th><th>Về</th><th>Km</th><th>Công-tơ-mét</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td>{r.code}{r.isPhatSinh ? " (PS)" : ""}</td>
                  <td>{r.diemDen}</td>
                  <td>{r.vehicleName} ({r.plateNo})</td>
                  <td>{fmtDateTime(r.gioXuatBen)}</td>
                  <td>{fmtDateTime(r.gioKetThuc)}</td>
                  <td>{vi(r.soKm)}</td>
                  <td>{vi(r.odoStart)} → {vi(r.odoEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>,
  );
});

extra.get("/thong-ke/export", async (c) => {
  const { s, db } = await pageCtx(c);
  if (!isDoiXe(s) && !isAdmin(s) && !isLanhDaoDai(s)) return c.text("Không có quyền.", 403);
  const loai = c.req.query("loai") === "xe" ? "xe" : "lai-xe";
  const def = monthRange();
  const rows = await statRows(db, instantFromVN(c.req.query("tu") || def.tu, "00:00"), instantFromVN(c.req.query("den") || def.den, "23:59"));

  const map = new Map<string, { name: string; trips: number; km: number; hours: number }>();
  for (const r of rows) {
    const key = loai === "xe" ? r.plateNo : r.driverName;
    const name = loai === "xe" ? `${r.vehicleName} (${r.plateNo})` : r.driverName;
    const m = map.get(key) ?? { name, trips: 0, km: 0, hours: 0 };
    m.trips++;
    m.km += r.soKm ?? 0;
    if (r.gioXuatBen && r.gioKetThuc) m.hours += Math.max(0, (r.gioKetThuc.getTime() - r.gioXuatBen.getTime()) / 3.6e6);
    map.set(key, m);
  }
  const head = loai === "xe" ? "Xe,Số chuyến,Tổng km" : "Lái xe,Số chuyến,Tổng km,Giờ chạy";
  const lines = [head];
  for (const m of map.values()) {
    lines.push(loai === "xe" ? `"${m.name}",${m.trips},${m.km}` : `"${m.name}",${m.trips},${m.km},${m.hours.toFixed(1)}`);
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="thongke-${loai}.csv"` },
  });
});

/* ================= Quản trị ================= */

extra.get("/quan-tri", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  if (!isAdmin(s)) return c.text("Chỉ quản trị.", 403);
  const us = await db.select().from(users).where(isNull(users.deletedAt)).orderBy(asc(users.username)).limit(1000);
  const vs = await db.select().from(vehicles).where(isNull(vehicles.deletedAt)).orderBy(asc(vehicles.name));

  const dupNames = us.filter((u) => u.fullName.trim().toLowerCase() === u.username.trim().toLowerCase());
  const banSet = new Map<string, { td: number; pd: number }>();
  for (const u of us) {
    if (!u.dsBan) continue;
    const e = banSet.get(u.dsBan) ?? { td: 0, pd: 0 };
    if (u.role === "truong_ban") e.td++;
    if (u.role === "pho_ban") e.pd++;
    banSet.set(u.dsBan, e);
  }
  const thieuLanhDao = [...banSet.entries()].filter(([, v]) => v.td === 0 || v.pd === 0);

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/quan-tri" title="Quản trị">
      <h2>Quản trị</h2>

      <div class="card">
        <h3>Chất lượng dữ liệu</h3>
        <p>Tên trùng username: <b>{dupNames.length}</b></p>
        <p>Đơn vị thiếu Trưởng hoặc Phó ban: <b>{thieuLanhDao.length}</b>
          {thieuLanhDao.length ? ` — ${thieuLanhDao.map(([b]) => b).join(", ")}` : ""}</p>
      </div>

      <h3>Xe ({vs.length}) — <a class="btn sec" style="font-size:13px;padding:4px 10px" href="/quan-tri/xe/moi">+ Thêm xe</a></h3>
      <table>
        <thead><tr><th>Tên</th><th>Biển số</th><th>Chỗ</th><th>Số km</th><th>Hoạt động</th><th></th></tr></thead>
        <tbody>
          {vs.map((v) => (
            <tr>
              <td>{v.name}</td><td>{v.plateNo}</td><td>{v.seats}</td><td>{vi(v.currentOdometer)}</td><td>{v.isActive ? "✓" : "—"}</td>
              <td><a href={`/quan-tri/xe/${v.id}`}>Sửa</a></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Người dùng ({us.length}) — <a class="btn sec" style="font-size:13px;padding:4px 10px" href="/quan-tri/user/moi">+ Thêm user</a></h3>
      <table>
        <thead><tr><th>Username</th><th>Họ tên</th><th>Vai trò</th><th>Đơn vị</th><th>Lái xe</th><th>Hoạt động</th><th></th></tr></thead>
        <tbody>
          {us.slice(0, 500).map((u) => (
            <tr>
              <td>{u.username}</td><td>{u.fullName}</td><td>{roleLabel(u.role)}</td><td>{u.dsBan ?? ""}</td>
              <td>{u.isDriver ? "✓" : ""}</td><td>{u.isActive ? "✓" : "—"}</td>
              <td><a href={`/quan-tri/user/${u.username}`}>Sửa</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>,
  );
});

