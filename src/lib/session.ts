import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { Env, Session } from "../env";

export const SESSION_COOKIE = "htvxe_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

export async function issueSession(c: Context<Env>, s: Session): Promise<void> {
  const token = await sign(
    { ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE },
    c.env.AUTH_SECRET,
    "HS256",
  );
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession(c: Context<Env>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** Đọc cookie -> gắn c.get("session"). Không chặn (để trang login qua được). */
export const sessionMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  let session: Session | null = null;
  if (token) {
    try {
      const p = (await verify(token, c.env.AUTH_SECRET, "HS256")) as unknown as Session;
      session = {
        username: p.username,
        fullName: p.fullName,
        role: p.role,
        isDriver: !!p.isDriver,
        dsBan: p.dsBan ?? null,
      };
    } catch {
      session = null;
    }
  }
  c.set("session", session);
  await next();
};

/** Chặn route cần đăng nhập. */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  if (!c.get("session")) return c.redirect("/login");
  await next();
};

export function must(c: Context<Env>): Session {
  const s = c.get("session");
  if (!s) throw new Error("Chưa đăng nhập");
  return s;
}
