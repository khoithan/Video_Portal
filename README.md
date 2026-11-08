# Video Admin Portal — Hệ thống Quản trị Video & Phân Quyền (Supabase Cloud)

Ứng dụng web quản trị kho video (**Video Admin Portal**) được xây dựng theo kiến trúc **Front-end thuần (HTML5, CSS3, Vanilla JavaScript ES6+)** kết nối trực tiếp tới **Supabase Cloud (PostgreSQL + Supabase Auth + Row Level Security)**, không cần cài đặt Node.js hay máy chủ trung gian.

Giao diện tuân thủ nghiêm ngặt phong cách **SaaS Light Mode** hiện đại, trực quan và tương thích đa thiết bị (Desktop, Tablet, Mobile).

---

## 1. Tính năng nổi bật

### 1.1. Xác thực Người dùng (Supabase Auth + JWT)
- **Đăng nhập (`login.html`):** Hỗ trợ đăng nhập linh hoạt bằng **Email** hoặc **Username**, tùy chọn *Duy trì đăng nhập* (`localStorage` / `sessionStorage`) và nút điền nhanh tài khoản mẫu.
- **Đăng ký (`register.html`):** Tạo tài khoản mới đồng bộ trực tiếp vào `auth.users` và `public.users` (mặc định vai trò `USER`).
- **Quên mật khẩu (`forgot-password.html`):** Đặt lại mật khẩu mới cho tài khoản đã đăng ký trên hệ thống demo.

### 1.2. Quản lý Tài khoản & Phân Quyền RBAC (`permissions.html`)
- Hỗ trợ 2 vai trò phân quyền rõ ràng: **`ADMIN`** và **`USER`**.
- **Bảo vệ hai lớp (UI + Database RLS):**
  - Tài khoản `USER` không thấy mục Phân Quyền trên thanh điều hướng và sẽ nhận màn hình **403 Access Denied** nếu truy cập trực tiếp qua URL; đồng thời bị chặn đọc/sửa danh sách tài khoản ngay ở tầng PostgreSQL RLS.
  - Tài khoản `ADMIN` có toàn quyền truy cập trang Phân Quyền:
    - **Tạo tài khoản & Phân quyền mới (`+ Tạo Tài khoản Mới`):** Khởi tạo trực tiếp tài khoản mới kèm vai trò ban đầu (`ADMIN` hoặc `USER`) mà không làm gián đoạn phiên đăng nhập hiện tại của Admin.
    - **Chỉnh sửa vai trò trực tiếp:** Thay đổi quyền của các tài khoản khác giữa `ADMIN` và `USER` ngay trên bảng dữ liệu (khóa tự hạ quyền của chính tài khoản đang đăng nhập).
    - **Thống kê & Lọc nhanh:** Thẻ đếm tổng tài khoản / số `ADMIN` / số `USER`, tìm kiếm theo Email/Username/Họ tên và lọc theo vai trò.

### 1.3. Dashboard Thống kê & Biểu đồ (`index.html`)
- **3 Thẻ chỉ số thời gian thực (Metric Cards):**
  1. **Tổng số Video** (kèm số danh mục đang hoạt động).
  2. **Tổng Lượt xem** (kèm trung bình lượt xem / video).
  3. **Dung lượng Lưu trữ (Storage):** Tính tổng dung lượng trên hạn mức `10 GB` kèm thanh tiến trình cảnh báo màu sắc.
- **Trực quan hóa dữ liệu với Chart.js 4:**
  - **Bar Chart:** Top 10 video có lượt xem cao nhất.
  - **Line Chart:** Xu hướng lượt xem có nút chuyển đổi linh hoạt **Theo Ngày** (30 ngày gần nhất) và **Theo Tháng** (`YYYY-MM`).
- **Bảng 5 Video mới nhất** cập nhật trong kho.

### 1.4. Quản lý Kho Video & Danh mục (`videos.html`)
- **CRUD Video đầy đủ:** Thêm mới, chỉnh sửa qua Modal (có xem trước ảnh Thumbnail và tạo ảnh mẫu ngẫu nhiên), xóa video có hộp thoại xác nhận.
- **Quản lý Danh mục (`video_categories`):** Thêm, đổi tên, cập nhật mô tả và xóa danh mục ngay trong Modal chuyên biệt.
- **Tìm kiếm, Bộ lọc & Sắp xếp:** Tìm kiếm tiêu đề theo thời gian thực (debounce), lọc theo danh mục, sắp xếp theo mới nhất / lượt xem / dung lượng / ID.
- **Xem trước Video (Preview Player):** Phát trực tiếp luồng video `.mp4` ngay trong hộp thoại xem trước.
- **Xuất dữ liệu nhanh:** Trích xuất dữ liệu bảng `videos` và `users` từ Supabase ra tệp JSON (`supabase_videos.json`, `supabase_users.json`).

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Giao diện & Logic** | HTML5, CSS3 Custom Properties (Light Mode), Vanilla JavaScript (ES6+) |
| **Biểu đồ** | [Chart.js v4.4.1](https://www.chartjs.org/) (CDN) |
| **Cơ sở dữ liệu & Auth** | [Supabase](https://supabase.com/) (`@supabase/supabase-js@2` qua CDN) |
| **Bảo mật dữ liệu** | Supabase Auth (JWT, `bcrypt`) + PostgreSQL Row Level Security (RLS) |
| **Typography** | Google Fonts — `Plus Jakarta Sans` & `Inter` |

---

## 3. Cấu trúc thư mục

```text
Video_webadmin/
├── index.html                              # Trang Dashboard tổng quan & biểu đồ
├── videos.html                             # Trang Quản lý kho video & danh mục (CRUD)
├── permissions.html                        # Trang Quản lý tài khoản & phân quyền (ADMIN only)
├── login.html                              # Trang Đăng nhập
├── register.html                           # Trang Đăng ký tài khoản
├── forgot-password.html                    # Trang Đặt lại mật khẩu
├── assets/
│   ├── css/
│   │   └── style.css                       # Hệ thống giao diện Light Mode toàn cục
│   └── js/
│       ├── db-manager.js                   # Kết nối Supabase Client, Auth & Data Access Layer
│       ├── auth.js                         # Quản lý phiên JWT, bảo vệ route & thanh điều hướng
│       ├── dashboard.js                    # Xử lý số liệu thống kê & biểu đồ Chart.js
│       ├── videos.js                       # Xử lý CRUD video, danh mục & trình phát preview
│       └── permissions.js                  # Xử lý tạo tài khoản mới & phân quyền ADMIN / USER
├── t_i_li_u_y_u_c_u_s_n_ph_m_prd.md        # Tài liệu yêu cầu sản phẩm gốc (PRD)
├── thi_t_k_c_s_d_li_u_sqlite.md            # Tài liệu thiết kế cấu trúc bảng gốc
├── h_ng_d_n_vibe_coding_quy_t_c_cho_ai.md  # Quy chuẩn thiết kế giao diện & Vibe Coding
├── .gitignore                              # Loại trừ tệp nhạy cảm (supabase.txt, .env*)
└── README.md                               # Tài liệu hướng dẫn dự án
```

---

## 4. Kiến trúc Cơ sở dữ liệu Supabase

Hệ thống sử dụng 4 bảng chính trong schema `public` (tất cả đều bật **Row Level Security - RLS**) kết hợp với schema nội bộ `app_private`:

1. **`public.users`**: Lưu hồ sơ tài khoản (`id`, `auth_user_id`, `username`, `email`, `full_name`, `avatar_url`, `role` [`ADMIN` | `USER`], `created_at`), liên kết khóa ngoại `1-1` với `auth.users`.
2. **`public.video_categories`**: Lưu danh mục video (`id`, `name`, `slug`, `description`, `created_at`).
3. **`public.videos`**: Lưu thông tin video (`id`, `title`, `thumbnail`, `video_url`, `category_id`, `views`, `size_mb`, `duration`, `status`, `created_at`).
4. **`public.video_analytics`**: Lưu thống kê lượt xem theo ngày (`id`, `video_id`, `view_date`, `views_count`, tự động xóa theo `ON DELETE CASCADE` khi xóa video).

### Các hàm RPC & Trigger trên PostgreSQL
- `app_private.is_admin()`: Kiểm tra người dùng hiện tại (`auth.uid()`) có vai trò `ADMIN` trong `public.users` hay không.
- `app_private.handle_new_auth_user()`: Trigger tự động đồng bộ bản ghi từ `auth.users` sang `public.users`.
- `public.resolve_login_email(p_identifier)`: Phân giải Username sang Email phục vụ đăng nhập.
- `public.register_portal_user(...)`: Tạo tài khoản người dùng mới với vai trò mặc định `USER`.
- `public.admin_create_portal_user(...)`: Chỉ cho phép `ADMIN` gọi để tạo tài khoản mới kèm vai trò `ADMIN` hoặc `USER`.
- `public.reset_demo_user_password(...)`: Đặt lại mật khẩu cho môi trường demo.

---

## 5. Tài khoản dùng thử (Demo Accounts)

Cơ sở dữ liệu đã khởi tạo sẵn **12 tài khoản mẫu** (mật khẩu mặc định chung: `123456`):

| Vai trò (`Role`) | Email | Username | Quyền hạn trong hệ thống |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@vibecoding.dev` | `admin` | Toàn quyền Dashboard, Kho Video, **vào trang Phân Quyền**, tạo tài khoản mới & chỉnh sửa role tài khoản khác |
| **`USER`** | `editor@vibecoding.dev` | `editor` | Truy cập Dashboard & Quản lý Video; **không** được truy cập trang Phân Quyền |
| **`USER`** | `user1@demo.com` → `user10@demo.com` | `user1` → `user10` | 10 tài khoản thành viên mẫu phục vụ kiểm thử phân quyền |

---

## 6. Hướng dẫn Chạy & Triển khai

### 6.1. Chạy trực tiếp trên máy cá nhân (Local)
Dự án không yêu cầu cài đặt thư viện hay biên dịch:
1. Mở trực tiếp tệp `login.html` bằng trình duyệt (Chrome, Edge, Firefox...) hoặc chạy qua tiện ích **Live Server** trong VS Code.
2. Đăng nhập bằng tài khoản `admin@vibecoding.dev` / `123456` để trải nghiệm đầy đủ các phân hệ.

### 6.2. Cấu hình kết nối Supabase
Thông tin kết nối phía trình duyệt được khai báo tại đầu tệp `assets/js/db-manager.js`:
```javascript
const SUPABASE_URL = 'https://ewovaxasdtyvnyscyppp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```
> **Lưu ý bảo mật quan trọng:**
> - Chỉ sử dụng **Publishable Key** (`sb_publishable_...`) ở phía Front-end kết hợp với chính sách **RLS** trên Supabase.
> - **Tuyệt đối không** đưa mật khẩu Database (`DB Password`) hoặc `service_role` / `secret` key vào mã nguồn JavaScript/HTML hoặc đẩy tệp `supabase.txt` lên GitHub.

### 6.3. Triển khai lên GitHub Pages / Cloudflare Pages / Netlify
1. Đảm bảo tệp `.gitignore` giữ nguyên quy tắc loại trừ `supabase.txt` và `.env*`.
2. Đẩy toàn bộ các tệp `.html`, `README.md` và thư mục `assets/` lên nhánh chính của repository.
3. Bật **GitHub Pages** (Settings → Pages → Deploy from branch) và truy cập đường dẫn website sau khi quá trình xuất bản hoàn tất.

---

## 7. Bảng màu chuẩn giao diện (Light Mode Design System)

- **Background Primary:** `#FFFFFF`
- **Background Secondary (Layout):** `#F8FAFC`
- **Text Primary:** `#0F172A`
- **Text Secondary / Muted:** `#64748B`
- **Primary Accent:** `#2563EB` (Hover: `#1D4ED8`)
- **Border:** `#E2E8F0`
- **Semantic Status:** `#10B981` (Success) · `#F59E0B` (Warning) · `#EF4444` (Danger)
