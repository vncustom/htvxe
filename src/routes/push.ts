import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { pushSubscriptions } from "../db/schema";
import { must } from "../lib/session";

export const push = new Hono<Env>();

push.get("/api/push/vapid-public-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY ?? null }));

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

push.post("/api/push/subscribe", async (c) => {
  const s = must(c);
  const db = c.get("db");
  const body = await c.req.json<SubscribeBody>();
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) return c.text("Thiếu dữ liệu subscription.", 400);

  await db
    .insert(pushSubscriptions)
    .values({
      username: s.username,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: c.req.header("user-agent") ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { username: s.username, p256dh: body.keys.p256dh, auth: body.keys.auth, lastUsedAt: new Date() },
    });
  return c.json({ ok: true });
});

push.post("/api/push/unsubscribe", async (c) => {
  must(c);
  const db = c.get("db");
  const body = await c.req.json<{ endpoint?: string }>();
  if (!body?.endpoint) return c.text("Thiếu endpoint.", 400);
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
  return c.json({ ok: true });
});
