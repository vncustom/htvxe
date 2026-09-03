// Xử lý xác thực HTV SSO Client (chuẩn tương thích htv_sso_fastapi)
export const DEFAULT_SSO_SERVER = "http://10.1.1.215";

function base64UrlDecode(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeText(str: string): string {
  const bytes = base64UrlDecode(str);
  return new TextDecoder().decode(bytes);
}

/**
 * Xác thực token JWT (HS256) từ HTV SSO Dashboard bằng WebCrypto chuẩn.
 * Có leeway 300 giây (5 phút) để bù sai lệch đồng hồ giữa server nội bộ HTV và Cloudflare.
 */
export async function verifySsoJwt(
  token: string,
  secret: string,
  leewaySeconds = 300,
): Promise<{ valid: boolean; payload?: any; error?: string }> {
  if (!token || !secret) {
    return { valid: false, error: "Thiếu token hoặc HTV_SSO_SECRET." };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Định dạng token không hợp lệ (không đúng định dạng JWT)." };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Kiểm tra chữ ký HMAC-SHA256
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const isValidSig = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!isValidSig) {
      return { valid: false, error: "Chữ ký token không hợp lệ (sai HTV_SSO_SECRET hoặc token đã bị sửa đổi)." };
    }
  } catch (err: any) {
    return { valid: false, error: "Lỗi kiểm tra chữ ký token: " + (err?.message || String(err)) };
  }

  // 2. Parse nội dung JSON payload
  let payload: any;
  try {
    const payloadJson = base64UrlDecodeText(payloadB64);
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, error: "Không thể giải mã dữ liệu payload trong token." };
  }

  // 3. Kiểm tra hạn sử dụng (exp) kèm bù sai lệch giờ (leeway)
  const now = Math.floor(Date.now() / 1000);
  if (payload && typeof payload.exp === "number") {
    if (now > payload.exp + leewaySeconds) {
      return { valid: false, error: "Token SSO đã hết hạn." };
    }
  }

  return { valid: true, payload };
}

/**
 * Trích xuất username từ payload trả về theo chuẩn linh hoạt của HTV SSO.
 */
export function extractSsoUsername(payload: any): string {
  if (!payload || typeof payload !== "object") return "";

  let u = payload.username;
  if (u && typeof u === "object") {
    u = u.username || u.sub || u.name;
  }
  if (!u || typeof u !== "string" || !u.trim()) {
    u = payload.sub || payload.name || payload.user || "";
  }
  if (typeof u === "object") {
    u = String(u);
  }
  return String(u || "").trim();
}

/**
 * Tạo URL chuyển hướng đăng nhập tới Dashboard HTV kèm tham số ?next=
 */
export function getSsoLoginUrl(ssoServerUrl: string | undefined, callbackUrl: string): string {
  const base = (ssoServerUrl || DEFAULT_SSO_SERVER).replace(/\/+$/, "");
  return `${base}/login?next=${encodeURIComponent(callbackUrl)}`;
}
