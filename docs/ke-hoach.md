# Kế hoạch — Hệ thống Đặt xe Công tác HTV

Tài liệu tham chiếu rút gọn đi kèm mã nguồn (`htvxe`).

## Quyết định đã chốt

| | |
|---|---|
| Kiến trúc | **Cloud-only**. 1 nơi chạy (Cloudflare Workers), 1 CSDL (Supabase Postgres). Không bản nội bộ, không đồng bộ. |
| Stack | Hono (router + JSX server-render) + Drizzle ORM + postgres.js. Không framework SPA. |
| DB | PostgreSQL/Supabase, kết nối qua Transaction pooler cổng 6543. |
| Múi giờ | Hiển thị `Asia/Ho_Chi_Minh` (cố định trong `src/lib/tz.ts`), lưu UTC. |
| Đăng nhập | username + mật khẩu; seed toàn bộ `123456` (PBKDF2 qua WebCrypto). |
| Duyệt đơn | Chỉ `truong_ban` + `pho_ban` cùng `dsBan`. Trưởng/phó phòng không duyệt. |
| Lịch | Mọi người xem tất cả chuyến; nhân viên chỉ sửa/hủy đơn của mình khi chưa duyệt. |
| Xe/lái xe | 4 xe + 4 lái xe. 1 đơn = 1 xe. |
| Trùng lịch | Chỉ cảnh báo, vẫn cho lưu. |
| Nhiên liệu | Không theo dõi — chỉ km + thời gian. |
| Hủy đơn | Chưa duyệt → người tạo hủy. Đã điều xe → chỉ Trưởng/Phó Ban Văn Phòng Đài. |
| Thông báo | Trong app: badge ở sidebar + banner "chuyến chưa đóng" ở mọi trang. |
| Mã đơn | `HTV-<năm>-<số 6 chữ số>`, vd `HTV-2026-000123`. |

## Vai trò (`users.role`)

| Vai trò | Quyền chính |
|---|---|
| `nhan_vien` | Tạo đơn, xem tất cả, sửa/hủy đơn của mình khi chưa duyệt |
| `truong_ban`, `pho_ban` | + duyệt đơn của đúng `dsBan` |
| `truong_phong`, `pho_phong` | như nhân viên (không duyệt) |
| `to_truong`, `to_pho` | Điều xe (gán xe + lái xe), công-tơ-mét, thống kê, cảnh báo km ngoài đơn |
| lái xe (`nhan_vien` + `isDriver`) | Xem chuyến được phân, nhập công-tơ-mét + giờ, tạo đơn phát sinh |
| `ban_tgd` | Xem tất cả + thống kê (chỉ đọc) |
| `admin`, `admin_datxe` | Quản trị user/xe, bảng chất lượng dữ liệu. `admin_datxe` toàn quyền như `admin`. |

## Trạng thái đơn & màu

| `status` | Màu | Ý nghĩa |
|---|---|---|
| `nhap` | xám nhạt | Nháp (hiện app luôn gửi thẳng, ít dùng) |
| `cho_ban_duyet` | xám | Vừa gửi, chờ Ban |
| `ban_tu_choi` | đỏ | Ban từ chối |
| `cho_doi_xe` | cam | Ban đã duyệt |
| `doi_xe_tu_choi` | đỏ | Đội xe từ chối |
| `da_dieu_xe` | xanh lá | Đã gán xe + lái xe |
| `dang_chay` | xanh dương | Lái xe đã nhập km đầu |
| `hoan_thanh` | xám xanh | Đã nhập km cuối, đóng chuyến |
| `huy` | xám | Đã hủy |

Đơn phát sinh (`isPhatSinh = true`): bỏ qua bước Ban, vào thẳng `cho_doi_xe`.

## Mô hình dữ liệu

Nguồn sự thật: `src/db/schema.ts`. 9 bảng:

`users`, `vehicles`, `bookings` (lõi), `booking_approvals` (Ban ghi),
`booking_dispatch` (Đội xe ghi), `trip_logs` (lái xe ghi), `odometer_events`,
`audit_log` (chỉnh sửa sau khi khoá số liệu), `alert_acks` ("Biết rồi" cho cảnh báo km).

Quan hệ tới user tham chiếu theo `username`. Xoá = tắt cờ (`isActive` / `deletedAt`),
**không xoá cứng** để giữ lịch sử đơn.

## Lịch sử phát triển

- **Bản 1 (Next.js + Prisma trên Vercel)** — M0–M6: đăng nhập, lịch tuần, vòng đời đơn
  (tạo → Ban duyệt → Đội xe điều xe → lái xe nhập km → hoàn thành), hủy đơn theo quyền,
  đơn phát sinh, công-tơ-mét + cảnh báo km ngoài đơn, thống kê + CSV + in, quản trị user/xe.
- **Chuyển Vercel → Cloudflare** — đổi adapter sang `@opennextjs/cloudflare`, Prisma dùng
  driver adapter. Vướng: bundle ~3.4 MiB gzip, **vượt giới hạn Workers Free 3 MiB**
  (phần lớn do query engine WASM của Prisma).
- **Bản 2 (hiện tại — `htvxe`)** — viết lại từ đầu bằng Hono + Drizzle + postgres.js,
  **cloud-only** (bỏ SQLite local + daemon đồng bộ). Bundle ~115 KiB gzip. Giữ nguyên
  toàn bộ nghiệp vụ của bản 1. Thêm PWA manifest.

## Việc dữ liệu còn lại (`scripts/users.json`)

1. Các user có `full_name` trùng `username` — cần điền tên thật (bảng chất lượng dữ liệu ở `/quan-tri` đếm số này).
2. Bổ sung đủ Trưởng Ban + Phó Ban cho mọi đơn vị (logic duyệt phụ thuộc `dsBan`).
3. Chuẩn hoá `phone`.
4. Sửa vài lỗi chính tả tên.
5. Dòng `admin` trống thông tin.
