import type { Context } from "hono";
import type { Env } from "../env";
import { must } from "./session";
import { getBadges, getOpenTrips, type Badges, type OpenTrip } from "./queries";
import type { DB } from "../db/client";

export type PageCtx = {
  s: ReturnType<typeof must>;
  db: DB;
  badges: Badges;
  openTrips: OpenTrip[];
};

/** Gom session + badge + "chuyến đang chạy của tôi" (banner) cho mọi trang. */
export async function pageCtx(c: Context<Env>): Promise<PageCtx> {
  const s = must(c);
  const db = c.get("db");
  const [badges, openTrips] = await Promise.all([
    getBadges(db, s),
    s.isDriver ? getOpenTrips(db, s.username) : Promise.resolve([] as OpenTrip[]),
  ]);
  return { s, db, badges, openTrips };
}
