import type { Session } from "../env";

export const VP_DAI = "Văn Phòng Đài";

export const ROLE_LABEL: Record<string, string> = {
  nhan_vien: "Nhân viên",
  truong_ban: "Trưởng ban",
  pho_ban: "Phó ban",
  truong_phong: "Trưởng phòng",
  pho_phong: "Phó phòng",
  to_truong: "Tổ trưởng Đội xe",
  to_pho: "Tổ phó Đội xe",
  ban_tgd: "Ban Tổng Giám đốc",
  admin: "Quản trị",
  admin_datxe: "Quản trị (datxe)",
};
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? role;

export const isBanLeader = (s: Session) => s.role === "truong_ban" || s.role === "pho_ban";
export const isDoiXe = (s: Session) => s.role === "to_truong" || s.role === "to_pho";
export const isVpDaiLeader = (s: Session) => isBanLeader(s) && s.dsBan === VP_DAI;
export const isAdmin = (s: Session) => s.role === "admin" || s.role === "admin_datxe";
export const isLanhDaoDai = (s: Session) => s.role === "ban_tgd";
export const isDriver = (s: Session) => s.isDriver;

export const canApproveFor = (s: Session, donVi: string) =>
  isBanLeader(s) && !!s.dsBan && s.dsBan === donVi;

export function canCancelBooking(
  s: Session,
  bk: { status: string; requesterUsername: string },
): boolean {
  const owner = bk.requesterUsername === s.username;
  if ((bk.status === "cho_ban_duyet" || bk.status === "nhap") && owner) return true;
  if (bk.status === "cho_doi_xe" && (isDoiXe(s) || isVpDaiLeader(s))) return true;
  if (bk.status === "da_dieu_xe" && isVpDaiLeader(s)) return true;
  return false;
}
