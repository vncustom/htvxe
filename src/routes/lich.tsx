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
  const today = todayKey();
  const sunday = addDaysKey(monday, 6);
  const ddmm = (k: string) => {
    const [, mm, dd] = k.split("-");
    return `${dd}/${mm}`;
  };

  return c.html(
    <Layout session={s} badges={badges} openTrips={openTrips} path="/lich" title="Lịch tuần">
      <div class="pagehead">
        <h2>Lịch tuần {ddmm(monday)} – {ddmm(sunday)}</h2>
      </div>
      <div class="weeknav no-print">
        <a class="btn sec" href={`/lich?tuan=${addDaysKey(monday, -7)}`}>← Tuần trước</a>
        <a class="btn sec" href={`/lich?tuan=${todayKey()}`}>Tuần này</a>
        <a class="btn sec" href={`/lich?tuan=${nextMonday}`}>Tuần sau →</a>
        <form method="get" action="/lich">
          <label style="margin:0;font-weight:600">Chọn ngày</label>
          <input type="date" name="tuan" value={anchor} onchange="this.form.submit()" />
          <button class="sec">Xem tuần</button>
        </form>
      </div>
      <div class="grid7">
        {days.map((d, i) => (
          <div class={d === today ? "day today" : "day"}>
            <div class="dh">
              <span>{weekdayLabel((i + 1) % 7)} {ddmm(d)}</span>
              {d === today ? <span>Hôm nay</span> : null}
            </div>
            {(byDay[d] ?? []).map((e) => (
              <a class="ev" href={`/don/${e.id}`} style={`background:${statusColor(e.status)}`}>
                {fmtTime(e.startTime)} {e.diemDen}
              </a>
            ))}
            {(byDay[d] ?? []).length === 0 ? <span class="muted" style="font-size:11px">—</span> : null}
          </div>
        ))}
      </div>
    </Layout>,
  );
});
