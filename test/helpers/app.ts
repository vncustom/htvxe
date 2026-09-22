import { sign } from "hono/jwt";
import type { ExecutionContext } from "hono";
import { createApp } from "../../src/index";
import type { Env, Session } from "../../src/env";
import type { DB } from "../../src/db/client";

export const TEST_AUTH_SECRET = "test-auth-secret";

/** Env giả cho request test — chỉ AUTH_SECRET được đọc thật (verify JWT session);
 * DATABASE_URL/VAPID/GMAIL không cần vì dbMiddleware bị thay và push/email tự no-op
 * khi thiếu cấu hình (xem lib/push.ts, lib/gmail.ts). */
export function testEnv(): Env["Bindings"] {
  return {
    DATABASE_URL: "unused-in-tests",
    AUTH_SECRET: TEST_AUTH_SECRET,
    ASSETS: {} as Env["Bindings"]["ASSETS"],
  };
}

/** `c.executionCtx.waitUntil(...)` được gọi trong dbMiddleware + notify() — Hono ném
 * lỗi nếu không truyền executionCtx cho app.request(), nên luôn cần stub này. */
export function testExecutionCtx(): ExecutionContext {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p.catch(() => {}));
    },
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
}

/** Dựng app Hono thật (toàn bộ route) nhưng gắn thẳng DB test (PGlite) thay vì mở
 * kết nối Postgres thật — đi qua đúng middleware/route/rbac production. */
export function buildTestApp(db: DB) {
  return createApp(async (c, next) => {
    c.set("db", db);
    c.set("sql", { end: async () => {} } as unknown as Env["Variables"]["sql"]);
    await next();
  });
}

/** Ký cookie session JWT giống `issueSession` (lib/session.ts) nhưng không cần Context. */
export async function sessionCookie(s: Session, secret = TEST_AUTH_SECRET): Promise<string> {
  const token = await sign({ ...s, exp: Math.floor(Date.now() / 1000) + 3600 }, secret, "HS256");
  return `htvxe_session=${token}`;
}
