import { describe, expect, it } from "vitest";
import { findOdoGaps, GAP_TOLERANCE_KM, type OdoTripRow } from "../../src/lib/odometer";

const trip = (over: Partial<OdoTripRow>): OdoTripRow => ({
  bookingId: over.bookingId ?? "b",
  code: over.code ?? "HTV-2026-000001",
  odoStart: over.odoStart ?? null,
  odoEnd: over.odoEnd ?? null,
  soKm: over.soKm ?? null,
  gioXuatBen: over.gioXuatBen ?? null,
  gioKetThuc: over.gioKetThuc ?? null,
});

describe("findOdoGaps", () => {
  it("không báo gap khi chuyến sau xuất phát đúng số km chuyến trước về", () => {
    const trips = [
      trip({ bookingId: "1", code: "A", odoStart: 100, odoEnd: 150 }),
      trip({ bookingId: "2", code: "B", odoStart: 150, odoEnd: 200 }),
    ];
    expect(findOdoGaps("veh1", trips)).toEqual([]);
  });

  it("bỏ qua sai số nhỏ trong ngưỡng cho phép", () => {
    const trips = [
      trip({ bookingId: "1", code: "A", odoStart: 100, odoEnd: 150 }),
      trip({ bookingId: "2", code: "B", odoStart: 150 + GAP_TOLERANCE_KM, odoEnd: 200 }),
    ];
    expect(findOdoGaps("veh1", trips)).toEqual([]);
  });

  it("báo gap khi chuyến sau xuất phát với km cao hơn km về chuyến trước quá ngưỡng", () => {
    const trips = [
      trip({ bookingId: "1", code: "A", odoStart: 100, odoEnd: 150 }),
      trip({ bookingId: "2", code: "B", odoStart: 180, odoEnd: 200 }),
    ];
    const gaps = findOdoGaps("veh1", trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      vehicleId: "veh1",
      prevCode: "A",
      nextCode: "B",
      nextBookingId: "2",
      prevEnd: 150,
      nextStart: 180,
      gapKm: 30,
    });
  });

  it("sắp xếp theo odoStart trước khi so sánh, không theo thứ tự truyền vào", () => {
    const trips = [
      trip({ bookingId: "2", code: "B", odoStart: 180, odoEnd: 200 }),
      trip({ bookingId: "1", code: "A", odoStart: 100, odoEnd: 150 }),
    ];
    const gaps = findOdoGaps("veh1", trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].prevCode).toBe("A");
    expect(gaps[0].nextCode).toBe("B");
  });

  it("bỏ qua chuyến chưa có đủ odoStart/odoEnd", () => {
    const trips = [
      trip({ bookingId: "1", code: "A", odoStart: 100, odoEnd: 150 }),
      trip({ bookingId: "2", code: "B", odoStart: null, odoEnd: null }),
      trip({ bookingId: "3", code: "C", odoStart: 300, odoEnd: 350 }),
    ];
    const gaps = findOdoGaps("veh1", trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ prevCode: "A", nextCode: "C", gapKm: 150 });
  });

  it("không có gap nào với 0 hoặc 1 chuyến", () => {
    expect(findOdoGaps("veh1", [])).toEqual([]);
    expect(findOdoGaps("veh1", [trip({ odoStart: 100, odoEnd: 150 })])).toEqual([]);
  });
});
