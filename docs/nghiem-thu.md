# Danh sách nghiệm thu

Chạy thử trên **URL Cloudflare** (`https://htvxe.<tài-khoản>.workers.dev`).
Mật khẩu mọi tài khoản: `123456`. Đánh dấu ✅ khi đạt.

## 0. Chuẩn bị

- [ ] `npm run db:push` + `npm run seed` đã chạy → Supabase có 367 user + 4 xe
- [ ] `npm run deploy` xong, mở URL thấy trang đăng nhập
- [ ] Trong `/quan-tri`: điền tên thật cho các user còn trùng username; đủ Trưởng/Phó ban mỗi đơn vị

## 1. Đăng nhập & phân quyền

- [ ] `laixe1` → thấy menu **Lịch tuần, Đơn của tôi, Tạo đơn, Chuyến của tôi, Thông báo**; KHÔNG thấy Duyệt/Điều xe/Quản trị
- [ ] Một Trưởng/Phó ban (vd thuộc TT Tin Tức) → thấy thêm **Duyệt đơn**
- [ ] `huynhvantuan` (Tổ trưởng Đội xe) → thấy **Điều xe, Công-tơ-mét, Thống kê**
- [ ] `admin` / `adminxe` → thấy **Quản trị**
- [ ] Sai mật khẩu → báo lỗi, không vào được
- [ ] User bị tắt "Đang hoạt động" trong Quản trị → không đăng nhập được (401)

## 2. Vòng đời một đơn công tác

- [ ] Nhân viên: **Tạo đơn** → điền → Gửi → trạng thái **Chờ Ban duyệt** (xám); mã dạng `HTV-2026-000xxx`
- [ ] Trưởng/Phó ban cùng đơn vị mở `/duyet` → thấy đơn → **Duyệt** → **Chờ Đội xe** (cam)
- [ ] Tổ trưởng/Tổ phó Đội xe mở `/dieu-xe` → mở đơn → chọn **xe** + **lái xe** + ghi chú → **Điều xe** → **Đã điều xe** (xanh lá)
- [ ] Trang điều xe hiện cảnh báo "đang bận trong khung giờ này" nếu có chuyến trùng giờ (vẫn cho lưu)
- [ ] Lịch tuần hiển thị đúng màu theo từng bước
- [ ] Badge ở sidebar cập nhật đúng số việc chờ xử lý cho từng vai trò
- [ ] Ban **Từ chối** → trạng thái đỏ, kèm ghi chú; Đội xe **Từ chối** → đỏ
- [ ] Chủ đơn bấm **Sửa đơn** khi còn Chờ Ban duyệt → lưu được; sau khi duyệt thì không thấy nút sửa

## 3. Hủy đơn

- [ ] Người tạo hủy đơn khi **Chờ Ban duyệt** → OK
- [ ] Người tạo KHÔNG hủy được sau khi Ban đã duyệt
- [ ] Trạng thái **Chờ Đội xe**: Đội xe hoặc Trưởng/Phó Ban Văn Phòng Đài hủy được
- [ ] Trạng thái **Đã điều xe**: chỉ Trưởng/Phó Ban **Văn Phòng Đài** hủy được

## 4. Đơn phát sinh

- [ ] Lái xe (hoặc Đội xe) tạo đơn, tick "Đơn phát sinh" → vào thẳng **Chờ Đội xe**, có nhãn "Phát sinh"
- [ ] Đội xe điều xe cho đơn phát sinh như bình thường

## 5. Công-tơ-mét

- [ ] Lái xe mở **Chuyến của tôi** → chuyến **Đã điều xe** → nhập **số km lúc xuất bến** (điền sẵn = số km xe) + giờ → **Bắt đầu chuyến** → **Đang chạy** (xanh dương)
- [ ] Banner "Bạn có N chuyến đang chạy chưa đóng" hiện ở **mọi trang** cho tới khi đóng chuyến
- [ ] Nhập **số km lúc về** + giờ kết thúc → **Đóng chuyến** → **Hoàn thành**; số km xe cập nhật theo km về
- [ ] Nhập km về < km đi → bị chặn, báo lỗi
- [ ] Không cho bắt đầu chuyến mới trên xe đang có chuyến chưa đóng
- [ ] `/dieu-xe` đầu trang liệt kê xe đang chạy chưa đóng, đánh dấu **QUÁ GIỜ** nếu quá giờ dự kiến / > 12 giờ
- [ ] `/cong-to-met`: tạo cố tình 1 khoảng trống (odo đầu chuyến sau > odo cuối chuyến trước + 1 km) → hiện cảnh báo đỏ
- [ ] Bấm **Biết rồi** → cảnh báo ẩn khỏi danh sách; `/cong-to-met?daxem=1` → xem lại được; **Bỏ ẩn** → hiện lại
- [ ] Đội xe: đơn đã **Hoàn thành** → panel "Điều chỉnh km" → sửa km + lý do → lưu; số km xe tính lại; ghi vào `audit_log`
- [ ] "Đặt lại số km gốc của xe" ở `/cong-to-met` → lưu → số km xe đổi
- [ ] Bấm tên xe ở `/cong-to-met` → `/cong-to-met/xe/:id` dòng thời gian, tô đỏ chỗ đứt quãng

## 6. Thống kê

- [ ] `/thong-ke` chọn khoảng ngày → số liệu đổi theo
- [ ] Bảng theo lái xe: số chuyến, phát sinh, tổng km, giờ chạy
- [ ] Bảng theo xe: số chuyến, tổng km
- [ ] Bấm **Chi tiết** ở 1 lái xe → `/thong-ke/lai-xe/:username` liệt kê từng chuyến trong kỳ
- [ ] **CSV lái xe / CSV xe** tải về, mở bằng Excel đúng (có dấu tiếng Việt)
- [ ] `Ctrl+P` (In / Lưu PDF) → trang sạch, ẩn sidebar + header

## 7. Quản trị

- [ ] `/quan-tri`: sửa họ tên 1 user → số "trùng username" giảm
- [ ] **+ Thêm user** → điền → Lưu → đăng nhập được bằng `123456`
- [ ] Mở 1 user → sửa vai trò / đơn vị / cờ "lái xe" / "Đang hoạt động" → Lưu
- [ ] **Đặt lại mật khẩu về 123456** → user đó đăng nhập lại bằng `123456`
- [ ] Bổ sung Trưởng/Phó ban cho đơn vị còn thiếu → dòng cảnh báo "thiếu Trưởng/Phó ban" giảm
- [ ] **+ Thêm xe** / sửa xe → xuất hiện đúng trong danh sách chọn xe khi điều xe

## 8. Điện thoại (lái xe)

- [ ] Mở URL trên điện thoại → giao diện co gọn, nút full-width
- [ ] "Thêm vào màn hình chính" → mở ra chạy như app (standalone, có icon)
- [ ] Lái xe nhập công-tơ-mét trên điện thoại thuận tiện (bàn phím số)

## 9. Phiên & bảo mật

- [ ] Đăng nhập rồi chuyển nhiều trang → không bị văng ra `/login` (cookie `Secure` + HTTPS)
- [ ] Đăng xuất → quay lại trang bất kỳ → bị đưa về `/login`
- [ ] Đổi `AUTH_SECRET` rồi deploy → mọi phiên cũ bị vô hiệu, phải đăng nhập lại
