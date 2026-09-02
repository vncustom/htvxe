# Đặt xe Công tác HTV — bản Cloudflare

Ứng dụng đặt xe công tác cho Đài, chạy **cloud-only**: 1 nơi chạy (Cloudflare Workers),
1 CSDL (Supabase Postgres). Không có bản chạy nội bộ, không daemon đồng bộ.
Server-render bằng Hono + JSX, bundle ~120 KiB gzip (thừa sức trong Workers Free).

Tài liệu chi tiết trong [`docs/`](docs/):

| File | Nội dung |
|---|---|
| [`docs/trien-khai.md`](docs/trien-khai.md) | Dựng từ đầu & deploy — **không cần máy local** (Supabase SQL Editor + GitHub → Cloudflare tự build) |
| [`docs/van-hanh.md`](docs/van-hanh.md) | Vận hành hằng ngày: thêm/sửa user, sao lưu, reset dữ liệu, đổi lược đồ |
| [`docs/ke-hoach.md`](docs/ke-hoach.md) | Quyết định kiến trúc, vai trò, trạng thái đơn, mô hình dữ liệu |
| [`docs/nghiem-thu.md`](docs/nghiem-thu.md) | Danh sách nghiệm thu (checklist) |
| [`docs/dong-bo.md`](docs/dong-bo.md) | Vì sao **không còn** tầng đồng bộ |

## Stack

| | |
|---|---|
| Web | [Hono](https://hono.dev) + JSX server-render, chạy trên Cloudflare Workers |
| DB | [Drizzle ORM](https://orm.drizzle.team) + [postgres.js](https://github.com/porsager/postgres) → Supabase Postgres (Transaction pooler, cổng 6543) |
| Auth | JWT trong cookie (`hono/jwt`, HS256) + PBKDF2-SHA256 (WebCrypto) |
| Giờ VN / CSV / in | `Intl` thuần (`Asia/Ho_Chi_Minh` cố định) + `@media print` |
| PWA | `manifest.webmanifest` + `logo.png` — cài được như app trên điện thoại |

## Thư mục

```
src/
  index.tsx        wire toàn bộ + middleware DB / session
  env.ts           kiểu Bindings / Session
  db/schema.ts     lược đồ Drizzle — NGUỒN SỰ THẬT, 9 bảng
  db/client.ts     kết nối postgres.js cho mỗi request (prepare:false cho pooler 6543)
  lib/             password, session, page, rbac, status, tz, odometer, queries, ui
  routes/
    auth.tsx       đăng nhập / đăng xuất
    lich.tsx       lịch tuần (chọn ngày + chú thích màu)
    misc.tsx       "/" , Đơn của tôi (lọc + phân trang + hộp "cần xem") , Thông báo
    booking.tsx    tạo đơn, chi tiết, duyệt, điều xe, hủy, sửa & gửi lại, điều chỉnh km
    queues.tsx     hàng chờ Duyệt (Ban) + Điều xe (Đội xe)
    trips.tsx      Chuyến của tôi (lái xe nhập km đi/về; hiện SĐT biên tập + lái xe)
    extra.tsx      công-tơ-mét + cảnh báo km ngoài đơn, thống kê + CSV, quản trị
    admin.tsx      form thêm/sửa user + xe
public/            logo.png, icon.svg, manifest.webmanifest  (Workers phục vụ ở "/")
scripts/
  seed.sql         367 user + 4 xe (mật khẩu 123456) — dán vào Supabase SQL Editor
  demo.sql         dữ liệu demo phủ mọi trạng thái + luồng
  demo-cleanup.sql xoá sạch dữ liệu demo, giữ user + xe
  seed.ts          (tuỳ chọn) seed bằng tsx từ máy local, cần scripts/users.json
drizzle/           SQL khởi tạo do drizzle-kit sinh (0000_init.sql)
```

## Dựng nhanh (không cần máy local)

1. **Supabase** → tạo project → **SQL Editor**: chạy `drizzle/0000_init.sql` (tạo 9 bảng)
   rồi `scripts/seed.sql` (nạp user + xe).
2. **GitHub** → push repo này.
3. **Cloudflare** → Workers & Pages → *Import a repository* → chọn repo, nhánh `main`,
   Deploy command `npx wrangler deploy`.
4. Worker `htvxe` → **Settings → Variables and Secrets** → thêm Secret:
   - `DATABASE_URL` = chuỗi **Transaction pooler cổng 6543** của Supabase
   - `AUTH_SECRET` = chuỗi ngẫu nhiên dài
5. Mở `https://htvxe.<tài-khoản>.workers.dev` → đăng nhập `admin` / `123456`.

Từ đó mỗi `git push` lên `main` → Cloudflare tự build & deploy. Xem đầy đủ ở
[`docs/trien-khai.md`](docs/trien-khai.md).

> `APP_TZ` không cần đặt — múi giờ `Asia/Ho_Chi_Minh` cố định trong `src/lib/tz.ts`.

## Phát triển từ máy (tuỳ chọn)

```bash
npm install
cp .dev.vars.example .dev.vars      # điền DATABASE_URL + AUTH_SECRET
npm run typecheck                   # tsc --noEmit
npm run dev                         # wrangler dev — http://localhost:8787
npm run deploy                      # đẩy thẳng lên Cloudflare (không qua GitHub)
```

`npm run db:push` / `npm run db:generate` (drizzle-kit) và `npm run seed` chỉ cần khi
đổi `src/db/schema.ts` hoặc muốn seed bằng `scripts/users.json`; đặt `DATABASE_URL`
(nên dùng Session pooler **5432**) trước khi chạy.

## Tính năng chính

- **Vòng đời đơn**: tạo → Ban duyệt → Đội xe điều xe → lái xe nhập km đi/về → hoàn thành.
  Đơn bị từ chối: chủ đơn **Sửa & gửi lại** hoặc **Hủy**. Đơn **phát sinh** bỏ qua bước Ban.
- **Lịch tuần**: xem theo tuần, chọn ngày bất kỳ để nhảy tuần, chú thích màu trạng thái,
  đánh dấu "Hôm nay".
- **Chuông thông báo** cạnh tên + badge sidebar + banner "chuyến chưa đóng" ở mọi trang.
- **Đơn của tôi**: hộp "cần bạn xem", lọc (Đang mở / Hoàn thành / Đã hủy / Tất cả), phân trang.
- **Công-tơ-mét**: cảnh báo km chạy ngoài đơn ("Biết rồi" để ẩn), dòng thời gian từng xe,
  Đội xe điều chỉnh km chuyến đã đóng (ghi `audit_log`). **Đặt lại số km gốc: chỉ admin / adminxe.**
- **Thống kê**: mặc định trọn tháng hiện tại, theo lái xe / theo xe, CSV, in. Lái xe có
  trang **"Thống kê của tôi"**.
- **Quản trị**: thêm/sửa user + xe, đặt lại mật khẩu về `123456`, bảng chất lượng dữ liệu.
- **PWA**: cài như app điện thoại, bàn phím số cho lái xe nhập km.
