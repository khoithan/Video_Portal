# Product Requirements Document (PRD) - Video Admin Portal

## 1. Tổng quan dự án (Project Overview)
Xây dựng hệ thống Website Admin quản lý video hoạt động hoàn toàn ở phía Client (Front-end Only). Dự án sử dụng HTML5, CSS3, Vanilla JavaScript kết hợp với cơ sở dữ liệu SQLite chạy trực tiếp trên trình duyệt thông qua WebAssembly (`sql.js`) và lưu trữ bền vững bằng `IndexedDB` / `localStorage`. Hoàn toàn không sử dụng Backend Server.

## 2. Phong cách thiết kế (UI/UX & Theme)
- **Chế độ màu:** Light Mode (Tông màu sáng, nền trắng chủ đạo).
- **Bảng màu (Color Palette):**
  - Nền chính (Background Primary): `#FFFFFF`
  - Nền phụ / Layout (Background Secondary): `#F8FAFC`
  - Chữ chính (Text Primary): `#0F172A`
  - Chữ phụ (Text Muted): `#64748B`
  - Màu nhấn chủ đạo (Primary Accent): `#2563EB` (Hover: `#1D4ED8`)
  - Màu viền (Border): `#E2E8F0`
  - Màu trạng thái: Xanh lá `#10B981` (Success), Đỏ `#EF4444` (Danger/Delete), Vàng `#F59E0B` (Warning).
- **Bố cục (Layout):** Sidebar cố định bên trái + Header phía trên + Khu vực nội dung chính (Main Content) có khả năng responsive.

## 3. Các trang & Tính năng chi tiết

### 3.1. Nhóm trang Xác thực (Authentication)
1. **Trang Đăng nhập (`login.html`):**
   - Nhập Email/Username và Password.
   - Kiểm tra thông tin đối chiếu với database `users.db`.
   - Lưu trạng thái đăng nhập vào `sessionStorage` hoặc `localStorage`.
   - Liên kết chuyển sang trang Đăng ký và Quên mật khẩu.
2. **Trang Đăng ký (`register.html`):**
   - Form nhập: Username, Email, Password, Confirm Password.
   - Kiểm tra trùng lặp Email/Username trong `users.db`.
   - Lưu người dùng mới vào bảng `users`.
3. **Trang Quên mật khẩu (`forgot-password.html`):**
   - Nhập Email đã đăng ký để đặt lại mật khẩu mới trực tiếp vào `users.db`.

### 3.2. Trang Tổng quan (`index.html` - Dashboard)
- **Thẻ thống kê (Metric Cards):**
  1. **Tổng số video:** Đếm tổng số bản ghi trong bảng `videos`.
  2. **Tổng lượt xem:** Tính tổng (`SUM`) cột `views` của toàn bộ video.
  3. **Dung lượng Storage:** Tính tổng (`SUM`) cột `size_mb` (hiển thị theo đơn vị MB hoặc GB kèm thanh tiến trình giới hạn, ví dụ: đã dùng X MB / 10 GB).
- **Biểu đồ (Charts - Sử dụng Chart.js):**
  1. **Biểu đồ cột (Bar Chart):** Hiển thị Top 10 video có lượt xem cao nhất (`ORDER BY views DESC LIMIT 10`).
  2. **Biểu đồ đường (Line Chart):** Thống kê xu hướng lượt xem theo Ngày hoặc theo Tháng (có bộ chuyển đổi Filter Ngày/Tháng).

### 3.3. Trang Quản lý Video (`videos.html` - List Video)
- **Danh sách Video (Data Table):**
  - Các cột hiển thị: `ID`, `Thumbnail` (hiển thị ảnh preview nhỏ bo góc), `Title` ( kèm tên danh mục bên dưới), `Views` (định dạng có dấu phân cách hàng nghìn), `Actions` (Nút **Edit** và **Delete**).
- **Thanh công cụ (Toolbar):**
  - Tìm kiếm theo tiêu đề video (Real-time search).
  - Lọc theo Danh mục (`video_categories`).
  - Nút **"+ Thêm Video Mới"** mở Modal thêm video.
- **Tính năng Thêm / Sửa (Modal Form):**
  - Cho phép nhập/chỉnh sửa: Title, Thumbnail URL, Video URL, Category, Views ban đầu, Dung lượng (MB).
- **Tính năng Xóa:**
  - Hiển thị hộp thoại xác nhận trước khi thực hiện câu lệnh `DELETE` trong `videos.db`.