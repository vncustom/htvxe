import type { Context } from "hono";
import type { Env } from "../env";

/** Access token Gmail API cache theo isolate (Worker có thể tái sử dụng giữa các request). */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(env: Env["Bindings"]): Promise<string | null> {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Lấy access token Gmail lỗi", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function encodeSubject(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  return `=?UTF-8?B?${bytesToBase64(bytes)}?=`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function toBase64Url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gửi 1 email qua Gmail API (tài khoản Gmail đã cấp OAuth2 refresh token).
 * Không throw — lỗi chỉ log, không chặn luồng chính. Bỏ qua êm nếu chưa cấu hình secrets. */
export async function sendGmail(
  c: Context<Env>,
  args: { to: string; subject: string; body: string },
): Promise<void> {
  const { to, subject, body } = args;
  const token = await getAccessToken(c.env);
  if (!token) return;

  const from = c.env.GMAIL_SENDER || "me";
  const bodyB64 = bytesToBase64(new TextEncoder().encode(body)).replace(/(.{76})/g, "$1\r\n");
  const raw =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encodeSubject(subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    bodyB64;

  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    });
    if (!res.ok) console.error("Gửi Gmail lỗi", res.status, await res.text());
  } catch (err) {
    console.error("Gửi Gmail lỗi", to, err);
  }
}
