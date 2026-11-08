# Database Architecture & SQLite Schemas

Hệ thống sử dụng thư viện `sql.js` (SQLite biên dịch sang WebAssembly) để quản lý các tệp cơ sở dữ liệu ngay trên trình duyệt. Dữ liệu nhị phân (Uint8Array) của mỗi database được lưu trữ riêng biệt trong `IndexedDB` để đảm bảo không bị mất khi tải lại trang.

---

## 1. Database Quản lý Người dùng (`users.db`)

### Bảng `users`
Lưu trữ thông tin tài khoản quản trị viên.

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Dữ liệu mẫu khởi tạo (`users.db`):**
```sql
INSERT INTO users (username, email, password, full_name, role) VALUES 
('admin', 'admin@vibecoding.dev', '123456', 'Admin Vibe', 'superadmin'),
('editor', 'editor@vibecoding.dev', '123456', 'Content Editor', 'editor');
```

---

## 2. Database Quản lý Video (`videos.db`)

Bao gồm bảng danh mục, bảng thông tin video và bảng lịch sử lượt xem để phục vụ biểu đồ.

### 2.1. Bảng `video_categories` (Danh mục video)
```sql
CREATE TABLE IF NOT EXISTS video_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. Bảng `videos` (Danh sách video)
```sql
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    video_url TEXT,
    category_id INTEGER,
    views INTEGER DEFAULT 0,
    size_mb REAL DEFAULT 0.0,
    duration TEXT DEFAULT '00:00',
    status TEXT DEFAULT 'published',
    created_at DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (category_id) REFERENCES video_categories(id) ON DELETE SET NULL
);
```

### 2.3. Bảng `video_analytics` (Thống kê lượt xem theo ngày/tháng)
Phục vụ cho Biểu đồ Line (Lượt xem theo ngày/tháng) trên trang Dashboard.

```sql
CREATE TABLE IF NOT EXISTS video_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER,
    view_date DATE NOT NULL,
    views_count INTEGER DEFAULT 0,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

---

## 3. Các câu truy vấn SQL quan trọng cho ứng dụng

### Truy vấn Dashboard Metrics:
```sql
-- Tổng số video, Tổng lượt xem, Tổng dung lượng (MB)
SELECT 
    COUNT(id) AS total_videos,
    COALESCE(SUM(views), 0) AS total_views,
    ROUND(COALESCE(SUM(size_mb), 0), 2) AS total_storage_mb
FROM videos;
```

### Truy vấn Top 10 Video nhiều lượt xem nhất (Bar Chart):
```sql
SELECT id, title, views 
FROM videos 
ORDER BY views DESC 
LIMIT 10;
```

### Truy vấn Lượt xem theo Ngày (Line Chart - 30 ngày gần nhất):
```sql
SELECT view_date, SUM(views_count) AS daily_views
FROM video_analytics
GROUP BY view_date
ORDER BY view_date ASC
LIMIT 30;
```

### Truy vấn Lượt xem theo Tháng (Line Chart):
```sql
SELECT strftime('%Y-%m', view_date) AS view_month, SUM(views_count) AS monthly_views
FROM video_analytics
GROUP BY view_month
ORDER BY view_month ASC;
```