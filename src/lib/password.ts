// Băm mật khẩu bằng PBKDF2-SHA256 qua WebCrypto — có sẵn trên Workers, nhanh,
// không cần thư viện (bcrypt tốn CPU dễ vượt giới hạn Worker free).
// Định dạng lưu: pbkdf2$<iterations>$<salt_b64>$<hash_b64>

const ITER = 100_000;
const KEYLEN = 32;

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" },
    key,
    KEYLEN * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITER);
  return `pbkdf2$${ITER}$${b64(salt.buffer)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  const salt = unb64(parts[2]);
  const expected = parts[3];
  const actual = b64(await derive(password, salt, iter));
  // so sánh hằng thời gian
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
