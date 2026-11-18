# Tạo máy chủ AI miễn phí cho Fusion English (làm 1 lần, khoảng 10 phút)

Máy chủ AI là "bộ não" để web nói chuyện với bạn như người nước ngoài. Dùng Cloudflare, miễn phí (có giới hạn lượt mỗi ngày), không cần thẻ.

1. Vào https://dash.cloudflare.com/sign-up , đăng ký tài khoản bằng email, xác nhận email.
2. Ở menu trái chọn **Workers & Pages** → **Create** → **Create Worker**.
3. Đặt tên `fusion-ai` → bấm **Deploy**.
4. Bấm **Edit code**. Xóa hết mã cũ, mở tệp `fusion-ai-worker.js`, sao chép toàn bộ rồi dán vào → bấm **Deploy**.
5. Vào **Settings** (Cài đặt) của Worker → **Bindings** → **Add** → chọn **Workers AI** → đặt tên biến là `AI` (viết hoa) → **Deploy**.
6. Sao chép địa chỉ của Worker (dạng `https://fusion-ai.TEN-BAN.workers.dev`).
7. Mở web → trang **Hội thoại** → dán địa chỉ vào ô "Nói chuyện với người bản xứ (AI)" → **Lưu** → **Bắt đầu nói chuyện**.

Lưu ý:
- Dùng trên điện thoại: mở địa chỉ https://buivantanchuyentin-stack.github.io/fusion-english/ (micro chỉ chạy ở https), dùng Chrome, cho phép micro.
- Hết lượt miễn phí trong ngày thì AI báo lỗi, sáng hôm sau dùng lại được.
- Nếu một mô hình bị Cloudflare ngừng, mã tự thử mô hình khác. Nếu tất cả lỗi, báo mình để cập nhật tên mô hình.
- Mã chỉ cho phép web của bạn (github.io và localhost) gọi vào, người lạ không dùng được từ trang khác.
