import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = ReturnType<typeof makeDb>["db"];

/**
 * Kết nối Postgres cho MỘT request. Supabase Transaction Pooler (cổng 6543) yêu
 * cầu `prepare: false`. Không giữ pool trong Workers — pooler của Supabase lo phần đó.
 */
export function makeDb(url: string) {
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    fetch_types: false,
  });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export { schema };
