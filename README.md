# Đặt xe Công tác HTV — bản Cloudflare (nhẹ)

Viết lại từ đầu để chạy gọn trên **Cloudflare Workers** (bundle ~110 KB gzip, thừa
sức trong free tier 3 MiB). Cloud-only: không còn bản SQLite local / daemon đồng bộ.

Tài liệu: [`docs/trien-khai.md`](docs/trien-khai.md) (triển khai từng bước),
[`docs/van-hanh.md`](docs/van-hanh.md) (vận hành hằng ngày),
[`docs/ke-hoach.md`](docs/ke-hoach.md), [`docs/nghiem-thu.md`](docs/nghiem-thu.md),
[`docs/dong-bo.md`](docs/dong-bo.md) (giải thích vì sao không còn đồng bộ).

## Stack

| | |
|---|---|
| Web | [Hono](https://hono.dev) + JSX server-render |
| DB | [Drizzle ORM](https://orm.drizzle.team) + [postgres.js](https://github.com/porsager/postgres) → Supabase Postgres |
| Auth | JWT trong cookie (`hono/jwt`) + PBKDF2 (WebCrypto) |
| Giờ VN / CSV / in | `Intl` thuần + `@media print` |

## Thư mục

```
src/
  index.tsx        wire toàn bộ, middleware DB + session
  env.ts           kiểu Bindings / Session
  db/schema.ts     lược đồ Drizzle (users, vehicles, bookings, booking_approvals,
                   booking_dispatch, trip_logs, odometer_events, audit_log, alert_acks)
  db/client.ts     kết nối postgres.js cho mỗi request
  lib/             password, session, rbac, status, tz, odometer, queries, ui
  routes/          auth, lich, booking, queues (duyệt + điều xe), trips, misc
                   (đơn của tôi + thông báo), extra (công-tơ-mét + thống kê + quản trị)
scripts/seed.ts    nạp 367 user + 4 xe từ scripts/users.json (mật khẩu 123456)
```

## Chạy local

```bash
npm install
cp .dev.vars.example .dev.vars      # điền DATABASE_URL (Supabase) + AUTH_SECRET
npm run db:push                     # tạo bảng trên Supabase (đặt DATABASE_URL ở shell)
DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres' npm run seed
npm run dev                         # http://localhost:8787
```

## Deploy Cloudflare

```bash
npx wrangler secret put DATABASE_URL   # chuỗi Transaction pooler cổng 6543
npx wrangler secret put AUTH_SECRET
npm run deploy
```

`APP_TZ=Asia/Ho_Chi_Minh` đặt ở phần Variables (không cần Secret).
Hoặc nối GitHub trong dashboard: Build command `npm run deploy` (hoặc để trống
build, deploy = `npx wrangler deploy`).

## Đã làm ở lượt 2

- Quản trị: form thêm/sửa user (`/quan-tri/user/moi`, `/quan-tri/user/:username`,
  đặt lại mật khẩu về 123456) + form thêm/sửa xe (`/quan-tri/xe/moi`, `/quan-tri/xe/:id`).
- Công-tơ-mét: nút "Biết rồi" / "Bỏ ẩn" cho cảnh báo km chạy ngoài đơn (`alert_acks`,
  `?daxem=1` xem lại), dòng thời gian công-tơ-mét từng xe (`/cong-to-met/xe/:id`,
  tô đỏ chỗ đứt quãng), Đội xe điều chỉnh km chuyến đã đóng (ghi `audit_log`).
- Thống kê: trang chi tiết từng lái xe (`/thong-ke/lai-xe/:username`).
- Banner nhắc "chuyến đang chạy chưa đóng" hiện ở **mọi trang** (không chỉ /dieu-xe).
- PWA: `manifest.webmanifest` + icon + theme-color — cài được như app trên điện thoại.

## Còn thiếu (nếu cần)

- Xoá cứng user/xe (hiện chỉ có tắt hoạt động — đúng chủ trương không xoá cứng).
- Km "chưa giải trình" tính riêng trong thống kê (khác với bảng cảnh báo gap).
