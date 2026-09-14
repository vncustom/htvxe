// Tạo cặp khoá VAPID (dùng 1 lần khi setup Web Push). Chạy TỪ MÁY LOCAL:
//   npx tsx scripts/generate-vapid-keys.ts
// Copy kết quả:
//   VAPID_PUBLIC_KEY  -> đặt trong wrangler.jsonc (vars, không bí mật)
//   VAPID_PRIVATE_KEY -> đặt bằng `wrangler secret put VAPID_PRIVATE_KEY`
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

const publicJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
const privateJwk = privateKey.export({ format: "jwk" }) as { d: string };

const b64url = (b64: string) => Buffer.from(b64, "base64url");
const publicKeyRaw = Buffer.concat([Buffer.from([0x04]), b64url(publicJwk.x), b64url(publicJwk.y)]);

console.log("VAPID_PUBLIC_KEY=" + publicKeyRaw.toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + privateJwk.d);
