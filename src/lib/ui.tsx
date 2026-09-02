import type { FC, PropsWithChildren } from "hono/jsx";
import type { Session } from "../env";
import type { Badges, OpenTrip } from "./queries";
import { isAdmin, isBanLeader, isDoiXe, isLanhDaoDai, roleLabel } from "./rbac";
import { statusColor, statusLabel } from "./status";
import { fmtDateTime } from "./tz";

export const CSS = `
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#f1f5f9}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
.wrap{display:flex;min-height:100vh}
.side{width:220px;background:#0f172a;color:#cbd5e1;padding:16px 0;flex-shrink:0}
.side h1{font-size:16px;color:#fff;margin:0 16px 14px}
.side a{display:block;color:#cbd5e1;padding:9px 16px;font-size:14px}
.side a:hover{background:#1e293b;color:#fff;text-decoration:none}
.side a.on{background:#1e293b;color:#fff;border-left:3px solid #38bdf8}
.badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:#ef4444;color:#fff;font-size:11px;text-align:center;line-height:18px}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.top{background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
.top .who{font-size:13px;color:#475569}
.content{padding:20px;max-width:1000px;width:100%}
h2{margin:0 0 16px;font-size:20px}
h3{margin:20px 0 10px;font-size:16px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e2e8f0;font-size:14px}
th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f8fafc;font-weight:600}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px}
label{display:block;margin:10px 0 3px;font-size:13px;font-weight:600;color:#334155}
input,select,textarea{width:100%;padding:8px 9px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;background:#fff}
textarea{min-height:70px}
.row{display:flex;gap:12px;flex-wrap:wrap}.row>*{flex:1;min-width:180px}
button,.btn{display:inline-block;padding:9px 16px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover,.btn:hover{background:#1d4ed8;text-decoration:none}
button.sec,.btn.sec{background:#e2e8f0;color:#0f172a}
button.danger,.btn.danger{background:#dc2626}
button.ok,.btn.ok{background:#16a34a}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;color:#fff;font-size:12px;font-weight:600;white-space:nowrap}
.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:6px;margin:10px 0}
.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:6px;margin:10px 0}
.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:10px 12px;border-radius:6px;margin:10px 0}
.muted{color:#64748b;font-size:13px}
.grid7{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.day{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px;min-height:120px}
.day .dh{font-size:12px;font-weight:700;color:#475569;margin-bottom:4px}
.ev{display:block;font-size:11px;padding:3px 5px;border-radius:4px;margin-bottom:3px;color:#fff;line-height:1.3}
.banner{background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;padding:9px 20px;font-size:13px}
.banner b{color:#dc2626}
.banner a{color:#9a3412;text-decoration:underline}
@media(max-width:820px){
 .wrap{flex-direction:column}.side{width:100%;display:flex;flex-wrap:wrap;padding:8px}
 .side h1{width:100%}.side a{padding:7px 10px}.side a.on{border-left:0;border-bottom:2px solid #38bdf8}
 .grid7{grid-template-columns:1fr}.day{min-height:auto}
 button,.btn{width:100%;margin-top:6px;padding:12px}
}
@media print{.side,.top,.no-print{display:none!important}.content{max-width:none;padding:0}}
`;

type NavItem = { href: string; label: string; show: boolean; badge?: number };

export const Layout: FC<
  PropsWithChildren<{
    session: Session;
    badges: Badges;
    path: string;
    title?: string;
    openTrips?: OpenTrip[];
  }>
> = ({ session: s, badges: b, path, title, openTrips, children }) => {
  const nav: NavItem[] = [
    { href: "/lich", label: "Lịch tuần", show: true },
    { href: "/cua-toi", label: "Đơn của tôi", show: true, badge: b.donCuaToi },
    { href: "/don/moi", label: "Tạo đơn", show: true },
    { href: "/duyet", label: "Duyệt đơn", show: isBanLeader(s), badge: b.duyet },
    { href: "/dieu-xe", label: "Điều xe", show: isDoiXe(s), badge: b.dieuXe },
    { href: "/chuyen-cua-toi", label: "Chuyến của tôi", show: s.isDriver, badge: b.chuyenLaiXe },
    { href: "/cong-to-met", label: "Công-tơ-mét", show: isDoiXe(s) || isAdmin(s) },
    { href: "/thong-ke", label: "Thống kê", show: isDoiXe(s) || isAdmin(s) || isLanhDaoDai(s) },
    { href: "/thong-bao", label: "Thông báo", show: true },
    { href: "/quan-tri", label: "Quản trị", show: isAdmin(s) },
  ];
  return (
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} — Đặt xe HTV` : "Đặt xe HTV"}</title>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Đặt xe HTV" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div class="wrap">
          <nav class="side no-print">
            <h1>Đặt xe HTV</h1>
            {nav
              .filter((n) => n.show)
              .map((n) => (
                <a href={n.href} class={path === n.href ? "on" : ""}>
                  {n.label}
                  {n.badge ? <span class="badge">{n.badge}</span> : null}
                </a>
              ))}
          </nav>
          <div class="main">
            <header class="top no-print">
              <div class="who">
                <b>{s.fullName}</b> · {roleLabel(s.role)}
                {s.dsBan ? ` · ${s.dsBan}` : ""}
              </div>
              <form method="post" action="/logout">
                <button class="sec" style="padding:5px 12px">Đăng xuất</button>
              </form>
            </header>
            {openTrips && openTrips.length > 0 ? (
              <div class="banner no-print">
                Bạn có {openTrips.length} chuyến đang chạy chưa đóng:{" "}
                {openTrips.map((t, i) => (
                  <>
                    {i > 0 ? " · " : ""}
                    <a href={`/don/${t.id}`}>
                      {t.code} ({t.route}, từ {fmtDateTime(t.since)})
                    </a>
                    {t.overdue ? <b> QUÁ GIỜ</b> : null}
                  </>
                ))}
              </div>
            ) : null}
            <main class="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
};

export const StatusPill: FC<{ status: string }> = ({ status }) => (
  <span class="pill" style={`background:${statusColor(status)}`}>
    {statusLabel(status)}
  </span>
);

export const Alert: FC<{ kind?: "err" | "warn" | "ok"; msg?: string | null }> = ({ kind = "err", msg }) =>
  msg ? <div class={kind}>{msg}</div> : null;

export const vi = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("vi-VN");
