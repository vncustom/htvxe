import { describe, expect, it } from "vitest";
import { ACTIVE_STATUSES, REJECTED_STATUSES, STATUS, statusColor, statusLabel } from "../../src/lib/status";

describe("status — nhãn & màu", () => {
  it("statusLabel trả nhãn tiếng Việt đúng cho từng trạng thái đã biết", () => {
    expect(statusLabel(STATUS.CHO_BAN_DUYET)).toBe("Chờ Ban duyệt");
    expect(statusLabel(STATUS.HOAN_THANH)).toBe("Hoàn thành");
    expect(statusLabel(STATUS.HUY)).toBe("Đã hủy");
  });

  it("statusLabel trả lại chính giá trị nếu không có trong bảng nhãn", () => {
    expect(statusLabel("trang_thai_la")).toBe("trang_thai_la");
  });

  it("statusColor trả về màu mặc định cho trạng thái không xác định", () => {
    expect(statusColor("khong_ton_tai")).toBe("#6b7280");
    expect(statusColor(STATUS.HUY)).toBe("#9ca3af");
  });

  it("mỗi giá trị STATUS đều có nhãn và màu", () => {
    for (const s of Object.values(STATUS)) {
      expect(statusLabel(s)).not.toBe(s);
      expect(statusColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("ACTIVE_STATUSES và REJECTED_STATUSES không giao nhau", () => {
    const overlap = ACTIVE_STATUSES.filter((s) => REJECTED_STATUSES.includes(s));
    expect(overlap).toEqual([]);
  });
});
