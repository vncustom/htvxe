"""Chuyen file Excel danh sach user cua Admin -> scripts/users.json de chay `npm run seed`.

Cach dung:
    python scripts/convert_admin_users.py <file_excel_admin.xlsx> [file_csv_cu_supabase.csv]

- <file_excel_admin.xlsx>: file Admin moi xuat (vd DS_user_20260915_075019.xlsx), sheet dau tien,
  cac cot: username, full_name, ds_ban, ds_phong, ds_to, bac_vtvl, ds_vai_tro, JobTitles, Email, phone.
- [file_csv_cu_supabase.csv]: (tuy chon nhung nen co) ban export CSV cua bang `users` hien tai tren
  Supabase (Table editor -> users -> Export). Dung de GIU LAI email/phone/job_title/is_driver cu
  khi file moi de trong, tranh ghi de mat du lieu.

Ket qua: ghi de scripts/users.json (dinh dang SeedUser[] ma scripts/seed.ts doc).
Neu gap gia tri `ds_vai_tro` la, script se IN CANH BAO va giu nguyen role cu (hoac "nhan_vien"
neu la user hoan toan moi) - PHAI tu sua tay scripts/users.json truoc khi chay `npm run seed`.
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROLE_MAP = {
    "truong_ban": "truong_ban",
    "pho_ban": "pho_ban",
    "nhan_vien": "nhan_vien",
    "truong_phong": "truong_phong",
    "pho_phong": "pho_phong",
    "bantgd": "ban_tgd",
    "ban_tgd": "ban_tgd",
    "to_truong": "to_truong",
    "to_pho": "to_pho",
    "admin_datxe": "admin_datxe",
    "admin": "admin",
}


def norm_role(raw):
    """Tra ve (role_chuan, ok) voi ok=False neu khong nhan dien duoc gia tri."""
    if not isinstance(raw, str) or not raw.strip():
        return None, True  # trong -> khong phai loi, se dung role cu
    key = raw.strip().lower()
    if key in ROLE_MAP:
        return ROLE_MAP[key], True
    key_no_us = key.replace("_", "")
    for k, v in ROLE_MAP.items():
        if k.replace("_", "") == key_no_us:
            return v, True
    return raw, False


def clean_str(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    excel_path = Path(sys.argv[1])
    csv_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None

    if not excel_path.exists():
        print(f"Khong tim thay file: {excel_path}")
        sys.exit(1)

    new_df = pd.read_excel(excel_path)

    old_by_username = {}
    if csv_path and csv_path.exists():
        old_df = pd.read_csv(csv_path)
        old_by_username = old_df.set_index("username").to_dict("index")
    elif csv_path:
        print(f"Canh bao: khong tim thay {csv_path}, se khong giu duoc du lieu cu.")

    out = []
    unknown_roles = []
    new_users = []

    for _, row in new_df.iterrows():
        username = clean_str(row.get("username"))
        if not username:
            continue
        old = old_by_username.get(username)
        is_new_user = old is None
        if is_new_user:
            new_users.append(username)
            old = {}

        role_raw = clean_str(row.get("ds_vai_tro"))
        role, ok = norm_role(role_raw)
        if not ok:
            unknown_roles.append((username, role_raw))
            role = old.get("role") or "nhan_vien"
        elif role is None:
            role = old.get("role") or "nhan_vien"

        job_title = clean_str(row.get("JobTitles")) or clean_str(old.get("job_title"))
        email = clean_str(row.get("Email")) or clean_str(old.get("email"))
        phone = clean_str(row.get("phone")) or clean_str(old.get("phone"))

        old_is_driver = bool(old.get("is_driver")) if old.get("is_driver") is not None else False
        is_driver = old_is_driver or (job_title == "Lái xe")

        full_name = clean_str(row.get("full_name")) or username

        out.append(
            {
                "username": username,
                "fullName": full_name,
                "dsBan": clean_str(row.get("ds_ban")),
                "dsPhong": clean_str(row.get("ds_phong")),
                "dsTo": clean_str(row.get("ds_to")),
                "role": role,
                "jobTitle": job_title,
                "email": email,
                "phone": phone,
                "isDriver": is_driver,
            }
        )

    out_path = Path(__file__).parent / "users.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Da ghi {len(out)} user vao {out_path}")
    if new_users:
        print(f"\n{len(new_users)} user hoan toan moi (se tao voi mat khau mac dinh 123456):")
        for u in new_users[:30]:
            print(f"  + {u}")
        if len(new_users) > 30:
            print(f"  ... va {len(new_users) - 30} nguoi khac")

    if unknown_roles:
        print(f"\n!!! {len(unknown_roles)} dong co ds_vai_tro LA, chua nhan dien duoc:")
        for u, r in unknown_roles:
            print(f"  - {u}: '{r}'  (dang tam giu role cu trong users.json, SUA TAY truoc khi seed)")
    else:
        print("\nKhong co role la. Kiem tra lai scripts/users.json roi chay: npm run seed")


if __name__ == "__main__":
    main()
