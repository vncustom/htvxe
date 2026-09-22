import { describe, expect, it } from "vitest";
import {
  canApproveFor,
  canCancelBooking,
  canEditBooking,
  isAdmin,
  isBanLeader,
  isDoiXe,
  isLanhDaoDai,
  isVpDaiLeader,
  VP_DAI,
} from "../../src/lib/rbac";
import type { Session } from "../../src/env";

const mkSession = (over: Partial<Session> = {}): Session => ({
  username: "u1",
  fullName: "User 1",
  role: "nhan_vien",
  isDriver: false,
  dsBan: null,
  ...over,
});

describe("rbac — vai trò", () => {
  it("isBanLeader chỉ đúng cho truong_ban/pho_ban", () => {
    expect(isBanLeader(mkSession({ role: "truong_ban" }))).toBe(true);
    expect(isBanLeader(mkSession({ role: "pho_ban" }))).toBe(true);
    expect(isBanLeader(mkSession({ role: "truong_phong" }))).toBe(false);
    expect(isBanLeader(mkSession({ role: "nhan_vien" }))).toBe(false);
  });

  it("isDoiXe chỉ đúng cho to_truong/to_pho", () => {
    expect(isDoiXe(mkSession({ role: "to_truong" }))).toBe(true);
    expect(isDoiXe(mkSession({ role: "to_pho" }))).toBe(true);
    expect(isDoiXe(mkSession({ role: "nhan_vien" }))).toBe(false);
  });

  it("isAdmin đúng cho cả admin và admin_datxe", () => {
    expect(isAdmin(mkSession({ role: "admin" }))).toBe(true);
    expect(isAdmin(mkSession({ role: "admin_datxe" }))).toBe(true);
    expect(isAdmin(mkSession({ role: "ban_tgd" }))).toBe(false);
  });

  it("isLanhDaoDai chỉ đúng cho ban_tgd", () => {
    expect(isLanhDaoDai(mkSession({ role: "ban_tgd" }))).toBe(true);
    expect(isLanhDaoDai(mkSession({ role: "admin" }))).toBe(false);
  });

  it("isVpDaiLeader cần vừa là ban leader vừa đúng dsBan = Văn Phòng Đài", () => {
    expect(isVpDaiLeader(mkSession({ role: "truong_ban", dsBan: VP_DAI }))).toBe(true);
    expect(isVpDaiLeader(mkSession({ role: "truong_ban", dsBan: "Ban khác" }))).toBe(false);
    expect(isVpDaiLeader(mkSession({ role: "pho_phong", dsBan: VP_DAI }))).toBe(false);
  });
});

describe("rbac — canApproveFor", () => {
  it("cho duyệt khi là ban leader và đúng dsBan của đơn vị yêu cầu", () => {
    const s = mkSession({ role: "truong_ban", dsBan: "Ban Thời sự" });
    expect(canApproveFor(s, "Ban Thời sự")).toBe(true);
    expect(canApproveFor(s, "Ban Khác")).toBe(false);
  });

  it("không cho duyệt khi không có dsBan", () => {
    const s = mkSession({ role: "truong_ban", dsBan: null });
    expect(canApproveFor(s, "Ban Thời sự")).toBe(false);
  });

  it("không cho duyệt nếu không phải ban leader dù cùng dsBan", () => {
    const s = mkSession({ role: "nhan_vien", dsBan: "Ban Thời sự" });
    expect(canApproveFor(s, "Ban Thời sự")).toBe(false);
  });
});

describe("rbac — canCancelBooking", () => {
  const owner = mkSession({ username: "chu-don" });

  it("chủ đơn hủy được khi đang chờ Ban duyệt hoặc nháp", () => {
    expect(canCancelBooking(owner, { status: "cho_ban_duyet", requesterUsername: "chu-don" })).toBe(true);
    expect(canCancelBooking(owner, { status: "nhap", requesterUsername: "chu-don" })).toBe(true);
  });

  it("chủ đơn hủy được đơn đã bị từ chối", () => {
    expect(canCancelBooking(owner, { status: "ban_tu_choi", requesterUsername: "chu-don" })).toBe(true);
    expect(canCancelBooking(owner, { status: "doi_xe_tu_choi", requesterUsername: "chu-don" })).toBe(true);
  });

  it("người khác không hủy được đơn của owner (trừ đúng vai trò)", () => {
    const other = mkSession({ username: "nguoi-khac" });
    expect(canCancelBooking(other, { status: "cho_ban_duyet", requesterUsername: "chu-don" })).toBe(false);
  });

  it("chỉ Đội xe hoặc lãnh đạo VP Đài hủy được khi đang chờ Đội xe", () => {
    const doiXe = mkSession({ role: "to_truong" });
    const vpDaiLeader = mkSession({ role: "truong_ban", dsBan: VP_DAI });
    const banThuong = mkSession({ role: "truong_ban", dsBan: "Ban Khác" });
    expect(canCancelBooking(doiXe, { status: "cho_doi_xe", requesterUsername: "chu-don" })).toBe(true);
    expect(canCancelBooking(vpDaiLeader, { status: "cho_doi_xe", requesterUsername: "chu-don" })).toBe(true);
    expect(canCancelBooking(banThuong, { status: "cho_doi_xe", requesterUsername: "chu-don" })).toBe(false);
  });

  it("chủ đơn không tự hủy được khi đã điều xe (phải qua VP Đài)", () => {
    expect(canCancelBooking(owner, { status: "da_dieu_xe", requesterUsername: "chu-don" })).toBe(false);
  });

  it("không ai hủy được đơn đã hoàn thành", () => {
    const vpDaiLeader = mkSession({ role: "truong_ban", dsBan: VP_DAI });
    expect(canCancelBooking(vpDaiLeader, { status: "hoan_thanh", requesterUsername: "chu-don" })).toBe(false);
  });
});

describe("rbac — canEditBooking", () => {
  it("chủ đơn sửa được ở các trạng thái cho phép", () => {
    const owner = mkSession({ username: "chu-don" });
    for (const status of ["nhap", "cho_ban_duyet", "ban_tu_choi", "doi_xe_tu_choi"]) {
      expect(canEditBooking(owner, { status, requesterUsername: "chu-don" })).toBe(true);
    }
  });

  it("không sửa được khi đã điều xe/đang chạy/hoàn thành/hủy", () => {
    const owner = mkSession({ username: "chu-don" });
    for (const status of ["da_dieu_xe", "dang_chay", "hoan_thanh", "huy"]) {
      expect(canEditBooking(owner, { status, requesterUsername: "chu-don" })).toBe(false);
    }
  });

  it("người không phải chủ đơn không sửa được dù đúng trạng thái", () => {
    const other = mkSession({ username: "nguoi-khac" });
    expect(canEditBooking(other, { status: "cho_ban_duyet", requesterUsername: "chu-don" })).toBe(false);
  });
});
