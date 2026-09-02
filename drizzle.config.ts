import { defineConfig } from "drizzle-kit";

// Dùng cho `drizzle-kit push` / `generate` chạy TỪ MÁY LOCAL.
// Đặt DATABASE_URL (chuỗi Supabase, nên dùng Session pooler cổng 5432 khi push schema).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
