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
| [`docs/system_architecture.md`](docs/system_architecture.md) | Kiến trúc kỹ thuật: vòng đời request, bản đồ module, sơ đồ dữ liệu, ghi chú hiệu năng |
| [`docs/nghiem-thu.md`](docs/nghiem-thu.md) | Danh sách nghiệm thu (checklist) |
| [`docs/kiem-tra-app.md`](docs/kiem-tra-app.md) | Cách kiểm tra app còn chạy đúng không — **dành cho người không biết code** |
| [`docs/du-lieu-mau.md`](docs/du-lieu-mau.md) | Nạp/dọn dữ liệu mẫu để test, checklist trước khi go-live — **dành cho người không biết code** |
| [`docs/dong-bo.md`](docs/dong-bo.md) | Vì sao **không còn** tầng đồng bộ |
| [`docs/app-android.md`](docs/app-android.md) | App Android (TWA bọc web) — build APK, xác minh domain, phát hành |
| [`docs/cai-app-iphone.md`](docs/cai-app-iphone.md) | Hướng dẫn người dùng iPhone cài PWA và bật thông báo |
| [`docs/cap-nhat-user-tu-file-admin.md`](docs/cap-nhat-user-tu-file-admin.md) | Nạp danh sách user hàng loạt từ file Excel do Admin/nhân sự cấp |
| [`docs/huong-dan-tich-hop-htv-sso.md`](docs/huong-dan-tich-hop-htv-sso.md) | Cơ chế + mã nguồn mẫu tích hợp đăng nhập HTV SSO |
| [`docs/huong-dan-lay-gmail-refresh-token.md`](docs/huong-dan-lay-gmail-refresh-token.md) | Cấu hình Gmail API để app gửi email thông báo |

## Stack

| | |
|---|---|
| Web | [Hono](https://hono.dev) + JSX server-render, chạy trên Cloudflare Workers |
| DB | [Drizzle ORM](https://orm.drizzle.team) + [postgres.js](https://github.com/porsager/postgres) → Supabase Postgres (Transaction pooler, cổng 6543) |
| Auth | JWT trong cookie (`hono/jwt`, HS256) + PBKDF2-SHA256 (WebCrypto) |
| Giờ VN / CSV / in | `Intl` thuần (`Asia/Ho_Chi_Minh` cố định) + `@media print` |
| PWA | `manifest.webmanifest` + `logo.png` — cài được như app trên điện thoại |
| Push | Web Push (VAPID) qua [`@block65/webcrypto-web-push`](https://github.com/block65/webcrypto-web-push) — chạy bằng WebCrypto thuần, không cần `node:crypto` |

## Thư mục

```
src/
  index.tsx        wire toàn bộ + middleware DB / session
  env.ts           kiểu Bindings / Session
  db/schema.ts     lược đồ Drizzle — NGUỒN SỰ THẬT, 11 bảng
  db/client.ts     kết nối postgres.js cho mỗi request (prepare:false cho pooler 6543)
  lib/             password, session, page, rbac, status, tz, odometer, queries, ui, notify, push, vehicleGroups
  routes/
    auth.tsx       đăng nhập / đăng xuất
    lich.tsx       lịch tuần (chọn ngày + chú thích màu)
    misc.tsx       "/" , Đơn của tôi (lọc + phân trang + hộp "cần xem") , Thông báo
    booking.tsx    tạo đơn, chi tiết, duyệt, điều xe, hủy, sửa & gửi lại, điều chỉnh km
    queues.tsx     hàng chờ Duyệt (Ban) + Điều xe (Đội xe)
    trips.tsx      Chuyến của tôi (lái xe nhập km đi/về; hiện SĐT biên tập + lái xe)
    extra.tsx      công-tơ-mét + cảnh báo km ngoài đơn, thống kê + CSV, quản trị
    admin.tsx      form thêm/sửa user + xe
    push.ts        API Web Push: /api/push/vapid-public-key, /subscribe, /unsubscribe
public/            logo.png, icon.svg, manifest.webmanifest, sw.js (service worker), push.js (subscribe UI)
scripts/
  seed.sql               367 user + 4 xe (mật khẩu 123456) — dán vào Supabase SQL Editor
  demo.sql               dữ liệu demo phủ mọi trạng thái + luồng
  demo-cleanup.sql       xoá sạch dữ liệu demo, giữ user + xe
  seed.ts                (tuỳ chọn) seed bằng tsx từ máy local, cần scripts/users.json
  generate-vapid-keys.ts tạo cặp khoá VAPID cho Web Push (chạy 1 lần khi setup / khi đổi khoá)
drizzle/           SQL khởi tạo do drizzle-kit sinh (0000_init.sql, ...)
```

## Dựng nhanh (không cần máy local)

1. **Supabase** → tạo project → **SQL Editor**: chạy lần lượt **tất cả** file `.sql`
   trong `drizzle/` theo đúng thứ tự số (`0000_init.sql`, `0001_...`, `0002_...`, ...
   — chỉ chạy `0000_init.sql` là **chưa đủ**, xem chi tiết ở
   [`docs/trien-khai.md`](docs/trien-khai.md)), rồi `scripts/seed.sql` (nạp user + xe).
2. **GitHub** → push repo này.
3. **Cloudflare** → Workers & Pages → *Import a repository* → chọn repo, nhánh `main`,
   Deploy command `npx wrangler deploy`.
4. Worker `htvxe` → **Settings → Variables and Secrets** → thêm Secret:
   - `DATABASE_URL` = chuỗi **Transaction pooler cổng 6543** của Supabase
   - `AUTH_SECRET` = chuỗi ngẫu nhiên dài
   - `VAPID_PRIVATE_KEY` = tạo bằng `npx tsx scripts/generate-vapid-keys.ts` (Web Push — xem mục dưới)
5. Mở `https://htvxe.<tài-khoản>.workers.dev` → đăng nhập `admin` / `123456`.

Từ đó mỗi `git push` lên `main` → Cloudflare tự build & deploy. Xem đầy đủ ở
[`docs/trien-khai.md`](docs/trien-khai.md).

> `APP_TZ` không cần đặt — múi giờ `Asia/Ho_Chi_Minh` cố định trong `src/lib/tz.ts`.

## Phát triển từ máy (tuỳ chọn)

```bash
npm install
cp .dev.vars.example .dev.vars      # điền DATABASE_URL + AUTH_SECRET
npm run typecheck                   # tsc --noEmit
npm test                            # unit + integration test (không cần DB thật, xem test/)
npm run dev                         # wrangler dev — http://localhost:8787
npm run deploy                      # đẩy thẳng lên Cloudflare (không qua GitHub)
```

Test chạy bằng **Vitest**; test tích hợp (`test/integration/`) dựng 1 Postgres thật
(qua **PGlite**, biên dịch sang WASM, chạy trong bộ nhớ) và áp đúng các file SQL trong
`drizzle/`, nên không cần Docker/DATABASE_URL. Chi tiết: [`test/README.md`](test/README.md).

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
- **Web Push**: nút "🔔 Bật thông báo trên máy này" cạnh nút Đăng xuất — bấm 1 lần để nhận
  thông báo đẩy ra điện thoại/máy tính khi có đơn mới cần duyệt/điều xe, đơn được duyệt/từ
  chối/điều xe, bị tag @biên tập·@quay phim, đổi xe/lái xe, hoặc đơn bị hủy. Xem mục
  [Web Push](#web-push) để biết cách tắt và cách setup.

## Web Push

Đẩy thông báo ra điện thoại/máy tính bằng chuẩn Web Push (VAPID), không qua bên thứ 3
(Zalo/SMS/Firebase) — Cloudflare Worker tự ký và gửi thẳng tới dịch vụ push của
Chrome/Safari/Edge. Code ở [`src/lib/push.ts`](src/lib/push.ts), [`src/lib/notify.ts`](src/lib/notify.ts),
[`src/routes/push.ts`](src/routes/push.ts), [`public/sw.js`](public/sw.js), [`public/push.js`](public/push.js).

**Cách tắt thông báo trên điện thoại:**

1. **Trong app (cách chính)**: mở app → bấm nút **"🔔 Đã bật thông báo trên máy này"**
   cạnh nút Đăng xuất → nút đổi thành "Bật thông báo" là đã tắt xong (huỷ subscribe, xoá
   khỏi CSDL). Phải bấm riêng trên từng thiết bị/trình duyệt đã bật.
2. **Không mở được app / muốn chặn hẳn ở trình duyệt**:
   - **Android (Chrome)**: chạm giữ icon thông báo hoặc vào Chrome ⋮ → *Cài đặt* → *Thông
     báo* (hoặc *Cài đặt trang* của riêng app) → tắt cho app "Đặt xe Công tác HTV".
   - **iPhone (đã "Thêm vào màn hình chính")**: *Cài đặt* → *Thông báo* → tìm app → tắt,
     hoặc xoá icon khỏi màn hình chính.
   - **Máy tính (Chrome/Edge)**: bấm icon 🔒/ⓘ trên thanh địa chỉ → *Thông báo* → *Chặn*.

**Setup lần đầu (đã làm — ghi lại để sau này đổi khoá):**

1. Tạo cặp khoá: `npx tsx scripts/generate-vapid-keys.ts`.
2. `VAPID_PUBLIC_KEY` + `VAPID_SUBJECT` (email hoặc URL liên hệ, **không cần** hộp thư
   thật) → đặt trong `wrangler.jsonc` (`vars`, không bí mật).
3. `VAPID_PRIVATE_KEY` → đặt bằng `wrangler secret put VAPID_PRIVATE_KEY` (bí mật, KHÔNG
   commit vào git).
4. Đổi khoá = tạo cặp mới rồi lặp lại bước 2–3 — mọi người phải bấm lại nút "Bật thông
   báo" vì subscription cũ gắn với khoá cũ sẽ không gửi được nữa.
