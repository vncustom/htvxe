# Cẩm nang vận hành

Bản **cloud-only**: 1 CSDL Supabase, 1 Worker Cloudflare. Không bản nội bộ, không daemon
đồng bộ.

- **Dữ liệu** (user, đơn, chuyến, km…): thao tác qua **giao diện web** hoặc **Supabase SQL Editor**.
- **Mã nguồn**: sửa → `git push` → Cloudflare tự build & deploy.
- Hầu hết việc vận hành **không cần máy local**.

---

## 1. Cập nhật mã lên production

Đã bật auto-deploy (Workers Builds nối GitHub — xem `docs/trien-khai.md` mục 5):

```bash
git pull            # trước khi sửa
# ... sửa code ...
npm run typecheck   # tuỳ chọn, kiểm tra nhanh (cần npm install 1 lần)
git add -A && git commit -m "..." && git push
```

`git push` lên `main` → Cloudflare tự build. Theo dõi ở Worker `htvxe` → **Deployments**.

- Chỉ sửa giao diện / logic → **không đụng** Supabase.
- Sửa `src/db/schema.ts` → xem mục 6.
- Deploy thẳng không qua GitHub (khi cần): `npm run deploy` từ máy đã `npx wrangler login`.

### Làm việc từ nhiều máy
Không giới hạn "chỉ 1 máy". Quy trình mỗi lần: `git pull` → sửa → `git push`. Nếu quên
pull thì `git push` bị *rejected* → `git pull` (Git tự trộn) → sửa xung đột nếu có →
push lại. Dữ liệu ở Supabase không bị ảnh hưởng bởi việc deploy.

---

## 2. Thêm / sửa / xoá user

### Cách 1 — Trang Quản trị (khuyến nghị)
Đăng nhập `admin` (hoặc `adminxe`) → menu **Quản trị**:

- **Thêm**: *+ Thêm user* → điền → Lưu (mật khẩu khởi tạo `123456`).
- **Sửa**: bấm **Sửa** ở dòng user → đổi họ tên / vai trò / đơn vị / SĐT / cờ "lái xe" /
  "Đang hoạt động" → Lưu.
- **Đặt lại mật khẩu**: trong trang sửa user → *Đặt lại mật khẩu về 123456*.
- **Vô hiệu hoá**: bỏ tick **Đang hoạt động** → user không đăng nhập được.
  Hệ thống **không xoá cứng** để giữ lịch sử đơn.

> **Lưu ý về HTV SSO**:
> - Đảm bảo `username` trong bảng `users` khớp đúng với tên đăng nhập trên hệ thống HTV SSO.
> - Khi nhân sự đăng nhập bằng HTV SSO, hệ thống **không dùng mật khẩu trong Supabase** (mật khẩu do HTV SSO quản lý và người dùng tự đổi tại HTV SSO).
> - Mật khẩu trong Supabase chỉ dùng khi người dùng đăng nhập bằng phương thức **"Đăng nhập nội bộ"** (dự phòng khi ở ngoài mạng cơ quan).
> - Xem thêm tài liệu chi tiết: [`docs/huong-dan-tich-hop-htv-sso.md`](huong-dan-tich-hop-htv-sso.md).

Thay đổi có hiệu lực ngay (ghi thẳng Supabase).

### Cách 2 — Nạp hàng loạt bằng SQL
Khi cần thêm/sửa nhiều người:

- Có sẵn `scripts/seed.sql` → sửa/nối thêm câu `insert ... on conflict (username) do update`
  rồi dán vào **Supabase → SQL Editor → Run**. Upsert theo `username` — chỉ thêm & sửa,
  **không xoá**, **không đổi mật khẩu** người đã có.
- Cần một chuỗi băm PBKDF2 của `123456` cho user mới. Lấy nhanh 1 chuỗi hợp lệ:
  ```
  pbkdf2$100000$J6R+WNbm3143s421VTl8/w==$Q7v2Q+R4e37PTDQsEmLVuZnIDqus3U18WPJIqDgRmcg=
  ```
  (hoặc dùng trang Quản trị để nó tự băm).

### Cách 3 — Tạo lại `scripts/seed.sql` từ `scripts/users.json` (cần máy)
Nếu quản danh sách bằng `scripts/users.json` (mảng object: `username, fullName, dsBan,
dsPhong, dsTo, role, jobTitle, email, phone, isDriver`):

```bash
$env:DATABASE_URL='<chuỗi Session pooler 5432>'
npm run seed          # tsx scripts/seed.ts — upsert thẳng vào Supabase
```

`scripts/users.json` chứa thông tin cá nhân → **bị `.gitignore`**, giữ 1 bản cục bộ.

### Cách 4 — Xoá hẳn 1 user (hiếm)
Chỉ được nếu user **chưa từng tạo đơn / được phân chuyến**. Supabase SQL Editor:
```sql
delete from users where username = '<username>';
```
Khuyến nghị: **cứ tắt hoạt động, đừng xoá.**

---

## 3. Dữ liệu demo để trình diễn

- **Nạp**: Supabase SQL Editor → dán [`scripts/demo.sql`](../scripts/demo.sql) → Run.
  Tạo 22 đơn phủ **mọi trạng thái + màu**, có đơn phát sinh, cảnh báo km, audit log,
  chuyến đang chạy / quá giờ. Mốc thời gian tính theo `now()` nên luôn "tươi". Chạy lại
  được (tự dọn demo cũ theo `created_by='demo-seed'`).
- **Xoá sạch demo** (giữ user + xe): dán [`scripts/demo-cleanup.sql`](../scripts/demo-cleanup.sql).

---

## 4. Sao lưu & khôi phục

- **Tự động**: Supabase sao lưu hằng ngày (Free giữ vài ngày) — dashboard →
  **Database → Backups**.
- **Thủ công trước mốc quan trọng** (go-live, trước khi xoá dữ liệu thử):
  Supabase → **Database → Backups → Create backup**, hoặc export từng bảng ra CSV
  (Table editor → ⋯ → Export), hoặc `pg_dump "<chuỗi 5432>" > backup.sql`.
- **Khôi phục**: Restore trong dashboard, hoặc `psql "<chuỗi 5432>" < backup.sql`.

---

## 5. Reset dữ liệu trước khi chạy thật

### Chỉ xoá đơn/chuyến, GIỮ user + xe + số km
Supabase SQL Editor:
```sql
truncate bookings, booking_approvals, booking_dispatch,
         trip_logs, odometer_events, audit_log, alert_acks restart identity cascade;
```

### Xoá sạch tất cả rồi nạp lại
```sql
truncate users, vehicles, bookings, booking_approvals, booking_dispatch,
         trip_logs, odometer_events, audit_log, alert_acks restart identity cascade;
```
rồi dán lại `scripts/seed.sql`.

### Trước khi go-live nên
- Đổi `AUTH_SECRET`: Worker → Settings → Variables and Secrets → sửa `AUTH_SECRET` →
  Deployments → Retry (mọi người đăng nhập lại). Hoặc `npx wrangler secret put AUTH_SECRET`.
- Tạo 1 backup thủ công trên Supabase làm mốc "khai trương".
- Đặt số công-tơ-mét gốc cho 4 xe (mục 7).
- Nhắc mọi người đổi mật khẩu khỏi `123456`.

---

## 6. Đổi lược đồ (`src/db/schema.ts`)

Nguồn sự thật là `src/db/schema.ts`. Hai cách áp thay đổi lên Supabase:

- **Từ máy** (khuyến nghị): 
  ```bash
  $env:DATABASE_URL='<chuỗi Session pooler 5432>'
  npm run db:push            # Drizzle so sánh schema với DB rồi áp
  npm run db:generate        # (tuỳ chọn) sinh file SQL migration trong drizzle/
  ```
- **Không có máy**: tự viết `ALTER TABLE …` trong Supabase SQL Editor cho khớp schema mới.

Sau đó `git push` để Cloudflare deploy code mới. Thay đổi phá huỷ (đổi kiểu cột, bỏ cột
có dữ liệu) → backup trước.

---

## 7. Đặt số công-tơ-mét gốc cho từng xe

Sau khi seed, mọi xe = 0. Cần đặt = **số trên đồng hồ xe lúc bắt đầu dùng hệ thống thật**.

**Ai làm**: **chỉ `admin` / `adminxe`**. Menu **Công-tơ-mét** → mục *"Đặt lại số km gốc
của xe"* → chọn xe, nhập số thực → **Lưu**. (Đội xe không thấy mục này — họ chỉ điều
chỉnh km theo từng chuyến đã đóng.)

Hoặc SQL Editor:
```sql
update vehicles set current_odometer = 235000 where plate_no = '50A-030.36';
```

Lưu ý:
- Chốt số cùng lúc cho cả 4 xe, ghi lại **ngày giờ chốt**.
- Chuyến đầu tiên: lái xe nhập "số km lúc xuất bến" đúng bằng số này (form điền sẵn).
- Việc chỉnh km theo chuyến ghi vào `audit_log`.

---

## 8. Xử lý tình huống thường gặp

| Tình huống | Cách xử lý |
|---|---|
| Đơn bị **Ban/Đội xe từ chối** nằm mãi ở "Đơn của tôi → cần xem" | Chủ đơn mở đơn → **Sửa & gửi lại** (Ban từ chối → về Chờ Ban duyệt; Đội xe từ chối → về Chờ Đội xe) hoặc **Hủy đơn**. |
| Chuông / badge còn số nhưng không rõ việc gì | Bấm **chuông** cạnh tên → trang Thông báo liệt kê từng việc. |
| Lịch tuần khó phân biệt màu | Chú thích màu ngay dưới thanh chọn tuần. |
| Danh sách "Đơn của tôi" quá dài | Dùng bộ lọc **Đang mở / Hoàn thành / Đã hủy / Tất cả** + phân trang. |
| Lái xe muốn xem tháng mình chạy bao nhiêu | Menu lái xe → **Thống kê của tôi** (mặc định trọn tháng, đổi khoảng ngày được). |
| Xe hỏng, ngừng dùng | Quản trị → Sửa xe → bỏ tick "Đang hoạt động" → xe không còn trong danh sách điều xe. |
