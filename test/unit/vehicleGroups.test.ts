import { describe, expect, it } from "vitest";
import {
  isVehicleGroup,
  VEHICLE_GROUP_DEFAULT_SEATS,
  vehicleGroupLabel,
} from "../../src/lib/vehicleGroups";

describe("vehicleGroups", () => {
  it("isVehicleGroup nhận diện đúng giá trị hợp lệ", () => {
    expect(isVehicleGroup("4")).toBe(true);
    expect(isVehicleGroup("xe_tai")).toBe(true);
    expect(isVehicleGroup("999")).toBe(false);
    expect(isVehicleGroup(null)).toBe(false);
    expect(isVehicleGroup(undefined)).toBe(false);
  });

  it("vehicleGroupLabel trả nhãn hiển thị đúng, rỗng khi null/undefined", () => {
    expect(vehicleGroupLabel("7")).toBe("7 chỗ");
    expect(vehicleGroupLabel(null)).toBe("");
    expect(vehicleGroupLabel(undefined)).toBe("");
  });

  it("vehicleGroupLabel trả lại chính giá trị nếu không khớp nhóm nào (dữ liệu cũ)", () => {
    expect(vehicleGroupLabel("khong-ro")).toBe("khong-ro");
  });

  it("VEHICLE_GROUP_DEFAULT_SEATS khớp số chỗ cho từng nhóm", () => {
    expect(VEHICLE_GROUP_DEFAULT_SEATS["4"]).toBe(4);
    expect(VEHICLE_GROUP_DEFAULT_SEATS["16"]).toBe(16);
    expect(VEHICLE_GROUP_DEFAULT_SEATS["xe_tai"]).toBe(2);
  });
});
