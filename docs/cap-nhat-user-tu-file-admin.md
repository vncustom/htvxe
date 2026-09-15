# Cập nhật bảng `users` từ file Excel của Admin

Định kỳ, Admin (bên quản lý nhân sự / HTV) xuất một file Excel kiểu
`DS_user_YYYYMMDD_HHMMSS.xlsx` chứa danh sách người dùng mới nhất. Tài liệu này
hướng dẫn cách đưa dữ liệu đó vào bảng `users` trên Supabase mà **không làm mất**
dữ liệu đã có (mật khẩu, cờ hoạt động, cờ lái xe...).

---

## 0. Chuẩn bị máy (chỉ làm 1 lần)

Windows PowerShell mặc định chặn chạy script (`npm`, `tsx`... đều gọi qua file
`.ps1`), sẽ báo lỗi kiểu:

```
npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

Mở PowerShell, chạy 1 lần (không cần quyền admin):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Gõ `Y` khi được hỏi xác nhận. Từ giờ `npm run ...` chạy bình thường.

Ngoài ra cần có `pandas`, `openpyxl` cho script Python ở Bước 1:

```bash
pip install pandas openpyxl
```

---

## 1. Cấu trúc file Admin cấp

File Excel có 1 sheet (tên sheet có thể đổi, ví dụ `MXH_user`), các cột:

| Cột trong file Excel | Ý nghĩa | Cột tương ứng trong bảng `users` |
|---|---|---|
| `username` | Tên đăng nhập (khớp với username HTV SSO) | `username` |
| `full_name` | Họ tên | `full_name` |
| `ds_ban` | Ban | `ds_ban` |
| `ds_phong` | Phòng | `ds_phong` |
| `ds_to` | Tổ | `ds_to` |
| `bac_vtvl` | Bậc vị trí việc làm (số 3–7) | *chưa có cột riêng trong schema hiện tại — xem mục 5* |
| `ds_vai_tro` | Mã vai trò | `role` (cần chuẩn hoá — xem mục 2) |
| `JobTitles` | Chức danh hiển thị | `job_title` |
| `Email` | Email | `email` |
| `phone` | SĐT | `phone` |

Các cột **không có** trong file Admin nhưng bảng `users` cần: `password_hash`,
`is_active`, `is_driver`. Vì vậy đây là thao tác **upsert theo `username`**, không
phải ghi đè toàn bảng — xem mục 3.

---

## 2. Chuẩn hoá dữ liệu trước khi nạp

File Admin xuất ra không đồng nhất cách viết `ds_vai_tro`, cần map về đúng mã
`role` mà ứng dụng đang dùng (xem `src/lib/rbac.ts`):

| Giá trị gặp trong file Admin | `role` chuẩn trong app |
|---|---|
| `truong_ban` | `truong_ban` |
| `pho_ban` | `pho_ban` |
| `nhan_vien` | `nhan_vien` |
| `truong_phong` | `truong_phong` |
| `Pho_phong`, `pho_phong` | `pho_phong` |
| `BanTGD` | `ban_tgd` |
| `to_truong` | `to_truong` |
| `to_pho` | `to_pho` |
| `admin_datxe` | `admin_datxe` |

Quy tắc chung: `giá_trị.strip().lower()`, riêng `BanTGD` map cứng về `ban_tgd`.
Nếu gặp giá trị lạ không nằm trong danh sách trên → **không đoán**, để nguyên và
báo người kiểm tra thủ công (đừng để một role rác lọt vào DB, vì `role` quyết
định quyền duyệt đơn).

`is_driver`: file Admin không có cột này, suy ra từ `JobTitles`:
- `JobTitles == "Lái xe"` → `is_driver = true`
- Còn lại → giữ nguyên giá trị `is_driver` hiện có trong DB (đừng mặc định `false`,
  vì sẽ tắt oan cờ lái xe của người đã được set thủ công).

`email`, `phone`: nhiều dòng trống (`NaN`). **Không ghi đè** email/phone hiện có
trong DB bằng giá trị rỗng — chỉ cập nhật khi file Admin có giá trị mới.

Trước khi chạy nạp, rà nhanh bằng mắt các dòng bất thường, ví dụ dòng có
`full_name` trùng y hệt `username` (không viết hoa/dấu) — đây thường là do Admin
xuất thiếu, nên đối chiếu lại trước khi ghi vào DB.

---

## 3. Quy trình nạp (khuyến nghị — Cách 3 mở rộng trong `docs/van-hanh.md`)

Chạy từ thư mục gốc project (`D:\project\htvxe`), **theo đúng thứ tự 2 bước** —
`npm run seed` không tự đọc file Excel, nó chỉ đọc `scripts/users.json` do
Bước 1 tạo ra. Bỏ qua Bước 1 sẽ báo lỗi `ENOENT ... scripts\\users.json`.

### Bước 1 — Chuyển Excel → `scripts/users.json`

Script có sẵn tại [`scripts/convert_admin_users.py`](../scripts/convert_admin_users.py).

```bash
python scripts/convert_admin_users.py "<đường dẫn file Excel Admin gửi>.xlsx" "<đường dẫn file CSV export users hiện tại>.csv"
```

Ví dụ thực tế:

```bash
python scripts/convert_admin_users.py "C:\Users\pc\Downloads\DS_user_20260915_075019.xlsx" "C:\Users\pc\Downloads\users_cu_supabase.csv"
```

Tham số thứ 2 (file CSV) là **tuỳ chọn nhưng nên có** — export từ Supabase:
Table editor → bảng `users` → nút **Export** → CSV. Có file này thì script mới
giữ được `email` / `phone` / `job_title` / `is_driver` cũ khi file Admin để trống
các ô đó, tránh ghi đè mất dữ liệu.

Script sẽ in ra:
- Số user đã ghi vào `scripts/users.json`.
- Danh sách user **hoàn toàn mới** (chưa có trong file CSV cũ) — những người này
  sẽ được tạo với mật khẩu mặc định `123456`.
- Cảnh báo nếu có `ds_vai_tro` **lạ**, không khớp 1 trong 10 mã role hợp lệ (xem
  bảng ở mục 2) — trường hợp này script tạm giữ role cũ (hoặc `nhan_vien` nếu là
  user mới) và bạn **phải tự sửa tay** trong `scripts/users.json` trước khi
  chạy tiếp.

Kiểm tra kỹ nội dung `scripts/users.json` (đặc biệt các dòng bị cảnh báo) trước
khi qua bước 2. Xác nhận file này đã xuất hiện trong thư mục `scripts/` (mở
Explorer hoặc `dir scripts\users.json`).

### Bước 2 — Nạp vào Supabase

Lấy chuỗi kết nối: Supabase dashboard → **Project Settings → Database →
Connection string → Session pooler** — dùng đúng cổng **5432** (không dùng
`6543` là Transaction pooler, dễ lỗi khi ghi hàng loạt nhiều dòng liên tiếp).

```powershell
$env:DATABASE_URL='postgresql://postgres.xxxxxxxx:MATKHAU@aws-0-xxxxx.pooler.supabase.com:5432/postgres'
npm run seed          # tsx scripts/seed.ts — upsert theo username
```

Nếu gặp lỗi `... npm.ps1 cannot be loaded because running scripts is disabled`
→ xem mục 0 (chưa bật quyền chạy script PowerShell).

`scripts/seed.ts` chỉ **thêm mới / cập nhật** theo `username` (`on conflict
(username) do update`) — **không xoá** user vắng mặt trong file, **không đổi
mật khẩu** người đã có. User hoàn toàn mới sẽ được tạo với mật khẩu mặc định
`123456`. Cuối cùng script in ra tổng số user/xe hiện có trong DB để đối chiếu.

### Bước 3 — Kiểm tra sau khi nạp

- Vào trang **Quản trị** trong app, lọc theo Ban/Phòng vừa đổi, xác nhận vai trò
  và chức danh hiển thị đúng.
- Đối chiếu vài tài khoản lái xe (`is_driver`) để chắc cờ không bị tắt oan.
- Nếu ai đó đăng nhập không được sau khi cập nhật, kiểm tra `username` trong file
  Admin có khớp chính xác với username HTV SSO không (xem
  [`docs/huong-dan-tich-hop-htv-sso.md`](huong-dan-tich-hop-htv-sso.md)).

---

## 4. Nếu chỉ có vài người thay đổi

Không cần chạy script cho vài chục dòng lẻ tẻ — sửa trực tiếp qua **Quản trị →
Sửa user** trong giao diện web (xem mục 2 của `docs/van-hanh.md`). Chỉ dùng quy
trình ở mục 3 khi Admin gửi **toàn bộ danh sách mới** (vài trăm dòng).

---

## 5. Cột `bac_vtvl` (bậc vị trí việc làm)

Cột này đã tồn tại sẵn trong bảng `users` trên Supabase (thêm bằng tay, hiện tại
toàn bộ đang `NULL`) nhưng **chưa khai báo trong `src/db/schema.ts`** và ứng dụng
chưa dùng đến. Nếu về sau cần hiển thị/dùng `bac_vtvl` trong app:

1. Thêm cột vào `usersTable` trong `src/db/schema.ts`:
   ```ts
   bacVtvl: integer("bac_vtvl"),
   ```
2. `npm run db:generate` rồi `npm run db:push` (xem mục 6 của `docs/van-hanh.md`).
3. Bổ sung `bacVtvl` vào `scripts/convert_admin_users.py` và `scripts/seed.ts`.

Cho tới lúc đó, giá trị `bac_vtvl` trong file Admin **có thể bỏ qua** khi nạp —
không ảnh hưởng gì đến app hiện tại.
