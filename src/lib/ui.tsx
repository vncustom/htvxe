import type { FC, PropsWithChildren } from "hono/jsx";
import type { Session } from "../env";
import type { Badges, OpenTrip } from "./queries";
import { isAdmin, isBanLeader, isDoiXe, isLanhDaoDai, roleLabel } from "./rbac";
import { statusColor, statusLabel } from "./status";
import { fmtDateTime } from "./tz";

export const CSS = `
:root{
 --bg:#eef2f7;--surface:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;
 --brand:#2563eb;--brand-d:#1d4ed8;--brand-t:#38bdf8;
 --side:#0b1220;--side-2:#131c31;--side-ink:#aeb9cc;
 --radius:12px;--shadow:0 1px 2px rgba(15,23,42,.05),0 4px 12px -4px rgba(15,23,42,.12)
}
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.wrap{display:flex;min-height:100vh}
.side{width:232px;background:linear-gradient(180deg,var(--side),var(--side-2));color:var(--side-ink);padding:14px 12px 24px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{display:flex;align-items:center;gap:10px;margin:4px 4px 18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)}
.brand img{height:38px;width:auto;background:#fff;border-radius:8px;padding:4px;flex-shrink:0}
.brand span{font-size:15px;font-weight:700;color:#fff;line-height:1.25}
.side a{display:flex;align-items:center;gap:8px;color:var(--side-ink);padding:9px 12px;font-size:14px;border-radius:8px;margin:2px 0;font-weight:500;transition:background .12s,color .12s}
.side a:hover{background:rgba(255,255,255,.06);color:#fff;text-decoration:none}
.side a.on{background:var(--brand);color:#fff;box-shadow:0 6px 16px -6px rgba(37,99,235,.7)}
.badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:auto;border-radius:9px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:18px}
.side a.on .badge{background:rgba(255,255,255,.25)}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.top{background:var(--surface);border-bottom:1px solid var(--line);padding:12px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px;position:sticky;top:0;z-index:5}
.top .who{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:10px}
.top .avatar{width:32px;height:32px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
.top .who b{color:var(--ink);font-weight:650}
.content{padding:22px;max-width:1040px;width:100%}
h2{margin:0 0 18px;font-size:21px;font-weight:700;letter-spacing:-.01em}
h3{margin:22px 0 10px;font-size:15px;font-weight:700}
.pagehead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px}
.pagehead h2{margin:0}
.tablewrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.tablewrap table{border:0}
h3+table,p+table{box-shadow:var(--shadow)}
th,td{border-bottom:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:top}
tr:last-child td{border-bottom:0}
th{background:#f8fafc;font-weight:650;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
tbody tr{transition:background .1s}tbody tr:hover{background:#f8fafc}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:16px;box-shadow:var(--shadow)}
.card h3:first-child{margin-top:0}
.card table{box-shadow:none}
.card table th{background:#fbfcfe}
label{display:block;margin:12px 0 4px;font-size:12.5px;font-weight:650;color:#334155}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;background:#fff;color:var(--ink);transition:border-color .12s,box-shadow .12s}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(37,99,235,.15)}
textarea{min-height:74px;resize:vertical}
.row{display:flex;gap:14px;flex-wrap:wrap}.row>*{flex:1;min-width:190px}
button,.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 16px;border:0;border-radius:8px;background:var(--brand);color:#fff;font:inherit;font-weight:650;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.12);transition:background .12s,transform .05s,box-shadow .12s}
button:hover,.btn:hover{background:var(--brand-d);text-decoration:none;box-shadow:0 4px 12px -4px rgba(37,99,235,.6)}
button:active,.btn:active{transform:translateY(1px)}
button:focus-visible,.btn:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
button.sec,.btn.sec{background:#eef2f7;color:#1e293b;box-shadow:inset 0 0 0 1px var(--line)}
button.sec:hover,.btn.sec:hover{background:#e2e8f0}
button.danger,.btn.danger{background:#dc2626}button.danger:hover,.btn.danger:hover{background:#b91c1c}
button.ok,.btn.ok{background:#16a34a}button.ok:hover,.btn.ok:hover{background:#15803d}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;color:#fff;font-size:11.5px;font-weight:700;white-space:nowrap;box-shadow:0 1px 2px rgba(15,23,42,.15)}
.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:11px 13px;border-radius:8px;margin:10px 0}
.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:11px 13px;border-radius:8px;margin:10px 0}
.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:11px 13px;border-radius:8px;margin:10px 0}
.muted{color:var(--muted);font-size:13px}
.weeknav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.weeknav form{display:flex;gap:8px;align-items:center;margin-left:auto}
.weeknav input[type=date]{width:auto}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin-bottom:14px;font-size:12.5px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:-1px}
.top .bell{position:relative;font-size:18px;line-height:1;color:inherit}
.top .bell:hover{text-decoration:none;filter:brightness(1.15)}
.top .bell .badge{position:absolute;top:-7px;right:-9px;margin:0;min-width:16px;line-height:16px;font-size:10px;padding:0 4px}
.grid7{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.day{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px;min-height:132px;box-shadow:var(--shadow);cursor:pointer}
.day.today{border-color:var(--brand);box-shadow:0 0 0 2px rgba(37,99,235,.25),var(--shadow)}
.day:hover{background:#f8fafc}
.mention-wrap{position:relative}
.mention-drop{position:absolute;top:100%;left:0;right:0;z-index:20;margin-top:2px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);max-height:180px;overflow-y:auto}
.mention-drop div{padding:7px 11px;font-size:13.5px;cursor:pointer}
.mention-drop div:hover,.mention-drop div.active{background:#eef2f7}
.mention-drop .muted{padding:7px 11px}
.day .dh{font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between}
.day.today .dh{color:var(--brand)}
.ev{display:block;font-size:11px;padding:4px 6px;border-radius:6px;margin-bottom:4px;color:#fff;line-height:1.3;font-weight:600}
.ev:hover{text-decoration:none;filter:brightness(1.08)}
.banner{background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;padding:10px 22px;font-size:13px}
.banner b{color:#dc2626}
.banner a{color:#9a3412;text-decoration:underline;font-weight:600}
@media(max-width:820px){
 .wrap{flex-direction:column}
 .side{width:100%;height:auto;position:static;display:flex;flex-wrap:wrap;padding:10px;gap:2px}
 .brand{width:100%;margin:2px 4px 8px}
 .side a{padding:7px 10px}.side a.on{box-shadow:none}
 .badge{margin-left:6px}
 .grid7{grid-template-columns:1fr}.day{min-height:auto}
 button,.btn{width:100%;margin-top:6px;padding:12px}
 .weeknav form{margin-left:0;width:100%}
}
@media print{.side,.top,.no-print{display:none!important}.content{max-width:none;padding:0}.card,.tablewrap{box-shadow:none}}
`;

type NavItem = { href: string; label: string; show: boolean; badge?: number };

const initials = (name: string) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const Layout: FC<
  PropsWithChildren<{
    session: Session;
    badges: Badges;
    path: string;
    title?: string;
    openTrips?: OpenTrip[];
  }>
> = ({ session: s, badges: b, path, title, openTrips, children }) => {
  const notif = b.duyet + b.dieuXe + b.chuyenLaiXe + (openTrips?.length ?? 0) + b.donCuaToi + b.thongBaoChuaDoc;
  const nav: NavItem[] = [
    { href: "/lich", label: "Lịch tuần", show: true },
    { href: "/cua-toi", label: "Đơn của tôi", show: true, badge: b.donCuaToi },
    { href: "/don/moi", label: "Tạo đơn", show: true },
    { href: "/duyet", label: "Duyệt đơn", show: isBanLeader(s), badge: b.duyet },
    { href: "/dieu-xe", label: "Điều xe", show: isDoiXe(s), badge: b.dieuXe },
    { href: "/chuyen-cua-toi", label: "Chuyến của tôi", show: s.isDriver, badge: b.chuyenLaiXe },
    { href: "/thong-ke/toi", label: "Thống kê của tôi", show: s.isDriver },
    { href: "/cong-to-met", label: "Công-tơ-mét", show: isDoiXe(s) || isAdmin(s) },
    { href: "/thong-ke", label: "Thống kê", show: isDoiXe(s) || isAdmin(s) || isLanhDaoDai(s) },
    { href: "/thong-bao", label: "Thông báo", show: true, badge: b.thongBaoChuaDoc },
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
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Đặt xe HTV" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div class="wrap">
          <nav class="side no-print">
            <div class="brand">
              <img src="/logo.png" alt="Logo Đài" />
              <span>Đặt xe<br />Công tác HTV</span>
            </div>
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
                <a class="bell" href="/thong-bao" title="Thông báo" aria-label="Thông báo">
                  🔔{notif > 0 ? <span class="badge">{notif > 99 ? "99+" : notif}</span> : null}
                </a>
                <span class="avatar">{initials(s.fullName)}</span>
                <span>
                  <b>{s.fullName}</b> · {roleLabel(s.role)}
                  {s.dsBan ? ` · ${s.dsBan}` : ""}
                </span>
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
        <script src="/mention.js" defer></script>
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
