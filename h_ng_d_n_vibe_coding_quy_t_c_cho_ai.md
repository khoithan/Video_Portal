# Vibe Coding Guidelines & Prompting Rules

Tài liệu này dùng để định hướng cho AI Assistant (Cursor, Windsurf, GitHub Copilot, Claude...) khi sinh mã nguồn cho dự án.

## 1. Nguyên tắc cốt lõi (Strict Constraints)
1. **KHÔNG dùng Backend:** Tuyệt đối không tạo mã nguồn Node.js, Express, PHP, Python hay gọi REST API bên ngoài.
2. **Thuần Front-end:** Chỉ sử dụng HTML5, CSS3 và Vanilla JavaScript (ES6+).
3. **Cơ sở dữ liệu SQLite:**
   - Sử dụng `sql.js` thông qua CDN: `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js`
   - Khởi tạo tách biệt 2 instance database trong bộ nhớ: `usersDb` (tương ứng `users.db`) và `videosDb` (tương ứng `videos.db`).
   - Tự động lưu (export binary) và nạp lại từ `IndexedDB` sau mỗi lệnh `INSERT`, `UPDATE`, `DELETE`.
4. **Giao diện Light Mode:** Luôn giữ nền trắng sáng (`#FFFFFF` / `#F8FAFC`), đổ bóng nhẹ (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`), font chữ hiện đại (`Inter` hoặc `Plus Jakarta Sans`).

## 2. Cấu trúc thư mục chuẩn (Project Structure)
```text
project-root/
├── PRD.md
├── DATABASE.md
├── GUIDELINES.md
├── index.html              # Trang Dashboard (Tổng quan & Biểu đồ)
├── videos.html             # Trang Danh sách Video (CRUD Video)
├── login.html              # Trang Đăng nhập
├── register.html           # Trang Đăng ký
├── forgot-password.html    # Trang Quên mật khẩu
└── assets/
    ├── css/
    │   └── style.css       # Toàn bộ style Light Mode cho hệ thống
    └── js/
        ├── db-manager.js   # Quản lý khởi tạo users.db, videos.db, seed data & IndexedDB
        ├── auth.js         # Xử lý đăng nhập, đăng ký, quên mật khẩu, bảo vệ route
        ├── dashboard.js    # Truy vấn thống kê và vẽ biểu đồ Chart.js
        └── videos.js       # Hiển thị danh sách, thêm, sửa, xóa video & danh mục
```

## 3. Lộ trình Prompt khi Vibe Coding (Step-by-Step Prompts)

Bạn có thể copy lần lượt các câu lệnh dưới đây gửi cho AI để xây dựng từng phần:

- **Bước 1 (Tạo tầng Database):**
  > "Dựa vào `DATABASE.md` và `GUIDELINES.md`, hãy viết file `assets/js/db-manager.js` sử dụng `sql.js` để khởi tạo 2 database `users.db` và `videos.db`, tự động tạo bảng, chèn dữ liệu mẫu (gồm 15 video mẫu và dữ liệu lượt xem theo ngày/tháng) và lưu trữ bền vững vào IndexedDB."

- **Bước 2 (Tạo CSS Light Mode & Trang Auth):**
  > "Dựa vào `PRD.md`, hãy tạo file `assets/css/style.css` theo tông màu sáng (Light mode) và 3 trang `login.html`, `register.html`, `forgot-password.html` cùng file `assets/js/auth.js` kết nối với `users.db`."

- **Bước 3 (Tạo trang Dashboard):**
  > "Hãy tạo trang `index.html` và `assets/js/dashboard.js` hiển thị 3 thẻ thống kê (Tổng video, Tổng lượt xem, Dung lượng Storage) và 2 biểu đồ bằng Chart.js (Bar chart Top 10 video nhiều view nhất và Line chart lượt xem có nút chuyển đổi theo Ngày/Tháng) lấy dữ liệu từ `videos.db`."

- **Bước 4 (Tạo trang Quản lý Video):**
  > "Hãy tạo trang `videos.html` và `assets/js/videos.js` hiển thị bảng danh sách video (id, title, thumbnail, category, views, actions: Edit, Delete), hỗ trợ thêm mới, chỉnh sửa bằng Modal và xóa video trực tiếp trong `videos.db`."