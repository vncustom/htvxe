import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { users } from "../db/schema";
import { verifyPassword } from "../lib/password";
import { CSS } from "../lib/ui";
import { issueSession, clearSession } from "../lib/session";
import { verifySsoJwt, extractSsoUsername, getSsoLoginUrl, DEFAULT_SSO_SERVER } from "../lib/sso";

export const auth = new Hono<Env>();

const LoginPage = (props: { err?: string; info?: string }) => (
  <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Đăng nhập — Đặt xe HTV</title>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .auth-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background: #f8fafc;
        }
        .auth-brand {
          text-align: center;
          margin-bottom: 20px;
        }
        .auth-brand img {
          height: 56px;
          width: auto;
          margin-bottom: 8px;
        }
        .auth-brand h1 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .auth-card {
          width: 100%;
          max-width: 380px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .auth-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }
        .auth-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .auth-close {
          color: #94a3b8;
          font-size: 18px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          text-decoration: none;
        }
        .auth-close:hover {
          color: #475569;
          background: #f1f5f9;
        }
        .auth-body {
          padding: 22px 20px 24px;
        }
        .btn-sso {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff !important;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none !important;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .btn-sso:hover {
          background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          transform: translateY(-1px);
        }
        .btn-sso svg {
          flex-shrink: 0;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          margin: 20px 0 18px;
          text-align: center;
        }
        .auth-divider::before, .auth-divider::after {
          content: "";
          flex: 1;
          border-bottom: 1px solid #e2e8f0;
        }
        .auth-divider span {
          padding: 0 12px;
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
        }
        .auth-form label {
          display: block;
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #475569;
          text-transform: uppercase;
        }
        .auth-form input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
          color: #0f172a;
        }
        .auth-form input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
        .btn-submit {
          width: 100%;
          padding: 11px 16px;
          border-radius: 8px;
          background: #4f46e5;
          color: #fff;
          border: none;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2);
          transition: all 0.15s ease;
        }
        .btn-submit:hover {
          background: #4338ca;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        .auth-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13.5px;
          line-height: 1.4;
        }
        .auth-info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13.5px;
          line-height: 1.4;
        }
      `,
        }}
      />
    </head>
    <body>
      <div class="auth-wrapper">
        <div class="auth-brand">
          <img src="/logo.png" alt="Logo HTV" />
          <h1>Đặt xe Công tác HTV</h1>
        </div>

        <div class="auth-card">
          <div class="auth-header">
            <span class="auth-title">Đăng nhập</span>
            <a href="/login" class="auth-close" title="Làm mới">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </a>
          </div>

          <div class="auth-body">
            {props.err ? <div class="auth-alert">{props.err}</div> : null}
            {props.info ? <div class="auth-info">{props.info}</div> : null}

            {/* Nút Đăng nhập bằng HTV SSO */}
            <a href="/auth/sso" class="btn-sso" id="btn-htv-sso">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Đăng nhập bằng HTV SSO</span>
            </a>

            {/* Phân cách hoặc đăng nhập nội bộ */}
            <div class="auth-divider">
              <span>hoặc đăng nhập nội bộ</span>
            </div>

            {/* Form đăng nhập nội bộ */}
            <form method="post" action="/login" class="auth-form">
              <label>Tên đăng nhập</label>
              <input name="username" placeholder="admin" autofocus required />

              <label>Mật khẩu</label>
              <input name="password" type="password" placeholder="••••••" required />

              <button type="submit" class="btn-submit">
                Đăng nhập
              </button>
            </form>
          </div>
        </div>

        <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
          Mật khẩu nội bộ mặc định: 123456
        </p>
      </div>
    </body>
  </html>
);

// Trang đăng nhập
auth.get("/login", (c) => {
  if (c.get("session")) return c.redirect("/lich");
  return c.html(<LoginPage />);
});

// Xử lý đăng nhập nội bộ
auth.post("/login", async (c) => {
  const form = await c.req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const db = c.get("db");

  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!u || !u.isActive || u.deletedAt || !(await verifyPassword(password, u.passwordHash))) {
    return c.html(<LoginPage err="Sai tên đăng nhập hoặc mật khẩu." />, 401);
  }
  await issueSession(c, {
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isDriver: u.isDriver,
    dsBan: u.dsBan,
  });
  return c.redirect("/lich");
});

// Chuyển hướng tới HTV SSO Dashboard
auth.get("/auth/sso", (c) => {
  // Callback trỏ về /api/auth/sso của app này
  const callbackUrl = new URL("/api/auth/sso", c.req.url).toString();
  const ssoUrl = getSsoLoginUrl(c.env.HTV_SSO_SERVER_URL, callbackUrl);
  return c.redirect(ssoUrl, 302);
});

// Hàm xử lý chung cho SSO Callback (nhận từ POST body hoặc GET query)
async function handleSsoCallback(c: any) {
  let token = "";

  // 1. Đọc token: ưu tiên POST body form, sau đó query param
  if (c.req.method === "POST") {
    try {
      const form = await c.req.formData();
      token = String(form.get("token") ?? "").trim();
    } catch {
      // Bỏ qua nếu body không phải form data
    }
  }
  if (!token) {
    token = String(c.req.query("token") ?? "").trim();
  }

  if (!token) {
    return c.html(
      <LoginPage err="Không tìm thấy token xác thực được gửi từ HTV SSO Dashboard." />,
      400,
    );
  }

  const ssoSecret = c.env.HTV_SSO_SECRET;
  if (!ssoSecret) {
    return c.html(
      <LoginPage err="Lỗi cấu hình hệ thống: Chưa thiết lập HTV_SSO_SECRET trên Cloudflare Worker." />,
      500,
    );
  }

  // 2. Xác thực và giải mã JWT HS256 (bù sai lệch đồng hồ 5 phút)
  const verifyResult = await verifySsoJwt(token, ssoSecret, 300);
  if (!verifyResult.valid || !verifyResult.payload) {
    return c.html(
      <LoginPage err={`Xác thực SSO thất bại: ${verifyResult.error || "Token không hợp lệ."}`} />,
      401,
    );
  }

  // 3. Trích xuất username
  const username = extractSsoUsername(verifyResult.payload);
  if (!username) {
    return c.html(
      <LoginPage err="Không thể xác định tên tài khoản (username) từ dữ liệu HTV SSO trả về." />,
      400,
    );
  }

  // 4. Đối soát user trong cơ sở dữ liệu Supabase
  const db = c.get("db");
  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!u) {
    return c.html(
      <LoginPage
        err={`Tài khoản HTV SSO '${username}' chưa được phân quyền trong hệ thống Đặt xe HTV. Vui lòng liên hệ quản trị viên.`}
      />,
      403,
    );
  }

  if (!u.isActive || u.deletedAt) {
    return c.html(
      <LoginPage err={`Tài khoản '${username}' đã bị khoá hoặc ngưng kích hoạt trong hệ thống Đặt xe HTV.`} />,
      403,
    );
  }

  // 5. Cấp phiên đăng nhập (session cookie)
  await issueSession(c, {
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isDriver: u.isDriver,
    dsBan: u.dsBan,
  });

  return c.redirect("/lich", 303);
}

// Endpoint nhận token từ HTV SSO: hỗ trợ cả GET và POST tại /api/auth/sso và /sso
auth.post("/api/auth/sso", handleSsoCallback);
auth.get("/api/auth/sso", handleSsoCallback);
auth.post("/sso", handleSsoCallback);
auth.get("/sso", handleSsoCallback);

// Đăng xuất
auth.post("/logout", (c) => {
  clearSession(c);
  return c.redirect("/login");
});
auth.get("/logout", (c) => {
  clearSession(c);
  return c.redirect("/login");
});
