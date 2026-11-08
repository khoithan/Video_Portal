/**
 * Permission Management Module (permissions.js)
 * Quản lý tài khoản & phân quyền với 2 vai trò: ADMIN và USER trực tiếp trên bảng public.users (Supabase PostgreSQL + RLS).
 * - Chỉ tài khoản role ADMIN mới được phép truy cập trang này.
 * - ADMIN có thể tạo tài khoản mới kèm vai trò (ADMIN / USER) và chỉnh sửa role của các tài khoản khác.
 */

(function (window) {
    'use strict';

    let currentAdminUser = null;
    let searchDebounceTimer = null;
    let newlyCreatedAccountId = null;

    function formatNumber(num) {
        return Number(num || 0).toLocaleString('vi-VN');
    }

    function formatCreatedAt(raw) {
        if (!raw) return '—';
        return String(raw).slice(0, 16).replace('T', ' ');
    }

    // =========================================================================
    // 1. QUẢN LÝ MODAL TẠO TÀI KHOẢN & PHÂN QUYỀN MỚI
    // =========================================================================

    function showCreateModalAlert(message, type = 'error') {
        const alertEl = document.getElementById('createAccountAlert');
        if (!alertEl) return;
        alertEl.className = `auth-alert show ${type}`;
        alertEl.textContent = message;
    }

    function clearCreateModalAlert() {
        const alertEl = document.getElementById('createAccountAlert');
        if (!alertEl) return;
        alertEl.className = 'auth-alert';
        alertEl.textContent = '';
    }

    function syncRolePickerSelection() {
        const picker = document.getElementById('newAccRolePicker');
        if (!picker) return;

        picker.querySelectorAll('.role-option-card').forEach((card) => {
            const radio = card.querySelector('input[name="newAccRole"]');
            card.classList.toggle('selected', Boolean(radio && radio.checked));
        });
    }

    function openCreateAccountModal() {
        if (!currentAdminUser || !window.Auth.isAdmin(currentAdminUser)) {
            window.Auth.showToast('Chỉ tài khoản ADMIN mới được phép tạo tài khoản mới.', 'error');
            return;
        }

        const form = document.getElementById('createAccountForm');
        if (form) form.reset();

        // Đặt lại trạng thái mặc định cho các ô mật khẩu (nếu trước đó bấm Hiện mật khẩu)
        ['newAccPassword', 'newAccConfirmPassword'].forEach((inputId) => {
            const input = document.getElementById(inputId);
            if (input) input.type = 'password';
            const toggleBtn = document.querySelector(`.toggle-password-btn[data-target="${inputId}"]`);
            if (toggleBtn) {
                toggleBtn.style.color = 'var(--text-muted)';
                toggleBtn.setAttribute('aria-label', 'Hiện mật khẩu');
            }
        });

        clearCreateModalAlert();
        syncRolePickerSelection();

        const modal = document.getElementById('createAccountModal');
        if (modal) {
            modal.classList.add('open');
            setTimeout(() => document.getElementById('newAccUsername')?.focus(), 80);
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
    }

    async function handleCreateAccountSubmit(e) {
        e.preventDefault();
        clearCreateModalAlert();

        const username = (document.getElementById('newAccUsername')?.value || '').trim();
        const fullName = (document.getElementById('newAccFullName')?.value || '').trim();
        const email = (document.getElementById('newAccEmail')?.value || '').trim().toLowerCase();
        const password = document.getElementById('newAccPassword')?.value || '';
        const confirmPassword = document.getElementById('newAccConfirmPassword')?.value || '';
        const selectedRoleRadio = document.querySelector('input[name="newAccRole"]:checked');
        const role = selectedRoleRadio ? selectedRoleRadio.value : 'USER';
        const submitBtn = document.getElementById('submitCreateAccountBtn');

        if (!username || !email || !password || !confirmPassword) {
            showCreateModalAlert('Vui lòng nhập đầy đủ các trường bắt buộc (*).');
            return;
        }

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
            showCreateModalAlert('Username cần từ 3-30 ký tự (chữ cái, số, dấu chấm, gạch dưới, gạch ngang).');
            document.getElementById('newAccUsername')?.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showCreateModalAlert('Định dạng địa chỉ Email không hợp lệ.');
            document.getElementById('newAccEmail')?.focus();
            return;
        }

        if (password.length < 6) {
            showCreateModalAlert('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.');
            document.getElementById('newAccPassword')?.focus();
            return;
        }

        if (password !== confirmPassword) {
            showCreateModalAlert('Mật khẩu xác nhận không khớp.');
            document.getElementById('newAccConfirmPassword')?.focus();
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang tạo trên Supabase...';
            }

            const created = await window.DBManager.adminCreateAccount({
                username,
                email,
                password,
                fullName: fullName || username,
                role
            });

            // Mở rộng bộ lọc nếu đang lọc khác với tài khoản vừa tạo để Admin thấy ngay dòng mới
            const roleFilterEl = document.getElementById('permRoleFilter');
            const searchInputEl = document.getElementById('permSearchInput');
            if (roleFilterEl && roleFilterEl.value && roleFilterEl.value !== created.role) {
                roleFilterEl.value = '';
            }
            if (searchInputEl && searchInputEl.value.trim()) {
                searchInputEl.value = '';
            }

            newlyCreatedAccountId = created?.id ? Number(created.id) : null;

            await Promise.all([renderPermissionMetrics(), renderAccountsTable()]);
            closeModal('createAccountModal');

            window.Auth.showToast(
                `Đã tạo tài khoản ${created.email} với quyền ${created.role} trên Supabase!`,
                'success'
            );
        } catch (err) {
            showCreateModalAlert(err.message || 'Không thể tạo tài khoản mới trên Supabase.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Tạo & Phân quyền';
            }
        }
    }

    // =========================================================================
    // 2. HIỂN THỊ THỐNG KÊ & BẢNG DANH SÁCH TÀI KHOẢN
    // =========================================================================

    async function renderPermissionMetrics() {
        const stats = await window.DBManager.getPermissionStats();

        const totalEl = document.getElementById('permTotalAccounts');
        const adminEl = document.getElementById('permAdminCount');
        const userEl = document.getElementById('permUserCount');

        if (totalEl) totalEl.textContent = formatNumber(stats.total_accounts);
        if (adminEl) adminEl.textContent = formatNumber(stats.admin_count);
        if (userEl) userEl.textContent = formatNumber(stats.user_count);
    }

    async function renderAccountsTable() {
        const tbody = document.getElementById('permissionsTableBody');
        const countBadge = document.getElementById('permCountBadge');
        if (!tbody) return;

        const keyword = (document.getElementById('permSearchInput')?.value || '').trim();
        const role = document.getElementById('permRoleFilter')?.value || '';

        const { totalAll, accounts } = await window.DBManager.listAccounts({ keyword, role });

        if (countBadge) {
            countBadge.textContent =
                accounts.length === totalAll
                    ? `${formatNumber(totalAll)} tài khoản`
                    : `Hiển thị ${formatNumber(accounts.length)} / ${formatNumber(totalAll)} tài khoản`;
        }

        if (accounts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="empty-icon">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <div class="empty-title">Không tìm thấy tài khoản phù hợp</div>
                            <div class="empty-desc">Thử thay đổi từ khóa tìm kiếm, bộ lọc vai trò hoặc nhấn "+ Tạo Tài khoản Mới".</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const highlightId = newlyCreatedAccountId;
        newlyCreatedAccountId = null;

        tbody.innerHTML = accounts
            .map((acc) => {
                const accRole = window.Auth.normalizeRole(acc.role);
                const isRoleAdmin = accRole === 'ADMIN';
                const isSelf =
                    currentAdminUser &&
                    ((acc.auth_user_id && acc.auth_user_id === currentAdminUser.auth_user_id) ||
                        Number(acc.id) === Number(currentAdminUser.id));
                const isNewlyCreated = highlightId !== null && Number(acc.id) === Number(highlightId);

                const displayName = acc.full_name || acc.username;
                const initials = window.Auth.getInitials(displayName);
                const roleBadgeHtml = isRoleAdmin
                    ? '<span class="role-badge admin">ADMIN</span>'
                    : '<span class="role-badge user">USER</span>';

                const actionHtml = isSelf
                    ? `
                        <span class="perm-locked-note" title="Không thể tự thay đổi vai trò của tài khoản đang đăng nhập">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>Tài khoản của bạn</span>
                        </span>
                    `
                    : `
                        <div class="perm-edit-group">
                            <select
                                class="role-select"
                                data-role-select-id="${acc.id}"
                                data-original-role="${accRole}"
                                aria-label="Chọn quyền cho ${window.Auth.escapeHtml(acc.email)}"
                            >
                                <option value="ADMIN" ${accRole === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                                <option value="USER" ${accRole === 'USER' ? 'selected' : ''}>USER</option>
                            </select>
                            <button
                                type="button"
                                class="btn btn-primary btn-sm"
                                data-save-role-id="${acc.id}"
                                disabled
                            >
                                Lưu quyền
                            </button>
                        </div>
                    `;

                return `
                    <tr data-account-row-id="${acc.id}" class="${isNewlyCreated ? 'row-newly-created' : ''}">
                        <td class="col-id">#${acc.id}</td>
                        <td>
                            <div class="user-account-cell">
                                <div class="user-avatar-table ${isRoleAdmin ? '' : 'role-user'}">
                                    ${window.Auth.escapeHtml(initials)}
                                </div>
                                <div>
                                    <div class="account-primary-name">
                                        <span>${window.Auth.escapeHtml(displayName)}</span>
                                        ${isSelf ? '<span class="self-account-tag">Đang đăng nhập</span>' : ''}
                                    </div>
                                    <div class="account-username-sub">@${window.Auth.escapeHtml(acc.username)}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span style="font-weight: 500; color: var(--text-secondary);">
                                ${window.Auth.escapeHtml(acc.email)}
                            </span>
                        </td>
                        <td>${roleBadgeHtml}</td>
                        <td style="color: var(--text-muted); font-size: 0.82rem;">
                            ${window.Auth.escapeHtml(formatCreatedAt(acc.created_at))}
                        </td>
                        <td style="text-align: right;">
                            ${actionHtml}
                        </td>
                    </tr>
                `;
            })
            .join('');
    }

    // =========================================================================
    // 3. CẬP NHẬT ROLE & GẮN SỰ KIỆN TƯƠNG TÁC
    // =========================================================================

    async function handleUpdateAccountRole(targetUserId, newRole, triggerBtn) {
        if (currentAdminUser && Number(targetUserId) === Number(currentAdminUser.id)) {
            window.Auth.showToast('Không thể tự thay đổi vai trò của tài khoản đang đăng nhập.', 'warning');
            return;
        }

        try {
            if (triggerBtn) {
                triggerBtn.disabled = true;
                triggerBtn.textContent = 'Đang lưu...';
            }

            const updated = await window.DBManager.updateAccountRole(targetUserId, newRole);

            await Promise.all([renderPermissionMetrics(), renderAccountsTable()]);

            window.Auth.showToast(
                `Đã đổi quyền của ${updated.email} sang ${updated.role} trên Supabase!`,
                'success'
            );
        } catch (err) {
            window.Auth.showToast('Lỗi cập nhật quyền trên Supabase: ' + err.message, 'error');
            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.textContent = 'Lưu quyền';
            }
        }
    }

    function bindPermissionEvents() {
        // Mở / Đóng Modal Tạo tài khoản
        document.getElementById('openCreateAccountBtn')?.addEventListener('click', openCreateAccountModal);

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

        document.getElementById('newAccRolePicker')?.addEventListener('change', syncRolePickerSelection);
        document.getElementById('createAccountForm')?.addEventListener('submit', handleCreateAccountSubmit);

        // Bộ lọc tìm kiếm & vai trò
        document.getElementById('permSearchInput')?.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                renderAccountsTable().catch((err) => console.error(err));
            }, 160);
        });

        document.getElementById('permRoleFilter')?.addEventListener('change', () => {
            renderAccountsTable().catch((err) => console.error(err));
        });

        const switchBtn = document.getElementById('switchAdminAccountBtn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                window.Auth.logout();
            });
        }

        // Thay đổi Role trực tiếp trên dòng của bảng
        const tbody = document.getElementById('permissionsTableBody');
        if (tbody) {
            tbody.addEventListener('change', (e) => {
                const selectEl = e.target.closest('[data-role-select-id]');
                if (!selectEl) return;

                const userId = selectEl.getAttribute('data-role-select-id');
                const originalRole = selectEl.getAttribute('data-original-role');
                const isModified = selectEl.value !== originalRole;

                selectEl.classList.toggle('changed', isModified);

                const row = tbody.querySelector(`tr[data-account-row-id="${userId}"]`);
                if (row) row.classList.toggle('row-pending-change', isModified);

                const saveBtn = tbody.querySelector(`button[data-save-role-id="${userId}"]`);
                if (saveBtn) saveBtn.disabled = !isModified;
            });

            tbody.addEventListener('click', (e) => {
                const saveBtn = e.target.closest('button[data-save-role-id]');
                if (!saveBtn || saveBtn.disabled) return;

                const userId = saveBtn.getAttribute('data-save-role-id');
                const selectEl = tbody.querySelector(`select[data-role-select-id="${userId}"]`);
                if (!selectEl) return;

                handleUpdateAccountRole(userId, selectEl.value, saveBtn);
            });
        }
    }

    async function bootstrapPermissionsPage() {
        window.Auth.initAdminShell();
        bindPermissionEvents();

        const loadingEl = document.getElementById('permissionsLoading');
        const deniedEl = document.getElementById('accessDeniedSection');
        const contentEl = document.getElementById('permissionsContent');
        const createBtnEl = document.getElementById('openCreateAccountBtn');

        try {
            const liveUser = await window.Auth.requireAuthAsync();
            if (!liveUser) return;

            currentAdminUser = liveUser;
            if (loadingEl) loadingEl.style.display = 'none';

            if (!window.Auth.isAdmin(liveUser)) {
                const deniedEmailEl = document.getElementById('deniedAccountEmail');
                if (deniedEmailEl) {
                    deniedEmailEl.textContent = liveUser.email || liveUser.username;
                }
                if (createBtnEl) createBtnEl.style.display = 'none';
                if (deniedEl) deniedEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
                return;
            }

            if (createBtnEl) createBtnEl.style.display = 'inline-flex';
            if (deniedEl) deniedEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';

            await Promise.all([renderPermissionMetrics(), renderAccountsTable()]);

            const params = new URLSearchParams(window.location.search);
            if (params.get('action') === 'create') {
                openCreateAccountModal();
                window.history.replaceState({}, document.title, 'permissions.html');
            }
        } catch (err) {
            console.error('[Permissions] Lỗi kết nối Supabase:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `<span style="color:var(--danger);font-weight:600;">Lỗi nạp dữ liệu phân quyền từ Supabase: ${window.Auth.escapeHtml(err.message)}</span>`;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', bootstrapPermissionsPage);
})(window);
