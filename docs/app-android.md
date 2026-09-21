# App Android (TWA)

App Android chỉ là **vỏ bọc** quanh website `https://htvxe.vncustom.workers.dev`
(Trusted Web Activity, dựng bằng [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)).
Không có code nghiệp vụ trong app → **sửa web là app cập nhật theo ngay**, không cần phát hành lại APK.
Đăng nhập (cookie/SSO), Web Push, lịch tuần… đều dùng nguyên bản web.
Người dùng có thể cài APK **hoặc** mở web / "Thêm vào màn hình chính" — cùng một hệ thống, cùng dữ liệu.

```
android/twa-manifest.json   cấu hình app (packageId, host, màu, icon, khoá ký)
public/manifest.webmanifest PWA manifest (có icon PNG 192/512/maskable)
public/.well-known/assetlinks.json   xác minh app ↔ domain (ẩn thanh địa chỉ)
```

## Cần có (máy build)

- Node.js ≥ 18, JDK 17, Android SDK — `bubblewrap` tự tải JDK/SDK ở lần chạy đầu (~1 GB) và hỏi đường dẫn.
- Web đã **deploy** (Bubblewrap tải manifest + icon từ URL thật).

```bash
npm i -g @bubblewrap/cli
```

## Build lần đầu

```bash
cd android
bubblewrap update --manifest=./twa-manifest.json   # sinh project Android
bubblewrap build                                   # tạo keystore (lần đầu) + app-release-signed.apk
```

Lần đầu Bubblewrap hỏi tạo khoá ký `htvxe-release.keystore` (alias `htvxe`) — **đặt mật khẩu và sao lưu
file này + mật khẩu ở nơi an toàn**. Mất khoá = không thể cập nhật app trên máy đã cài (phải gỡ và cài lại).
Keystore đã nằm trong `.gitignore`, **không commit**.

## Bắt buộc: xác minh domain (assetlinks)

Nếu thiếu bước này app vẫn chạy nhưng hiện **thanh địa chỉ Chrome** phía trên.

1. Lấy vân tay SHA-256 của khoá ký:
   ```bash
   keytool -list -v -keystore android/htvxe-release.keystore -alias htvxe
   ```
   (dòng `SHA256: AB:CD:...`)
2. Tạo `public/.well-known/assetlinks.json`:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "vn.org.htv.datxe",
       "sha256_cert_fingerprints": ["AB:CD:...:vân-tay-SHA256"]
     }
   }]
   ```
3. `npm run deploy`, kiểm tra `https://htvxe.vncustom.workers.dev/.well-known/assetlinks.json` mở được (JSON, không bị đòi đăng nhập).

Nếu sau này đưa lên **Google Play** (App Signing), thêm cả vân tay SHA-256 của "App signing key" trong Play Console vào mảng.

## Phát hành

- **Nội bộ (khuyến nghị cho Đài):** gửi file `android/app-release-signed.apk` qua Zalo/Drive/trang tải; người dùng bật "Cài từ nguồn không xác định" rồi cài.
- **Google Play:** dùng `app-release-bundle.aab`, cần tài khoản nhà phát triển (25 USD một lần).

## Cập nhật app

- Đổi nội dung/chức năng: chỉ cần deploy web.
- Đổi icon, tên, màu, packageId: sửa `android/twa-manifest.json`, tăng `appVersion` + `appVersionCode`, rồi
  `bubblewrap update && bubblewrap build`, phát hành lại APK.

## Thông báo đẩy

Web Push chạy qua Chrome nên **không cần Firebase**. Người dùng mở app → bấm "Bật thông báo trên máy này"
→ cấp quyền thông báo (Android 13+ sẽ hỏi quyền hệ thống). Bấm vào thông báo sẽ mở lại app.

## Lưu ý

- App dùng Chrome của máy: cần Chrome ≥ 72 (máy đời mới đều đạt).
- Đăng nhập SSO chuyển sang `http://10.1.1.215` (mạng nội bộ) — điện thoại phải nối được mạng đó (Wi-Fi/VPN của Đài),
  giống khi dùng web.
