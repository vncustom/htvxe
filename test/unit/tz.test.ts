import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  fmtDate,
  fmtDateTime,
  fromDatetimeLocal,
  instantFromVN,
  mondayKeyOf,
  toDatetimeLocal,
  vnDateKey,
  vnParts,
  vnWeekday,
  weekdayLabel,
} from "../../src/lib/tz";

// Việt Nam không DST, offset cố định +07:00 -> mọi phép quy đổi phải khớp chính xác.

describe("tz — quy đổi giờ VN <-> UTC", () => {
  it("fromDatetimeLocal hiểu input là giờ VN rồi quy ra UTC (-7h)", () => {
    const d = fromDatetimeLocal("2026-03-05T08:00");
    expect(d.toISOString()).toBe("2026-03-05T01:00:00.000Z");
  });

  it("instantFromVN với mặc định 00:00", () => {
    const d = instantFromVN("2026-03-05");
    expect(d.toISOString()).toBe("2026-03-04T17:00:00.000Z");
  });

  it("toDatetimeLocal là nghịch đảo của fromDatetimeLocal", () => {
    const s = "2026-03-05T08:30";
    expect(toDatetimeLocal(fromDatetimeLocal(s))).toBe(s);
  });

  it("vnParts đọc đúng năm/tháng/ngày/giờ/phút theo giờ VN", () => {
    const d = fromDatetimeLocal("2026-03-05T23:45");
    expect(vnParts(d)).toEqual({ year: 2026, month: 3, day: 5, hour: 23, minute: 45 });
  });

  it("vnDateKey trả về đúng ngày VN kể cả khi UTC đã sang ngày khác", () => {
    // 2026-03-05 01:00 VN = 2026-03-04 18:00 UTC (khác ngày UTC)
    const d = fromDatetimeLocal("2026-03-05T01:00");
    expect(vnDateKey(d)).toBe("2026-03-05");
  });
});

describe("tz — hiển thị", () => {
  it("fmtDateTime/fmtDate trả về '—' khi null/undefined", () => {
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDateTime(undefined)).toBe("—");
    expect(fmtDate(null)).toBe("—");
  });

  it("fmtDateTime chứa đúng ngày và giờ VN (không so khớp thứ tự cụm — phụ thuộc dữ liệu ICU của môi trường)", () => {
    const d = fromDatetimeLocal("2026-03-05T08:05");
    const out = fmtDateTime(d);
    expect(out).toContain("05/03/2026");
    expect(out).toContain("08:05");
    expect(out).not.toContain(",");
  });
});

describe("tz — tuần & thứ", () => {
  it("vnWeekday trả 0=CN..6=T7 theo giờ VN", () => {
    // 2026-03-05 là Thứ Năm
    const d = fromDatetimeLocal("2026-03-05T12:00");
    expect(vnWeekday(d)).toBe(4);
    expect(weekdayLabel(vnWeekday(d))).toBe("T5");
  });

  it("mondayKeyOf trả về Thứ Hai của tuần chứa ngày đó", () => {
    expect(mondayKeyOf("2026-03-05")).toBe("2026-03-02"); // Thứ Năm -> Thứ Hai cùng tuần
    expect(mondayKeyOf("2026-03-02")).toBe("2026-03-02"); // đã là Thứ Hai
    expect(mondayKeyOf("2026-03-08")).toBe("2026-03-02"); // Chủ Nhật -> Thứ Hai tuần trước
  });

  it("addDaysKey cộng/trừ ngày đúng, kể cả qua tháng", () => {
    expect(addDaysKey("2026-03-05", 1)).toBe("2026-03-06");
    expect(addDaysKey("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDaysKey("2026-03-05", -5)).toBe("2026-02-28");
  });
});
