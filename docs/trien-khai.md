# Triển khai (Cloudflare Workers + Supabase)

Bản này **cloud-only**: 1 nơi chạy duy nhất là Cloudflare Workers, 1 CSDL duy nhất là
Supabase Postgres. Không còn bản chạy nội bộ (SQLite) và không còn daemon đồng bộ.

| | |
|---|---|
| Web | Hono + JSX server-render, chạy trên Cloudflare Workers |
| DB | Drizzle ORM + postgres.js → Supabase (Transaction pooler, cổng 6543) |
| Auth | JWT trong cookie (`hono/jwt`) + PBKDF2 (WebCrypto) |
| Repo | `github.com/vncustom/htvxe` |
| Lược đồ | `src/db/schema.ts` (nguồn sự thật) → `drizzle-kit` sinh SQL |

---

## Ai kết nối với ai

- **GitHub** giữ mã nguồn.
- **Cloudflare** chạy app trên Workers; nối tới Supabase bằng chuỗi kết nối đặt trong
  **Secret** của Worker. Deploy bằng `npm run deploy` từ máy, **hoặc** để Cloudflare tự
  build khi push GitHub (mục 6).
- **Supabase** chỉ là Postgres — không cần biết GitHub hay Cloudflare.
- **Máy local** chỉ dùng để: sửa code, chạy `db:push` (tạo/cập nhật bảng) và `seed`
  (nạp user + xe) — mỗi việc chạy khi cần, không chạy thường trực.

## 1. Tạo project Supabase

**Create a new project:**

| Mục | Chọn |
|---|---|
| **Project name** | `htvxe` (tuỳ ý) |
| **Database password** | Đặt **chỉ chữ + số**, ~24 ký tự (tránh `@ # : / ?` để khỏi phải mã hoá trong URL). Lưu lại. |
| **Region** | **Southeast Asia (Singapore)** |
| **Data API / RLS** | Bỏ chọn — app tự kiểm soát quyền ở tầng đăng nhập. |

Đợi ~2 phút cho project khởi tạo xong.

## 2. Lấy chuỗi kết nối

Dashboard → nút **Connect** → **Connection string**. Thay `[YOUR-PASSWORD]`:

- **Transaction pooler**, cổng **`6543`** → dùng cho **Cloudflare (runtime)**.
- **Session pooler**, cổng **`5432`** → dùng cho **`db:push` / `seed`** chạy từ máy local.

> Dùng host `...pooler.supabase.com` cho cả hai. Đừng dùng "Direct connection"
> `db.xxxx.supabase.co` — chỉ có IPv6, Cloudflare Workers không gọi được.

Ví dụ:
```
# runtime (Cloudflare)
postgresql://postgres.abcd:MATKHAU@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
# push/seed (máy local)
postgresql://postgres.abcd:MATKHAU@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

## 3. Tạo bảng + nạp dữ liệu (chạy từ máy local)

Chạy **1 lần** khi khởi tạo, và **mỗi khi sửa `src/db/schema.ts`**. Dùng chuỗi cổng **5432**.

```powershell
cd G:\apptulam\htvxe
npm install

$env:DATABASE_URL='<chuỗi 5432>'
npm run db:push        # tạo / cập nhật 9 bảng theo src/db/schema.ts
npm run seed           # nạp 367 user (mật khẩu 123456) + 4 xe
```

> `scripts/users.json` (danh sách user, chứa thông tin cá nhân) **bị `.gitignore`**.
> Giữ 1 bản cục bộ; nếu mất, chép lại từ project cũ `G:\apptulam\HTVcar\prisma\data\users.json`.

`npm run seed` là **upsert theo username** — chạy lại được, không xoá, không đổi mật khẩu
user đã có.

## 4. Đăng nhập Cloudflare + đặt Secret

```powershell
npx wrangler login                    # mở trình duyệt, cấp quyền 1 lần
npx wrangler secret put DATABASE_URL  # dán chuỗi Transaction pooler cổng 6543
npx wrangler secret put AUTH_SECRET   # chuỗi ngẫu nhiên dài, vd:
                                      #   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> `APP_TZ` **không cần đặt** — múi giờ `Asia/Ho_Chi_Minh` đã cố định trong `src/lib/tz.ts`.

## 5. Deploy

```powershell
npm run deploy
```

In ra URL dạng `https://htvxe.<tài-khoản>.workers.dev`. Mỗi lần sửa code chạy lại
`npm run deploy` là xong.

## 6. (Tuỳ chọn) Để Cloudflare tự build khi push GitHub

Workers & Pages → **`htvxe` → Settings → Build → Connect** → chọn repo `htvxe`, nhánh `main`:

- **Build command**: `npx wrangler deploy`
- **Deploy command**: để trống
- **Root directory**: `/`

Từ đó mỗi `git push` lên `main` → Cloudflare tự cài deps + `wrangler deploy`.
Secret `DATABASE_URL`, `AUTH_SECRET` đã đặt ở mục 4 vẫn dùng được.

## 7. Kiểm tra

- Mở URL `*.workers.dev` → đăng nhập `admin` / `123456` hoặc `laixe1` / `123456`.
- Tạo một đơn → mã dạng `HTV-2026-000001`.
- Chuyển vài trang để chắc session không rớt (cookie `Secure` + HTTPS).

## Lưu ý

- **`wrangler dev` ở máy** kết nối Supabase thật hay chập chờn (hạn chế môi trường preview
  của Wrangler). Cứ `npm run deploy` rồi test trên URL thật.
- **Đổi lược đồ về sau**: sửa `src/db/schema.ts` → `npm run db:push` (cổng 5432) → `npm run deploy`.
- **Bảo mật**: không commit `.dev.vars` (đã trong `.gitignore`). Đổi `AUTH_SECRET` trước khi
  chạy thật — đổi xong mọi người phải đăng nhập lại.
- **Supabase free tier** tạm dừng sau ~7 ngày không truy vấn; lần gọi đầu chậm vài giây.
- **Cài như app điện thoại**: mở URL → trình duyệt → "Thêm vào màn hình chính"
  (`manifest.webmanifest` + icon đã có, chạy chế độ standalone).
- **Gói Workers Free** (100k request/ngày, bundle ≤ 3 MiB) đủ dùng — bundle hiện ~115 KiB gzip.
