// Lược đồ Drizzle — bản CLOUD-ONLY (Cloudflare Workers + Supabase Postgres).
// Bỏ so với bản Prisma cũ: originNode, các bảng đồng bộ (sync_*). Giữ soft-delete
// (deletedAt) + updatedBy để truy vết. DateTime luôn lưu UTC (timestamptz).
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const now = () => timestamp("_", { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    fullName: text("full_name").notNull(),
    dsBan: text("ds_ban"),
    dsPhong: text("ds_phong"),
    dsTo: text("ds_to"),
    role: text("role").notNull().default("nhan_vien"),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    isDriver: boolean("is_driver").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("users_ds_ban_idx").on(t.dsBan), index("users_role_idx").on(t.role)],
);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  plateNo: text("plate_no").notNull().unique(),
  seats: integer("seats").notNull(),
  currentOdometer: integer("current_odometer").notNull().default(0),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    requesterUsername: text("requester_username").notNull(),
    donViYeuCau: text("don_vi_yeu_cau").notNull(),
    startTime: timestamp("start_time", { withTimezone: true, mode: "date" }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: "date" }),
    diemXuatPhat: text("diem_xuat_phat").notNull().default("HTV"),
    diemDen: text("diem_den").notNull(),
    noiDung: text("noi_dung").notNull(),
    bienTap: text("bien_tap"),
    bienTapUsername: text("bien_tap_username"),
    quayPhim: text("quay_phim"),
    quayPhimUsername: text("quay_phim_username"),
    soNguoi: integer("so_nguoi"),
    isPhatSinh: boolean("is_phat_sinh").notNull().default(false),
    status: text("status").notNull().default("cho_ban_duyet"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("bookings_status_idx").on(t.status),
    index("bookings_start_time_idx").on(t.startTime),
    index("bookings_don_vi_idx").on(t.donViYeuCau),
  ],
);

export const bookingApprovals = pgTable("booking_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().unique(),
  approverUsername: text("approver_username").notNull(),
  quyetDinh: text("quyet_dinh").notNull(), // duyet | tu_choi
  ghiChu: text("ghi_chu"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const bookingDispatch = pgTable(
  "booking_dispatch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull().unique(),
    vehicleId: uuid("vehicle_id").notNull(),
    driverUsername: text("driver_username").notNull(),
    ghiChuDoiXe: text("ghi_chu_doi_xe"),
    dispatchedBy: text("dispatched_by").notNull(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("dispatch_vehicle_idx").on(t.vehicleId),
    index("dispatch_driver_idx").on(t.driverUsername),
  ],
);

export const tripLogs = pgTable("trip_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().unique(),
  driverUsername: text("driver_username").notNull(),
  odoStart: integer("odo_start"),
  gioXuatBen: timestamp("gio_xuat_ben", { withTimezone: true, mode: "date" }),
  odoEnd: integer("odo_end"),
  gioKetThuc: timestamp("gio_ket_thuc", { withTimezone: true, mode: "date" }),
  soKm: integer("so_km"),
  ghiChuLaiXe: text("ghi_chu_lai_xe"),
  daDongChuyen: boolean("da_dong_chuyen").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const odometerEvents = pgTable(
  "odometer_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id").notNull(),
    bookingId: uuid("booking_id"),
    loai: text("loai").notNull(), // start | end | dieu_chinh
    odoValue: integer("odo_value").notNull(),
    atTime: timestamp("at_time", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    byUsername: text("by_username"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("odo_vehicle_time_idx").on(t.vehicleId, t.atTime)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    byUsername: text("by_username"),
    atTime: timestamp("at_time", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    diff: text("diff"),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

export const alertAcks = pgTable(
  "alert_acks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(), // odo_gap
    refId: text("ref_id").notNull(),
    ackedBy: text("acked_by").notNull(),
    note: text("note"),
    ackedAt: timestamp("acked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("alert_kind_ref_idx").on(t.kind, t.refId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    bookingId: uuid("booking_id"),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("notif_username_idx").on(t.username, t.readAt)],
);


export type User = typeof users.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
