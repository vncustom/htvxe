import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "../db/client";
import { notifications, users } from "../db/schema";

/** Ghi 1 thông báo cho `username`, bỏ qua nếu rỗng hoặc trùng người đang thao tác (`exclude`). */
export async function notify(
  db: DB,
  args: { username: string | null | undefined; bookingId?: string; kind: string; message: string; exclude?: string },
): Promise<void> {
  const { username, bookingId, kind, message, exclude } = args;
  if (!username || username === exclude) return;
  await db.insert(notifications).values({ username, bookingId, kind, message });
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
