import { users, vehicles } from "../../src/db/schema";
import { hashPassword } from "../../src/lib/password";
import type { DB } from "../../src/db/client";
import type { Session } from "../../src/env";

export const sessionOf = (u: typeof users.$inferSelect): Session => ({
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  isDriver: u.isDriver,
  dsBan: u.dsBan,
});

/** Bộ dữ liệu tối thiểu để chạy hết vòng đời 1 đơn: 1 nhân viên (chủ đơn), 1 trưởng ban
 * cùng `dsBan` (được duyệt), 1 tổ trưởng Đội xe, 1 lái xe, 1 xe sẵn sàng. */
export async function seedBasicFixture(db: DB) {
  const passwordHash = await hashPassword("123456");
  const donVi = "Ban Thời sự";

  const [nhanVien] = await db
    .insert(users)
    .values({ username: "nv1", fullName: "Nguyễn Văn A", role: "nhan_vien", dsBan: donVi, passwordHash })
    .returning();
  const [truongBan] = await db
    .insert(users)
    .values({ username: "tb1", fullName: "Trần Thị B", role: "truong_ban", dsBan: donVi, passwordHash })
    .returning();
  const [truongBanKhac] = await db
    .insert(users)
    .values({ username: "tb2", fullName: "Đỗ Thị K", role: "truong_ban", dsBan: "Ban Khác", passwordHash })
    .returning();
  const [toTruong] = await db
    .insert(users)
    .values({ username: "tt1", fullName: "Lê Văn C", role: "to_truong", passwordHash })
    .returning();
  const [driver] = await db
    .insert(users)
    .values({ username: "lx1", fullName: "Phạm Văn D", role: "nhan_vien", isDriver: true, passwordHash })
    .returning();
  const [driver2] = await db
    .insert(users)
    .values({ username: "lx2", fullName: "Ngô Thị E", role: "nhan_vien", isDriver: true, passwordHash })
    .returning();
  const [veh] = await db
    .insert(vehicles)
    .values({ name: "Xe 1", plateNo: "51A-11111", seats: 4, vehicleGroup: "4" })
    .returning();
  const [veh2] = await db
    .insert(vehicles)
    .values({ name: "Xe 2", plateNo: "51A-22222", seats: 7, vehicleGroup: "7" })
    .returning();

  return { donVi, nhanVien, truongBan, truongBanKhac, toTruong, driver, driver2, veh, veh2 };
}
