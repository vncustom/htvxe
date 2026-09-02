# Danh sách nghiệm thu

Chạy thử trên **URL Cloudflare** (`https://htvxe.<tài-khoản>.workers.dev`).
Mật khẩu mọi tài khoản: `123456`. Đánh dấu ✅ khi đạt.

## 0. Chuẩn bị

- [ ] Supabase SQL Editor đã chạy `drizzle/0000_init.sql` + `scripts/seed.sql` → có 367 user + 4 xe
- [ ] *(tuỳ chọn)* chạy `scripts/demo.sql` để có sẵn 22 đơn phủ mọi trạng thái
- [ ] `git push` → Worker `htvxe` deploy xong, mở URL thấy trang đăng nhập (có **logo Đài**)
- [ ] Secret `DATABASE_URL` (pooler 6543) + `AUTH_SECRET` đã đặt ở Worker
- [ ] Trong `/quan-tri`: điền tên thật cho user còn trùng username; đủ Trưởng/Phó ban mỗi đơn vị

## 1. Đăng nhập & phân quyền

- [ ] `laixe1` → menu **Lịch tuần, Đơn của tôi, Tạo đơn, Chuyến của tôi, Thống kê của tôi, Thông báo**; KHÔNG thấy Duyệt/Điều xe/Công-tơ-mét/Quản trị
- [ ] Trưởng/Phó ban (vd TT Tin Tức) → thấy thêm **Duyệt đơn**
- [ ] `huynhvantuan` (Tổ trưởng Đội xe) → thấy **Điều xe, Công-tơ-mét, Thống kê**
- [ ] `admin` / `adminxe` → thấy **Quản trị**
- [ ] Sai mật khẩu → báo lỗi, không vào được
- [ ] User bị tắt "Đang hoạt động" → không đăng nhập được (401)
- [ ] Thanh trên hiện **avatar chữ cái** + **chuông** cạnh tên

## 2. Vòng đời một đơn công tác

- [ ] Nhân viên **Tạo đơn** → Gửi → **Chờ Ban duyệt** (xám); mã `HTV-2026-000xxx`
- [ ] Trưởng/Phó ban cùng đơn vị mở `/duyet` → **Duyệt** → **Chờ Đội xe** (cam)
- [ ] Đội xe mở `/dieu-xe` → mở đơn → chọn **xe** + **lái xe** + ghi chú → **Điều xe** → **Đã điều xe** (xanh lá)
- [ ] Trang điều xe cảnh báo "đang bận trong khung giờ này" nếu có chuyến trùng giờ (vẫn cho lưu)
- [ ] **Xe đã tắt "Đang hoạt động"** không xuất hiện trong danh sách chọn xe
- [ ] Lịch tuần hiển thị đúng màu theo từng bước; **chú thích màu** hiện trên lưới
- [ ] Badge sidebar + số trên **chuông** cập nhật đúng cho từng vai
- [ ] Ban **Từ chối** → đỏ, kèm ghi chú; Đội xe **Từ chối** → đỏ

## 3. Sửa & gửi lại / Hủy đơn

- [ ] Chủ đơn bấm **Sửa đơn** khi còn Chờ Ban duyệt → lưu được
- [ ] Sau khi duyệt / điều xe → chủ đơn KHÔNG thấy nút sửa
- [ ] Đơn **Ban từ chối** → chủ đơn thấy **"Sửa & gửi lại"** → lưu → về **Chờ Ban duyệt**, thẻ "Ban đã từ chối" biến mất
- [ ] Đơn **Đội xe từ chối** → **"Sửa & gửi lại"** → về **Chờ Đội xe** (giữ lượt Ban đã duyệt)
- [ ] Đơn bị từ chối → chủ đơn bấm **Hủy đơn** → **Đã hủy**, rớt khỏi "cần xem"
- [ ] Người tạo hủy khi **Chờ Ban duyệt** → OK; sau khi Ban duyệt thì không
- [ ] **Chờ Đội xe**: Đội xe hoặc Trưởng/Phó Ban Văn Phòng Đài hủy được
- [ ] **Đã điều xe**: chỉ Trưởng/Phó Ban **Văn Phòng Đài** hủy được

## 4. Trang "Đơn của tôi"

- [ ] Hộp vàng **"N đơn cần bạn xem"** liệt kê đúng các đơn ở `ban_tu_choi` / `doi_xe_tu_choi` / `da_dieu_xe`, kèm lý do
- [ ] Các dòng đó nằm đầu bảng, nền vàng, nhãn cam **"Cần xem"**
- [ ] 4 nút lọc **Đang mở / Hoàn thành / Đã hủy / Tất cả** kèm số đếm, bấm đổi danh sách
- [ ] Khi > 25 đơn: có **phân trang** "← Trước / Sau →" và "Trang x/y"

## 5. Đơn phát sinh

- [ ] Lái xe (hoặc Đội xe) tạo đơn, tick "Đơn phát sinh" → vào thẳng **Chờ Đội xe**, có nhãn tím "Phát sinh"
- [ ] Đội xe điều xe cho đơn phát sinh như bình thường

## 6. Công-tơ-mét

- [ ] Lái xe: **Chuyến của tôi** → chuyến **Đã điều xe** → bảng hiện **Xe / Lái xe + SĐT / Biên tập + SĐT / Nội dung**
- [ ] Nhập **km xuất bến** (điền sẵn = số km xe) + giờ → **Bắt đầu chuyến** → **Đang chạy**
- [ ] Banner "Bạn có N chuyến đang chạy chưa đóng" hiện ở **mọi trang** tới khi đóng
- [ ] Nhập **km về** + giờ kết thúc → **Đóng chuyến** → **Hoàn thành**; số km xe cập nhật
- [ ] km về < km đi → bị chặn
- [ ] Không cho bắt đầu chuyến mới trên xe đang có chuyến chưa đóng
- [ ] `/dieu-xe` đầu trang liệt kê xe đang chạy chưa đóng, đánh dấu **QUÁ GIỜ** (quá giờ dự kiến / > 12h)
- [ ] `/cong-to-met`: khoảng trống km (odo đầu chuyến sau > odo cuối chuyến trước + 1) → hàng đỏ
- [ ] **Biết rồi** → ẩn khỏi danh sách; `?daxem=1` → xem lại; **Bỏ ẩn** → hiện lại
- [ ] Đội xe: đơn **Hoàn thành** → panel "Điều chỉnh km" → sửa + lý do → lưu; số km xe tính lại; ghi `audit_log`
- [ ] Bấm tên xe → `/cong-to-met/xe/:id` dòng thời gian, tô đỏ chỗ đứt quãng
- [ ] **"Đặt lại số km gốc của xe"**: `admin` / `adminxe` thấy & lưu được; **`huynhvantuan` (Đội xe) KHÔNG thấy mục này**

## 7. Thống kê

- [ ] `/thong-ke` mặc định = **trọn tháng hiện tại** (ngày 1 → ngày cuối tháng); đổi khoảng ngày → số liệu đổi
- [ ] Bảng theo lái xe: số chuyến, phát sinh, tổng km, giờ chạy; theo xe: số chuyến, tổng km
- [ ] **Chi tiết** 1 lái xe → `/thong-ke/lai-xe/:username` liệt kê từng chuyến trong kỳ
- [ ] **CSV lái xe / CSV xe** tải về, mở Excel đúng dấu tiếng Việt
- [ ] `Ctrl+P` → trang sạch, ẩn sidebar + header
- [ ] Lái xe (`laixe1`) mở **Thống kê của tôi** → thấy tổng chuyến / km / giờ + bảng từng chuyến; KHÔNG có nút "← Thống kê chung"

## 8. Lịch tuần

- [ ] Nút **← Tuần trước / Tuần này / Tuần sau →** hoạt động
- [ ] Ô **chọn ngày**: chọn ngày bất kỳ → nhảy tới tuần chứa ngày đó
- [ ] Tiêu đề hiện khoảng `dd/mm – dd/mm`; ô **Hôm nay** viền xanh
- [ ] **Chú thích màu** khớp màu các đơn trên lưới

## 9. Quản trị

- [ ] `/quan-tri`: sửa họ tên 1 user → số "trùng username" giảm
- [ ] **+ Thêm user** → Lưu → đăng nhập được bằng `123456`
- [ ] Mở 1 user → sửa vai trò / đơn vị / cờ "lái xe" / "Đang hoạt động" → Lưu
- [ ] **Đặt lại mật khẩu về 123456** → user đó đăng nhập lại bằng `123456`
- [ ] Bổ sung Trưởng/Phó ban → dòng cảnh báo "thiếu Trưởng/Phó ban" giảm
- [ ] **+ Thêm xe** / sửa xe → xuất hiện đúng khi điều xe

## 10. Điện thoại (lái xe)

- [ ] Mở URL trên điện thoại → giao diện co gọn, nút full-width
- [ ] "Thêm vào màn hình chính" → mở ra chạy như app (standalone, icon logo)
- [ ] Nhập công-tơ-mét: bàn phím số

## 11. Phiên & bảo mật

- [ ] Đăng nhập rồi chuyển nhiều trang → không văng ra `/login`
- [ ] Đăng xuất → vào trang bất kỳ → về `/login`
- [ ] Đổi `AUTH_SECRET` rồi deploy lại → mọi phiên cũ vô hiệu, phải đăng nhập lại
