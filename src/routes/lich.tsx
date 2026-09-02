import { Hono } from "hono";
import { and, gte, isNull, lt, inArray } from "drizzle-orm";
import type { Env } from "../env";
import { bookings } from "../db/schema";
import { pageCtx } from "../lib/page";
import { ACTIVE_STATUSES, statusColor } from "../lib/status";
import { Layout } from "../lib/ui";
import { addDaysKey, fmtTime, instantFromVN, mondayKeyOf, todayKey, vnDateKey, weekdayLabel } from "../lib/tz";

export const lich = new Hono<Env>();

lich.get("/lich", async (c) => {
  const { s, db, badges, openTrips } = await pageCtx(c);
  const anchor = c.req.query("tuan") || todayKey();
  const monday = mondayKeyOf(anchor);
  const nextMonday = addDaysKey(monday, 7);
  const from = instantFromVN(monday, "00:00");
  const to = instantFromVN(nextMonday, "00:00");

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      diemDen: bookings.diemDen,
      startTime: bookings.startTime,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        isNull(bookings.deletedAt),
        inArray(bookings.status, ACTIVE_STATUSES),
        gte(bookings.startTime, from),
        lt(bookings.startTime, to),
      ),
    )
    .orderBy(bookings.startTime);

  const byDay: Record<string, typeof rows> = {};
  for (const r of rows) (byDay[vnDateKey(r.startTime)] ??= []).push(r);

  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/lich" title="Lịch tuần">
      <h2>Lịch tuần</h2>
      <p class="no-print">
        <a class="btn sec" href={`/lich?tuan=${addDaysKey(monday, -7)}`}>← Tuần trước</a>{" "}
        <a class="btn sec" href={`/lich?tuan=${todayKey()}`}>Tuần này</a>{" "}
        <a class="btn sec" href={`/lich?tuan=${nextMonday}`}>Tuần sau →</a>
      </p>
      <div class="grid7">
        {days.map((d, i) => {
          const [, m, dd] = d.split("-");
          return (
            <div class="day">
              <div class="dh">
                {weekdayLabel((i + 1) % 7)} {dd}/{m}
              </div>
              {(byDay[d] ?? []).map((e) => (
                <a class="ev" href={`/don/${e.id}`} style={`background:${statusColor(e.status)}`}>
                  {fmtTime(e.startTime)} {e.diemDen}
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </Layout>,
  );
});
