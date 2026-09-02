// Hằng số + tổng hợp công-tơ-mét.
export const KM_DAILY_WARN = 400; // cảnh báo 1 chuyến vượt ngưỡng
export const GAP_TOLERANCE_KM = 1; // sai số cho phép giữa 2 chuyến liên tiếp

export type OdoTripRow = {
  bookingId: string;
  code: string;
  odoStart: number | null;
  odoEnd: number | null;
  soKm: number | null;
  gioXuatBen: Date | null;
  gioKetThuc: Date | null;
};

export type OdoGap = {
  vehicleId: string;
  prevCode: string;
  nextCode: string;
  nextBookingId: string;
  prevEnd: number;
  nextStart: number;
  gapKm: number; // nextStart - prevEnd (km chạy ngoài đơn)
};

/** Dò khoảng trống công-tơ-mét: chuyến sau xuất phát với số km > số km về của chuyến trước. */
export function findOdoGaps(vehicleId: string, trips: OdoTripRow[]): OdoGap[] {
  const done = trips
    .filter((t) => t.odoStart != null && t.odoEnd != null)
    .sort((a, b) => (a.odoStart! - b.odoStart!) || (a.odoEnd! - b.odoEnd!));
  const gaps: OdoGap[] = [];
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1];
    const next = done[i];
    const gapKm = next.odoStart! - prev.odoEnd!;
    if (gapKm > GAP_TOLERANCE_KM) {
      gaps.push({
        vehicleId,
        prevCode: prev.code,
        nextCode: next.code,
        nextBookingId: next.bookingId,
        prevEnd: prev.odoEnd!,
        nextStart: next.odoStart!,
        gapKm,
      });
    }
  }
  return gaps;
}
