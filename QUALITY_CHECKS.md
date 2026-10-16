# Kiểm tra chất lượng — 16/10/2026

Các thay đổi dành cho web quản lý acc; không thay TOOL_MAKE.js.

## Chạy lại kiểm tra

`node --test tests/quality-regression.test.cjs`

17 kiểm tra cho xung đột, xác nhận nhật ký, mã phiên bản và Telegram. Ngoài ra đã chạy 35 kiểm tra hồi quy hiện có trong bộ kiểm thử tạm của phiên làm việc.

## Đã kiểm tra bằng dữ liệu giả

- Chuyển acc vừa mở BAN vào Rank hoặc Chung Sức, giữ ID/lịch sử, tìm lại và nạp lại dữ liệu.
- Phân biệt acc dùng được, đang BAN, chờ kiểm tra sau BAN và kho cần lọc; giữ kho Chung Sức riêng.
- Mất mạng, Firebase từ chối, mất phản hồi: không ghi nhật ký thao tác thành công trước xác nhận.
- Thay đổi tiếp trong lúc đang lưu: giữ đợt mới chờ xác nhận; không ghi nhận kho trung gian chưa lưu.
- Hai Admin sửa trường khác nhau: gộp dữ liệu. Cùng trường có giá trị khác nhau: chặn ghi đè.
- Acc bị xóa hoặc sửa từ thiết bị khác: không tự khôi phục/xóa đè bằng bản cũ.
- Telegram: khóa gửi chung, gửi một lần, chờ khi bị giới hạn, không tự gửi lại khi mất phản hồi.
- Các tài nguyên CSS/JS nội bộ dùng cùng mã phiên bản `20261016-quality-1`.

Kiểm thử dùng mô phỏng DOM/Firebase/Telegram, không ghi dữ liệu thật hoặc gửi tin thật.

## Cần kiểm tra trên điện thoại thật trước khi phát hành

Chưa chạy trình duyệt Android/iPhone thật trong môi trường này. Các kiểm tra logic không thay thế kiểm tra giao diện.

Thực hiện trên Chrome Android và Safari iPhone, màn hình dọc/ngang, bàn phím mở/đóng:

1. Vào danh sách BAN: tên dài xuống dòng; nút sửa ngày dễ bấm; không tràn ngang.
2. Đổi ngày BAN về hôm nay, vào kho chờ kiểm tra, chuyển một acc thử vào Rank và một acc vào Chung Sức. Tìm toàn bộ kho và tải lại: mỗi acc chỉ còn một bản ghi đúng kho.
3. Tắt mạng rồi chuyển acc: giao diện báo còn thay đổi trên máy, nhật ký chưa ghi thành công. Bật mạng, thử đồng bộ: chỉ có một nhật ký sau xác nhận.
4. Hai thiết bị cùng sửa một trường: thiết bị sau báo xung đột. Chọn Dùng bản cloud, xác nhận; bản trên máy phải được sao lưu trước khi thay.
5. Mở nút Telegram trong công cụ Admin: kiểm tra trạng thái chờ/đã gửi/lỗi/chưa xác minh. Thử lại lỗi xác định, tôn trọng thời gian chờ. Với chưa xác minh, kiểm tra kênh trước, không gửi lại tự động.
6. Tải lại trang trên máy từng mở bản cũ: kiểm tra CSS và JS có cùng tham số phiên bản; giao diện BAN vẫn là các thẻ có khoảng cách.

Lịch sử Telegram hiển thị 100 mục gần nhất trên thiết bị, gồm chuyển kho và bản tin BAN từ khi cập nhật. Thông báo thêm acc, cảnh báo riêng tư và tin kiểm tra cũng có trạng thái. Nút thử lại các tin này chỉ khả dụng trong phiên hiện tại để không lưu nội dung/mật khẩu vào lịch sử gửi.

## Khi cập nhật lần sau

Đổi đồng thời mã `?v=` của các CSS và JS nội bộ trong index.html. Giữ một mã cho toàn bộ tài nguyên trong cùng lần phát hành.
