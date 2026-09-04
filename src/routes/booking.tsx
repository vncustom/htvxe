import { Hono } from "hono";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Env } from "../env";
import {
  auditLog,
  bookingApprovals,
  bookingDispatch,
  bookings,
  odometerEvents,
  tripLogs,
  users,
  vehicles,
} from "../db/schema";
import { must } from "../lib/session";
import { pageCtx } from "../lib/page";
import { getBadges, genBookingCode, loadBooking, findBusyInWindow } from "../lib/queries";
import { notify, verifyTaggedUser } from "../lib/notify";
import { STATUS } from "../lib/status";
import { canApproveFor, canCancelBooking, canEditBooking, isDoiXe, isVpDaiLeader } from "../lib/rbac";
import { fromDatetimeLocal, fmtDateTime, toDatetimeLocal } from "../lib/tz";
import { Layout, StatusPill, Alert, vi } from "../lib/ui";

export const booking = new Hono<Env>();

const str = (v: unknown): string | null => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};
const intOrNull = (v: unknown): number | null => {
  const t = String(v ?? "").trim().replace(/[.,\s]/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
};

/* ---------- Tạo đơn ---------- */

/** Ô text tự do có thể tag @username (dropdown gợi ý, xem public/mention.js). Chọn 1 người =
 * thay toàn bộ nội dung ô bằng tên người đó + ghi username vào input ẩn. */
function MentionField(props: { label: string; name: string; value?: string | null; hiddenName: string; hiddenValue?: string | null }) {
  return (
    <div>
      <label>{props.label}</label>
      <input name={props.name} value={props.value ?? ""} data-mention data-hidden={props.hiddenName} autocomplete="off" placeholder="Gõ @ để tag người dùng" />
      <input type="hidden" name={props.hiddenName} id={props.hiddenName} value={props.hiddenValue ?? ""} />
    </div>
  );
}

function CreateForm(props: { s: ReturnType<typeof must>; err?: string; v?: Record<string, string> }) {
  const v = props.v ?? {};
  const canPhatSinh = isDoiXe(props.s) || props.s.isDriver;
  return (
    <div class="card">
      <h2>Tạo đơn công tác</h2>
      <Alert msg={props.err} />
      <form method="post" action="/don">
        <div class="row">
          <div>
            <label>Bắt đầu *</label>
            <input type="datetime-local" name="startTime" value={v.startTime} min={toDatetimeLocal(new Date())} required />
          </div>
          <div>
            <label>Kết thúc (dự kiến)</label>
            <input type="datetime-local" name="endTime" value={v.endTime} />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Điểm xuất phát</label>
            <input name="diemXuatPhat" value={v.diemXuatPhat ?? "HTV"} />
          </div>
          <div>
            <label>Điểm đến *</label>
            <input name="diemDen" value={v.diemDen} required />
          </div>
        </div>
        <label>Nội dung công tác *</label>
        <textarea name="noiDung" required>{v.noiDung ?? ""}</textarea>
        <div class="row">
          <MentionField label="Biên tập" name="bienTap" value={v.bienTap} hiddenName="bienTapUsername" hiddenValue={v.bienTapUsername} />
          <MentionField label="Quay phim" name="quayPhim" value={v.quayPhim} hiddenName="quayPhimUsername" hiddenValue={v.quayPhimUsername} />
          <div>
            <label>Số người</label>
            <input name="soNguoi" type="number" min="1" value={v.soNguoi} />
          </div>
        </div>
        <label>Đơn vị yêu cầu</label>
        <input name="donViYeuCau" value={v.donViYeuCau ?? props.s.dsBan ?? ""} />
        {canPhatSinh ? (
          <label style="font-weight:400;margin-top:12px">
            <input type="checkbox" name="isPhatSinh" style="width:auto;margin-right:6px" />
            Đơn phát sinh (bỏ qua bước Ban, chuyển thẳng Đội xe)
          </label>
        ) : null}
        <div style="margin-top:16px">
          <button>Gửi đơn</button>
        </div>
      </form>
    </div>
  );
}

booking.get("/don/moi", async (c) => {
  const { s, badges, openTrips } = await pageCtx(c);
  const ngay = c.req.query("ngay") ?? "";
  const v = /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? { startTime: `${ngay}T08:00` } : undefined;
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/don/moi" title="Tạo đơn">
      <CreateForm s={s} v={v} />
    </Layout>,
  );
});

booking.post("/don", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const f = await c.req.formData();
  const raw = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])) as Record<string, string>;

  const startRaw = String(f.get("startTime") ?? "");
  const diemDen = String(f.get("diemDen") ?? "").trim();
  const noiDung = String(f.get("noiDung") ?? "").trim();
  const fail = (err: string) =>
    c.html(
      <Layout session={s} badges={{ duyet: 0, dieuXe: 0, chuyenLaiXe: 0, chuyenChuaDong: 0, donCuaToi: 0, thongBaoChuaDoc: 0 }} path="/don/moi">
        <CreateForm s={s} err={err} v={raw} />
      </Layout>,
      400,
    );

  if (!startRaw) return fail("Chọn thời gian bắt đầu.");
  if (!diemDen) return fail("Nhập địa điểm đến.");
  if (!noiDung) return fail("Nhập nội dung công tác.");

  const startTime = fromDatetimeLocal(startRaw);
  const endRaw = String(f.get("endTime") ?? "");
  const endTime = endRaw ? fromDatetimeLocal(endRaw) : null;
  if (Number.isNaN(startTime.getTime())) return fail("Thời gian bắt đầu không hợp lệ.");
  if (startTime < new Date()) return fail("Không được tạo đơn cho thời gian trong quá khứ.");
  if (endTime && endTime <= startTime) return fail("Thời gian kết thúc phải sau thời gian bắt đầu.");

  const soNguoiRaw = String(f.get("soNguoi") ?? "").trim();
  const soNguoi = soNguoiRaw ? Math.max(1, Math.trunc(Number(soNguoiRaw)) || 1) : null;
  const isPhatSinh = f.get("isPhatSinh") === "on" && (isDoiXe(s) || s.isDriver);
  const donVi = (str(f.get("donViYeuCau")) ?? s.dsBan ?? "").trim() || "(chưa rõ)";
  const code = await genBookingCode(db, startTime);

  const bienTapUsernameRaw = str(f.get("bienTapUsername"));
  const quayPhimUsernameRaw = str(f.get("quayPhimUsername"));
  const bienTapUsername = (await verifyTaggedUser(db, bienTapUsernameRaw)) ? bienTapUsernameRaw : null;
  const quayPhimUsername = (await verifyTaggedUser(db, quayPhimUsernameRaw)) ? quayPhimUsernameRaw : null;
  const bienTap = str(f.get("bienTap"));
  const quayPhim = str(f.get("quayPhim"));

  const [created] = await db
    .insert(bookings)
    .values({
      code,
      requesterUsername: s.username,
      donViYeuCau: donVi,
      startTime,
      endTime,
      diemXuatPhat: (str(f.get("diemXuatPhat")) ?? "HTV") || "HTV",
      diemDen,
      noiDung,
      bienTap,
      bienTapUsername,
      quayPhim,
      quayPhimUsername,
      soNguoi,
      isPhatSinh,
      status: isPhatSinh ? STATUS.CHO_DOI_XE : STATUS.CHO_BAN_DUYET,
      createdBy: s.username,
      updatedBy: s.username,
    })
    .returning({ id: bookings.id });

  if (bienTapUsername) {
    await notify(db, { username: bienTapUsername, bookingId: created.id, kind: "tagged", message: `Bạn được gắn thẻ Biên tập cho đơn ${code} (${diemDen})`, exclude: s.username });
  }
  if (quayPhimUsername) {
    await notify(db, { username: quayPhimUsername, bookingId: created.id, kind: "tagged", message: `Bạn được gắn thẻ Quay phim cho đơn ${code} (${diemDen})`, exclude: s.username });
  }

  return c.redirect(`/don/${created.id}`);
});

/* ---------- Chi tiết đơn ---------- */

booking.get("/don/:id", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const data = await loadBooking(db, c.req.param("id"));
  if (!data) return c.notFound();
  const { bk, requester, approval, approverName, dispatch, vehicle, driver, dispatcherName, tripLog } = data;

  const showApprove = bk.status === STATUS.CHO_BAN_DUYET && canApproveFor(s, bk.donViYeuCau);
  const showDispatch = bk.status === STATUS.CHO_DOI_XE && isDoiXe(s);
  const showRedispatch = bk.status === STATUS.DA_DIEU_XE && isDoiXe(s);
  const showCancel = canCancelBooking(s, bk);
  const showAdjust = bk.status === STATUS.HOAN_THANH && !!tripLog && isDoiXe(s);

  let driverList: { username: string; fullName: string }[] = [];
  let vehList: typeof vehicles.$inferSelect[] = [];
  let busy: Awaited<ReturnType<typeof findBusyInWindow>> = [];
  if (showDispatch || showRedispatch) {
    driverList = await db
      .select({ username: users.username, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.isDriver, true), eq(users.isActive, true), isNull(users.deletedAt)));
    vehList = await db.select().from(vehicles).where(and(eq(vehicles.isActive, true), isNull(vehicles.deletedAt)));
    busy = await findBusyInWindow(db, bk.startTime, bk.endTime, bk.id);
  }

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="" title={bk.code}>
      <h2>
        {bk.code} <StatusPill status={bk.status} />
        {bk.isPhatSinh ? <span class="pill" style="background:#7c3aed;margin-left:6px">Phát sinh</span> : null}
      </h2>

      <div class="card">
        <table>
          <tbody>
            <tr><th style="width:160px">Người tạo</th><td>{requester?.fullName} ({bk.requesterUsername}){requester?.phone ? ` · ${requester.phone}` : ""}</td></tr>
            <tr><th>Đơn vị</th><td>{bk.donViYeuCau}</td></tr>
            <tr><th>Thời gian</th><td>{fmtDateTime(bk.startTime)} → {bk.endTime ? fmtDateTime(bk.endTime) : "(chưa có)"}</td></tr>
            <tr><th>Hành trình</th><td>{bk.diemXuatPhat} → {bk.diemDen}</td></tr>
            <tr><th>Nội dung</th><td>{bk.noiDung}</td></tr>
            {bk.bienTap ? <tr><th>Biên tập</th><td>{bk.bienTap}</td></tr> : null}
            {bk.quayPhim ? <tr><th>Quay phim</th><td>{bk.quayPhim}</td></tr> : null}
            {bk.soNguoi ? <tr><th>Số người</th><td>{bk.soNguoi}</td></tr> : null}
          </tbody>
        </table>
        {canEditBooking(s, bk) ? (
          <p style="margin-top:10px">
            <a class="btn sec" href={`/don/${bk.id}/sua`}>
              {bk.status === STATUS.BAN_TU_CHOI || bk.status === STATUS.DOI_XE_TU_CHOI ? "Sửa & gửi lại" : "Sửa đơn"}
            </a>
          </p>
        ) : null}
      </div>

      {approval ? (
        <div class="card">
          <h3>Ban {approval.quyetDinh === "duyet" ? "đã duyệt" : "từ chối"}</h3>
          <p>{approverName} · {fmtDateTime(approval.decidedAt)}{approval.ghiChu ? ` · ${approval.ghiChu}` : ""}</p>
        </div>
      ) : null}

      {dispatch && vehicle && driver ? (
        <div class="card">
          <h3>Điều xe</h3>
          <p>
            Xe: <b>{vehicle.name}</b> ({vehicle.plateNo}) · Lái xe: <b>{driver.fullName}</b>
            {driver.phone ? ` · ${driver.phone}` : ""}<br />
            {dispatcherName} điều · {fmtDateTime(dispatch.dispatchedAt)}
            {dispatch.ghiChuDoiXe ? ` · ${dispatch.ghiChuDoiXe}` : ""}
          </p>
        </div>
      ) : null}

      {tripLog ? (
        <div class="card">
          <h3>Nhật ký chuyến</h3>
          <table>
            <tbody>
              <tr><th style="width:160px">Xuất bến</th><td>{fmtDateTime(tripLog.gioXuatBen)} · km {vi(tripLog.odoStart)}</td></tr>
              <tr><th>Kết thúc</th><td>{fmtDateTime(tripLog.gioKetThuc)} · km {vi(tripLog.odoEnd)}</td></tr>
              <tr><th>Quãng đường</th><td>{vi(tripLog.soKm)} km</td></tr>
              {tripLog.ghiChuLaiXe ? <tr><th>Ghi chú</th><td>{tripLog.ghiChuLaiXe}</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {showAdjust ? (
        <div class="card no-print">
          <h3>Điều chỉnh km (Đội xe)</h3>
          <p class="muted">Chuyến đã đóng — sửa ở đây sẽ ghi vào nhật ký thao tác.</p>
          <form method="post" action={`/don/${bk.id}/dieu-chinh-km`}>
            <div class="row">
              <div><label>Km lúc đi</label><input name="odoStart" inputmode="numeric" value={tripLog!.odoStart ?? ""} required /></div>
              <div><label>Km lúc về</label><input name="odoEnd" inputmode="numeric" value={tripLog!.odoEnd ?? ""} required /></div>
            </div>
            <label>Lý do điều chỉnh</label>
            <input name="lyDo" required />
            <div style="margin-top:10px"><button class="sec">Lưu điều chỉnh</button></div>
          </form>
        </div>
      ) : null}

      {showApprove ? (
        <div class="card no-print">
          <h3>Duyệt đơn (Ban {s.dsBan})</h3>
          <form method="post" action={`/don/${bk.id}/approve`}>
            <label>Ghi chú</label>
            <input name="ghiChu" />
            <div style="margin-top:12px;display:flex;gap:10px">
              <button name="decision" value="duyet" class="ok">Duyệt</button>
              <button name="decision" value="tu_choi" class="danger">Từ chối</button>
            </div>
          </form>
        </div>
      ) : null}

      {showDispatch || showRedispatch ? (
        <div class="card no-print">
          <h3>{showRedispatch ? "Điều chỉnh xe / lái xe" : "Điều xe"}</h3>
          {showRedispatch ? <p class="muted" style="margin-top:0">Tài xế chưa bắt đầu chuyến — có thể đổi xe/lái xe nếu cần. Người liên quan sẽ được báo.</p> : null}
          {busy.length ? (
            <div class="warn">
              Đang bận trong khung giờ này:
              <ul style="margin:6px 0 0">
                {busy.map((x) => (
                  <li>{x.code} · {x.vehicleName} ({x.plateNo}) · {x.driverName} · {fmtDateTime(x.startTime)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <form method="post" action={showRedispatch ? `/don/${bk.id}/dieu-chinh-dieu-xe` : `/don/${bk.id}/dispatch`}>
            <div class="row">
              <div>
                <label>Xe</label>
                <select name="vehicleId" required>
                  <option value="">— chọn xe —</option>
                  {vehList.map((v) => (
                    <option value={v.id} selected={showRedispatch && dispatch?.vehicleId === v.id}>
                      {v.name} ({v.plateNo}) · {v.seats} chỗ
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Lái xe</label>
                <select name="driverUsername" required>
                  <option value="">— chọn lái xe —</option>
                  {driverList.map((d) => (
                    <option value={d.username} selected={showRedispatch && dispatch?.driverUsername === d.username}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label>Ghi chú Đội xe</label>
            <input name="ghiChuDoiXe" value={showRedispatch ? dispatch?.ghiChuDoiXe ?? "" : ""} />
            <div style="margin-top:12px;display:flex;gap:10px">
              {showRedispatch ? (
                <button class="ok">Lưu điều chỉnh</button>
              ) : (
                <>
                  <button name="decision" value="dieu" class="ok">Điều xe</button>
                  <button name="decision" value="tu_choi" class="danger">Từ chối</button>
                </>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {showCancel ? (
        <form method="post" action={`/don/${bk.id}/cancel`} class="no-print" style="margin-top:8px"
          onsubmit="return confirm('Hủy đơn này?')">
          <button class="danger">Hủy đơn</button>
        </form>
      ) : null}
    </Layout>,
  );
});

/* ---------- Hành động vòng đời ---------- */

booking.post("/don/:id/approve", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();
  const decision = String(f.get("decision") ?? "");
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (!canApproveFor(s, bk.donViYeuCau)) return c.text("Không có quyền duyệt.", 403);
  if (bk.status !== STATUS.CHO_BAN_DUYET) return c.text("Đơn không còn chờ Ban duyệt.", 409);

  const next = decision === "duyet" ? STATUS.CHO_DOI_XE : STATUS.BAN_TU_CHOI;
  await db
    .insert(bookingApprovals)
    .values({ bookingId: id, approverUsername: s.username, quyetDinh: decision, ghiChu: str(f.get("ghiChu")), updatedBy: s.username })
    .onConflictDoUpdate({
      target: bookingApprovals.bookingId,
      set: { approverUsername: s.username, quyetDinh: decision, ghiChu: str(f.get("ghiChu")), decidedAt: new Date(), updatedBy: s.username, deletedAt: null },
    });
  await db.update(bookings).set({ status: next, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
  return c.redirect(`/don/${id}`);
});

booking.post("/don/:id/dispatch", async (c) => {
  const s = must(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe được điều xe.", 403);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (bk.status !== STATUS.CHO_DOI_XE) return c.text("Đơn không còn chờ Đội xe.", 409);

  if (String(f.get("decision") ?? "dieu") === "tu_choi") {
    await db.update(bookings).set({ status: STATUS.DOI_XE_TU_CHOI, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
    return c.redirect(`/don/${id}`);
  }
  const vehicleId = String(f.get("vehicleId") ?? "");
  const driverUsername = String(f.get("driverUsername") ?? "");
  if (!vehicleId || !driverUsername) return c.text("Chọn xe và lái xe.", 400);

  await db
    .insert(bookingDispatch)
    .values({ bookingId: id, vehicleId, driverUsername, ghiChuDoiXe: str(f.get("ghiChuDoiXe")), dispatchedBy: s.username, updatedBy: s.username })
    .onConflictDoUpdate({
      target: bookingDispatch.bookingId,
      set: { vehicleId, driverUsername, ghiChuDoiXe: str(f.get("ghiChuDoiXe")), dispatchedBy: s.username, dispatchedAt: new Date(), updatedBy: s.username, deletedAt: null },
    });
  await db.update(bookings).set({ status: STATUS.DA_DIEU_XE, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
  return c.redirect(`/don/${id}`);
});

/** Tổ trưởng/tổ phó Đội xe đổi lại xe/lái xe cho đơn đã điều nhưng tài xế chưa bắt đầu chuyến. */
booking.post("/don/:id/dieu-chinh-dieu-xe", async (c) => {
  const s = must(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe được điều chỉnh xe.", 403);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (bk.status !== STATUS.DA_DIEU_XE) return c.text("Chỉ điều chỉnh được đơn đã điều xe mà tài xế chưa bắt đầu chuyến.", 409);

  const [oldDispatch] = await db.select().from(bookingDispatch).where(eq(bookingDispatch.bookingId, id)).limit(1);
  if (!oldDispatch) return c.notFound();

  const vehicleId = String(f.get("vehicleId") ?? "");
  const driverUsername = String(f.get("driverUsername") ?? "");
  if (!vehicleId || !driverUsername) return c.text("Chọn xe và lái xe.", 400);
  const ghiChuDoiXe = str(f.get("ghiChuDoiXe"));

  const changed = vehicleId !== oldDispatch.vehicleId || driverUsername !== oldDispatch.driverUsername;
  if (changed) {
    await db
      .update(bookingDispatch)
      .set({
        vehicleId,
        driverUsername,
        ghiChuDoiXe,
        dispatchedBy: s.username,
        dispatchedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: s.username,
      })
      .where(eq(bookingDispatch.bookingId, id));

    await db.insert(auditLog).values({
      entity: "booking_dispatch",
      entityId: id,
      action: "dieu_chinh_dieu_xe",
      byUsername: s.username,
      diff: JSON.stringify({
        before: { vehicleId: oldDispatch.vehicleId, driverUsername: oldDispatch.driverUsername },
        after: { vehicleId, driverUsername },
      }),
    });

    if (driverUsername !== oldDispatch.driverUsername) {
      await notify(db, { username: oldDispatch.driverUsername, bookingId: id, kind: "redispatch_removed", message: `Bạn đã được gỡ khỏi chuyến ${bk.code}`, exclude: s.username });
      await notify(db, { username: driverUsername, bookingId: id, kind: "redispatch_assigned", message: `Bạn được phân công chuyến ${bk.code} (${bk.diemXuatPhat} → ${bk.diemDen})`, exclude: s.username });
    }
    await notify(db, { username: bk.requesterUsername, bookingId: id, kind: "redispatch", message: `Đơn ${bk.code} của bạn vừa được điều chỉnh xe/tài xế`, exclude: s.username });
    if (bk.bienTapUsername) {
      await notify(db, { username: bk.bienTapUsername, bookingId: id, kind: "redispatch", message: `Đơn ${bk.code} bạn tham gia vừa được điều chỉnh xe/tài xế`, exclude: s.username });
    }
    if (bk.quayPhimUsername) {
      await notify(db, { username: bk.quayPhimUsername, bookingId: id, kind: "redispatch", message: `Đơn ${bk.code} bạn tham gia vừa được điều chỉnh xe/tài xế`, exclude: s.username });
    }
  }

  return c.redirect(`/don/${id}`);
});

booking.post("/don/:id/cancel", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const id = c.req.param("id");
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (!canCancelBooking(s, bk)) return c.text("Không có quyền hủy đơn ở trạng thái này.", 403);
  await db.update(bookings).set({ status: STATUS.HUY, updatedAt: new Date(), updatedBy: s.username }).where(eq(bookings.id, id));
  return c.redirect(`/don/${id}`);
});

/* ---------- Sửa đơn nháp / chờ duyệt (chủ đơn) ---------- */

booking.get("/don/:id/sua", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, c.req.param("id"))).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (!canEditBooking(s, bk)) return c.text("Không sửa được đơn này.", 403);
  const isResubmit = bk.status === STATUS.BAN_TU_CHOI || bk.status === STATUS.DOI_XE_TU_CHOI;
  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="" title={`Sửa ${bk.code}`}>
      <div class="card">
        <h2>Sửa {bk.code}</h2>
        {isResubmit ? (
          <div class="warn">Đơn đã bị từ chối. Lưu lại sẽ <b>gửi lại</b> đơn để duyệt từ đầu.</div>
        ) : null}
        <form method="post" action={`/don/${bk.id}/sua`}>
          <div class="row">
            <div><label>Bắt đầu *</label><input type="datetime-local" name="startTime" value={toDatetimeLocal(bk.startTime)} min={toDatetimeLocal(new Date())} required /></div>
            <div><label>Kết thúc</label><input type="datetime-local" name="endTime" value={bk.endTime ? toDatetimeLocal(bk.endTime) : ""} /></div>
          </div>
          <div class="row">
            <div><label>Điểm xuất phát</label><input name="diemXuatPhat" value={bk.diemXuatPhat} /></div>
            <div><label>Điểm đến *</label><input name="diemDen" value={bk.diemDen} required /></div>
          </div>
          <label>Nội dung *</label>
          <textarea name="noiDung" required>{bk.noiDung}</textarea>
          <div class="row">
            <MentionField label="Biên tập" name="bienTap" value={bk.bienTap} hiddenName="bienTapUsername" hiddenValue={bk.bienTapUsername} />
            <MentionField label="Quay phim" name="quayPhim" value={bk.quayPhim} hiddenName="quayPhimUsername" hiddenValue={bk.quayPhimUsername} />
            <div><label>Số người</label><input type="number" min="1" name="soNguoi" value={bk.soNguoi ?? ""} /></div>
          </div>
          <div style="margin-top:14px"><button>{isResubmit ? "Lưu & gửi lại" : "Lưu"}</button> <a class="btn sec" href={`/don/${bk.id}`}>Thoát</a></div>
        </form>
      </div>
    </Layout>,
  );
});

booking.post("/don/:id/sua", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const id = c.req.param("id");
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return c.notFound();
  if (!canEditBooking(s, bk)) return c.text("Không sửa được đơn này.", 403);
  const f = await c.req.formData();
  const startTime = fromDatetimeLocal(String(f.get("startTime")));
  const endRaw = String(f.get("endTime") ?? "");
  if (Number.isNaN(startTime.getTime())) return c.text("Thời gian bắt đầu không hợp lệ.", 400);
  if (startTime < new Date()) return c.text("Không được đổi đơn về thời gian trong quá khứ.", 400);

  const bienTapUsernameRaw = str(f.get("bienTapUsername"));
  const quayPhimUsernameRaw = str(f.get("quayPhimUsername"));
  const bienTapUsername = (await verifyTaggedUser(db, bienTapUsernameRaw)) ? bienTapUsernameRaw : null;
  const quayPhimUsername = (await verifyTaggedUser(db, quayPhimUsernameRaw)) ? quayPhimUsernameRaw : null;

  // Đơn bị từ chối: sửa xong = gửi lại. Ban từ chối -> chờ Ban duyệt lại (xoá lượt
  // duyệt cũ); Đội xe từ chối -> quay lại hàng chờ Đội xe (giữ lượt Ban đã duyệt).
  let resetStatus: string | undefined;
  if (bk.status === STATUS.BAN_TU_CHOI) resetStatus = STATUS.CHO_BAN_DUYET;
  else if (bk.status === STATUS.DOI_XE_TU_CHOI) resetStatus = STATUS.CHO_DOI_XE;

  await db
    .update(bookings)
    .set({
      startTime,
      endTime: endRaw ? fromDatetimeLocal(endRaw) : null,
      diemXuatPhat: (str(f.get("diemXuatPhat")) ?? "HTV") || "HTV",
      diemDen: String(f.get("diemDen") ?? "").trim() || bk.diemDen,
      noiDung: String(f.get("noiDung") ?? "").trim() || bk.noiDung,
      bienTap: str(f.get("bienTap")),
      bienTapUsername,
      quayPhim: str(f.get("quayPhim")),
      quayPhimUsername,
      soNguoi: intOrNull(f.get("soNguoi")),
      ...(resetStatus ? { status: resetStatus } : {}),
      updatedAt: new Date(),
      updatedBy: s.username,
    })
    .where(eq(bookings.id, id));

  if (bk.status === STATUS.BAN_TU_CHOI) {
    await db
      .update(bookingApprovals)
      .set({ deletedAt: new Date(), updatedBy: s.username })
      .where(eq(bookingApprovals.bookingId, id));
  }

  if (bienTapUsername && bienTapUsername !== bk.bienTapUsername) {
    await notify(db, { username: bienTapUsername, bookingId: id, kind: "tagged", message: `Bạn được gắn thẻ Biên tập cho đơn ${bk.code}`, exclude: s.username });
  }
  if (quayPhimUsername && quayPhimUsername !== bk.quayPhimUsername) {
    await notify(db, { username: quayPhimUsername, bookingId: id, kind: "tagged", message: `Bạn được gắn thẻ Quay phim cho đơn ${bk.code}`, exclude: s.username });
  }
  return c.redirect(`/don/${id}`);
});

/* ---------- Đội xe điều chỉnh km chuyến đã đóng ---------- */

booking.post("/don/:id/dieu-chinh-km", async (c) => {
  const s = must(c);
  if (!isDoiXe(s)) return c.text("Chỉ Đội xe được điều chỉnh km.", 403);
  const db = c.get("db");
  const id = c.req.param("id");
  const f = await c.req.formData();

  const [row] = await db
    .select({ tripLog: tripLogs, vehicleId: bookingDispatch.vehicleId })
    .from(tripLogs)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .where(eq(tripLogs.bookingId, id))
    .limit(1);
  if (!row) return c.notFound();

  const odoStart = intOrNull(f.get("odoStart")) ?? row.tripLog.odoStart;
  const odoEnd = intOrNull(f.get("odoEnd")) ?? row.tripLog.odoEnd;
  if (odoStart == null || odoEnd == null || odoEnd < odoStart) return c.text("Số km không hợp lệ.", 400);
  const soKm = odoEnd - odoStart;
  const before = { odoStart: row.tripLog.odoStart, odoEnd: row.tripLog.odoEnd, soKm: row.tripLog.soKm };

  await db.update(tripLogs).set({ odoStart, odoEnd, soKm, updatedAt: new Date(), updatedBy: s.username }).where(eq(tripLogs.bookingId, id));
  await db.insert(auditLog).values({
    entity: "trip_log",
    entityId: id,
    action: "dieu_chinh_km",
    byUsername: s.username,
    diff: JSON.stringify({ before, after: { odoStart, odoEnd, soKm }, lyDo: str(f.get("lyDo")) }),
  });

  // Đồng bộ lại currentOdometer = km về lớn nhất trong các chuyến đã đóng của xe.
  const closed = await db
    .select({ odoEnd: tripLogs.odoEnd })
    .from(tripLogs)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, tripLogs.bookingId))
    .where(and(eq(bookingDispatch.vehicleId, row.vehicleId), eq(tripLogs.daDongChuyen, true), isNull(tripLogs.deletedAt)));
  const maxOdo = closed.reduce((m, t) => (t.odoEnd != null && t.odoEnd > m ? t.odoEnd : m), 0);
  if (maxOdo > 0) {
    await db.update(vehicles).set({ currentOdometer: maxOdo, updatedAt: new Date(), updatedBy: s.username }).where(eq(vehicles.id, row.vehicleId));
  }

  return c.redirect(`/don/${id}`);
});

