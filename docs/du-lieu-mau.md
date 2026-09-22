# Dữ liệu mẫu để test (dành cho người không biết code)

Tin vui: **đã có sẵn 3 file làm đúng việc bạn cần** trong thư mục `scripts/`, không phải
viết mới. Tài liệu này giải thích chúng làm gì và cách dùng, từng bước, không cần biết
code.

## 3 file bạn sẽ dùng

| File | Làm gì | Khi nào dùng |
|---|---|---|
| [`scripts/seed.sql`](../scripts/seed.sql) | Nạp **367 nhân viên thật** của Đài + 4 xe thật, mật khẩu ai cũng là `123456` | Chỉ 1 lần lúc dựng app (nhiều khả năng đã chạy rồi) |
| [`scripts/demo.sql`](../scripts/demo.sql) | Tạo **22 đơn công tác mẫu**, phủ đủ mọi tình huống: đơn chờ duyệt, bị từ chối, đã điều xe, đang chạy, quá giờ, đã hoàn thành, đơn phát sinh, cảnh báo km chạy ngoài đơn... | Mỗi khi muốn có dữ liệu để bấm thử |
| [`scripts/demo-cleanup.sql`](../scripts/demo-cleanup.sql) | Xoá sạch 22 đơn mẫu đó, **giữ nguyên** 367 người + 4 xe thật | Lúc hết giai đoạn test, chuẩn bị dùng thật |

Cả `demo.sql` và `demo-cleanup.sql` đều **an toàn chạy đi chạy lại nhiều lần** — chạy
`demo.sql` 2-3 lần liên tiếp không tạo ra đơn trùng, nó tự dọn đơn mẫu cũ trước khi tạo
lại. Ngày giờ trong các đơn mẫu tính theo "bây giờ" nên lúc nào chạy cũng thấy dữ liệu
"tươi" (không bị lỗi thời).

## Cách nạp dữ liệu mẫu để test (3 bước)

1. Đăng nhập vào **Supabase** (trang quản lý CSDL của app) → chọn project của app này
   → menu bên trái chọn **SQL Editor**.
2. Mở file [`scripts/demo.sql`](../scripts/demo.sql), bấm chọn hết nội dung (Ctrl+A),
   copy (Ctrl+C), dán (Ctrl+V) vào ô SQL Editor trên Supabase.
3. Bấm nút **Run** (hoặc Ctrl+Enter). Đợi vài giây — thấy bảng kết quả hiện ra là xong.

Xong bước này, mở app lên (menu **Lịch tuần** hoặc **Đơn của tôi**) sẽ thấy ngay 22 đơn
mẫu với đủ trạng thái, màu sắc khác nhau.

## Đăng nhập thử — "diễn viên" nào đóng vai gì

Mật khẩu của tất cả đều là **`123456`**. Đăng nhập bằng username tương ứng để thấy đúng
màn hình của vai trò đó:

| Username | Vai trò | Vào menu nào để thấy việc cần làm |
|---|---|---|
| `admin` | Quản trị | **Quản trị** — thêm/sửa user, xe |
| `nguyenbaolam` | Trưởng ban "Ban Chuyên Đề" | **Duyệt đơn** — có đơn đang chờ duyệt |
| `nguybadien` | Trưởng ban "Ban CĐL" | **Duyệt đơn** |
| `huynhvantuan` | Tổ trưởng Đội xe | **Điều xe**, **Công-tơ-mét**, **Thống kê** |
| `topho` | Tổ phó Đội xe | **Điều xe** |
| `laixe1` .. `laixe4` | Lái xe | **Chuyến của tôi** — có chuyến sẵn để bấm "Bắt đầu"/"Kết thúc" |
| `leanhdung`, `huynhthiphuongthao` | Nhân viên (chủ đơn) | **Đơn của tôi** — có đơn cần xem |
| `CaoAnhMinh-TGD` | Ban Tổng Giám đốc | **Thống kê** (chỉ xem) |

**Lưu ý quan trọng**: đây đều là tài khoản của **nhân viên thật** trong Đài (chỉ mượn để
đóng vai lúc test) — không phải tài khoản giả tạo riêng cho việc test. Vì vậy:
- Đừng đổi mật khẩu, họ tên, số điện thoại của những tài khoản này khi đang test.
- Nếu ai trong số họ **đã** dùng app thật (có đơn/chuyến thật của riêng họ), 22 đơn mẫu
  chỉ là thêm vào chứ không đụng tới đơn thật của họ — vẫn nên dọn sạch demo (bước dưới)
  trước khi công bố cho mọi người dùng thật, tránh gây nhầm lẫn.

## Dọn sạch dữ liệu mẫu khi hết giai đoạn test

Khi thấy ổn rồi, muốn xoá 22 đơn mẫu đi (giữ nguyên 367 người + 4 xe):

1. Supabase → **SQL Editor**.
2. Copy toàn bộ nội dung [`scripts/demo-cleanup.sql`](../scripts/demo-cleanup.sql), dán
   vào, bấm **Run**.
3. Kết quả cuối cùng phải toàn số **0** (trừ dòng "users" và "vehicles (con lai)") —
   nghĩa là đã xoá sạch đơn/chuyến mẫu, chỉ còn người + xe.

Sau bước này bạn có thể nạp lại `demo.sql` bất cứ lúc nào để test tiếp — không có gì mất
vĩnh viễn ngoài chính 22 đơn mẫu đó.

## Việc cần làm thêm khi thật sự chuyển sang dùng thật (go-live)

`demo-cleanup.sql` chỉ lo phần dữ liệu đơn/chuyến mẫu. Để app sẵn sàng cho mọi người
dùng thật, làm thêm (không có script tự động — làm 1 lần, tay):

1. ✅ Chạy `demo-cleanup.sql` (bước trên) — xoá đơn mẫu.
2. **Đặt số km gốc thật cho 4 xe** — đăng nhập `admin` → menu **Công-tơ-mét** → *"Đặt
   lại số km gốc của xe"* → nhập đúng số trên đồng hồ xe thật lúc bắt đầu dùng app.
3. **Đổi `AUTH_SECRET`** (khoá bí mật ký phiên đăng nhập) — trên Cloudflare, vào Worker
   `htvxe` → **Settings → Variables and Secrets** → sửa `AUTH_SECRET` thành 1 chuỗi mới
   → **Deployments → Retry**. Việc này làm mọi người đang đăng nhập phải đăng nhập lại —
   nên làm **trước** khi công bố cho mọi người, không làm giữa lúc đang có người dùng.
4. **Tạo 1 bản sao lưu (backup) thủ công** trên Supabase — Dashboard → **Database →
   Backups → Create backup** — coi như mốc "khai trương", lỡ có gì còn khôi phục lại được.
5. **Nhắc mọi người đổi mật khẩu** khỏi `123456` mặc định (mỗi người tự đăng nhập, không
   có chỗ đổi mật khẩu trong app hiện tại thì nhắc dùng **Đăng nhập bằng HTV SSO** nếu
   Đài đã tích hợp — xem [`docs/huong-dan-tich-hop-htv-sso.md`](huong-dan-tich-hop-htv-sso.md)).

Nếu muốn hiểu sâu hơn về vận hành hằng ngày (thêm/sửa user, sao lưu, đổi lược đồ...),
xem [`docs/van-hanh.md`](van-hanh.md) — tài liệu đó viết cho người quen thao tác kỹ
thuật hơn một chút.

---

*Không tìm thấy 2 file `scripts/demo.sql` / `scripts/demo-cleanup.sql`? Kiểm tra bạn
đang ở đúng repo `htvxe` (không phải bản cũ) — cứ hỏi Claude: "kiểm tra giúp tôi file
demo.sql còn không" để xác nhận.*
