import { buildPushPayload, type PushSubscription as WebPushSubscription } from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Env } from "../env";
import { pushSubscriptions } from "../db/schema";

export type PushPayload = { title: string; body: string; url?: string };

/** Gửi Web Push tới mọi thiết bị đã subscribe của 1 user. Không throw — lỗi từng
 * thiết bị chỉ log, không chặn luồng chính. Thiết bị đã gỡ (404/410) sẽ bị xoá. */
export async function sendPush(c: Context<Env>, username: string, payload: PushPayload): Promise<void> {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = c.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const db = c.get("db");
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.username, username));
  if (!subs.length) return;

  const vapid = { subject: VAPID_SUBJECT || "mailto:admin@example.com", publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  const message = { data: JSON.stringify(payload), options: { ttl: 3600, urgency: "high" as const } };

  await Promise.all(
    subs.map(async (sub) => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        const req = await buildPushPayload(message, subscription, vapid);
        const res = await fetch(sub.endpoint, req);
        if (res.status === 404 || res.status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      } catch (err) {
        console.error("Gửi web push lỗi", sub.endpoint, err);
      }
    }),
  );
}

/** Gửi push tới nhiều user cùng lúc (ví dụ: mọi Trưởng/Phó ban của 1 đơn vị). */
export async function sendPushToMany(c: Context<Env>, usernames: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(usernames.filter(Boolean))];
  await Promise.all(unique.map((u) => sendPush(c, u, payload)));
}
