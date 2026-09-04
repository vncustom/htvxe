import { and, asc, desc, eq, inArray, isNull, like, ne, sql, type SQL } from "drizzle-orm";
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

export async function loadBooking(db: DB, id: string) {
  const [bk] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!bk || bk.deletedAt) return null;

  const [requester] = await db
    .select({ fullName: users.fullName, username: users.username, phone: users.phone, dsBan: users.dsBan })
    .from(users)
    .where(eq(users.username, bk.requesterUsername))
    .limit(1);

  const [approval] = await db
    .select()
    .from(bookingApprovals)
    .where(and(eq(bookingApprovals.bookingId, id), isNull(bookingApprovals.deletedAt)))
    .limit(1);
  let approverName: string | null = null;
  if (approval) {
    const [a] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.username, approval.approverUsername))
      .limit(1);
    approverName = a?.fullName ?? null;
  }

  const [dispatch] = await db
    .select()
    .from(bookingDispatch)
    .where(and(eq(bookingDispatch.bookingId, id), isNull(bookingDispatch.deletedAt)))
    .limit(1);
  let vehicle = null as typeof vehicles.$inferSelect | null;
  let driver: { fullName: string; username: string; phone: string | null } | null = null;
  let dispatcherName: string | null = null;
  if (dispatch) {
    [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, dispatch.vehicleId)).limit(1);
    [driver] = await db
      .select({ fullName: users.fullName, username: users.username, phone: users.phone })
      .from(users)
      .where(eq(users.username, dispatch.driverUsername))
      .limit(1);
    const [d] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.username, dispatch.dispatchedBy))
      .limit(1);
    dispatcherName = d?.fullName ?? null;
  }

  const [tripLog] = await db
    .select()
    .from(tripLogs)
    .where(and(eq(tripLogs.bookingId, id), isNull(tripLogs.deletedAt)))
    .limit(1);

  return { bk, requester, approval, approverName, dispatch, vehicle, driver, dispatcherName, tripLog };
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
