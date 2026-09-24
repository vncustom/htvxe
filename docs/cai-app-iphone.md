# Cài app Đặt xe HTV trên iPhone (PWA)

iPhone không cài được APK như Android. Cách dùng như một app là **thêm web vào Màn hình chính** (PWA):
có icon riêng, mở toàn màn hình, nhận thông báo đẩy. Không cần App Store, không tốn phí,
và luôn là bản mới nhất vì vẫn là website `https://htvxe.vncustom.workers.dev`.

## Yêu cầu

- **iOS 16.4 trở lên** (Cài đặt → Cài đặt chung → Giới thiệu → Phiên bản iOS). Máy cũ hơn vẫn dùng được web
  nhưng **không nhận được thông báo đẩy**.
- **Phải dùng Safari** để cài. Chrome, Cốc Cốc, Firefox… trên iPhone không có nút cài PWA.
- Nối được mạng nội bộ của Đài (Wi-Fi/VPN) khi đăng nhập SSO, giống khi dùng web.

## Bước 1 — Thêm vào Màn hình chính

1. Mở **Safari**, vào `https://htvxe.vncustom.workers.dev`.
2. Bấm nút **Chia sẻ** (hình vuông có mũi tên hướng lên) ở thanh dưới. Nếu không thấy, bấm dấu **⋯** rồi chọn Chia sẻ.
3. Kéo danh sách xuống, chọn **Thêm vào Màn hình chính**.
4. Giữ nguyên tên "Đặt xe HTV", bấm **Thêm** (nếu có tuỳ chọn *Mở như ứng dụng web* thì để bật).
5. Icon "Đặt xe HTV" xuất hiện ở Màn hình chính.

## Bước 2 — Đăng nhập trong app

**Mở app từ icon ở Màn hình chính** (không mở bằng Safari). Đăng nhập lại: app trên Màn hình chính
có phiên đăng nhập **riêng**, không dùng chung với Safari.

## Bước 3 — Bật thông báo

Bắt buộc làm trong app mở từ icon. Bật ở tab Safari thường sẽ **không** nhận được thông báo.

1. Trong app, bấm nút **🔔 Bật thông báo trên máy này** ở thanh trên cùng.
2. iPhone hỏi *"Đặt xe HTV muốn gửi thông báo"* → chọn **Cho phép**.
3. Nút đổi thành **🔔 Đã bật thông báo trên máy này** là xong.

## Không thấy thông báo?

| Hiện tượng | Cách xử lý |
|---|---|
| Bấm nút mà không hiện hộp thoại xin quyền | Bạn đang mở bằng Safari, không phải icon Màn hình chính. Đóng, mở lại từ icon |
| Nút hiện *"Trình duyệt đang chặn thông báo"* | Cài đặt → Thông báo → **Đặt xe HTV** → bật **Cho phép thông báo**. Mở lại app, bấm nút |
| Không có mục "Đặt xe HTV" trong Cài đặt → Thông báo | Chưa từng bấm Cho phép. Mở app từ icon và bấm nút 🔔 lần nữa. Vẫn không có: xoá icon, cài lại từ Bước 1 |
| Bật rồi mà vẫn không nhận | Kiểm tra iPhone không đang bật **Tập trung** (Không làm phiền); Cài đặt → Thông báo → Đặt xe HTV → bật Màn hình khoá, Trung tâm thông báo, Biểu ngữ |
| Bị đăng xuất bất ngờ | Đăng nhập lại; phiên hết hạn sau 30 ngày |

## Gỡ hoặc cài lại

Giữ icon "Đặt xe HTV" → **Xoá ứng dụng** → *Xoá khỏi Màn hình chính*. Cài lại từ Bước 1 rồi bật thông báo lại.

## Khác biệt so với app Android

| | Android (APK) | iPhone (PWA) |
|---|---|---|
| Cài | Gửi file APK | Safari → Thêm vào Màn hình chính |
| Thông báo | Chrome, cấp quyền cho app | Chỉ khi mở từ icon, iOS 16.4+ |
| Lên App Store / Google Play | Có thể (Play) | Không |
| Cập nhật | Tự theo web | Tự theo web |

Muốn có mặt trên App Store cần đóng gói app native riêng (cần máy Mac, tài khoản Apple Developer 99 USD/năm
và làm lại phần thông báo đẩy theo APNs). Chỉ nên làm khi có yêu cầu bắt buộc.
