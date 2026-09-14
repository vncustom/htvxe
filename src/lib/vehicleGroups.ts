/** Nhóm/loại xe theo số chỗ (hoặc xe tải) — nguồn dữ liệu duy nhất cho cột
 * vehicles.vehicle_group và bookings.vehicle_group_yeu_cau. Dùng để: (1) phân loại
 * khi Admin thêm xe, (2) người tạo đơn chọn loại xe cần, (3) Đội xe lọc nhanh danh
 * sách xe khi điều xe (tránh cuộn danh sách dài khi có nhiều xe). */
export const VEHICLE_GROUPS = [
  { value: "4", label: "4 chỗ", seats: 4 },
  { value: "5", label: "5 chỗ", seats: 5 },
  { value: "7", label: "7 chỗ", seats: 7 },
  { value: "16", label: "16 chỗ", seats: 16 },
  { value: "xe_tai", label: "Xe tải", seats: 2 },
] as const;

export type VehicleGroupValue = (typeof VEHICLE_GROUPS)[number]["value"];

export const VEHICLE_GROUP_LABEL: Record<string, string> = Object.fromEntries(
  VEHICLE_GROUPS.map((g) => [g.value, g.label]),
);

export const VEHICLE_GROUP_DEFAULT_SEATS: Record<string, number> = Object.fromEntries(
  VEHICLE_GROUPS.map((g) => [g.value, g.seats]),
);

export const isVehicleGroup = (v: unknown): v is VehicleGroupValue =>
  typeof v === "string" && v in VEHICLE_GROUP_LABEL;

export const vehicleGroupLabel = (v: string | null | undefined) =>
  (v ? VEHICLE_GROUP_LABEL[v] : undefined) ?? v ?? "";
