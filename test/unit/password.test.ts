import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password";

describe("password — PBKDF2 qua WebCrypto", () => {
  it("verifyPassword đúng với mật khẩu đã hash", async () => {
    const hash = await hashPassword("123456");
    expect(await verifyPassword("123456", hash)).toBe(true);
  });

  it("verifyPassword sai với mật khẩu khác", async () => {
    const hash = await hashPassword("123456");
    expect(await verifyPassword("sai-mat-khau", hash)).toBe(false);
  });

  it("2 lần hash cùng 1 mật khẩu ra 2 chuỗi khác nhau (salt ngẫu nhiên)", async () => {
    const a = await hashPassword("123456");
    const b = await hashPassword("123456");
    expect(a).not.toBe(b);
    expect(await verifyPassword("123456", a)).toBe(true);
    expect(await verifyPassword("123456", b)).toBe(true);
  });

  it("hash đúng định dạng pbkdf2$<iter>$<salt>$<hash>", async () => {
    const hash = await hashPassword("123456");
    expect(hash.split("$")).toHaveLength(4);
    expect(hash.startsWith("pbkdf2$100000$")).toBe(true);
  });

  it("verifyPassword trả false với chuỗi lưu trữ hỏng/không đúng định dạng", async () => {
    expect(await verifyPassword("123456", "khong-phai-hash")).toBe(false);
    expect(await verifyPassword("123456", "pbkdf2$100000$abc")).toBe(false);
    expect(await verifyPassword("123456", "bcrypt$10$abc$def")).toBe(false);
  });
});
