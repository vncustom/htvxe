// Seed user + xe lên Supabase. Chạy TỪ MÁY LOCAL:
//   DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' npx tsx scripts/seed.ts
// (nên dùng Session pooler cổng 5432 cho thao tác ghi hàng loạt)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { hashPassword } from "../src/lib/password";

type SeedUser = {
  username: string;
  fullName: string;
  dsBan: string | null;
  dsPhong: string | null;
  dsTo: string | null;
  role: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isDriver: boolean;
};

const VEHICLES = [
  { name: "Toyota Zace", plateNo: "50A-030.36", seats: 7 },
  { name: "Toyota Corolla Altis", plateNo: "50M-006.30", seats: 5 },
  { name: "Mitsubishi Triton", plateNo: "50A-031.91", seats: 5 },
  { name: "Toyota Hiace", plateNo: "50A-031.67", seats: 16 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL");
  const sql = postgres(url, { prepare: false });

  const path = fileURLToPath(new URL("./users.json", import.meta.url));
  const users: SeedUser[] = JSON.parse(readFileSync(path, "utf-8"));

  let n = 0;
  for (const u of users) {
    const hash = await hashPassword("123456");
    await sql`
      insert into users
        (username, full_name, ds_ban, ds_phong, ds_to, role, job_title, email, phone, password_hash, is_driver)
      values
        (${u.username}, ${u.fullName}, ${u.dsBan}, ${u.dsPhong}, ${u.dsTo}, ${u.role},
         ${u.jobTitle}, ${u.email}, ${u.phone}, ${hash}, ${u.isDriver})
      on conflict (username) do update set
        full_name = excluded.full_name, ds_ban = excluded.ds_ban, ds_phong = excluded.ds_phong,
        ds_to = excluded.ds_to, role = excluded.role, job_title = excluded.job_title,
        email = excluded.email, phone = excluded.phone, is_driver = excluded.is_driver,
        updated_at = now()
    `;
    n++;
    if (n % 50 === 0) console.log(`  ...${n}/${users.length}`);
  }

  for (const v of VEHICLES) {
    await sql`
      insert into vehicles (name, plate_no, seats)
      values (${v.name}, ${v.plateNo}, ${v.seats})
      on conflict (plate_no) do update set
        name = excluded.name, seats = excluded.seats, updated_at = now()
    `;
  }

  const [{ count: uc }] = await sql`select count(*)::int from users`;
  const [{ count: vc }] = await sql`select count(*)::int from vehicles`;
  console.log(`Seed xong: ${uc} user, ${vc} xe. Mật khẩu mặc định: 123456`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
