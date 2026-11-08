/**
 * Video & Category CRUD Controller (videos.js)
 * Hiển thị danh sách, tìm kiếm, lọc danh mục, thêm/sửa/xóa video & danh mục
 * trực tiếp trên cơ sở dữ liệu Supabase PostgreSQL (public.videos & public.video_categories).
 */

(function (window) {
    'use strict';

    let pendingDeleteVideoId = null;
    let cachedCategories = [];
    let searchDebounceTimer = null;

    function formatNumber(num) {
        return Number(num || 0).toLocaleString('vi-VN');
    }

    function slugifyVietnamese(text) {
        return (
            String(text || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'danh-muc'
        );
    }

    // =========================================================================
    // 1. QUẢN LÝ ĐÓNG / MỞ MODAL
    // =========================================================================

    function openModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('open');
    }

    function closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        el.classList.remove('open');

        if (modalId === 'previewModal') {
            const box = document.getElementById('previewPlayerBox');
            if (box) box.innerHTML = '';
        }
    }

    function bindGlobalModalEvents() {
        document.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', () => {
                closeModal(btn.getAttribute('data-close-modal'));
            });
        });

        document.querySelectorAll('.modal-overlay').forEach((overlay) => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(overlay.id);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach((overlay) => {
                    closeModal(overlay.id);
                });
            }
        });
    }

    // =========================================================================
    // 2. NẠP DANH MỤC & HIỂN THỊ BẢNG VIDEO TỪ SUPABASE
    // =========================================================================

    async function loadCategoriesIntoSelects() {
        cachedCategories = await window.DBManager.listCategoriesWithCount();

        const filterSelect = document.getElementById('categoryFilter');
        const formSelect = document.getElementById('videoCategoryInput');

        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML =
                '<option value="">Tất cả danh mục</option>' +
                cachedCategories
                    .map(
                        (c) => `<option value="${c.id}">${window.Auth.escapeHtml(c.name)}</option>`
                    )
                    .join('');
            filterSelect.value = currentVal;
        }

        if (formSelect) {
            const currentVal = formSelect.value;
            formSelect.innerHTML =
                '<option value="">-- Chưa phân loại --</option>' +
                cachedCategories
                    .map(
                        (c) => `<option value="${c.id}">${window.Auth.escapeHtml(c.name)}</option>`
                    )
                    .join('');
            formSelect.value = currentVal;
        }
    }

    async function renderVideosTable() {
        const tbody = document.getElementById('videosTableBody');
        const countBadge = document.getElementById('videoCountSummary');
        if (!tbody) return;

        const searchKeyword = (document.getElementById('searchInput')?.value || '').trim();
        const categoryId = document.getElementById('categoryFilter')?.value || '';
        const sortKey = document.getElementById('sortSelect')?.value || 'newest';

        const { totalAll, videos } = await window.DBManager.listVideos({
            searchKeyword,
            categoryId,
            sortKey
        });

        if (countBadge) {
            countBadge.textContent =
                videos.length === totalAll
                    ? `${formatNumber(totalAll)} video`
                    : `Hiển thị ${formatNumber(videos.length)} / ${formatNumber(totalAll)} video`;
        }

        if (videos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="empty-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <polygon points="10 9 15 12 10 15 10 9"></polygon>
                                </svg>
                            </div>
                            <div class="empty-title">Không tìm thấy video phù hợp</div>
                            <div class="empty-desc">Thử thay đổi từ khóa tìm kiếm, bộ lọc danh mục hoặc thêm video mới.</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = videos
            .map((v) => {
                const fallbackSrc = window.Auth.getFallbackThumbnail(`#${v.id}`);
                const isPublished = (v.status || 'published') === 'published';
                const statusLabel = isPublished ? 'Published' : 'Draft';
                const statusClass = isPublished ? 'published' : 'draft';

                return `
                    <tr>
                        <td class="col-id">#${v.id}</td>
                        <td>
                            <div class="thumb-wrapper" data-action="preview" data-id="${v.id}" title="Nhấn để xem trước video">
                                <img
                                    src="${window.Auth.escapeHtml(v.thumbnail)}"
                                    alt="${window.Auth.escapeHtml(v.title)}"
                                    loading="lazy"
                                    onerror="this.onerror=null;this.src='${fallbackSrc}';"
                                />
                                <span class="thumb-duration">${window.Auth.escapeHtml(v.duration || '00:00')}</span>
                            </div>
                        </td>
                        <td class="video-title-cell">
                            <div class="video-main-title">${window.Auth.escapeHtml(v.title)}</div>
                            <div class="video-sub-meta">
                                <span><strong>${window.Auth.escapeHtml(v.category_name)}</strong></span>
                                <span>&bull;</span>
                                <span class="status-badge ${statusClass}">${statusLabel}</span>
                                <span>&bull;</span>
                                <span>${window.Auth.escapeHtml(v.created_at || '')}</span>
                            </div>
                        </td>
                        <td>
                            <span class="category-badge">${window.Auth.escapeHtml(v.category_name)}</span>
                        </td>
                        <td>
                            <span class="views-number">${formatNumber(v.views)}</span>
                            <span class="size-sub">${Number(v.size_mb || 0).toFixed(1)} MB</span>
                        </td>
                        <td style="text-align: right;">
                            <div class="action-btns">
                                <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${v.id}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                    <span>Edit</span>
                                </button>
                                <button type="button" class="btn btn-ghost-danger btn-sm" data-action="delete" data-id="${v.id}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    <span>Delete</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join('');
    }

    // =========================================================================
    // 3. THÊM MỚI / CHỈNH SỬA / XÓA / XEM TRƯỚC VIDEO
    // =========================================================================

    function updateModalThumbPreview(url) {
        const previewImg = document.getElementById('modalThumbPreviewImg');
        if (!previewImg) return;
        const fallback = window.Auth.getFallbackThumbnail('PREVIEW');
        previewImg.onerror = () => {
            previewImg.onerror = null;
            previewImg.src = fallback;
        };
        previewImg.src = (url || '').trim() || fallback;
    }

    function openAddVideoModal() {
        const form = document.getElementById('videoForm');
        if (form) form.reset();

        document.getElementById('videoModalTitle').textContent = 'Thêm Video Mới';
        document.getElementById('saveVideoBtn').textContent = 'Lưu lên Supabase';
        document.getElementById('videoIdInput').value = '';

        const randomSeed = 'vibe_' + Math.floor(1000 + Math.random() * 9000);
        const defaultThumb = `https://picsum.photos/seed/${randomSeed}/640/360`;
        document.getElementById('videoThumbnailInput').value = defaultThumb;
        document.getElementById('videoUrlInput').value =
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
        document.getElementById('videoViewsInput').value = '0';
        document.getElementById('videoSizeInput').value = '150.0';
        document.getElementById('videoDurationInput').value = '15:00';
        document.getElementById('videoStatusInput').value = 'published';

        const firstCat = document.getElementById('videoCategoryInput')?.options[1];
        if (firstCat) {
            document.getElementById('videoCategoryInput').value = firstCat.value;
        }

        updateModalThumbPreview(defaultThumb);
        openModal('videoModal');
        setTimeout(() => document.getElementById('videoTitleInput')?.focus(), 80);
    }

    async function openEditVideoModal(videoId) {
        try {
            const video = await window.DBManager.getVideoById(videoId);
            if (!video) {
                window.Auth.showToast('Không tìm thấy video cần chỉnh sửa.', 'error');
                return;
            }

            document.getElementById('videoModalTitle').textContent = `Chỉnh sửa Video #${video.id}`;
            document.getElementById('saveVideoBtn').textContent = 'Cập nhật lên Supabase';
            document.getElementById('videoIdInput').value = video.id;
            document.getElementById('videoTitleInput').value = video.title || '';
            document.getElementById('videoCategoryInput').value = video.category_id || '';
            document.getElementById('videoStatusInput').value = video.status || 'published';
            document.getElementById('videoThumbnailInput').value = video.thumbnail || '';
            document.getElementById('videoUrlInput').value = video.video_url || '';
            document.getElementById('videoViewsInput').value = Number(video.views || 0);
            document.getElementById('videoSizeInput').value = Number(video.size_mb || 0);
            document.getElementById('videoDurationInput').value = video.duration || '00:00';

            updateModalThumbPreview(video.thumbnail);
            openModal('videoModal');
        } catch (err) {
            window.Auth.showToast('Lỗi tải thông tin video: ' + err.message, 'error');
        }
    }

    async function openDeleteConfirmModal(videoId) {
        try {
            const video = await window.DBManager.getVideoById(videoId);
            if (!video) return;

            pendingDeleteVideoId = Number(video.id);
            document.getElementById('deleteTargetTitle').textContent = `#${video.id} — ${video.title}`;
            openModal('deleteConfirmModal');
        } catch (err) {
            window.Auth.showToast('Lỗi tải video: ' + err.message, 'error');
        }
    }

    async function openPreviewModal(videoId) {
        try {
            const video = await window.DBManager.getVideoById(videoId);
            if (!video) return;

            document.getElementById('previewModalTitle').textContent = video.title;
            const playerBox = document.getElementById('previewPlayerBox');
            const metaBox = document.getElementById('previewMetaInfo');

            if (video.video_url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(video.video_url)) {
                playerBox.innerHTML = `
                    <video controls autoplay poster="${window.Auth.escapeHtml(video.thumbnail)}">
                        <source src="${window.Auth.escapeHtml(video.video_url)}" type="video/mp4" />
                        Trình duyệt không hỗ trợ phát video trực tiếp.
                    </video>
                `;
            } else {
                const fallback = window.Auth.getFallbackThumbnail(video.title);
                playerBox.innerHTML = `
                    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#FFFFFF;gap:12px;">
                        <img src="${window.Auth.escapeHtml(video.thumbnail)}" alt="" style="max-height:190px;border-radius:8px;" onerror="this.onerror=null;this.src='${fallback}';" />
                        ${
                            video.video_url
                                ? `<a href="${window.Auth.escapeHtml(video.video_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Mở liên kết Video gốc &nearr;</a>`
                                : '<span style="color:#94A3B8;font-size:0.85rem;">Video này chưa gắn đường dẫn phát MP4.</span>'
                        }
                    </div>
                `;
            }

            metaBox.innerHTML = `
                <span class="category-badge">${window.Auth.escapeHtml(video.category_name)}</span>
                <span>&bull;</span>
                <span>Lượt xem: <strong>${formatNumber(video.views)}</strong></span>
                <span>&bull;</span>
                <span>Dung lượng: <strong>${Number(video.size_mb || 0).toFixed(1)} MB</strong></span>
                <span>&bull;</span>
                <span>Thời lượng: <strong>${window.Auth.escapeHtml(video.duration || '00:00')}</strong></span>
            `;

            openModal('previewModal');
        } catch (err) {
            window.Auth.showToast('Lỗi mở xem trước: ' + err.message, 'error');
        }
    }

    async function handleSaveVideo(e) {
        e.preventDefault();

        const editId = document.getElementById('videoIdInput').value.trim();
        const title = document.getElementById('videoTitleInput').value.trim();
        const categoryVal = document.getElementById('videoCategoryInput').value;
        const categoryId = categoryVal ? Number(categoryVal) : null;
        const status = document.getElementById('videoStatusInput').value || 'published';
        const thumbnail = document.getElementById('videoThumbnailInput').value.trim();
        const videoUrl = document.getElementById('videoUrlInput').value.trim();
        const views = Math.max(0, parseInt(document.getElementById('videoViewsInput').value || '0', 10) || 0);
        const sizeMb = Math.max(0, parseFloat(document.getElementById('videoSizeInput').value || '0') || 0);
        const duration = document.getElementById('videoDurationInput').value.trim() || '00:00';

        if (!title) {
            window.Auth.showToast('Vui lòng nhập tiêu đề video.', 'error');
            document.getElementById('videoTitleInput').focus();
            return;
        }

        if (!thumbnail) {
            window.Auth.showToast('Vui lòng nhập URL ảnh Thumbnail.', 'error');
            document.getElementById('videoThumbnailInput').focus();
            return;
        }

        const saveBtn = document.getElementById('saveVideoBtn');
        try {
            saveBtn.disabled = true;

            const payload = {
                title,
                thumbnail,
                videoUrl,
                categoryId,
                views,
                sizeMb,
                duration,
                status
            };

            if (editId) {
                await window.DBManager.updateVideo(Number(editId), payload);
                window.Auth.showToast(`Đã cập nhật Video #${editId} trên Supabase!`, 'success');
            } else {
                await window.DBManager.createVideo(payload);
                window.Auth.showToast('Đã thêm video mới lên Supabase!', 'success');
            }

            closeModal('videoModal');
            await loadCategoriesIntoSelects();
            await renderVideosTable();
        } catch (err) {
            window.Auth.showToast('Lỗi lưu video: ' + err.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    }

    async function handleConfirmDelete() {
        if (!pendingDeleteVideoId) return;
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        try {
            confirmBtn.disabled = true;
            const deletedId = pendingDeleteVideoId;
            await window.DBManager.deleteVideo(deletedId);

            window.Auth.showToast(`Đã xóa Video #${deletedId} trên Supabase!`, 'success');
            pendingDeleteVideoId = null;
            closeModal('deleteConfirmModal');
            await loadCategoriesIntoSelects();
            await renderVideosTable();
        } catch (err) {
            window.Auth.showToast('Lỗi xóa video: ' + err.message, 'error');
        } finally {
            confirmBtn.disabled = false;
        }
    }

    // =========================================================================
    // 4. QUẢN LÝ DANH MỤC VIDEO (video_categories CRUD trên Supabase)
    // =========================================================================

    function resetCategoryForm() {
        document.getElementById('editCategoryId').value = '';
        document.getElementById('categoryNameInput').value = '';
        document.getElementById('categoryDescInput').value = '';
        document.getElementById('saveCategoryBtn').textContent = '+ Lưu Danh mục';
        document.getElementById('cancelCategoryEditBtn').style.display = 'none';
    }

    function renderCategoryListModal() {
        const listEl = document.getElementById('categoryListContainer');
        if (!listEl) return;

        if (cachedCategories.length === 0) {
            listEl.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:16px;">Chưa có danh mục nào.</p>`;
            return;
        }

        listEl.innerHTML = cachedCategories
            .map(
                (c) => `
                <div class="category-item">
                    <div class="category-item-info">
                        <div class="category-item-name">
                            ${window.Auth.escapeHtml(c.name)}
                            <span style="font-weight:500;color:var(--text-muted);font-size:0.78rem;">(${c.video_count} video)</span>
                        </div>
                        <div class="category-item-slug">
                            /${window.Auth.escapeHtml(c.slug)} ${c.description ? '— ' + window.Auth.escapeHtml(c.description) : ''}
                        </div>
                    </div>
                    <div class="action-btns">
                        <button type="button" class="btn btn-secondary btn-sm" data-cat-action="edit" data-cat-id="${c.id}">Sửa</button>
                        <button type="button" class="btn btn-ghost-danger btn-sm" data-cat-action="delete" data-cat-id="${c.id}">Xóa</button>
                    </div>
                </div>
            `
            )
            .join('');
    }

    async function handleSaveCategory(e) {
        e.preventDefault();

        const editId = document.getElementById('editCategoryId').value.trim();
        const name = document.getElementById('categoryNameInput').value.trim();
        const description = document.getElementById('categoryDescInput').value.trim();

        if (!name) {
            window.Auth.showToast('Vui lòng nhập tên danh mục.', 'error');
            return;
        }

        const slug = slugifyVietnamese(name);

        try {
            if (editId) {
                await window.DBManager.updateCategory(Number(editId), { name, slug, description });
                window.Auth.showToast('Đã cập nhật danh mục trên Supabase!', 'success');
            } else {
                await window.DBManager.createCategory({ name, slug, description });
                window.Auth.showToast('Đã thêm danh mục mới trên Supabase!', 'success');
            }

            resetCategoryForm();
            await loadCategoriesIntoSelects();
            renderCategoryListModal();
            await renderVideosTable();
        } catch (err) {
            window.Auth.showToast('Không thể lưu danh mục (tên/slug có thể đã tồn tại).', 'error');
        }
    }

    // =========================================================================
    // 5. KHỞI TẠO TRANG QUẢN LÝ VIDEO
    // =========================================================================

    function bindPageEvents() {
        bindGlobalModalEvents();

        document.getElementById('searchInput')?.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                renderVideosTable().catch((err) => console.error(err));
            }, 180);
        });

        document.getElementById('categoryFilter')?.addEventListener('change', () => {
            renderVideosTable().catch((err) => console.error(err));
        });

        document.getElementById('sortSelect')?.addEventListener('change', () => {
            renderVideosTable().catch((err) => console.error(err));
        });

        document.getElementById('openAddVideoBtn')?.addEventListener('click', openAddVideoModal);

        document.getElementById('videoThumbnailInput')?.addEventListener('input', (e) => {
            updateModalThumbPreview(e.target.value);
        });

        document.getElementById('randomThumbBtn')?.addEventListener('click', () => {
            const seed = 'vibe_' + Math.floor(1000 + Math.random() * 90000);
            const url = `https://picsum.photos/seed/${seed}/640/360`;
            document.getElementById('videoThumbnailInput').value = url;
            updateModalThumbPreview(url);
        });

        document.getElementById('videoForm')?.addEventListener('submit', handleSaveVideo);
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleConfirmDelete);

        document.getElementById('videosTableBody')?.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-action]');
            if (!trigger) return;
            const action = trigger.getAttribute('data-action');
            const id = trigger.getAttribute('data-id');

            if (action === 'edit') openEditVideoModal(id);
            else if (action === 'delete') openDeleteConfirmModal(id);
            else if (action === 'preview') openPreviewModal(id);
        });

        document.getElementById('openCategoryModalBtn')?.addEventListener('click', async () => {
            resetCategoryForm();
            await loadCategoriesIntoSelects();
            renderCategoryListModal();
            openModal('categoryModal');
        });

        document.getElementById('categoryForm')?.addEventListener('submit', handleSaveCategory);
        document.getElementById('cancelCategoryEditBtn')?.addEventListener('click', resetCategoryForm);

        document.getElementById('categoryListContainer')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-cat-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-cat-action');
            const catId = Number(btn.getAttribute('data-cat-id'));
            const cat = cachedCategories.find((item) => Number(item.id) === catId);
            if (!cat) return;

            if (action === 'edit') {
                document.getElementById('editCategoryId').value = cat.id;
                document.getElementById('categoryNameInput').value = cat.name;
                document.getElementById('categoryDescInput').value = cat.description || '';
                document.getElementById('saveCategoryBtn').textContent = 'Cập nhật Danh mục';
                document.getElementById('cancelCategoryEditBtn').style.display = 'inline-flex';
                document.getElementById('categoryNameInput').focus();
            } else if (action === 'delete') {
                const ok = window.confirm(
                    `Xóa danh mục "${cat.name}" trên Supabase? Các video thuộc danh mục này sẽ chuyển về "Chưa phân loại".`
                );
                if (!ok) return;

                try {
                    await window.DBManager.deleteCategory(catId);
                    window.Auth.showToast(`Đã xóa danh mục "${cat.name}".`, 'success');
                    resetCategoryForm();
                    await loadCategoriesIntoSelects();
                    renderCategoryListModal();
                    await renderVideosTable();
                } catch (err) {
                    window.Auth.showToast('Lỗi xóa danh mục: ' + err.message, 'error');
                }
            }
        });
    }

    async function bootstrapVideosPage() {
        window.Auth.initAdminShell();
        bindPageEvents();

        const loadingEl = document.getElementById('videosLoading');
        const contentEl = document.getElementById('videosContent');

        try {
            const user = await window.Auth.requireAuthAsync();
            if (!user) return;

            await loadCategoriesIntoSelects();
            await renderVideosTable();

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';

            const params = new URLSearchParams(window.location.search);
            if (params.get('action') === 'create') {
                openAddVideoModal();
                window.history.replaceState({}, document.title, 'videos.html');
            }
        } catch (err) {
            console.error('[Videos] Lỗi kết nối Supabase:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `<span style="color:var(--danger);font-weight:600;">Lỗi tải dữ liệu từ Supabase: ${window.Auth.escapeHtml(err.message)}</span>`;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', bootstrapVideosPage);
})(window);
