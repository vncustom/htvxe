import { Hono } from "hono";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { Env } from "../env";
import { bookings, notifications, users } from "../db/schema";
import { must } from "../lib/session";
import { pageCtx } from "../lib/page";
import { Layout, StatusPill } from "../lib/ui";
import { fmtDateTime } from "../lib/tz";
import { isBanLeader, isDoiXe } from "../lib/rbac";
import { STATUS } from "../lib/status";

export const misc = new Hono<Env>();

/** Tìm user cho dropdown tag @username (Biên tập / Quay phim). */
misc.get("/api/nguoi-dung", async (c) => {
  must(c);
  const db = c.get("db");
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json([]);
  const rows = await db
    .select({ username: users.username, fullName: users.fullName })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.isActive, true),
        or(ilike(users.fullName, `%${q}%`), ilike(users.username, `%${q}%`)),
      ),
    )
    .limit(8);
  return c.json(rows);
});

misc.get("/", (c) => c.redirect(c.get("session") ? "/lich" : "/login"));

// Đơn của người tạo đang ở các trạng thái vừa có biến động, cần chủ đơn xem lại.
// (đúng bằng công thức badge "Đơn của tôi" trong lib/queries.ts)
const ATTN: string[] = [STATUS.BAN_TU_CHOI, STATUS.DOI_XE_TU_CHOI, STATUS.DA_DIEU_XE];
const attnReason = (status: string) =>
  status === STATUS.DA_DIEU_XE
    ? "Đã bố trí xe — xem xe & lái xe"
    : "Bị từ chối — sửa lại rồi gửi, hoặc hủy";

const PAGE_SIZE = 25;
type FilterKey = "mo" | "xong" | "huy" | "all";
const FILTERS: { key: FilterKey; label: string; test: (st: string) => boolean }[] = [
  { key: "mo", label: "Đang mở", test: (st) => st !== STATUS.HOAN_THANH && st !== STATUS.HUY },
  { key: "xong", label: "Hoàn thành", test: (st) => st === STATUS.HOAN_THANH },
  { key: "huy", label: "Đã hủy", test: (st) => st === STATUS.HUY },
  { key: "all", label: "Tất cả", test: () => true },
];

misc.get("/cua-toi", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(isNull(bookings.deletedAt), eq(bookings.requesterUsername, s.username)))
    .orderBy(desc(bookings.startTime))
    .limit(1000);

  const attn = rows.filter((r) => ATTN.includes(r.status));

  const loc = (c.req.query("loc") as FilterKey) || "mo";
  const f = FILTERS.find((x) => x.key === loc) ?? FILTERS[0];
  const filtered = rows
    .filter((r) => f.test(r.status))
    .sort((a, b) => (ATTN.includes(a.status) ? 0 : 1) - (ATTN.includes(b.status) ? 0 : 1));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(c.req.query("trang")) || 1));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const q = (extra: Record<string, string | number>) =>
    "/cua-toi?" + new URLSearchParams({ loc: f.key, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) }).toString();

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/cua-toi" title="Đơn của tôi">
      <h2>Đơn của tôi</h2>

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

      <div class="weeknav no-print">
        {FILTERS.map((x) => {
          const n = rows.filter((r) => x.test(r.status)).length;
          return (
            <a class={`btn ${x.key === f.key ? "" : "sec"}`} href={`/cua-toi?loc=${x.key}`}>
              {x.label} ({n})
            </a>
          );
        })}
      </div>

      <div class="tablewrap">
        <table>
          <thead><tr><th>Mã</th><th>Thời gian</th><th>Đến</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colspan={5} class="muted">Không có đơn.</td></tr>
            ) : null}
            {pageRows.map((r) => {
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

      {totalPages > 1 ? (
        <div class="weeknav no-print" style="margin-top:12px">
          {page > 1 ? <a class="btn sec" href={q({ trang: page - 1 })}>← Trước</a> : null}
          <span class="muted">Trang {page}/{totalPages} · {filtered.length} đơn</span>
          {page < totalPages ? <a class="btn sec" href={q({ trang: page + 1 })}>Sau →</a> : null}
        </div>
      ) : null}
    </Layout>,
  );
});

misc.get("/thong-bao", async (c) => {
  const { s, db, badges: b, openTrips } = await pageCtx(c);
  const items: { text: string; href: string }[] = [];
  if (isBanLeader(s) && b.duyet) items.push({ text: `${b.duyet} đơn chờ Ban duyệt`, href: "/duyet" });
  if (isDoiXe(s) && b.dieuXe) items.push({ text: `${b.dieuXe} đơn chờ điều xe`, href: "/dieu-xe" });
  if (s.isDriver && b.chuyenLaiXe) items.push({ text: `${b.chuyenLaiXe} chuyến được phân cho bạn`, href: "/chuyen-cua-toi" });
  for (const t of openTrips) items.push({ text: `Chuyến ${t.code} đang chạy chưa đóng${t.overdue ? " — QUÁ GIỜ" : ""}`, href: `/don/${t.id}` });
  if (b.donCuaToi) items.push({ text: `${b.donCuaToi} đơn của bạn có cập nhật (duyệt / từ chối / điều xe)`, href: "/cua-toi" });

  const mine = await db
    .select()
    .from(notifications)
    .where(eq(notifications.username, s.username))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  if (mine.some((n) => !n.readAt)) {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.username, s.username), isNull(notifications.readAt)));
  }

  return c.html(
    <Layout session={s} badges={b} openTrips={openTrips} path="/thong-bao" title="Thông báo">
      <h2>Thông báo</h2>
      {mine.length > 0 ? (
        <>
          <h3 style="margin-top:0">Thông báo mới</h3>
          <div class="card">
            <ul style="margin:0;padding-left:18px">
              {mine.map((n) => (
                <li style="margin:6px 0">
                  {n.bookingId ? <a href={`/don/${n.bookingId}`}>{n.message}</a> : n.message}{" "}
                  <span class="muted">· {fmtDateTime(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      {items.length === 0 ? (
        mine.length === 0 ? <p class="muted">Không có thông báo.</p> : null
      ) : (
        <div class="card">
          <ul style="margin:0;padding-left:18px">
            {items.map((i) => <li style="margin:6px 0"><a href={i.href}>{i.text}</a></li>)}
          </ul>
        </div>
      )}
    </Layout>,
  );
});
