import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../src/db/schema";
import type { DB } from "../../src/db/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");

/** Áp toàn bộ file SQL trong drizzle/ (đúng thứ tự) lên 1 PGlite mới — cùng DDL/index
 * dùng để tạo bảng trên Supabase thật, nên test chạy trên schema/constraint y hệt
 * production, không phải bản rút gọn tay. */
async function applyMigrations(pg: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }
}

export type TestDb = { pg: PGlite; db: DB };

/** DB Postgres thật (WASM, trong bộ nhớ) cho 1 test — không cần Docker/mạng.
 * `db` đúc kiểu về `DB` (kiểu của client postgres.js production) vì cả hai đều là
 * NodePgDatabase/PgliteDatabase cùng implement chung interface query builder của
 * Drizzle; route/lib code chỉ gọi qua interface đó nên hoán đổi được an toàn. */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await applyMigrations(pg);
  const db = drizzle(pg, { schema }) as unknown as DB;
  return { pg, db };
}

const TABLES = [
  "notifications",
  "push_subscriptions",
  "alert_acks",
  "audit_log",
  "odometer_events",
  "trip_logs",
  "booking_dispatch",
  "booking_approvals",
  "bookings",
  "vehicles",
  "users",
];

/** Xoá sạch dữ liệu giữa các test nhưng giữ nguyên PGlite/schema đã dựng — rẻ hơn nhiều
 * so với tạo lại toàn bộ DB (không có FK giữa các bảng nên thứ tự không quan trọng). */
export async function truncateAll(pg: PGlite): Promise<void> {
  await pg.exec(`TRUNCATE ${TABLES.join(", ")}`);
}
