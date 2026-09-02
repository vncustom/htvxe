import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Env } from "../env";
import { bookings } from "../db/schema";
import { pageCtx } from "../lib/page";
import { Layout, StatusPill } from "../lib/ui";
import { fmtDateTime } from "../lib/tz";
import { isBanLeader, isDoiXe } from "../lib/rbac";
import { STATUS } from "../lib/status";

export const misc = new Hono<Env>();

misc.get("/", (c) => c.redirect(c.get("session") ? "/lich" : "/login"));

// Đơn của người tạo đang ở các trạng thái vừa có biến động, cần chủ đơn xem lại.
// (đúng bằng công thức badge "Đơn của tôi" trong lib/queries.ts)
const ATTN: string[] = [STATUS.BAN_TU_CHOI, STATUS.DOI_XE_TU_CHOI, STATUS.DA_DIEU_XE];
const attnReason = (status: string) =>
  status === STATUS.DA_DIEU_XE
    ? "Đã bố trí xe — xem xe & lái xe"
    : "Bị từ chối — sửa lại rồi gửi, hoặc hủy";

misc.get("/cua-toi", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(isNull(bookings.deletedAt), eq(bookings.requesterUsername, s.username)))
    .orderBy(desc(bookings.startTime))
    .limit(200);

  const attn = rows.filter((r) => ATTN.includes(r.status));
  const rest = rows.filter((r) => !ATTN.includes(r.status));
  const ordered = [...attn, ...rest];

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/cua-toi" title="Đơn của tôi">
      <h2>Đơn của tôi ({rows.length})</h2>

      {attn.length > 0 ? (
        <div class="warn">
          <b>{attn.length} đơn cần bạn xem</b> (vừa được duyệt / từ chối / điều xe):
          <ul style="margin:6px 0 0;padding-left:18px">
            {attn.map((r) => (
              <li>
                <a href={`/don/${r.id}`}>{r.code}</a> · {r.diemDen} · <StatusPill status={r.status} />{" "}
                <span class="muted">— {attnReason(r.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div class="tablewrap">
        <table>
          <thead><tr><th>Mã</th><th>Thời gian</th><th>Đến</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {ordered.map((r) => {
              const need = ATTN.includes(r.status);
              return (
                <tr style={need ? "background:#fffbeb" : ""}>
                  <td>
                    {need ? <span class="pill" style="background:#f59e0b;margin-right:6px">Cần xem</span> : null}
                    {r.code}
                  </td>
                  <td>{fmtDateTime(r.startTime)}</td>
                  <td>{r.diemDen}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td><a href={`/don/${r.id}`}>Xem</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>,
  );
});

misc.get("/thong-bao", async (c) => {
  const { s, badges: b, openTrips } = await pageCtx(c);
  const items: { text: string; href: string }[] = [];
  if (isBanLeader(s) && b.duyet) items.push({ text: `${b.duyet} đơn chờ Ban duyệt`, href: "/duyet" });
  if (isDoiXe(s) && b.dieuXe) items.push({ text: `${b.dieuXe} đơn chờ điều xe`, href: "/dieu-xe" });
  if (s.isDriver && b.chuyenLaiXe) items.push({ text: `${b.chuyenLaiXe} chuyến được phân cho bạn`, href: "/chuyen-cua-toi" });
  for (const t of openTrips) items.push({ text: `Chuyến ${t.code} đang chạy chưa đóng${t.overdue ? " — QUÁ GIỜ" : ""}`, href: `/don/${t.id}` });
  if (b.donCuaToi) items.push({ text: `${b.donCuaToi} đơn của bạn có cập nhật (duyệt / từ chối / điều xe)`, href: "/cua-toi" });

  return c.html(
    <Layout session={s} badges={b} openTrips={openTrips} path="/thong-bao" title="Thông báo">
      <h2>Thông báo</h2>
      {items.length === 0 ? <p class="muted">Không có thông báo.</p> : (
        <div class="card">
          <ul style="margin:0;padding-left:18px">
            {items.map((i) => <li style="margin:6px 0"><a href={i.href}>{i.text}</a></li>)}
          </ul>
        </div>
      )}
    </Layout>,
  );
});
