import { and, asc, desc, eq, inArray, isNull, like, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB } from "../db/client";
import {
  bookingApprovals,
  bookingDispatch,
  bookings,
  notifications,
  tripLogs,
  users,
  vehicles,
} from "../db/schema";
import type { Session } from "../env";
import { STATUS } from "./status";
import { isBanLeader, isDoiXe } from "./rbac";
import { APP_TZ } from "./tz";

const yearFmt = new Intl.DateTimeFormat("en", { timeZone: APP_TZ, year: "numeric" });
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** HTV-2026-000123 — cloud-only nên không cần tiền tố local/cloud. */
export async function genBookingCode(db: DB, now = new Date()): Promise<string> {
  const prefix = `HTV-${yearFmt.format(now)}-`;
  const [last] = await db
    .select({ code: bookings.code })
    .from(bookings)
    .where(like(bookings.code, `${prefix}%`))
    .orderBy(desc(bookings.code))
    .limit(1);
  const n = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(6, "0");
}

export type FullBooking = Awaited<ReturnType<typeof loadBooking>>;

const requesterU = alias(users, "requester_u");
const approverU = alias(users, "approver_u");
const driverU = alias(users, "driver_u");
const dispatcherU = alias(users, "dispatcher_u");

/** 1 round-trip duy nhất (LEFT JOIN hết) thay vì dò tuần tự từng bảng liên quan. */
export async function loadBooking(db: DB, id: string) {
  const [row] = await db
    .select({
      bk: bookings,
      requester: { fullName: requesterU.fullName, username: requesterU.username, phone: requesterU.phone, dsBan: requesterU.dsBan },
      approval: bookingApprovals,
      approverName: approverU.fullName,
      dispatch: bookingDispatch,
      vehicle: vehicles,
      driver: { fullName: driverU.fullName, username: driverU.username, phone: driverU.phone },
      dispatcherName: dispatcherU.fullName,
      tripLog: tripLogs,
    })
    .from(bookings)
    .leftJoin(requesterU, eq(requesterU.username, bookings.requesterUsername))
    .leftJoin(bookingApprovals, and(eq(bookingApprovals.bookingId, bookings.id), isNull(bookingApprovals.deletedAt)))
    .leftJoin(approverU, eq(approverU.username, bookingApprovals.approverUsername))
    .leftJoin(bookingDispatch, and(eq(bookingDispatch.bookingId, bookings.id), isNull(bookingDispatch.deletedAt)))
    .leftJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .leftJoin(driverU, eq(driverU.username, bookingDispatch.driverUsername))
    .leftJoin(dispatcherU, eq(dispatcherU.username, bookingDispatch.dispatchedBy))
    .leftJoin(tripLogs, and(eq(tripLogs.bookingId, bookings.id), isNull(tripLogs.deletedAt)))
    .where(eq(bookings.id, id))
    .limit(1);
  if (!row || row.bk.deletedAt) return null;

  return row;
}

export type Badges = {
  duyet: number;
  dieuXe: number;
  chuyenLaiXe: number;
  chuyenChuaDong: number;
  donCuaToi: number;
  thongBaoChuaDoc: number;
};

const count = async (db: DB, where: SQL<unknown> | undefined): Promise<number> => {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(where);
  return r?.n ?? 0;
};

export async function getBadges(db: DB, s: Session): Promise<Badges> {
  const alive = isNull(bookings.deletedAt);
  const [duyet, dieuXe, chuyenLaiXe, chuyenChuaDong, donCuaToi, thongBaoChuaDoc] = await Promise.all([
    isBanLeader(s) && s.dsBan
      ? count(db, and(alive, eq(bookings.status, STATUS.CHO_BAN_DUYET), eq(bookings.donViYeuCau, s.dsBan)))
      : Promise.resolve(0),
    isDoiXe(s) ? count(db, and(alive, eq(bookings.status, STATUS.CHO_DOI_XE))) : Promise.resolve(0),
    s.isDriver
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(bookings)
          .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
          .where(
            and(
              isNull(bookings.deletedAt),
              inArray(bookings.status, [STATUS.DA_DIEU_XE, STATUS.DANG_CHAY]),
              eq(bookingDispatch.driverUsername, s.username),
              isNull(bookingDispatch.deletedAt),
            ),
          )
          .then((r) => r[0]?.n ?? 0)
      : Promise.resolve(0),
    s.isDriver
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(bookings)
          .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
          .where(
            and(
              isNull(bookings.deletedAt),
              eq(bookings.status, STATUS.DANG_CHAY),
              eq(bookingDispatch.driverUsername, s.username),
              isNull(bookingDispatch.deletedAt),
            ),
          )
          .then((r) => r[0]?.n ?? 0)
      : Promise.resolve(0),
    count(
      db,
      and(
        alive,
        eq(bookings.requesterUsername, s.username),
        inArray(bookings.status, [STATUS.BAN_TU_CHOI, STATUS.DOI_XE_TU_CHOI, STATUS.DA_DIEU_XE]),
      ),
    ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.username, s.username), isNull(notifications.readAt)))
      .then((r) => r[0]?.n ?? 0),
  ]);
  return { duyet, dieuXe, chuyenLaiXe, chuyenChuaDong, donCuaToi, thongBaoChuaDoc };
}

/** Trưởng/Phó ban của 1 đơn vị — nhận thông báo khi có đơn mới chờ duyệt. */
export async function listApprovers(db: DB, donVi: string): Promise<string[]> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.isActive, true), eq(users.dsBan, donVi), inArray(users.role, ["truong_ban", "pho_ban"])));
  return rows.map((r) => r.username);
}

/** Tổ trưởng/Tổ phó Đội xe — nhận thông báo khi có đơn mới chờ điều xe. */
export async function listDoiXeUsers(db: DB): Promise<string[]> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.isActive, true), inArray(users.role, ["to_truong", "to_pho"])));
  return rows.map((r) => r.username);
}

export const effectiveEnd = (start: Date, end: Date | null) =>
  end ?? new Date(start.getTime() + DEFAULT_DURATION_MS);

export type BusyRow = {
  code: string;
  diemDen: string;
  startTime: Date;
  endTime: Date | null;
  vehicleId: string;
  vehicleName: string;
  plateNo: string;
  driverUsername: string;
  driverName: string;
};

export async function findBusyInWindow(
  db: DB,
  start: Date,
  end: Date | null,
  excludeId?: string,
): Promise<BusyRow[]> {
  const effEnd = effectiveEnd(start, end);
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      diemDen: bookings.diemDen,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      vehicleId: bookingDispatch.vehicleId,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      driverUsername: bookingDispatch.driverUsername,
      driverName: users.fullName,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .innerJoin(users, eq(users.username, bookingDispatch.driverUsername))
    .where(
      and(
        isNull(bookings.deletedAt),
        isNull(bookingDispatch.deletedAt),
        inArray(bookings.status, [STATUS.DA_DIEU_XE, STATUS.DANG_CHAY]),
        excludeId ? ne(bookings.id, excludeId) : undefined,
      ),
    )
    .orderBy(asc(bookings.startTime));

  return rows
    .filter((r) => r.startTime < effEnd && start < effectiveEnd(r.startTime, r.endTime))
    .map((r) => ({
      code: r.code,
      diemDen: r.diemDen,
      startTime: r.startTime,
      endTime: r.endTime,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName,
      plateNo: r.plateNo,
      driverUsername: r.driverUsername,
      driverName: r.driverName,
    }));
}

export type OpenTrip = {
  id: string;
  code: string;
  route: string;
  vehicleName: string;
  plateNo: string;
  driverUsername: string;
  driverName: string;
  since: Date;
  hours: number;
  odoStart: number | null;
  overdue: boolean;
};

const OVERDUE_HOURS = 12;

export async function getOpenTrips(db: DB, driverUsername?: string): Promise<OpenTrip[]> {
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      diemXuatPhat: bookings.diemXuatPhat,
      diemDen: bookings.diemDen,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      driverUsername: bookingDispatch.driverUsername,
      vehicleName: vehicles.name,
      plateNo: vehicles.plateNo,
      driverName: users.fullName,
      gioXuatBen: tripLogs.gioXuatBen,
      odoStart: tripLogs.odoStart,
    })
    .from(bookings)
    .innerJoin(bookingDispatch, eq(bookingDispatch.bookingId, bookings.id))
    .innerJoin(vehicles, eq(vehicles.id, bookingDispatch.vehicleId))
    .innerJoin(users, eq(users.username, bookingDispatch.driverUsername))
    .leftJoin(tripLogs, eq(tripLogs.bookingId, bookings.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(bookings.status, STATUS.DANG_CHAY),
        isNull(bookingDispatch.deletedAt),
        driverUsername ? eq(bookingDispatch.driverUsername, driverUsername) : undefined,
      ),
    )
    .orderBy(asc(bookings.startTime));

  const now = Date.now();
  return rows.map((r) => {
    const since = r.gioXuatBen ?? r.startTime;
    const hours = Math.max(0, (now - since.getTime()) / 3_600_000);
    const overdue = (!!r.endTime && now > r.endTime.getTime()) || hours > OVERDUE_HOURS;
    return {
      id: r.id,
      code: r.code,
      route: `${r.diemXuatPhat} → ${r.diemDen}`,
      vehicleName: r.vehicleName,
      plateNo: r.plateNo,
      driverUsername: r.driverUsername,
      driverName: r.driverName,
      since,
      hours,
      odoStart: r.odoStart,
      overdue,
    };
  });
}
