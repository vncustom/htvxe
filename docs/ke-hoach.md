# Kế hoạch — Hệ thống Đặt xe Công tác HTV

Tài liệu tham chiếu rút gọn đi kèm mã nguồn (`htvxe`).

## Quyết định đã chốt

| | |
|---|---|
| Kiến trúc | **Cloud-only**. 1 nơi chạy (Cloudflare Workers), 1 CSDL (Supabase Postgres). Không bản nội bộ, không đồng bộ. |
| Deploy | GitHub → Cloudflare **Workers Builds**: `git push` lên `main` là tự build. |
| Stack | Hono (router + JSX server-render) + Drizzle ORM + postgres.js. Không framework SPA. |
| DB | PostgreSQL/Supabase, kết nối qua Transaction pooler cổng 6543 (`prepare:false`). |
| Múi giờ | Hiển thị `Asia/Ho_Chi_Minh` (cố định trong `src/lib/tz.ts`), lưu UTC. |
| Đăng nhập | username + mật khẩu; seed toàn bộ `123456` (PBKDF2 qua WebCrypto). JWT trong cookie `Secure`. |
| Duyệt đơn | Chỉ `truong_ban` + `pho_ban` cùng `dsBan`. Trưởng/phó phòng không duyệt. |
| Lịch | Mọi người xem tất cả chuyến đang hoạt động; chọn ngày để nhảy tuần; chú thích màu. |
| Xe/lái xe | 4 xe + 4 lái xe. 1 đơn = 1 xe. |
| Trùng lịch | Chỉ cảnh báo khi điều xe, vẫn cho lưu. |
| Nhiên liệu | Không theo dõi — chỉ km + thời gian. |
| Hủy / sửa đơn | Chưa duyệt hoặc **đã bị từ chối** → chủ đơn hủy được. Đơn bị từ chối còn có **"Sửa & gửi lại"**. Đã điều xe → chỉ Trưởng/Phó Ban Văn Phòng Đài (hoặc Đội xe khi mới ở Chờ Đội xe). |
| Đặt lại số km gốc của xe | **Chỉ `admin` / `admin_datxe`.** Đội xe chỉ điều chỉnh km theo từng chuyến đã đóng. |
| Thông báo | Trong app: **chuông cạnh tên** (badge tổng) + badge từng mục ở sidebar + banner "chuyến chưa đóng" ở mọi trang + trang `/thong-bao`. |
| Thống kê | Mặc định **trọn tháng hiện tại** (ngày 1 → ngày cuối tháng). Lái xe có trang "Thống kê của tôi". |
| Mã đơn | `HTV-<năm>-<số 6 chữ số>`, vd `HTV-2026-000123`. |

## Vai trò (`users.role`)

| Vai trò | Quyền chính |
|---|---|
| `nhan_vien` | Tạo đơn, xem tất cả, sửa/hủy đơn của mình khi chưa duyệt hoặc bị từ chối |
| `truong_ban`, `pho_ban` | + duyệt đơn của đúng `dsBan` |
| `truong_phong`, `pho_phong` | như nhân viên (không duyệt) |
| `to_truong`, `to_pho` | Điều xe (gán xe + lái xe), công-tơ-mét, thống kê, cảnh báo km ngoài đơn, điều chỉnh km chuyến đã đóng |
| lái xe (`nhan_vien` + `isDriver`) | Xem chuyến được phân, nhập công-tơ-mét + giờ, tạo đơn phát sinh, **Thống kê của tôi** |
| `ban_tgd` | Xem tất cả + thống kê (chỉ đọc) |
| `admin`, `admin_datxe` | Quản trị user/xe, bảng chất lượng dữ liệu, **đặt lại số km gốc của xe**. `admin_datxe` toàn quyền như `admin`. |

## Trạng thái đơn & màu

| `status` | Màu | Ý nghĩa |
|---|---|---|
| `nhap` | xám nhạt | Nháp (hiện app luôn gửi thẳng, ít dùng) |
| `cho_ban_duyet` | xám | Vừa gửi, chờ Ban |
| `ban_tu_choi` | đỏ | Ban từ chối — chủ đơn Sửa & gửi lại (→ `cho_ban_duyet`) hoặc Hủy |
| `cho_doi_xe` | cam | Ban đã duyệt |
| `doi_xe_tu_choi` | đỏ | Đội xe từ chối — chủ đơn Sửa & gửi lại (→ `cho_doi_xe`) hoặc Hủy |
| `da_dieu_xe` | xanh lá | Đã gán xe + lái xe |
| `dang_chay` | xanh dương | Lái xe đã nhập km đầu |
| `hoan_thanh` | xám xanh | Đã nhập km cuối, đóng chuyến |
| `huy` | xám | Đã hủy |

Lịch tuần chỉ hiển thị các trạng thái *đang hoạt động*: `cho_ban_duyet`, `cho_doi_xe`,
`da_dieu_xe`, `dang_chay`, `hoan_thanh` — có chú thích màu ngay trên lưới.

Đơn phát sinh (`isPhatSinh = true`): bỏ qua bước Ban, vào thẳng `cho_doi_xe`. Chỉ Đội xe
hoặc lái xe tạo được.

## Badge "Đơn của tôi" / chuông

`donCuaToi` đếm đơn *do mình tạo* đang ở `ban_tu_choi`, `doi_xe_tu_choi`, hoặc
`da_dieu_xe` (vừa có biến động, cần chủ đơn xem). Trang **Đơn của tôi** hiện hộp
"cần bạn xem" liệt kê đúng các đơn này. Số trên **chuông** = tổng các việc cần xử lý
theo vai (chờ duyệt + chờ điều xe + chuyến được phân + chuyến chưa đóng + donCuaToi).

## Mô hình dữ liệu

Nguồn sự thật: `src/db/schema.ts`. 9 bảng:

`users`, `vehicles`, `bookings` (lõi), `booking_approvals` (Ban ghi),
`booking_dispatch` (Đội xe ghi), `trip_logs` (lái xe ghi), `odometer_events`,
`audit_log` (chỉnh sửa sau khi khoá số liệu), `alert_acks` ("Biết rồi" cho cảnh báo km).

Quan hệ tới user tham chiếu theo `username` (không FK). Xoá = tắt cờ (`isActive` /
`deletedAt`), **không xoá cứng** để giữ lịch sử đơn. `drizzle/0000_init.sql` là bản SQL
tạo bảng dùng khi dựng qua Supabase SQL Editor.

## Lịch sử phát triển

- **Bản 1 (Next.js + Prisma trên Vercel)** — M0–M6: đăng nhập, lịch tuần, vòng đời đơn,
  hủy đơn theo quyền, đơn phát sinh, công-tơ-mét + cảnh báo km ngoài đơn, thống kê +
  CSV + in, quản trị user/xe.
- **Chuyển Vercel → Cloudflare** — `@opennextjs/cloudflare` + Prisma driver adapter;
  bundle ~3.4 MiB gzip **vượt** giới hạn Workers Free 3 MiB (chủ yếu do query engine WASM).
- **Bản 2 (`htvxe`)** — viết lại từ đầu bằng Hono + Drizzle + postgres.js, **cloud-only**
  (bỏ SQLite local + daemon đồng bộ). Bundle ~115 KiB gzip. Giữ nguyên nghiệp vụ bản 1.
  Thêm PWA manifest.
- **Vòng cải thiện gần đây**:
  - Dựng & deploy không cần máy local: `drizzle/0000_init.sql` + `scripts/seed.sql` +
    `scripts/demo.sql` chạy qua Supabase SQL Editor; auto-deploy qua Workers Builds.
  - Giao diện làm lại: sidebar/logo Đài, card + bảng bo góc đổ bóng, avatar, focus ring.
  - Lịch tuần: chọn ngày để nhảy tuần, chú thích màu, đánh dấu "Hôm nay".
  - Chuông thông báo cạnh tên (badge tổng).
  - "Đơn của tôi": hộp "cần bạn xem", lọc theo nhóm trạng thái, phân trang 25/trang.
  - Đơn bị từ chối: "Sửa & gửi lại" + chủ đơn được Hủy.
  - "Chuyến của tôi" hiện SĐT biên tập + lái xe.
  - "Thống kê của tôi" cho lái xe; thống kê mặc định trọn tháng.
  - "Đặt lại số km gốc của xe" giới hạn còn `admin` / `admin_datxe`.

## Việc dữ liệu còn lại (`scripts/users.json` / `scripts/seed.sql`)

1. User có `full_name` trùng `username` — điền tên thật (bảng chất lượng dữ liệu ở `/quan-tri` đếm).
2. Đủ Trưởng Ban + Phó Ban cho mọi đơn vị (logic duyệt phụ thuộc `dsBan`).
3. Chuẩn hoá `phone`.
4. Sửa lỗi chính tả tên.
5. Dòng `admin` trống thông tin.
