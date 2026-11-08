/**
 * Supabase Client & Data Manager (db-manager.js)
 * Kết nối trực tiếp Website với Supabase Cloud (PostgreSQL + Supabase Auth + RLS):
 *  - Project URL: https://uxlzpayquiqjkrezhidp.supabase.co
 *  - Sử dụng Publishable Key an toàn cho trình duyệt (không bao giờ chứa DB Password)
 */

(function (window) {
    'use strict';

    const SUPABASE_URL = 'https://uxlzpayquiqjkrezhidp.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ab3IaZDlOo6yyTjnRU4OwA_dF0c0A96';
    const EPHEMERAL_FLAG_KEY = 'vibe_supabase_ephemeral_mode';

    let supabaseClient = null;
    let initPromise = null;

    // Custom storage hỗ trợ cả "Duy trì đăng nhập" (localStorage) và phiên tạm thời (sessionStorage)
    const hybridAuthStorage = {
        getItem(key) {
            try {
                return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
            } catch (_) {
                return null;
            }
        },
        setItem(key, value) {
            try {
                const isEphemeral = window.sessionStorage.getItem(EPHEMERAL_FLAG_KEY) === '1';
                if (isEphemeral) {
                    window.sessionStorage.setItem(key, value);
                    window.localStorage.removeItem(key);
                } else {
                    window.localStorage.setItem(key, value);
                    window.sessionStorage.removeItem(key);
                }
            } catch (_) {}
        },
        removeItem(key) {
            try {
                window.localStorage.removeItem(key);
                window.sessionStorage.removeItem(key);
            } catch (_) {}
        }
    };

    function setRememberMePreference(remember) {
        try {
            if (remember) {
                window.sessionStorage.removeItem(EPHEMERAL_FLAG_KEY);
            } else {
                window.sessionStorage.setItem(EPHEMERAL_FLAG_KEY, '1');
            }
        } catch (_) {}
    }

    function formatDateISO(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getClient() {
        if (!supabaseClient) {
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                throw new Error('Không tìm thấy thư viện @supabase/supabase-js từ CDN.');
            }
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: hybridAuthStorage
                }
            });
        }
        return supabaseClient;
    }

    async function init() {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            const client = getClient();
            return client;
        })();

        try {
            return await initPromise;
        } catch (err) {
            initPromise = null;
            throw err;
        }
    }

    // =========================================================================
    // 1. AUTHENTICATION & USER PROFILE (Supabase Auth + public.users)
    // =========================================================================

    async function fetchProfileByAuthId(authUserId) {
        const client = getClient();
        const { data, error } = await client
            .from('users')
            .select('id, auth_user_id, username, email, full_name, avatar_url, role, created_at')
            .eq('auth_user_id', authUserId)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return data;
    }

    async function getActiveSessionProfile() {
        const client = getClient();
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session?.user) {
            return null;
        }

        const authUser = sessionData.session.user;
        const profile = await fetchProfileByAuthId(authUser.id);
        if (profile) return profile;

        return {
            id: null,
            auth_user_id: authUser.id,
            username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            avatar_url: '',
            role: 'USER'
        };
    }

    async function signInWithIdentifier(identifier, password, remember = true) {
        const client = getClient();
        setRememberMePreference(remember);

        let loginEmail = String(identifier || '').trim();

        // Nếu người dùng nhập Username (không có @), phân giải sang Email qua RPC trên Supabase
        if (!loginEmail.includes('@')) {
            const { data: resolvedEmail, error: rpcErr } = await client.rpc('resolve_login_email', {
                p_identifier: loginEmail
            });
            if (rpcErr) {
                throw new Error('Lỗi kết nối Supabase khi kiểm tra Username: ' + rpcErr.message);
            }
            if (!resolvedEmail) {
                throw new Error('Thông tin Email/Username hoặc Mật khẩu không chính xác.');
            }
            loginEmail = resolvedEmail;
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: loginEmail,
            password
        });

        if (error || !data?.user) {
            throw new Error('Thông tin Email/Username hoặc Mật khẩu không chính xác.');
        }

        const profile = await fetchProfileByAuthId(data.user.id);
        return (
            profile || {
                id: null,
                auth_user_id: data.user.id,
                username: data.user.user_metadata?.username || loginEmail.split('@')[0],
                email: data.user.email,
                full_name: data.user.user_metadata?.full_name || loginEmail,
                role: 'USER'
            }
        );
    }

    async function registerAccount({ username, email, password, fullName }) {
        const client = getClient();
        const { data, error } = await client.rpc('register_portal_user', {
            p_username: username,
            p_email: email,
            p_password: password,
            p_full_name: fullName || username
        });

        if (error) {
            throw new Error(error.message);
        }
        return data;
    }

    async function resetAccountPassword({ email, newPassword }) {
        const client = getClient();
        const { data, error } = await client.rpc('reset_demo_user_password', {
            p_email: email,
            p_new_password: newPassword
        });

        if (error) {
            throw new Error(error.message);
        }
        return data;
    }

    async function signOut() {
        const client = getClient();
        await client.auth.signOut();
    }

    // =========================================================================
    // 2. MODULE PHÂN QUYỀN (public.users)
    // =========================================================================

    async function getPermissionStats() {
        const client = getClient();
        const { data, error } = await client.from('users').select('id, role');
        if (error) throw new Error(error.message);

        const rows = data || [];
        let adminCount = 0;
        let userCount = 0;
        rows.forEach((r) => {
            if (String(r.role || '').toUpperCase() === 'ADMIN') adminCount++;
            else userCount++;
        });

        return {
            total_accounts: rows.length,
            admin_count: adminCount,
            user_count: userCount
        };
    }

    async function listAccounts({ keyword = '', role = '' } = {}) {
        const client = getClient();
        const { data, error } = await client
            .from('users')
            .select('id, auth_user_id, username, email, full_name, role, created_at')
            .order('id', { ascending: true });

        if (error) throw new Error(error.message);

        const allRows = data || [];
        const kw = keyword.trim().toLowerCase();
        const roleFilter = role.trim().toUpperCase();

        const filtered = allRows.filter((acc) => {
            const accRole = String(acc.role || 'USER').toUpperCase();
            if (roleFilter && accRole !== roleFilter) return false;
            if (!kw) return true;
            return (
                String(acc.username || '').toLowerCase().includes(kw) ||
                String(acc.email || '').toLowerCase().includes(kw) ||
                String(acc.full_name || '').toLowerCase().includes(kw)
            );
        });

        // Ưu tiên hiển thị ADMIN lên đầu bảng, sau đó theo ID tăng dần
        filtered.sort((a, b) => {
            const aAdmin = String(a.role || '').toUpperCase() === 'ADMIN' ? 0 : 1;
            const bAdmin = String(b.role || '').toUpperCase() === 'ADMIN' ? 0 : 1;
            if (aAdmin !== bAdmin) return aAdmin - bAdmin;
            return Number(a.id) - Number(b.id);
        });

        return {
            totalAll: allRows.length,
            accounts: filtered
        };
    }

    async function updateAccountRole(targetUserId, newRole) {
        const client = getClient();
        const normalized = String(newRole || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';

        const { data, error } = await client
            .from('users')
            .update({ role: normalized })
            .eq('id', Number(targetUserId))
            .select('id, username, email, role')
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    // =========================================================================
    // 3. DASHBOARD METRICS & ANALYTICS (videos, video_categories, video_analytics)
    // =========================================================================

    async function getDashboardOverview() {
        const client = getClient();

        const [videosRes, catRes] = await Promise.all([
            client.from('videos').select('id, views, size_mb'),
            client.from('video_categories').select('id', { count: 'exact', head: true })
        ]);

        if (videosRes.error) throw new Error(videosRes.error.message);
        if (catRes.error) throw new Error(catRes.error.message);

        const vids = videosRes.data || [];
        const totalVideos = vids.length;
        const totalViews = vids.reduce((sum, v) => sum + Number(v.views || 0), 0);
        const totalStorageMb = Number(
            vids.reduce((sum, v) => sum + Number(v.size_mb || 0), 0).toFixed(2)
        );

        return {
            total_videos: totalVideos,
            total_views: totalViews,
            total_storage_mb: totalStorageMb,
            total_categories: catRes.count || 0
        };
    }

    async function getTopVideos(limit = 10) {
        const client = getClient();
        const { data, error } = await client
            .from('videos')
            .select('id, title, views')
            .order('views', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return data || [];
    }

    async function getViewsAnalyticsTrend(period = 'daily') {
        const client = getClient();
        const { data, error } = await client
            .from('video_analytics')
            .select('view_date, views_count')
            .order('view_date', { ascending: true })
            .limit(5000);

        if (error) throw new Error(error.message);
        const rows = data || [];

        if (period === 'monthly') {
            const monthMap = new Map();
            rows.forEach((r) => {
                if (!r.view_date) return;
                const ym = String(r.view_date).slice(0, 7);
                monthMap.set(ym, (monthMap.get(ym) || 0) + Number(r.views_count || 0));
            });

            return Array.from(monthMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([view_month, monthly_views]) => ({ view_month, monthly_views }));
        }

        const dayMap = new Map();
        rows.forEach((r) => {
            if (!r.view_date) return;
            const d = String(r.view_date).slice(0, 10);
            dayMap.set(d, (dayMap.get(d) || 0) + Number(r.views_count || 0));
        });

        const allDaysSorted = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const latest30 = allDaysSorted.slice(-30);
        return latest30.map(([view_date, daily_views]) => ({ view_date, daily_views }));
    }

    async function getRecentVideos(limit = 5) {
        const client = getClient();
        const { data, error } = await client
            .from('videos')
            .select('id, title, thumbnail, views, size_mb, duration, created_at, video_categories(name)')
            .order('id', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return (data || []).map((v) => ({
            ...v,
            category_name: v.video_categories?.name || 'Chưa phân loại'
        }));
    }

    // =========================================================================
    // 4. QUẢN LÝ KHO VIDEO & DANH MỤC (CRUD trên Supabase)
    // =========================================================================

    async function listCategoriesWithCount() {
        const client = getClient();
        const [catsRes, vidsRes] = await Promise.all([
            client.from('video_categories').select('id, name, slug, description, created_at').order('name', { ascending: true }),
            client.from('videos').select('category_id')
        ]);

        if (catsRes.error) throw new Error(catsRes.error.message);
        if (vidsRes.error) throw new Error(vidsRes.error.message);

        const countMap = new Map();
        (vidsRes.data || []).forEach((v) => {
            if (v.category_id) {
                countMap.set(v.category_id, (countMap.get(v.category_id) || 0) + 1);
            }
        });

        return (catsRes.data || []).map((c) => ({
            ...c,
            video_count: countMap.get(c.id) || 0
        }));
    }

    async function createCategory({ name, slug, description }) {
        const client = getClient();
        const { data, error } = await client
            .from('video_categories')
            .insert([{ name, slug, description }])
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async function updateCategory(id, { name, slug, description }) {
        const client = getClient();
        const { data, error } = await client
            .from('video_categories')
            .update({ name, slug, description })
            .eq('id', Number(id))
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async function deleteCategory(id) {
        const client = getClient();
        const { error } = await client.from('video_categories').delete().eq('id', Number(id));
        if (error) throw new Error(error.message);
    }

    async function listVideos({ searchKeyword = '', categoryId = '', sortKey = 'newest' } = {}) {
        const client = getClient();

        const totalRes = await client.from('videos').select('id', { count: 'exact', head: true });
        if (totalRes.error) throw new Error(totalRes.error.message);

        let query = client
            .from('videos')
            .select('id, title, thumbnail, video_url, category_id, views, size_mb, duration, status, created_at, video_categories(name)');

        if (searchKeyword.trim()) {
            query = query.ilike('title', `%${searchKeyword.trim()}%`);
        }

        if (categoryId) {
            query = query.eq('category_id', Number(categoryId));
        }

        if (sortKey === 'views_desc') {
            query = query.order('views', { ascending: false }).order('id', { ascending: false });
        } else if (sortKey === 'size_desc') {
            query = query.order('size_mb', { ascending: false }).order('id', { ascending: false });
        } else if (sortKey === 'id_asc') {
            query = query.order('id', { ascending: true });
        } else {
            query = query.order('id', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const videos = (data || []).map((v) => ({
            ...v,
            category_name: v.video_categories?.name || 'Chưa phân loại'
        }));

        return {
            totalAll: totalRes.count || 0,
            videos
        };
    }

    async function getVideoById(id) {
        const client = getClient();
        const { data, error } = await client
            .from('videos')
            .select('*, video_categories(name)')
            .eq('id', Number(id))
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return null;

        return {
            ...data,
            category_name: data.video_categories?.name || 'Chưa phân loại'
        };
    }

    async function createVideo(payload) {
        const client = getClient();
        const todayStr = formatDateISO(new Date());

        const { data, error } = await client
            .from('videos')
            .insert([
                {
                    title: payload.title,
                    thumbnail: payload.thumbnail,
                    video_url: payload.videoUrl || '',
                    category_id: payload.categoryId || null,
                    views: payload.views || 0,
                    size_mb: payload.sizeMb || 0,
                    duration: payload.duration || '00:00',
                    status: payload.status || 'published',
                    created_at: todayStr
                }
            ])
            .select()
            .single();

        if (error) throw new Error(error.message);

        if (payload.views > 0 && data?.id) {
            await client.from('video_analytics').insert([
                {
                    video_id: data.id,
                    view_date: todayStr,
                    views_count: payload.views
                }
            ]);
        }

        return data;
    }

    async function updateVideo(id, payload) {
        const client = getClient();
        const { data, error } = await client
            .from('videos')
            .update({
                title: payload.title,
                thumbnail: payload.thumbnail,
                video_url: payload.videoUrl || '',
                category_id: payload.categoryId || null,
                views: payload.views || 0,
                size_mb: payload.sizeMb || 0,
                duration: payload.duration || '00:00',
                status: payload.status || 'published'
            })
            .eq('id', Number(id))
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async function deleteVideo(id) {
        const client = getClient();
        const { error } = await client.from('videos').delete().eq('id', Number(id));
        if (error) throw new Error(error.message);
    }

    async function exportTableSnapshotJson(tableType) {
        const client = getClient();
        const tableName = tableType === 'users' ? 'users' : 'videos';
        const { data, error } = await client.from(tableName).select('*').order('id', { ascending: true });
        if (error) throw new Error(error.message);

        const blob = new Blob([JSON.stringify(data || [], null, 2)], {
            type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `supabase_${tableName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    window.DBManager = {
        SUPABASE_URL,
        init,
        getClient,
        formatDateISO,
        // Auth & Profile
        getActiveSessionProfile,
        signInWithIdentifier,
        registerAccount,
        resetAccountPassword,
        signOut,
        // Permissions
        getPermissionStats,
        listAccounts,
        updateAccountRole,
        // Dashboard
        getDashboardOverview,
        getTopVideos,
        getViewsAnalyticsTrend,
        getRecentVideos,
        // Videos & Categories
        listCategoriesWithCount,
        createCategory,
        updateCategory,
        deleteCategory,
        listVideos,
        getVideoById,
        createVideo,
        updateVideo,
        deleteVideo,
        exportTableSnapshotJson
    };
})(window);
