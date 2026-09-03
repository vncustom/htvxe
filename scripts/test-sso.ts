// Script kiểm thử đơn vị logic HTV SSO
import { verifySsoJwt, extractSsoUsername, getSsoLoginUrl } from "../src/lib/sso";

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function makeTestJwt(payload: any, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const hB64 = base64UrlEncode(JSON.stringify(header));
  const pB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${hB64}.${pB64}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data)
  );

  const sigB64 = Buffer.from(sigBuffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${data}.${sigB64}`;
}

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ HTV SSO ===");
  const secret = "my-secret-key-123456";

  // Test 1: URL Login
  const loginUrl = getSsoLoginUrl("http://10.1.1.215", "https://htvxe.vncustom.workers.dev/api/auth/sso");
  console.log("Test 1 - Login URL:", loginUrl);
  if (loginUrl.includes("http://10.1.1.215/login?next=") && loginUrl.includes("api%2Fauth%2Fsso")) {
    console.log("-> Test 1 PASS");
  } else {
    throw new Error("Test 1 FAIL");
  }

  // Test 2: Tạo & Xác thực JWT hợp lệ
  const now = Math.floor(Date.now() / 1000);
  const token = await makeTestJwt(
    {
      username: "admin",
      full_name: "Quản trị viên",
      role: "admin",
      exp: now + 300,
      iat: now,
    },
    secret
  );

  const res = await verifySsoJwt(token, secret);
  if (res.valid && res.payload?.username === "admin") {
    console.log("-> Test 2 PASS (Xác thực JWT thành công)");
  } else {
    throw new Error("Test 2 FAIL: " + JSON.stringify(res));
  }

  // Test 3: Sai secret key
  const resBadSecret = await verifySsoJwt(token, "wrong-secret");
  if (!resBadSecret.valid) {
    console.log("-> Test 3 PASS (Chặn token sai secret)");
  } else {
    throw new Error("Test 3 FAIL");
  }

  // Test 4: Token hết hạn nhưng trong phạm vi leeway (lệch giờ 2 phút)
  const tokenLeeway = await makeTestJwt(
    { username: "nv_ban1", exp: now - 120 }, // Hết hạn cách đây 2 phút
    secret
  );
  const resLeeway = await verifySsoJwt(tokenLeeway, secret, 300); // leeway 5 phút
  if (resLeeway.valid) {
    console.log("-> Test 4 PASS (Bù sai lệch giờ leeway hoạt động tốt)");
  } else {
    throw new Error("Test 4 FAIL: " + JSON.stringify(resLeeway));
  }

  // Test 5: Trích xuất username các biến thể
  console.log("Test 5 - Extract username:");
  if (extractSsoUsername({ username: "user_a" }) !== "user_a") throw new Error("5a fail");
  if (extractSsoUsername({ username: { username: "user_b" } }) !== "user_b") throw new Error("5b fail");
  if (extractSsoUsername({ sub: "user_c" }) !== "user_c") throw new Error("5c fail");
  if (extractSsoUsername({ name: "user_d" }) !== "user_d") throw new Error("5d fail");
  console.log("-> Test 5 PASS (Tất cả định dạng username đều bóc tách chính xác)");

  console.log("=== TẤT CẢ KIỂM THỬ THÀNH CÔNG ===");
}

runTests().catch((e) => {
  console.error("LỖI TEST:", e);
  process.exit(1);
});
