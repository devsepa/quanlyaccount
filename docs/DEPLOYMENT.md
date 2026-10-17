# Triển khai nâng cấp quản lý tài khoản

## Trạng thái

Mã giao diện có thể chạy với hệ thống hiện tại. `assets/js/app-config.js` mặc định `secureMode:false`, `serverScheduler:false` để không khóa người dùng trước khi triển khai máy chủ và xác thực. Chỉ đổi hai cờ sau khi hoàn tất các bước dưới đây. Chưa chạy migration hoặc ghi dữ liệu Firebase thật trong quá trình phát triển.

## 1. Chuẩn bị Firebase Blaze

- Xác nhận project ID trong `.firebaserc` là project của database đang dùng. Region Functions: `asia-southeast1`; database instance: `aopvman-default-rtdb`.
- Dùng Node.js 22, Firebase CLI và tài khoản có quyền triển khai project. Chạy `firebase login`, `firebase use aopvman` rồi `npm ci --prefix functions`.
- Firebase Console → Authentication: bật Email/Password và Anonymous; tạo tài khoản email riêng cho từng Admin. Không dùng mật khẩu Admin trong mã hoặc chat.
- Lấy cấu hình Web app từ Project settings: điền `apiKey`, `projectId`, `databaseURL`, `functionsURL` vào `assets/js/app-config.js`. Web API key không phải service account secret.
- Thiết lập Application Default Credentials trên máy quản trị để chạy script cấp quyền/migration. Không đưa file service account vào repository.

## 2. Sao lưu và quyền Admin

- Tải bản export đầy đủ Realtime Database riêng trước khi chuyển đổi; bản này chứa mật khẩu tài khoản và cấu hình cũ, cần giữ riêng.
- Với mỗi Firebase Auth UID của Admin, chạy `node functions/grant-admin.cjs UID grant` bằng thông tin xác thực máy chủ đã được thiết lập. Script đặt custom claim `admin:true` và registry `admin_access/UID:true`.
- Thu hồi quyền: `node functions/grant-admin.cjs UID revoke`. Giao diện cũng có API thu hồi quyền Admin; registry chặn ghi ngay cả khi ID token cũ chưa hết hạn.

## 3. Bí mật Telegram và lịch máy chủ

Chạy các lệnh sau; nhập giá trị trực tiếp trong CLI, không chèn vào file JS:

```sh
firebase functions:secrets:set BAN_TELEGRAM_BOT_TOKEN
firebase functions:secrets:set BAN_TELEGRAM_CHAT_ID
firebase deploy --only functions
```

`banClock` chạy mỗi phút; nhắc trong cửa sổ 6h/1h và chuyển acc có giờ sang trạng thái chờ kiểm tra khi đến hạn. Độ trễ thường tối đa một chu kỳ lịch, không bảo đảm đúng từng giây. Chỉ acc có ngày và giờ mới có nhắc theo giờ. `dailyBackup` chạy 03:15 giờ Việt Nam, lưu cả app_data và filter_queue, giữ 30 bản theo lịch. Bản trước khôi phục được lưu trước khi thay thế dữ liệu.

Thông báo dùng ID ổn định theo acc/thời điểm/mốc nhắc. Outbox được lưu cùng giao dịch đánh dấu nhắc; kết quả gửi không xác định được chuyển thành `uncertain`, không tự gửi lại để tránh trùng. Kiểm tra `app_data/serverReminderOutbox` khi cần đối soát. Không có cơ chế bảo đảm Telegram exactly-once khi mất phản hồi mạng. Cấu hình Cloud Monitoring/budget trong Console theo nhu cầu vận hành.

## 4. Chuyển sang đăng nhập mới

Thực hiện trong khoảng bảo trì, tránh mở song song bản web cũ có quyền ghi:

1. Đã có export riêng, Functions đã triển khai, tài khoản Admin đã cấp quyền và Web config đã điền.
2. `firebase deploy --only database` để áp dụng `database.rules.json`. Khách không còn được ghi toàn bộ app_data; API copyGuestAccount ghi lượt dùng có kiểm tra khóa, trạng thái BAN và giới hạn tốc độ.
3. Chạy `node functions/migrate-secure.cjs --confirm`. Giao dịch lưu bản trước chuyển đổi, bỏ adminPin/teleConfig khỏi app_data, bỏ đường PIN/token cũ, bật server_settings.schedulerEnabled/backupEnabled. Bot token dùng Secret Manager.
4. Đặt `secureMode:true`, `serverScheduler:true` trong `assets/js/app-config.js` rồi phát hành web. Cờ serverScheduler tắt bộ quét nhắc ở trình duyệt để tránh chồng nguồn gửi. Không tiếp tục sử dụng web cũ để ghi dữ liệu sau khi chuyển đổi.
5. Đăng nhập email/mật khẩu, kiểm tra Admin hợp lệ có thể thêm/sửa/chuyển kho; khách không thể ghi app_data qua REST; khóa khẩn cấp chỉ hạn chế khách. Kiểm tra một acc thử có giờ, Telegram và bản sao lưu trên máy chủ.
6. Xác nhận email đăng nhập, quyền registry và chức năng khôi phục trước khi kết thúc bảo trì. Nếu migration chưa hoàn tất, không bật secureMode.

Guest vẫn được đọc kho chia sẻ sau Anonymous Auth như mục đích của ứng dụng. Rules này bảo vệ quyền sửa dữ liệu, không biến kho chia sẻ thành kho mật khẩu riêng tư. Các thiết bị cũ giữ nguyên dữ liệu quản lý; danh tính mới dùng Auth UID và có thể cần liên kết lại bằng giao diện gộp thiết bị.

## Kiểm tra và giới hạn

`npm test` kiểm tra logic và hồi quy. Kiểm thử Emulator Rules dùng project demo, không chạm dữ liệu thật. Máy chủ cần kết nối Firebase thật để xác nhận IAM, Scheduler, Secret Manager và Telegram end-to-end; không coi unit test là bằng chứng đã triển khai.

Sao lưu trên thiết bị và xem trước khôi phục vẫn có sẵn khi secureMode chưa bật. Sao lưu máy chủ cần Functions, Rules và Auth được triển khai đồng bộ. Xuất acc đã chọn là JSON có mật khẩu, nên giữ file như file sao lưu tài khoản.

Tài liệu Firebase chính thức: [lịch Functions](https://firebase.google.com/docs/functions/schedule-functions), [custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [Auth REST](https://firebase.google.com/docs/reference/rest/auth), [Secrets](https://firebase.google.com/docs/functions/config-env).

Chạy kiểm thử có thể lặp lại: `npm ci`, `npm test`; Các bộ kiểm thử Emulator trước đây không còn trong checkout hiện tại. Các dependency phục vụ kiểm thử không cần đưa lên GitHub Pages. Các giao dịch chuyển/khôi phục nhiều kho đọc root Database để giữ tính nguyên tử; cần theo dõi lưu lượng khi dữ liệu tăng lớn.

## Bố cục thư mục

- `index.html`: trang chính.
- `assets/js/`: JavaScript và cấu hình phía web.
- `styles/`: CSS.
- `docs/`: tài liệu.
- `tests/`: các bài kiểm thử hiện có; chạy `npm test`.
- `functions/`: máy chủ Firebase; giữ cấu hình triển khai tại thư mục gốc.

Đợt sắp xếp chỉ chuyển file và cập nhật đường dẫn. Những bộ kiểm thử đã bị xóa trước đó không được phục hồi; các kết quả kiểm thử lịch sử không mô tả số bài còn lại trong checkout hiện tại.
