import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import type { DB } from "../db/client";
import type { Env } from "../env";
import { notifications, users } from "../db/schema";
import { sendPush } from "./push";

/** Ghi 1 thông báo cho `username` (bỏ qua nếu rỗng hoặc trùng người đang thao tác `exclude`)
 * và đẩy Web Push tới điện thoại/máy đã subscribe của họ (chạy nền, không chặn response). */
export async function notify(
  c: Context<Env>,
  args: { username: string | null | undefined; bookingId?: string; kind: string; message: string; exclude?: string },
): Promise<void> {
  const { username, bookingId, kind, message, exclude } = args;
  if (!username || username === exclude) return;
  const db = c.get("db");
  await db.insert(notifications).values({ username, bookingId, kind, message });
  c.executionCtx.waitUntil(
    sendPush(c, username, { title: "Đặt xe HTV", body: message, url: bookingId ? `/don/${bookingId}` : "/thong-bao" }),
  );
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
