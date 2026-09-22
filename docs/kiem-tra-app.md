# Kiểm tra app có còn chạy đúng không (dành cho người không biết code)

Tài liệu này giải thích cho người **không rành kỹ thuật** cách kiểm tra xem app Đặt xe
HTV còn hoạt động đúng hay không — sau khi nhờ ai đó (kể cả AI) sửa/thêm gì vào code.

## "Test" nghĩa là gì, nói đơn giản?

Tưởng tượng có một **người máy** đóng vai lần lượt: một nhân viên tạo đơn công tác, một
Trưởng ban duyệt đơn, một Đội xe điều xe, một lái xe bắt đầu rồi kết thúc chuyến đi —
và sau mỗi bước, người máy đó tự kiểm tra "đơn có chuyển đúng trạng thái không?",
"người không có quyền có bị chặn không?"... Toàn bộ việc này chạy trong **vài giây**,
thay vì bạn phải tự mở app, tạo tài khoản giả, bấm qua từng bước bằng tay mất 15-20
phút mỗi lần muốn chắc chắn app không bị hỏng.

Đó chính là "test" (kiểm thử tự động). App này đã có sẵn ~66 bài kiểm tra như vậy,
bao phủ những phần quan trọng nhất: quyền hạn ai được làm gì, vòng đời 1 đơn công tác,
tính giờ Việt Nam, mật khẩu, cảnh báo km xe chạy ngoài đơn...

**Vì sao bạn nên quan tâm dù không biết code**: mỗi khi có ai (kể cả AI) sửa code, có
rủi ro vô tình làm hỏng một chỗ khác mà không để ý. Chạy test là cách nhanh nhất để biết
ngay "sửa chỗ này có làm hỏng chỗ khác không" — **trước khi** đưa lên app thật mà mọi
người trong Đài đang dùng.

## Cách dễ nhất: nhờ AI chạy giúp

Bạn không cần tự làm gì cả. Trong khung chat với Claude (trợ lý AI), chỉ cần gõ:

```
chạy test giúp tôi
```

hoặc, sau khi nhờ sửa một tính năng:

```
chạy test xem có bị hỏng gì không
```

Claude sẽ tự chạy và báo lại bằng tiếng Việt dễ hiểu, đại loại:

- ✅ **"66/66 test đều qua, không có gì hỏng"** — yên tâm, app vẫn hoạt động đúng như
  thiết kế.
- ❌ **"có 1 test bị lỗi ở phần duyệt đơn"** — nghĩa là thay đổi vừa rồi làm hỏng một
  phần nào đó. Cứ để Claude tự tìm và sửa, hoặc hỏi lại "lỗi đó là gì, ảnh hưởng gì tới
  người dùng thật không?".

## Cách tự chạy (không bắt buộc, nếu bạn muốn tự tay bấm thử)

1. Mở khung dòng lệnh (cửa sổ đen chữ trắng, gọi là "Terminal") trong ứng dụng Claude
   Code — nếu không thấy, chỉ cần nhờ Claude: *"mở terminal cho tôi xem"*.
2. Gõ đúng 1 dòng này rồi bấm Enter:
   ```bash
   npm test
   ```
3. Đợi khoảng 3-5 giây. Kết quả hiện ra cuối cùng sẽ giống thế này:
   ```
   Test Files  8 passed (8)
        Tests  66 passed (66)
   ```
   Dòng có chữ **"passed"** (đã qua) cho tất cả các mục — nghĩa là **ổn, không có gì hỏng**.

Nếu thay vào đó bạn thấy chữ **"failed"** (đỏ) kèm mô tả lỗi dài dòng — đừng lo, không
cần đọc hiểu đoạn lỗi đó. Chỉ cần copy nguyên đoạn màn hình hiện ra và dán vào khung
chat, nhờ Claude: *"test bị lỗi, xem giúp tôi bị gì"*.

## Có làm hỏng gì thật không nếu tôi chạy sai/chạy nhiều lần?

**Không.** Test chạy trên một "app giả lập" hoàn toàn nằm trong bộ nhớ máy tính, dùng
dữ liệu giả (tên người dùng, đơn công tác... đều là dữ liệu mẫu do test tự tạo ra). Nó
**không** đụng vào Supabase (nơi lưu dữ liệu thật của Đài) — CSDL thật, đơn thật, user
thật hoàn toàn không bị ảnh hưởng dù bạn chạy `npm test` bao nhiêu lần. Dữ liệu giả đó
biến mất ngay khi test chạy xong.

## Khi nào nên chạy test?

- Sau mỗi lần nhờ Claude (hoặc ai đó) sửa/thêm tính năng — chạy trước khi đồng ý đưa lên
  app thật (deploy).
- Trước khi deploy một thay đổi lớn (ví dụ đổi cách duyệt đơn, thêm vai trò mới).
- Không cần chạy khi chỉ đổi chữ/màu giao diện đơn thuần — lúc đó nên **tự mở app bằng
  trình duyệt và bấm thử bằng mắt** thay vì chạy test (test không "nhìn" được giao diện
  đẹp/xấu, nó chỉ kiểm tra logic hoạt động đúng hay sai).

## Test tự động khác gì với việc tôi tự vào app bấm thử?

Hai việc **bổ sung cho nhau**, không thay thế nhau:

| | Test tự động (`npm test`) | Tự bấm thử trên trình duyệt |
|---|---|---|
| Tốc độ | Vài giây, kiểm tra hàng chục luồng cùng lúc | Vài phút mỗi luồng, làm tay |
| Phù hợp để kiểm tra | Logic có đúng không (đơn có chuyển đúng trạng thái, ai được làm gì) | Giao diện có đẹp/dễ dùng không, cảm giác thật khi dùng |
| Phát hiện lỗi mới phát sinh do sửa code | Rất tốt, chạy lại được vô hạn lần miễn phí | Dễ bỏ sót vì phải nhớ bấm lại đúng các bước cũ |

Nên dùng cả hai: chạy `npm test` để chắc logic không hỏng, rồi tự mở app xem có "nhìn
ổn" không trước khi công bố cho mọi người dùng.

---

*Nếu bạn là người viết code muốn hiểu cấu trúc test/công cụ đã chọn (Vitest, PGlite...),
xem tài liệu kỹ thuật ở [`test/README.md`](../test/README.md).*
