# Cẩm nang vận hành

Áp dụng cho bản **cloud-only**: 1 CSDL Supabase, 1 Worker Cloudflare. Không bản nội bộ,
không daemon đồng bộ.

Lệnh chạy trong **PowerShell**, tại `G:\apptulam\htvxe`.
Khi cần thao tác DB từ máy: đặt `$env:DATABASE_URL='<chuỗi Session pooler 5432>'` trước,
xong thì đóng cửa sổ hoặc `Remove-Item Env:DATABASE_URL`.

---

## 1. Sửa code rồi cập nhật lên production

```powershell
git pull            # LUÔN chạy trước khi bắt đầu sửa
# ... sửa code ...
npm run typecheck   # kiểm tra nhanh
git add -A && git commit -m "..." && git push
npm run deploy      # đẩy lên Cloudflare
```

- **Không cần** làm gì với Supabase nếu chỉ sửa giao diện / logic.
- **Nếu sửa `src/db/schema.ts`** (thêm/bớt cột, bảng): xem mục 7.
- Nên `git push` **trước** rồi mới `npm run deploy` — để mã trên GitHub và mã đang chạy
  trên Cloudflare luôn khớp nhau.

## 1b. Làm việc từ nhiều máy (nhà + cơ quan)

**Được — không có giới hạn "chỉ 1 máy".** Giới hạn đó là của bản cũ (có DB nội bộ +
daemon đồng bộ). Bản này không có gì chạy thường trực ở máy: **GitHub là nơi giữ mã
nguồn duy nhất**, còn `npm run deploy` chỉ là "đóng gói thư mục hiện tại rồi tải lên
Cloudflare".

### Cài 1 lần trên máy cơ quan
```powershell
# cài sẵn: Node.js (>=20) + Git
git clone https://github.com/vncustom/htvxe.git
cd htvxe
npm install
npx wrangler login          # xác thực Cloudflare cho MÁY NÀY (mở trình duyệt 1 lần)
```
- **Secret** (`DATABASE_URL`, `AUTH_SECRET`) đã nằm trên Cloudflare — **không cần** đặt
  lại ở máy cơ quan để `deploy`.
- Chỉ cần thêm khi máy đó phải chạy `db:push` / `seed`: đặt `$env:DATABASE_URL` (chuỗi
  5432) lúc chạy. Và chép riêng `scripts/users.json` (bị `.gitignore`) nếu cần `seed`.
- `.dev.vars` (nếu có) không đi theo Git — tạo lại từ `.dev.vars.example` khi cần
  `wrangler dev` cục bộ.

### Quy trình mỗi lần ngồi vào máy (nhà hoặc cơ quan)
1. `git pull` — lấy thay đổi máy kia đã đẩy lên.
2. Sửa code.
3. `git add -A && git commit -m "..." && git push`.
4. `npm run deploy`.

### Hai máy cùng sửa & deploy — có sao không?
Không sao, **miễn theo đúng quy trình trên**. Các điểm cần nhớ:

| Tình huống | Kết quả |
|---|---|
| Quên `git pull` trước khi sửa | Khi `git push` sẽ báo *rejected* → chạy `git pull` (Git tự trộn) → sửa xung đột nếu có → push lại. Không mất code. |
| `npm run deploy` từ máy có mã **cũ** (chưa `pull`) | Cloudflare bị lùi về bản cũ, đè mất thay đổi máy kia. **Cách tránh:** luôn `git pull` + `git push` trước khi `deploy`; nếu `git status` sạch và đã pull thì deploy an toàn. |
| Hai máy sửa **cùng một dòng** rồi cùng push | Máy push sau bị *conflict*, Git đánh dấu chỗ đụng để chọn tay. Bình thường của Git, không hỏng dữ liệu. |
| Deploy không liên quan gì tới Supabase | Dữ liệu (đơn, user…) nằm ở Supabase, deploy chỉ đổi mã chạy — deploy nhầm bản cũ **không làm mất dữ liệu**, chỉ mất thay đổi *code*. |

### Cách chắc ăn nhất: bật auto-deploy từ GitHub
Làm theo `docs/trien-khai.md` mục 6. Khi đó **chỉ cần `git push`**, Cloudflare tự build
bản mới nhất trên nhánh `main`. Không còn rủi ro "deploy nhầm mã cũ từ máy chưa pull",
và không cần `npx wrangler login` trên từng máy.

---

## 2. Thêm / sửa / xoá user

### Cách 1 — Trang Quản trị (khuyến nghị)
Đăng nhập `admin` (hoặc `adminxe`) → menu **Quản trị**:

- **Thêm**: *+ Thêm user* → điền → Lưu (mật khẩu khởi tạo `123456`).
- **Sửa**: bấm **Sửa** ở dòng user → đổi họ tên / vai trò / đơn vị / SĐT / cờ "lái xe" /
  "Đang hoạt động" → Lưu.
- **Đặt lại mật khẩu**: trong trang sửa user → nút *Đặt lại mật khẩu về 123456*.
- **Vô hiệu hoá**: bỏ tick **Đang hoạt động** → user không đăng nhập được nữa.
  Hệ thống **không xoá cứng** user để giữ lịch sử đơn.

Thay đổi có hiệu lực ngay (ghi thẳng Supabase).

### Cách 2 — Nạp hàng loạt từ `scripts/users.json`
Khi cần thêm/sửa nhiều (điền tên thật, đổi đơn vị hàng loạt…):

1. Sửa `scripts/users.json` (mảng object: `username, fullName, dsBan, dsPhong, dsTo,
   role, jobTitle, email, phone, isDriver`).
2. ```powershell
   $env:DATABASE_URL='<chuỗi 5432>'
   npm run seed
   ```
`seed` là **upsert theo username** — chỉ thêm & sửa, **không xoá**, **không đổi mật khẩu**
user đã tồn tại. User cần bỏ → tắt "Đang hoạt động" ở Cách 1.

### Cách 3 — Xoá hẳn 1 user (hiếm khi cần)
Chỉ làm được nếu user **chưa từng tạo đơn / được phân chuyến**. Supabase → **SQL Editor**:
```sql
delete from users where username = '<username>';
```
Khuyến nghị: **cứ tắt hoạt động, đừng xoá.**

---

## 3. Sao lưu & khôi phục dữ liệu

Không còn `dev.db` để copy. Thay vào đó:

- **Tự động**: Supabase sao lưu hằng ngày (gói Free giữ vài ngày) —
  dashboard → **Database → Backups**.
- **Thủ công trước mốc quan trọng** (go-live, trước khi xoá dữ liệu thử):
  - Supabase → **Database → Backups → Create backup**, hoặc
  - Export từng bảng ra CSV (Table editor → ⋯ → Export), hoặc
  - `pg_dump "<chuỗi 5432>" > backup.sql` từ máy có cài Postgres client.
- **Khôi phục**: Restore từ backup trong dashboard, hoặc `psql "<chuỗi 5432>" < backup.sql`.

---

## 4. Dữ liệu mẫu để xem thử luồng

Bản này **chưa có script seed demo**. Cách tạo nhanh vài đơn ở đủ trạng thái để trình diễn:

1. Đăng nhập một `nhan_vien` → **Tạo đơn** vài lần.
2. Đăng nhập Trưởng/Phó ban cùng đơn vị → `/duyet` → duyệt một số, từ chối một số.
3. Đăng nhập `huynhvantuan` (Đội xe) → `/dieu-xe` → điều xe cho vài đơn.
4. Đăng nhập `laixe1` → **Chuyến của tôi** → nhập km đi (rồi km về cho vài chuyến),
   cố tình nhập km đi chuyến sau lớn hơn km về chuyến trước để thử cảnh báo "km ngoài đơn".

Muốn xoá hết đơn thử sau đó → mục 5 Cách B.

---

## 5. Reset dữ liệu trước khi chạy thật

### Cách A — Xoá sạch, seed lại 367 user + 4 xe (số km = 0)
```powershell
$env:DATABASE_URL='<chuỗi 5432>'
npm run db:push -- --force   # dựng lại schema; hoặc chạy TRUNCATE ở SQL Editor (dưới)
npm run seed
```
Hoặc chạy trong Supabase **SQL Editor**:
```sql
truncate users, vehicles, bookings, booking_approvals, booking_dispatch,
         trip_logs, odometer_events, audit_log, alert_acks restart identity cascade;
```
rồi `npm run seed`.

### Cách B — Chỉ xoá đơn/chuyến, GIỮ user + xe + số km đã cấu hình
Supabase **SQL Editor**:
```sql
truncate bookings, booking_approvals, booking_dispatch,
         trip_logs, odometer_events, audit_log, alert_acks restart identity cascade;
```

### Trước khi go-live nên
- Đổi `AUTH_SECRET`: `npx wrangler secret put AUTH_SECRET` rồi `npm run deploy`
  (mọi người đăng nhập lại).
- Tạo 1 backup thủ công trên Supabase làm mốc "khai trương".
- Nhắc mọi người đổi mật khẩu khỏi `123456` (hiện chưa bắt buộc — báo nếu cần thêm tính năng).

---

## 6. Set chỉ số công-tơ-mét ban đầu cho từng xe

Sau khi seed, tất cả xe = 0. Cần đặt = **số trên đồng hồ xe lúc bắt đầu dùng hệ thống thật**.

**Cách làm** (Đội xe hoặc admin): mở **Công-tơ-mét** → mục *"Đặt lại số km gốc của xe"*
→ chọn xe, nhập số thực → **Lưu**.

Lưu ý:
- Chốt số cùng lúc cho cả 4 xe, ghi lại **ngày giờ chốt** ra sổ.
- Chuyến đầu tiên của mỗi xe: lái xe nhập "số km lúc xuất bến" đúng bằng số này
  (form điền sẵn). Từ đó hệ thống tự nối chuỗi công-tơ-mét và phát hiện km chạy ngoài đơn.
- Việc chỉnh số km cũng ghi vào nhật ký (`audit_log`).

---

## 7. Đổi lược đồ / chèn dữ liệu thủ công / xoá sạch bảng

### 7.1. Đổi `src/db/schema.ts` (thêm/bớt cột hoặc bảng)
```powershell
$env:DATABASE_URL='<chuỗi 5432>'
npm run db:push          # Drizzle so sánh schema với DB rồi áp thay đổi
npm run deploy           # đẩy code mới lên Cloudflare
```
- `npm run db:generate` (tuỳ chọn) sinh file SQL migration trong `drizzle/` để lưu vết.
- Thay đổi phá huỷ (đổi kiểu cột, bỏ cột có dữ liệu): Drizzle sẽ hỏi xác nhận; cân nhắc
  backup trước.

### 7.2. Chèn 1 user thẳng bằng SQL (khi chưa tiện dùng trang Quản trị)
Supabase **SQL Editor** — cần một chuỗi băm PBKDF2 của `123456`. Lấy chuỗi băm chạy ở máy
(tại `G:\apptulam\htvxe`):
```powershell
npx tsx -e "import('./src/lib/password').then(m=>m.hashPassword('123456')).then(console.log)"
```
rồi:
```sql
insert into users (username, full_name, role, password_hash, is_driver, is_active)
values ('adminxe', 'admin_datxe', 'admin_datxe', '<chuỗi-pbkdf2>', false, true)
on conflict (username) do update set role = excluded.role, updated_at = now();
```
> Đơn giản hơn: đăng nhập `admin` → **Quản trị → + Thêm user** (tự băm mật khẩu).

### 7.3. Xoá sạch toàn bộ bảng
Supabase **SQL Editor**:
```sql
truncate users, vehicles, bookings, booking_approvals, booking_dispatch,
         trip_logs, odometer_events, audit_log, alert_acks restart identity cascade;
```
Hoặc dựng lại toàn bộ lược đồ từ đầu:
```powershell
$env:DATABASE_URL='<chuỗi 5432>'
npm run db:push -- --force
npm run seed
```
