/**
 * Authentication & Shared Shell Utilities (auth.js)
 * Tích hợp trực tiếp với Supabase Auth (JWT) và bảng public.users trên Supabase PostgreSQL.
 */

(function (window) {
    'use strict';

    const PROFILE_CACHE_KEY = 'vibe_supabase_profile_cache';
    const LEGACY_SESSION_KEY = 'vibe_video_admin_session';

    function normalizeRole(role) {
        const upper = String(role || '').trim().toUpperCase();
        return upper === 'ADMIN' || upper === 'SUPERADMIN' ? 'ADMIN' : 'USER';
    }

    function isAdmin(user) {
        const target = user || getCurrentUser();
        return Boolean(target && normalizeRole(target.role) === 'ADMIN');
    }

    function getCurrentUser() {
        try {
            const raw =
                window.localStorage.getItem(PROFILE_CACHE_KEY) ||
                window.sessionStorage.getItem(PROFILE_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed) {
                parsed.role = normalizeRole(parsed.role);
            }
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function saveSession(user, remember = true) {
        if (!user) return null;
        const safeUser = {
            id: user.id,
            auth_user_id: user.auth_user_id || '',
            username: user.username,
            email: user.email,
            full_name: user.full_name || user.username,
            avatar_url: user.avatar_url || '',
            role: normalizeRole(user.role),
            loginAt: user.loginAt || new Date().toISOString()
        };

        const serialized = JSON.stringify(safeUser);
        try {
            window.localStorage.removeItem(LEGACY_SESSION_KEY);
            window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
            if (remember) {
                window.localStorage.setItem(PROFILE_CACHE_KEY, serialized);
                window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
            } else {
                window.sessionStorage.setItem(PROFILE_CACHE_KEY, serialized);
                window.localStorage.removeItem(PROFILE_CACHE_KEY);
            }
        } catch (_) {}
        return safeUser;
    }

    function clearCachedProfile() {
        try {
            window.localStorage.removeItem(PROFILE_CACHE_KEY);
            window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
            window.localStorage.removeItem(LEGACY_SESSION_KEY);
            window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
        } catch (_) {}
    }

    async function logout() {
        try {
            await window.DBManager.init();
            await window.DBManager.signOut();
        } catch (_) {}
        clearCachedProfile();
        window.location.href = 'login.html';
    }

    /**
     * Kiểm tra phiên đăng nhập thực tế trên Supabase Auth + đồng bộ Role mới nhất từ public.users
     */
    async function requireAuthAsync() {
        await window.DBManager.init();
        const liveProfile = await window.DBManager.getActiveSessionProfile();
        if (!liveProfile) {
            clearCachedProfile();
            window.location.replace('login.html');
            return null;
        }

        const isRemembered = !window.sessionStorage.getItem(PROFILE_CACHE_KEY);
        const synced = saveSession(liveProfile, isRemembered);
        applyUserToShellUI(synced);
        return synced;
    }

    async function redirectIfAuthenticatedAsync() {
        try {
            await window.DBManager.init();
            const liveProfile = await window.DBManager.getActiveSessionProfile();
            if (liveProfile) {
                saveSession(liveProfile, true);
                window.location.replace('index.html');
                return true;
            }
            clearCachedProfile();
        } catch (_) {}
        return false;
    }

    // =========================================================================
    // 2. SHARED UI HELPERS
    // =========================================================================

    function showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button type="button" class="modal-close" aria-label="Đóng" style="width:24px;height:24px;">&times;</button>
        `;

        toast.querySelector('button').addEventListener('click', () => toast.remove());
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3600);
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getFallbackThumbnail(label) {
        const safeLabel = escapeHtml((label || 'VIDEO').slice(0, 22));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#EFF6FF"/>
                    <stop offset="100%" stop-color="#DBEAFE"/>
                </linearGradient>
            </defs>
            <rect width="640" height="360" fill="url(#g)"/>
            <circle cx="320" cy="158" r="38" fill="#2563EB" opacity="0.14"/>
            <polygon points="310,140 310,176 340,158" fill="#2563EB"/>
            <text x="320" y="232" font-family="sans-serif" font-size="22" font-weight="700" fill="#1E3A8A" text-anchor="middle">${safeLabel}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function getInitials(name) {
        if (!name) return 'AD';
        const parts = String(name).trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function applyUserToShellUI(user) {
        if (!user) return;
        const normalizedRole = normalizeRole(user.role);

        const nameEl = document.getElementById('currentUserName');
        const roleEl = document.getElementById('currentUserRole');
        const avatarEl = document.getElementById('currentUserAvatar');
        const permNavEl = document.getElementById('navPermissionsLink');

        if (nameEl) nameEl.textContent = user.full_name || user.username;
        if (roleEl) roleEl.textContent = normalizedRole;
        if (avatarEl) avatarEl.textContent = getInitials(user.full_name || user.username);

        if (permNavEl) {
            permNavEl.style.display = normalizedRole === 'ADMIN' ? '' : 'none';
        }
    }

    function initAdminShell() {
        const cachedUser = getCurrentUser();
        if (cachedUser) {
            applyUserToShellUI(cachedUser);
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                logout();
            });
        }

        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');

        if (mobileMenuBtn && sidebar && backdrop) {
            const closeSidebar = () => {
                sidebar.classList.remove('open');
                backdrop.classList.remove('show');
            };
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                backdrop.classList.toggle('show');
            });
            backdrop.addEventListener('click', closeSidebar);
        }

        const exportVideosBtn = document.getElementById('exportVideosDbBtn');
        if (exportVideosBtn) {
            exportVideosBtn.addEventListener('click', async () => {
                try {
                    await window.DBManager.exportTableSnapshotJson('videos');
                    showToast('Đã xuất dữ liệu videos từ Supabase (JSON)!', 'success');
                } catch (err) {
                    showToast('Lỗi xuất dữ liệu: ' + err.message, 'error');
                }
            });
        }

        const exportUsersBtn = document.getElementById('exportUsersDbBtn');
        if (exportUsersBtn) {
            exportUsersBtn.addEventListener('click', async () => {
                try {
                    await window.DBManager.exportTableSnapshotJson('users');
                    showToast('Đã xuất dữ liệu users từ Supabase (JSON)!', 'success');
                } catch (err) {
                    showToast('Lỗi xuất dữ liệu: ' + err.message, 'error');
                }
            });
        }

        const resetDbBtn = document.getElementById('resetDemoDbBtn');
        if (resetDbBtn) {
            resetDbBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }
    }

    // =========================================================================
    // 3. FORM HANDLERS TRÊN CÁC TRANG XÁC THỰC (login, register, forgot-password)
    // =========================================================================

    function showAuthAlert(message, type = 'error') {
        const alertEl = document.getElementById('authAlert');
        if (!alertEl) return;
        alertEl.className = `auth-alert show ${type}`;
        alertEl.textContent = message;
    }

    function clearAuthAlert() {
        const alertEl = document.getElementById('authAlert');
        if (!alertEl) return;
        alertEl.className = 'auth-alert';
        alertEl.textContent = '';
    }

    function bindPasswordToggles() {
        document.querySelectorAll('.toggle-password-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                btn.setAttribute('aria-label', isPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
                btn.style.color = isPwd ? 'var(--accent)' : 'var(--text-muted)';
            });
        });
    }

    function initLoginPage() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        redirectIfAuthenticatedAsync();

        const params = new URLSearchParams(window.location.search);
        if (params.get('registered') === '1') {
            showAuthAlert('Đăng ký tài khoản trên Supabase thành công! Vui lòng đăng nhập.', 'success');
        } else if (params.get('reset') === '1') {
            showAuthAlert('Đặt lại mật khẩu mới trên Supabase thành công! Hãy đăng nhập lại.', 'success');
        }

        document.querySelectorAll('.demo-btn[data-username]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const identifierInput = document.getElementById('loginIdentifier');
                const passwordInput = document.getElementById('loginPassword');
                if (identifierInput) identifierInput.value = btn.getAttribute('data-username');
                if (passwordInput) passwordInput.value = btn.getAttribute('data-password') || '123456';
                clearAuthAlert();
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthAlert();

            const identifier = document.getElementById('loginIdentifier').value.trim();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe')?.checked ?? true;
            const submitBtn = document.getElementById('loginSubmitBtn');

            if (!identifier || !password) {
                showAuthAlert('Vui lòng nhập đầy đủ Email/Username và Mật khẩu.');
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Đang xác thực với Supabase...';
                }

                await window.DBManager.init();
                const profile = await window.DBManager.signInWithIdentifier(
                    identifier,
                    password,
                    rememberMe
                );

                saveSession(profile, rememberMe);
                showAuthAlert('Đăng nhập Supabase thành công! Đang chuyển tới Dashboard...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 350);
            } catch (err) {
                showAuthAlert(err.message || 'Đăng nhập thất bại.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập vào hệ thống';
                }
            }
        });
    }

    function initRegisterPage() {
        const form = document.getElementById('registerForm');
        if (!form) return;

        redirectIfAuthenticatedAsync();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthAlert();

            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const fullName = (document.getElementById('regFullName')?.value || '').trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            const submitBtn = document.getElementById('registerSubmitBtn');

            if (!username || !email || !password || !confirmPassword) {
                showAuthAlert('Vui lòng điền đầy đủ các trường bắt buộc.');
                return;
            }

            if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
                showAuthAlert('Username cần từ 3-30 ký tự (chữ cái, số, dấu chấm, gạch dưới).');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showAuthAlert('Định dạng địa chỉ Email không hợp lệ.');
                return;
            }

            if (password.length < 6) {
                showAuthAlert('Mật khẩu phải có tối thiểu 6 ký tự.');
                return;
            }

            if (password !== confirmPassword) {
                showAuthAlert('Mật khẩu xác nhận không khớp.');
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Đang lưu lên Supabase...';
                }

                await window.DBManager.init();
                await window.DBManager.registerAccount({
                    username,
                    email,
                    password,
                    fullName: fullName || username
                });

                showAuthAlert('Đăng ký tài khoản trên Supabase thành công! Đang chuyển sang Đăng nhập...', 'success');
                form.reset();
                setTimeout(() => {
                    window.location.href = 'login.html?registered=1';
                }, 750);
            } catch (err) {
                showAuthAlert(err.message || 'Lỗi tạo tài khoản trên Supabase.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng ký tài khoản';
                }
            }
        });
    }

    function initForgotPasswordPage() {
        const form = document.getElementById('forgotPasswordForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthAlert();

            const email = document.getElementById('resetEmail').value.trim();
            const newPassword = document.getElementById('resetNewPassword').value;
            const confirmPassword = document.getElementById('resetConfirmPassword').value;
            const submitBtn = document.getElementById('forgotSubmitBtn');

            if (!email || !newPassword || !confirmPassword) {
                showAuthAlert('Vui lòng nhập Email đã đăng ký và mật khẩu mới.');
                return;
            }

            if (newPassword.length < 6) {
                showAuthAlert('Mật khẩu mới phải có ít nhất 6 ký tự.');
                return;
            }

            if (newPassword !== confirmPassword) {
                showAuthAlert('Xác nhận mật khẩu mới không trùng khớp.');
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Đang cập nhật trên Supabase...';
                }

                await window.DBManager.init();
                const res = await window.DBManager.resetAccountPassword({ email, newPassword });

                showAuthAlert(
                    `Đã cập nhật mật khẩu mới cho tài khoản "${res?.username || email}" trên Supabase! Đang chuyển sang Đăng nhập...`,
                    'success'
                );
                form.reset();
                setTimeout(() => {
                    window.location.href = 'login.html?reset=1';
                }, 850);
            } catch (err) {
                showAuthAlert(err.message || 'Lỗi đặt lại mật khẩu.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đặt lại mật khẩu mới';
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindPasswordToggles();
        initLoginPage();
        initRegisterPage();
        initForgotPasswordPage();
    });

    window.Auth = {
        normalizeRole,
        isAdmin,
        getCurrentUser,
        saveSession,
        logout,
        requireAuthAsync,
        redirectIfAuthenticatedAsync,
        initAdminShell,
        showToast,
        escapeHtml,
        getInitials,
        getFallbackThumbnail
    };
})(window);
