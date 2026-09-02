# Triển khai (Cloudflare Workers + Supabase) — không cần máy local

Bản này **cloud-only**: 1 nơi chạy (Cloudflare Workers), 1 CSDL (Supabase Postgres).
Không còn bản chạy nội bộ (SQLite), không daemon đồng bộ.

Toàn bộ việc dựng có thể làm **hoàn toàn trên trình duyệt** — chỉ cần 1 lần `git push`
để đưa mã lên GitHub (đó là *tải mã lên*, không phải chạy app).

| | |
|---|---|
| Web | Hono + JSX server-render, chạy trên Cloudflare Workers |
| DB | Drizzle ORM + postgres.js → Supabase (Transaction pooler, cổng 6543) |
| Auth | JWT trong cookie (`hono/jwt`) + PBKDF2 (WebCrypto) |
| Lược đồ | `src/db/schema.ts` (nguồn sự thật) → `drizzle/0000_init.sql` |

## Ai kết nối với ai

- **GitHub** giữ mã nguồn.
- **Cloudflare Workers Builds** theo dõi nhánh `main`: mỗi `git push` → tự cài deps +
  `npx wrangler deploy`. Worker nối tới Supabase bằng **Secret** `DATABASE_URL`.
- **Supabase** chỉ là Postgres — không cần biết GitHub hay Cloudflare.

---

## 1. Tạo project Supabase

Create a new project:

| Mục | Chọn |
|---|---|
| **Project name** | `htvxe` |
| **Database password** | **Chỉ chữ + số**, ~24 ký tự (tránh `@ # : / ?` để khỏi mã hoá trong URL). Lưu lại. |
| **Region** | **Southeast Asia (Singapore)** |
| **Data API / RLS** | Bỏ chọn — app tự kiểm soát quyền ở tầng đăng nhập. |

Đợi ~2 phút.

## 2. Lấy chuỗi kết nối

Dashboard → **Connect** → **Connection string**, thay `[YOUR-PASSWORD]`:

- **Transaction pooler**, cổng **`6543`** → dùng cho **Cloudflare (runtime)**. Kết thúc bằng `/postgres`.
- **Session pooler**, cổng **`5432`** → chỉ cần nếu về sau chạy `db:push` / `seed` từ máy.

> Dùng host `...pooler.supabase.com`. **Đừng** dùng "Direct connection"
> `db.xxxx.supabase.co` — chỉ có IPv6, Cloudflare Workers không gọi được.

## 3. Tạo bảng + nạp user/xe — bằng SQL Editor (không cần máy)

Supabase → **SQL Editor** → **New query**, chạy lần lượt:

1. **Tạo 9 bảng**: dán toàn bộ [`drizzle/0000_init.sql`](../drizzle/0000_init.sql) → Run.
   (File có dấu `--> statement-breakpoint` của Drizzle; Postgres coi là comment, chạy
   thẳng được. Nếu báo lỗi thì Find & Replace chuỗi đó thành rỗng rồi Run lại.)
2. **Nạp 367 user + 4 xe**: dán toàn bộ [`scripts/seed.sql`](../scripts/seed.sql) → Run.
   Mật khẩu mặc định `123456`, dạng upsert theo `username` / `plate_no` (chạy lại được).
3. *(tuỳ chọn)* **Dữ liệu demo** để xem thử mọi luồng: dán [`scripts/demo.sql`](../scripts/demo.sql).
   Xoá demo sau đó: [`scripts/demo-cleanup.sql`](../scripts/demo-cleanup.sql).

> `scripts/seed.sql` chứa họ tên + SĐT nhân sự → **không commit lên GitHub công khai**
> (đã có trong `.gitignore`). Muốn tạo lại từ `scripts/users.json`: xem `docs/van-hanh.md` mục 2.

## 4. Đưa mã lên GitHub (1 lần)

`.gitignore` đã loại `node_modules/`, `.dev.vars`, `.wrangler/`, `scripts/*.sql`,
`scripts/users.json` nên push sạch.

```bash
git init -b main
git add .
git commit -m "Khởi tạo htvxe"
git remote add origin https://github.com/<tài-khoản>/htvxe.git
git push -u origin main
```

## 5. Nối Cloudflare với GitHub (Workers Builds)

Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** →
chọn repo `htvxe`, nhánh `main`:

| Trường | Giá trị |
|---|---|
| Worker name | `htvxe` (khớp `wrangler.jsonc`) |
| Deploy command | `npx wrangler deploy` |
| Build command | để trống (Cloudflare tự chạy `npm install`) |
| Root directory | `/` |

Nếu bước "Create and deploy" hỏi **API token**: để trống là được (Workers Builds tự cấp
quyền deploy). Nếu bắt buộc chọn → tạo token theo mẫu **"Edit Cloudflare Workers"**,
đặt Variable name `CLOUDFLARE_API_TOKEN`.

## 6. Đặt Secret cho Worker

Worker `htvxe` → **Settings** → **Variables and Secrets** → **Add** (loại **Secret**):

| Tên | Giá trị |
|---|---|
| `DATABASE_URL` | chuỗi **Transaction pooler cổng 6543** ở mục 2 (kết thúc `/postgres`) |
| `AUTH_SECRET` | chuỗi ngẫu nhiên dài (≥ 40 ký tự) |

Tạo `AUTH_SECRET` không cần máy — mở DevTools Console của trình duyệt:
```js
btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48))))
```

Đặt Secret xong → tab **Deployments** → **Retry / Create deployment** (hoặc push 1 commit)
để build lại với Secret mới.

> `APP_TZ` **không cần** — `Asia/Ho_Chi_Minh` cố định trong `src/lib/tz.ts`.

## 7. Kiểm tra

- Mở `https://htvxe.<tài-khoản>.workers.dev` → đăng nhập `admin` / `123456`.
- **Đổi mật khẩu admin** ngay (menu Quản trị → Sửa user).
- Tạo thử 1 đơn → mã dạng `HTV-2026-000001`.
- Chuyển vài trang để chắc session không rớt (cookie `Secure` + HTTPS).

## Lưu ý

- **Không dùng `git push` là dùng máy để chạy app** — đó chỉ là tải mã lên GitHub. App
  build & chạy trên Cloudflare.
- **Đổi lược đồ về sau** (`src/db/schema.ts`): hoặc chạy `npm run db:push` từ máy (cổng
  5432), hoặc tự viết `ALTER TABLE …` trong Supabase SQL Editor. Sau đó push code.
- **Bảo mật**: `.dev.vars` không commit (đã `.gitignore`). Đổi `AUTH_SECRET` trước khi
  chạy thật — đổi xong mọi người phải đăng nhập lại.
- **Supabase free tier** tạm dừng sau ~7 ngày không truy vấn; lần gọi đầu chậm vài giây.
- **Workers Free**: 100k request/ngày, bundle ≤ 3 MiB — bundle hiện ~120 KiB gzip.
- **`wrangler dev` ở máy** kết nối Supabase thật hay chập chờn (giới hạn môi trường
  preview của Wrangler). Cứ deploy rồi test trên URL thật.
