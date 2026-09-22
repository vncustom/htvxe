import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";
import { makeDb } from "./db/client";
import { sessionMiddleware, requireAuth } from "./lib/session";
import { auth } from "./routes/auth";
import { misc } from "./routes/misc";
import { lich } from "./routes/lich";
import { booking } from "./routes/booking";
import { queues } from "./routes/queues";
import { trips } from "./routes/trips";
import { extra } from "./routes/extra";
import { admin } from "./routes/admin";
import { push } from "./routes/push";

/** Kết nối DB cho mỗi request; đóng sau khi trả lời. Tách riêng để test tích hợp
 * thay bằng 1 middleware trỏ tới DB test (xem test/helpers/testApp.ts). */
export const dbMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const { sql, db } = makeDb(c.env.DATABASE_URL);
  c.set("sql", sql);
  c.set("db", db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
};

/** Lắp toàn bộ route lên 1 app Hono. Nhận `dbMw` rời để test tích hợp gắn DB giả
 * (PGlite) mà không phải kết nối Postgres thật. */
export function createApp(dbMw: MiddlewareHandler<Env> = dbMiddleware) {
  const app = new Hono<Env>();

  app.use("*", dbMw);
  app.use("*", sessionMiddleware);

  // Công khai
  app.route("/", auth);

  // Cần đăng nhập
  app.use("/lich", requireAuth);
  app.use("/cua-toi", requireAuth);
  app.use("/thong-bao", requireAuth);
  app.use("/don/*", requireAuth);
  app.use("/chuyen-cua-toi", requireAuth);
  app.use("/chuyen/*", requireAuth);
  app.use("/duyet", requireAuth);
  app.use("/dieu-xe", requireAuth);
  app.use("/cong-to-met", requireAuth);
  app.use("/cong-to-met/*", requireAuth);
  app.use("/thong-ke", requireAuth);
  app.use("/thong-ke/*", requireAuth);
  app.use("/quan-tri", requireAuth);
  app.use("/quan-tri/*", requireAuth);
  app.use("/api/*", requireAuth);

  app.route("/", misc);
  app.route("/", lich);
  app.route("/", booking);
  app.route("/", queues);
  app.route("/", trips);
  app.route("/", extra);
  app.route("/", admin);
  app.route("/", push);

  app.onError((err, c) => {
    console.error(err);
    return c.text("Lỗi máy chủ: " + (err as Error).message, 500);
  });

  return app;
}

export default createApp();
