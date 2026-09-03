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
 * Tạo danh sách các biến thể của secret key (xử lý trường hợp người dùng copy thừa dấu ngoặc kép, khoảng trắng, xuống dòng)
 */
function getSecretCandidates(rawSecret: string): string[] {
  const list = new Set<string>();
  if (!rawSecret) return [];

  list.add(rawSecret);
  list.add(rawSecret.trim());
  list.add(rawSecret.trim().replace(/^["']|["']$/g, ""));
  list.add(rawSecret.trim().replace(/^["']|["']$/g, "").trim());
  list.add(rawSecret.replace(/[\r\n\t]/g, ""));
  list.add(rawSecret.replace(/[\r\n\t]/g, "").trim().replace(/^["']|["']$/g, ""));

  return Array.from(list).filter(Boolean);
}

export type SsoVerifyResult = {
  valid: boolean;
  payload?: any;
  username?: string;
  error?: string;
  diagnostic?: {
    headerAlg?: string;
    decodedUsername?: string;
    secretLen?: number;
    secretPreview?: string;
    hasQuotes?: boolean;
    hasWhitespace?: boolean;
  };
};

/**
 * Xác thực token JWT từ HTV SSO Dashboard bằng WebCrypto chuẩn.
 * Có leeway 300 giây (5 phút) để bù sai lệch đồng hồ.
 * Hỗ trợ tự động chuẩn hoá secret key và cung cấp chi tiết chẩn đoán nếu sai secret.
 */
export async function verifySsoJwt(
  rawToken: string,
  rawSecret: string,
  leewaySeconds = 300,
): Promise<SsoVerifyResult> {
  if (!rawToken) {
    return { valid: false, error: "Không nhận được token từ HTV SSO." };
  }
  if (!rawSecret) {
    return { valid: false, error: "Biến môi trường HTV_SSO_SECRET chưa được cấu hình trên Cloudflare Workers." };
  }

  // Làm sạch token (loại bỏ khoảng trắng, dấu nháy thừa, giải mã URL nếu bị mã hoá)
  let token = rawToken.trim().replace(/^["']|["']$/g, "");
  if (token.includes("%")) {
    try {
      token = decodeURIComponent(token);
    } catch {
      // bỏ qua nếu không giải mã được
    }
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Định dạng token không hợp lệ (không đủ 3 phần của JWT)." };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Luôn giải mã header và payload trước để phục vụ chẩn đoán
  let header: any = {};
  let payload: any = {};
  try {
    header = JSON.parse(base64UrlDecodeText(headerB64));
  } catch {
    header = { alg: "HS256" };
  }

  try {
    payload = JSON.parse(base64UrlDecodeText(payloadB64));
  } catch {
    return { valid: false, error: "Không thể giải mã dữ liệu payload trong token." };
  }

  const decodedUsername = extractSsoUsername(payload);
  const alg = header?.alg || "HS256";
  const hashName = alg === "HS512" ? "SHA-512" : alg === "HS384" ? "SHA-384" : "SHA-256";

  // Chuẩn bị dữ liệu và chữ ký
  const encoder = new TextEncoder();
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signatureB64);
  } catch (err: any) {
    return { valid: false, error: "Chữ ký trong token không đúng định dạng Base64Url: " + err.message };
  }

  // 2. Thử xác thực với từng ứng viên secret (đã lọc ngoặc kép, khoảng trắng...)
  const candidates = getSecretCandidates(rawSecret);
  let verified = false;

  for (const cand of candidates) {
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(cand),
        { name: "HMAC", hash: hashName },
        false,
        ["verify"],
      );
      const ok = await crypto.subtle.verify("HMAC", key, signatureBytes, data);
      if (ok) {
        verified = true;
        break;
      }
    } catch {
      // tiếp tục thử candidate khác
    }
  }

  if (!verified) {
    const hasQuotes = /^["'].*["']$/.test(rawSecret.trim());
    const hasWhitespace = /\s/.test(rawSecret);
    const secretPreview = rawSecret.length > 6
      ? `${rawSecret.slice(0, 3)}...${rawSecret.slice(-3)}`
      : "(quá ngắn)";

    return {
      valid: false,
      error: `Chữ ký token không khớp với HTV_SSO_SECRET trên Cloudflare Worker.`,
      diagnostic: {
        headerAlg: alg,
        decodedUsername: decodedUsername || "(không rõ)",
        secretLen: rawSecret.length,
        secretPreview,
        hasQuotes,
        hasWhitespace,
      },
    };
  }

  // 3. Kiểm tra hạn sử dụng (exp) kèm bù sai lệch giờ (leeway)
  const now = Math.floor(Date.now() / 1000);
  if (payload && typeof payload.exp === "number") {
    if (now > payload.exp + leewaySeconds) {
      return {
        valid: false,
        error: `Token SSO đã hết hạn (Thời gian token: ${new Date(payload.exp * 1000).toLocaleTimeString()}, hiện tại: ${new Date(now * 1000).toLocaleTimeString()}).`,
      };
    }
  }

  return { valid: true, payload, username: decodedUsername };
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
