# Hướng dẫn cấu hình Gmail API để gửi email thông báo

Tài liệu này hướng dẫn từ đầu cách lấy `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
`GMAIL_REFRESH_TOKEN` để app gửi email thông báo qua Gmail API (dùng cho
[src/lib/gmail.ts](../src/lib/gmail.ts) và [src/lib/notify.ts](../src/lib/notify.ts)).
Viết lại sau khi đã làm thử nhiều lần bị lỗi — đi đúng thứ tự dưới đây để tránh lặp lại các lỗi đó.

---

## 1. Bật Gmail API

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo project mới (hoặc dùng project có sẵn).
2. **APIs & Services → Library** → tìm **Gmail API** → **Enable**.

---

## 2. Cấu hình màn hình xin quyền (OAuth consent screen)

Vào **APIs & Services → OAuth consent screen** (hoặc menu **Audience** trong giao diện mới):

1. **User type**: chọn **External**.
2. Mục **Branding**: điền các trường bắt buộc — **App name**, **User support email**,
   **Developer contact information**. Các ô **Application home page / privacy policy link /
   terms of service link** để **trống hết** (không bắt buộc, và nếu điền domain dạng
   `*.workers.dev` sẽ bị lỗi "Missing domain" vì đó là domain dùng chung, Google không cho
   authorize).
3. Mục **Audience**: thêm chính Gmail bạn sẽ dùng để gửi mail vào danh sách **Test users**.
4. Vẫn ở mục **Audience**: bấm **Publish app** để chuyển từ **Testing** sang **In production**.
   - **Bắt buộc phải Publish** — nếu để ở Testing, `refresh_token` sẽ **tự hết hạn sau 7 ngày**
     và app ngừng gửi được mail.
   - Google có thể hiện cảnh báo "unverified app" — bỏ qua được, vì app chỉ dùng nội bộ,
     không cần Google verify (scope `gmail.send` không phải "restricted scope").

---

## 3. Tạo OAuth Client ID

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

- **Application type: chọn "Web application"** — **không chọn "Desktop app"**, vì Desktop app
  không có ô khai báo redirect URI, sẽ không thể dùng với OAuth Playground ở bước sau (lỗi
  `Error 400: redirect_uri_mismatch`).
- Ở mục **Authorized redirect URIs**, thêm đúng:
  ```
  https://developers.google.com/oauthplayground
  ```
- Save. Copy lại **Client ID** và **Client secret** — đây chính là giá trị cho
  `GMAIL_CLIENT_ID` và `GMAIL_CLIENT_SECRET`.

---

## 4. Lấy Refresh Token bằng OAuth Playground

1. Mở [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Bấm icon bánh răng (Settings, góc trên phải) → tick **"Use your own OAuth credentials"** →
   dán đúng **Client ID** và **Client secret** vừa tạo ở bước 3 (rất quan trọng: phải dùng
   đúng cặp Client ID/Secret vừa tạo, nếu sau này đổi/tạo lại Client khác thì phải lấy lại
   Refresh Token mới — token cũ sẽ báo lỗi `invalid_grant`).
3. Khung bên trái, khung "Input your own scopes", gõ:
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
   Bấm **Authorize APIs** → đăng nhập đúng tài khoản Gmail muốn dùng để gửi mail → Allow.
4. Ở **Step 2**, bấm **Exchange authorization code for tokens**.
5. Copy giá trị **Refresh token** hiển thị (dạng `1//...`) — đây là `GMAIL_REFRESH_TOKEN`.
   (Access token bên dưới **không cần** — nó tự hết hạn sau ~1 giờ và app tự xin lại bằng
   refresh token mỗi lần gửi mail, xem [gmail.ts](../src/lib/gmail.ts).)

---

## 5. Đặt secrets lên Cloudflare

**Chỉ 2 giá trị sau là bí mật thật sự, đặt bằng `wrangler secret put`:**

```bash
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN
```

Lệnh sẽ chờ bạn dán giá trị vào rồi Enter.

> **Lưu ý quan trọng khi chạy trên Windows PowerShell:** TUYỆT ĐỐI không dùng cách
> `"giá-trị" | npx wrangler secret put TÊN_BIẾN` — PowerShell sẽ tự chèn thêm 1 ký tự xuống
> dòng vào cuối giá trị khi pipe qua lệnh ngoài, làm hỏng secret một cách **âm thầm** (lệnh
> vẫn báo "Success" nhưng giá trị sai). Luôn gõ tương tác trực tiếp (chạy lệnh, đợi dấu nhắc,
> gõ/dán giá trị, Enter) thay vì pipe.

**2 giá trị còn lại không bí mật** (`GMAIL_CLIENT_ID`, `GMAIL_SENDER` — địa chỉ Gmail dùng gửi),
khai báo thẳng trong [wrangler.jsonc](../wrangler.jsonc) mục `"vars"`, **không đặt qua
Cloudflare Dashboard** — vì Dashboard cho sửa biến không khai báo trong `wrangler.jsonc`, nhưng
lần deploy tiếp theo từ máy (`wrangler deploy`) sẽ **xoá mất** biến đó (không đồng bộ ngược từ
Dashboard về file cấu hình).

Sau khi đặt xong cả 4, deploy lại:

```bash
npx wrangler deploy
```

---

## 6. Kiểm tra hoạt động

1. Chạy `npx wrangler tail` để xem log thời gian thực.
2. Thực hiện 1 hành động sinh thông báo trong app (gắn thẻ Biên tập/Quay phim, duyệt đơn, điều
   xe...) cho 1 user có `email` trong bảng `users`.
3. Log thành công sẽ có dòng: `"Đã gửi Gmail tới" "<email>"`.
4. Nếu thấy lỗi `invalid_grant` khi đổi access token → Client ID/Secret hiện tại không khớp với
   Client đã dùng để lấy Refresh Token ở bước 4 — làm lại bước 4 với đúng cặp Client ID/Secret
   hiện đang đặt trên Cloudflare.

---

## Các lỗi đã gặp và cách xử lý (tham khảo nhanh)

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Error 400: redirect_uri_mismatch` khi Authorize trên Playground | OAuth Client đang là loại **Desktop app** (không có redirect URI) | Tạo lại Client loại **Web application**, thêm redirect URI `https://developers.google.com/oauthplayground` |
| Nút **Publish app** bị mờ, không bấm được | Chưa điền đủ trường bắt buộc ở **Branding** | Điền App name / User support email / Developer contact, để trống 3 ô link không bắt buộc |
| `"Missing domain: ...workers.dev"` ở Branding | Điền domain `*.workers.dev` (domain dùng chung) vào ô Application home page | Xoá trống ô đó — không bắt buộc |
| `invalid_grant` khi Worker tự đổi refresh token lấy access token | Refresh Token không khớp với `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` hiện tại (thường do đổi Client sau khi đã lấy token) | Vào OAuth Playground, dùng đúng Client ID/Secret hiện tại trên Cloudflare, lấy lại Refresh Token mới |
| Refresh Token tự nhiên ngừng hoạt động sau vài ngày | OAuth consent screen còn ở trạng thái **Testing** (token Testing tự hết hạn sau 7 ngày) | Publish app (mục 2, bước 4) |
| Đặt secret xong vẫn lỗi/sai giá trị dù CLI báo Success | Dùng `"..." | wrangler secret put ...` trên PowerShell — bị chèn thêm newline | Gõ tương tác trực tiếp, không pipe (xem mục 5) |
