import type { FC, PropsWithChildren } from "hono/jsx";
import type { Session } from "../env";
import type { Badges, OpenTrip } from "./queries";
import { isAdmin, isBanLeader, isDoiXe, isLanhDaoDai, roleLabel } from "./rbac";
import { statusColor, statusLabel } from "./status";
import { fmtDateTime } from "./tz";

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
    { href: "/thong-bao", label: "Nhật ký thông báo", show: true, badge: b.thongBaoChuaDoc },
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
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Đặt xe HTV" />
        <link rel="stylesheet" href="/style.css" />
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
              <div style="display:flex;gap:8px;align-items:center">
                <button id="push-toggle" class="sec" type="button" style="padding:5px 12px;font-size:12.5px;display:none"></button>
                <form method="post" action="/logout">
                  <button class="sec" style="padding:5px 12px">Đăng xuất</button>
                </form>
              </div>
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
        <script src="/push.js" defer></script>
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
