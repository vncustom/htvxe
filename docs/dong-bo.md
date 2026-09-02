# Đồng bộ — KHÔNG còn áp dụng

Bản này **cloud-only**: chỉ có **1 cơ sở dữ liệu** (Supabase Postgres) và **1 nơi chạy**
(Cloudflare Workers). Không có bản chạy nội bộ, không có SQLite, **không có daemon đồng bộ**.

Mọi thao tác (tạo đơn, duyệt, điều xe, nhập công-tơ-mét, quản trị) ghi thẳng vào Supabase
và mọi người thấy ngay — không có độ trễ đồng bộ, không có xung đột 2 chiều, không có
`sync_run` / `sync_conflict_log` / `sync_state`.

## Vì sao bỏ

Bản trước (Next.js + Prisma) chạy 2 nơi: máy nội bộ dùng SQLite (để hoạt động cả khi mất
mạng) + cloud dùng Postgres, và một daemon Node đồng bộ 2 chiều theo Last-Write-Wins.
Mô hình đó kéo theo nhiều thứ phải bảo trì: id tất định, xoá mềm bắt buộc, cột `originNode`,
watermark, test hội tụ, Task Scheduler...

Khi viết lại cho nhẹ (chạy lọt gói Cloudflare Workers Free), đã chốt **cloud-only**:
đơn giản hơn hẳn, đổi lại app cần có internet để dùng.

## Nếu về sau cần chạy offline lại

Sẽ phải dựng lại tầng đồng bộ (hoặc dùng giải pháp khác như Cloudflare D1 + replica,
hoặc PowerSync/ElectricSQL). Đây là thay đổi kiến trúc lớn, không phải bật/tắt cấu hình.

## Sao lưu dữ liệu

Thay cho "sao lưu `dev.db` mỗi ngày" của bản cũ:

- Supabase tự sao lưu hằng ngày (kể cả gói Free, giữ vài ngày).
- Trước các mốc quan trọng (go-live, xoá dữ liệu thử): Supabase dashboard →
  **Database → Backups** → tạo backup thủ công, hoặc **SQL Editor** chạy `pg_dump`
  qua công cụ ngoài, hoặc export CSV các bảng cần giữ.
