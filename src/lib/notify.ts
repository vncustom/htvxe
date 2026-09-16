import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import type { DB } from "../db/client";
import type { Env } from "../env";
import { notifications, users } from "../db/schema";
import { sendPush } from "./push";
import { sendGmail } from "./gmail";

/** Ghi 1 thông báo cho `username` (bỏ qua nếu rỗng hoặc trùng người đang thao tác `exclude`),
 * đẩy Web Push tới điện thoại/máy đã subscribe và gửi email (nếu có) — cả hai chạy nền, không chặn response. */
export async function notify(
  c: Context<Env>,
  args: { username: string | null | undefined; bookingId?: string; kind: string; message: string; exclude?: string },
): Promise<void> {
  const { username, bookingId, kind, message, exclude } = args;
  if (!username || username === exclude) return;
  const db = c.get("db");
  await db.insert(notifications).values({ username, bookingId, kind, message });
  const path = bookingId ? `/don/${bookingId}` : "/thong-bao";
  c.executionCtx.waitUntil(sendPush(c, username, { title: "Đặt xe HTV", body: message, url: path }));

  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.username, username)).limit(1);
  if (u?.email) {
    const link = `${new URL(c.req.url).origin}${path}`;
    c.executionCtx.waitUntil(
      sendGmail(c, { to: u.email, subject: "Đặt xe HTV — " + message, body: `${message}\n\nXem chi tiết: ${link}` }),
    );
  }
}

/** Gửi cùng 1 thông báo tới nhiều user (ví dụ mọi Trưởng/Phó ban của 1 đơn vị). */
export async function notifyMany(
  c: Context<Env>,
  args: { usernames: (string | null | undefined)[]; bookingId?: string; kind: string; message: string; exclude?: string },
): Promise<void> {
  const { usernames, ...rest } = args;
  await Promise.all([...new Set(usernames)].map((username) => notify(c, { username, ...rest })));
}

/** Kiểm tra username được tag có phải user thật (active, chưa xoá) — trả về họ tên hoặc null. */
export async function verifyTaggedUser(db: DB, username: string | null | undefined): Promise<string | null> {
  if (!username) return null;
  const [u] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(and(eq(users.username, username), eq(users.isActive, true), isNull(users.deletedAt)))
    .limit(1);
  return u?.fullName ?? null;
}
