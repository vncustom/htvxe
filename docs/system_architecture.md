# Kiến trúc hệ thống — `htvxe`

Tài liệu kỹ thuật: request đi qua đâu, module nào làm việc gì, dữ liệu nằm ở đâu.
Quyết định *nghiệp vụ* (vai trò, trạng thái đơn, badge...) xem [`ke-hoach.md`](ke-hoach.md);
đây chỉ nói về *cách hệ thống được lắp ráp*.

## 1. Tổng quan

Cloud-only, 2 thành phần chạy:

```
Trình duyệt / PWA (Android TWA)
        │  HTTPS
        ▼
Cloudflare Workers  ──  Hono app (src/index.tsx)
        │  postgres.js (TCP, TLS, "max: 1" mỗi request)
        ▼
Supabase Postgres  (Transaction pooler, cổng 6543)
```

Ngoài ra 2 dịch vụ ngoài, gọi bằng `fetch()` thuần, không SDK:

- **Web Push (VAPID)** — [`src/lib/push.ts`](../src/lib/push.ts) ký bằng WebCrypto, gửi thẳng tới
  push service của Chrome/Edge/Safari qua `@block65/webcrypto-web-push`.
- **Gmail API** (OAuth2 refresh token) — [`src/lib/gmail.ts`](../src/lib/gmail.ts), gửi email thông
  báo song song với push.
- **HTV SSO** (tuỳ chọn) — [`src/lib/sso.ts`](../src/lib/sso.ts), xác minh JWT từ SSO server nội bộ
  để đăng nhập không cần mật khẩu riêng.

Không có framework SPA, không build step phía client ngoài Wrangler bundle server. Mỗi
điều hướng trang là 1 request HTML mới (server-render bằng Hono JSX), tương tác nhỏ (tag
@username, bật push) dùng vài file JS thuần trong `public/`.

## 2. Vòng đời 1 request

[`src/index.tsx`](../src/index.tsx) nối middleware theo thứ tự:

1. **Mở kết nối DB** — `makeDb(c.env.DATABASE_URL)` tạo 1 client `postgres.js` mới
   (`max: 1, prepare: false`) cho **riêng request này**, gắn vào `c.set("db", ...)`.
   Đóng lại trong `finally` bằng `c.executionCtx.waitUntil(sql.end(...))` — không chặn
   response, nhưng vẫn là round-trip TCP+TLS mới mỗi lần (xem mục 7, việc chưa làm).
2. **`sessionMiddleware`** — đọc cookie `htvxe_session`, verify JWT (`hono/jwt`, HS256,
   `AUTH_SECRET`), gắn `c.set("session", ...)`. Không đụng DB — session tự chứa đủ thông
   tin hiển thị (username, fullName, role, isDriver, dsBan).
3. **`requireAuth`** — áp cho từng nhóm route cần đăng nhập (`/don/*`, `/thong-ke/*`,
   `/quan-tri/*`...); route công khai (`/login`, `/auth/*`) không qua middleware này.
4. **Route handler** — hầu hết trang gọi [`pageCtx(c)`](../src/lib/page.ts) đầu tiên để lấy
   `{ s, db, badges, openTrips }` cùng lúc (`Promise.all`): `s` = session bắt buộc đăng
   nhập, `badges` = 6 đếm song song cho sidebar/chuông, `openTrips` = chuyến đang chạy
   chưa đóng của lái xe (banner cảnh báo mọi trang). **Chỉ dùng `pageCtx` cho trang cần
   hiển thị Layout** — handler POST thuần hành động (tạo/sửa/xoá) chỉ cần `must(c)` để
   lấy session, không kéo theo `getBadges`/`getOpenTrips`.
5. **`app.onError`** — bắt lỗi chưa xử lý, trả `500` + log, tránh lộ stack trace.

Static assets (`public/*`) được Cloudflare **Workers Static Assets** (binding `ASSETS`
trong `wrangler.jsonc`) phục vụ thẳng ở edge, không chạy qua middleware trên — vào Worker
script chỉ khi không khớp file tĩnh nào.

## 3. Bản đồ module (`src/`)

| File/Thư mục | Vai trò |
|---|---|
| `index.tsx` | Nối middleware + toàn bộ route con thành 1 app Hono |
| `env.ts` | Kiểu `Bindings` (secrets/vars từ `wrangler.jsonc`), `Session`, `Variables` (`db`, `sql`, `session` trong context) |
| `db/schema.ts` | **Nguồn sự thật** lược đồ Drizzle — 9 bảng, index, kiểu suy ra (`User`, `Vehicle`, `Booking`) |
| `db/client.ts` | `makeDb(url)` — tạo `postgres.js` client + `drizzle()` cho 1 request |
| `lib/session.ts` | Ký/verify JWT cookie, `must(c)` (bắt buộc có session), `requireAuth` middleware |
| `lib/rbac.ts` | Toàn bộ luật phân quyền dạng hàm thuần (`isAdmin`, `isDoiXe`, `canApproveFor`, `canCancelBooking`, `canEditBooking`...) — không có logic quyền nào nằm rải trong route |
| `lib/queries.ts` | Các query dùng chung nhiều route: `loadBooking` (1 JOIN lớn cho trang chi tiết đơn), `getBadges`, `findBusyInWindow` (trùng lịch xe/lái xe), `getOpenTrips`, `genBookingCode`, `listApprovers`/`listDoiXeUsers` |
| `lib/page.ts` | `pageCtx(c)` — gói session + badge + openTrips cho mọi trang có Layout |
| `lib/notify.ts` | `notify`/`notifyMany` — ghi `notifications`, bắn push + email nền (`waitUntil`), không chặn response |
| `lib/push.ts` | Gửi Web Push (VAPID) tới các subscription của 1 user |
| `lib/gmail.ts` | Lấy access token Gmail (cache theo isolate) + gửi email qua Gmail API |
| `lib/sso.ts` | Verify JWT từ HTV SSO server, tạo URL đăng nhập SSO |
| `lib/password.ts` | Hash/verify mật khẩu (PBKDF2-SHA256 qua WebCrypto) |
| `lib/status.ts` | Danh sách `STATUS`, nhãn + màu hiển thị |
| `lib/odometer.ts` | Phát hiện "khoảng hở" công-tơ-mét (chạy ngoài đơn) từ chuỗi chuyến đã đóng của 1 xe |
| `lib/vehicleGroups.ts` | Danh mục loại xe (4/7/16/29 chỗ...) + số chỗ mặc định |
| `lib/tz.ts` | Mọi việc giờ VN: format hiển thị, chuyển `datetime-local` ⇄ UTC, `Intl` thuần (không thư viện ngoài) |
| `lib/ui.tsx` | `Layout` (khung trang: sidebar, chuông, banner chuyến chưa đóng), `StatusPill`, `Alert`, helper `vi()` (format số kiểu VN) |
| `routes/*.tsx` | 1 file/nhóm tính năng — xem bảng README `Thư mục`, mỗi file là 1 `Hono` sub-app gắn vào app chính bằng `app.route("/", ...)` |

## 4. Mô hình dữ liệu

9 bảng trong `db/schema.ts`, không dùng foreign key tới `users`/`vehicles` — tham chiếu
qua `username`/`id` dạng text/uuid trần, kiểm tra ở tầng ứng dụng. Lý do: cho phép soft-
delete user/xe (`isActive` / `deletedAt`) mà không phá lịch sử đơn cũ.

```
users ──┐                         vehicles
        │ (username, không FK)        │ (id, không FK)
        ▼                             ▼
     bookings ──1:1── booking_approvals   (Ban duyệt/từ chối)
        │        ──1:1── booking_dispatch  (Đội xe gán xe+lái xe)
        │                     │
        └──1:1── trip_logs ◄──┘          (lái xe nhập km đi/về)

odometer_events   ghi mốc km (start/end/điều chỉnh) — hiện chỉ GHI, chưa có nơi ĐỌC
audit_log         diff JSON khi sửa đơn / điều chỉnh km / đổi xe sau khi đã khoá số liệu
alert_acks        "Biết rồi" cho cảnh báo km chạy ngoài đơn (unique theo kind+refId)
notifications     thông báo trong app, đọc/chưa đọc (readAt)
push_subscriptions endpoint Web Push của từng thiết bị đã bật
```

`bookingApprovals.bookingId`, `bookingDispatch.bookingId`, `tripLogs.bookingId` đều
`unique` — mỗi đơn có tối đa 1 bản ghi mỗi loại, nên JOIN vào `bookings` không bao giờ
nhân dòng.

Index hiện có: `bookings(status)`, `bookings(startTime)`, `bookings(donViYeuCau)`,
`bookings(requesterUsername)`, `bookingDispatch(vehicleId)`, `bookingDispatch(driverUsername)`,
`odometerEvents(vehicleId, atTime)`, `auditLog(entity, entityId)`, `notifications(username, readAt)`,
`pushSubscriptions(username)`, `users(dsBan)`, `users(role)`, cùng các `unique` tự nhiên
(`users.username`, `vehicles.plateNo`, `bookings.code`...).

## 5. Vòng đời đơn (tóm tắt kỹ thuật)

Trạng thái lưu ở `bookings.status` (text, không enum DB). Mỗi chuyển trạng thái là 1
`UPDATE` trong route handler ([`routes/booking.tsx`](../src/routes/booking.tsx),
[`routes/trips.tsx`](../src/routes/trips.tsx)) kèm `notify`/`notifyMany` bắn thông báo —
**không có state machine tập trung**, luật chuyển trạng thái nằm rải trong từng handler
(được chặn bằng kiểm tra `bk.status !== EXPECTED` trước khi update). Xem bảng trạng thái
đầy đủ + ai được chuyển ở [`ke-hoach.md`](ke-hoach.md#trạng-thái-đơn--màu).

## 6. Thông báo — 3 kênh song song

`notify(c, {...})` ([`lib/notify.ts`](../src/lib/notify.ts)) làm 3 việc cho 1 người nhận:

1. `INSERT` vào `notifications` (đồng bộ, để trang `/thong-bao` + badge chuông đọc được ngay).
2. `sendPush(...)` — nền qua `c.executionCtx.waitUntil()`, không chặn response.
3. `sendGmail(...)` — nền tương tự, chỉ chạy nếu user có `email`.

`notifyMany` gọi `notify` song song (`Promise.all`) cho danh sách người nhận (đã lọc
trùng bằng `Set`).

## 7. Triển khai & vận hành

- **Deploy**: push lên `main` → Cloudflare Workers Builds tự build + deploy (không cần
  máy local). Deploy thủ công: `npm run deploy` (`wrangler deploy`).
- **Secrets** (`wrangler secret put` hoặc Dashboard): `DATABASE_URL`, `AUTH_SECRET`,
  `VAPID_PRIVATE_KEY`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
- **Vars không bí mật** khai trong `wrangler.jsonc` (`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`,
  `GMAIL_CLIENT_ID`, `GMAIL_SENDER`).
- **Schema đổi**: sửa `src/db/schema.ts` → `npm run db:generate` (drizzle-kit, không cần
  kết nối DB thật, chỉ diff snapshot) sinh SQL trong `drizzle/` → chạy tay qua Supabase
  SQL Editor (hoặc `npm run db:push` với `DATABASE_URL` trỏ Session pooler 5432).
- **Bundle**: ~115 KiB gzip (Hono + Drizzle + postgres.js), dư sức giới hạn Workers Free
  (3 MiB) — lý do đổi từ bản Next.js/Prisma cũ (~3.4 MiB, vượt giới hạn vì query engine WASM).

## 8. Ghi chú hiệu năng — đã làm / chưa làm

Đã áp dụng (xem lịch sử commit / trao đổi gần đây):

- `loadBooking` gộp từ 9 query tuần tự thành **1 query LEFT JOIN** (4 alias bảng `users`
  cho requester/approver/driver/dispatcher) — trang `/don/:id` giảm mạnh số round-trip.
- POST handler trong `admin.tsx` dùng `must(c)` thay vì `pageCtx(c)` — không kéo theo
  `getBadges`/`getOpenTrips` khi không render trang.
- Thêm index `bookings(requesterUsername)` — dùng bởi trang "Đơn của tôi" và badge
  `donCuaToi`.
- CSS tách ra `public/style.css` (link tĩnh, cache được ở edge/trình duyệt) thay vì
  nhúng `<style>` lặp lại trong mọi HTML response.

Chưa làm, cân nhắc khi cần:

- **Cloudflare Hyperdrive** trước Supabase — hiện mỗi request tự mở/đóng kết nối
  Postgres mới (mục 2, bước 1); Hyperdrive pool/cache connection ở edge, giảm latency
  bắt tay TCP+TLS mà không đổi code Drizzle/postgres.js.
- `odometer_events` hiện chỉ ghi, chưa có truy vấn đọc lại — cân nhắc dùng thật cho cảnh
  báo km ngoài đơn (đang suy ra từ `trip_logs`) hoặc bỏ ghi nếu không cần.
