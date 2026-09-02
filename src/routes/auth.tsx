import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { users } from "../db/schema";
import { verifyPassword } from "../lib/password";
import { CSS } from "../lib/ui";
import { issueSession, clearSession } from "../lib/session";

export const auth = new Hono<Env>();

const LoginPage = (props: { err?: string }) => (
  <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Đăng nhập — Đặt xe HTV</title>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </head>
    <body>
      <div style="max-width:360px;margin:10vh auto;padding:0 16px">
        <div style="text-align:center;margin-bottom:14px">
          <img src="/logo.png" alt="Logo Đài" style="height:64px;width:auto" />
        </div>
        <h2 style="text-align:center">Đặt xe Công tác HTV</h2>
        <form method="post" action="/login" class="card">
          {props.err ? <div class="err">{props.err}</div> : null}
          <label>Tên đăng nhập</label>
          <input name="username" autofocus required />
          <label>Mật khẩu</label>
          <input name="password" type="password" required />
          <button style="width:100%;margin-top:16px">Đăng nhập</button>
        </form>
        <p class="muted" style="text-align:center">Mật khẩu mặc định: 123456</p>
      </div>
    </body>
  </html>
);

auth.get("/login", (c) => {
  if (c.get("session")) return c.redirect("/lich");
  return c.html(<LoginPage />);
});

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

auth.post("/logout", (c) => {
  clearSession(c);
  return c.redirect("/login");
});
