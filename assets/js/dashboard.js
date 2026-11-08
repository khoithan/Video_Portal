/**
 * Dashboard Analytics & Charts Controller (dashboard.js)
 * Truy vấn dữ liệu trực tiếp từ Supabase PostgreSQL (videos, video_categories, video_analytics)
 * và trực quan hóa bằng Chart.js 4.
 */

(function (window) {
    'use strict';

    const STORAGE_LIMIT_MB = 10 * 1024; // Giới hạn 10 GB = 10,240 MB

    let barChartInstance = null;
    let lineChartInstance = null;
    let currentLinePeriod = 'daily';

    function formatNumber(num) {
        return Number(num || 0).toLocaleString('vi-VN');
    }

    function formatStorageDisplay(sizeMb) {
        const mb = Number(sizeMb || 0);
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(2)} GB`;
        }
        return `${mb.toFixed(1)} MB`;
    }

    function formatShortDate(isoDate) {
        if (!isoDate) return '';
        const parts = String(isoDate).split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return isoDate;
    }

    function formatMonthLabel(ym) {
        if (!ym) return '';
        const parts = String(ym).split('-');
        if (parts.length === 2) {
            return `T${Number(parts[1])}/${parts[0]}`;
        }
        return ym;
    }

    function truncateLabel(text, maxLen = 16) {
        const clean = String(text || '').trim();
        if (clean.length <= maxLen) return clean;
        return clean.slice(0, maxLen - 1) + '…';
    }

    // =========================================================================
    // 1. THẺ THỐNG KÊ (METRIC CARDS)
    // =========================================================================

    async function renderMetricCards() {
        const metrics = await window.DBManager.getDashboardOverview();

        const totalVideos = Number(metrics.total_videos || 0);
        const totalViews = Number(metrics.total_views || 0);
        const totalStorageMb = Number(metrics.total_storage_mb || 0);
        const totalCategories = Number(metrics.total_categories || 0);

        const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;
        const percentUsed = Math.min(100, (totalStorageMb / STORAGE_LIMIT_MB) * 100);

        document.getElementById('metricTotalVideos').textContent = formatNumber(totalVideos);
        document.getElementById('metricCategoriesInfo').textContent = `${formatNumber(totalCategories)} danh mục hoạt động`;

        document.getElementById('metricTotalViews').textContent = formatNumber(totalViews);
        document.getElementById('metricAvgViews').textContent = `Trung bình ${formatNumber(avgViews)} lượt xem / video`;

        document.getElementById('metricStorageValue').textContent = formatStorageDisplay(totalStorageMb);
        document.getElementById('storageUsedText').textContent =
            `Đã dùng ${totalStorageMb.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB / 10 GB`;
        document.getElementById('storagePercentText').textContent = `${percentUsed.toFixed(1)}%`;

        const progressBar = document.getElementById('storageProgressBar');
        progressBar.style.width = `${percentUsed}%`;
        progressBar.className = 'storage-progress-bar';
        if (percentUsed >= 90) {
            progressBar.classList.add('danger');
        } else if (percentUsed >= 75) {
            progressBar.classList.add('warning');
        }
    }

    // =========================================================================
    // 2. BIỂU ĐỒ CỘT (BAR CHART - TOP 10 VIDEO NHIỀU VIEW NHẤT)
    // =========================================================================

    async function renderTopVideosBarChart() {
        const canvas = document.getElementById('topVideosBarChart');
        if (!canvas || typeof window.Chart === 'undefined') return;

        const topVideos = await window.DBManager.getTopVideos(10);

        const fullTitles = topVideos.map((v) => v.title);
        const shortLabels = topVideos.map((v, idx) => `#${idx + 1} ${truncateLabel(v.title, 13)}`);
        const viewsData = topVideos.map((v) => Number(v.views || 0));

        if (barChartInstance) {
            barChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        barChartInstance = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: shortLabels,
                datasets: [
                    {
                        label: 'Lượt xem',
                        data: viewsData,
                        backgroundColor: '#2563EB',
                        hoverBackgroundColor: '#1D4ED8',
                        borderRadius: 6,
                        maxBarThickness: 34
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#FFFFFF',
                        bodyColor: '#E2E8F0',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => {
                                const index = items[0].dataIndex;
                                return fullTitles[index] || items[0].label;
                            },
                            label: (context) => ` Lượt xem: ${formatNumber(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11,
                                weight: '600'
                            },
                            maxRotation: 30,
                            minRotation: 15
                        }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: '#F1F5F9' },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            },
                            callback: (val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)
                        }
                    }
                }
            }
        });
    }

    // =========================================================================
    // 3. BIỂU ĐỒ ĐƯỜNG (LINE CHART - LƯỢT XEM THEO NGÀY / THÁNG)
    // =========================================================================

    async function renderViewsTrendLineChart(period = 'daily') {
        const canvas = document.getElementById('viewsTrendLineChart');
        if (!canvas || typeof window.Chart === 'undefined') return;

        const subtitleEl = document.getElementById('lineChartSubtitle');
        if (subtitleEl) {
            subtitleEl.textContent =
                period === 'monthly'
                    ? 'Tổng hợp lượt xem theo từng tháng (YYYY-MM) từ Supabase'
                    : 'Thống kê lượt xem trong 30 ngày gần nhất từ Supabase';
        }

        const rows = await window.DBManager.getViewsAnalyticsTrend(period);

        const trend =
            period === 'monthly'
                ? {
                      labels: rows.map((r) => formatMonthLabel(r.view_month)),
                      rawDates: rows.map((r) => `Tháng ${r.view_month}`),
                      values: rows.map((r) => Number(r.monthly_views || 0))
                  }
                : {
                      labels: rows.map((r) => formatShortDate(r.view_date)),
                      rawDates: rows.map((r) => `Ngày ${r.view_date}`),
                      values: rows.map((r) => Number(r.daily_views || 0))
                  };

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

        if (lineChartInstance) {
            lineChartInstance.destroy();
        }

        lineChartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.labels,
                datasets: [
                    {
                        label: period === 'monthly' ? 'Lượt xem theo tháng' : 'Lượt xem theo ngày',
                        data: trend.values,
                        borderColor: '#2563EB',
                        backgroundColor: gradient,
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.36,
                        pointRadius: period === 'monthly' ? 4.5 : 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: '#2563EB',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#FFFFFF',
                        bodyColor: '#E2E8F0',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                return trend.rawDates[idx] || items[0].label;
                            },
                            label: (context) => ` Tổng lượt xem: ${formatNumber(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748B',
                            maxTicksLimit: period === 'monthly' ? 12 : 10,
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11,
                                weight: '600'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: '#F1F5F9' },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            },
                            callback: (val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)
                        }
                    }
                }
            }
        });
    }

    // =========================================================================
    // 4. BẢNG 5 VIDEO MỚI NHẤT
    // =========================================================================

    async function renderRecentVideosTable() {
        const tbody = document.getElementById('recentVideosTbody');
        if (!tbody) return;

        const rows = await window.DBManager.getRecentVideos(5);

        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-title">Chưa có video nào trên Supabase</div>
                        <div class="empty-desc">Hãy nhấn "Thêm Video Mới" để bắt đầu.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rows
            .map((v) => {
                const fallbackSrc = window.Auth.getFallbackThumbnail(`#${v.id}`);
                return `
                    <tr>
                        <td class="col-id">#${v.id}</td>
                        <td>
                            <div class="thumb-wrapper" onclick="window.location.href='videos.html'">
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
                                <span>Ngày tạo: ${window.Auth.escapeHtml(v.created_at || '')}</span>
                            </div>
                        </td>
                        <td>
                            <span class="category-badge">${window.Auth.escapeHtml(v.category_name)}</span>
                        </td>
                        <td>
                            <span class="views-number">${formatNumber(v.views)}</span>
                        </td>
                        <td>
                            <span class="views-number">${Number(v.size_mb || 0).toFixed(1)} MB</span>
                        </td>
                    </tr>
                `;
            })
            .join('');
    }

    function bindPeriodFilterButtons() {
        document.querySelectorAll('.segment-btn[data-period]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const period = btn.getAttribute('data-period');
                if (period === currentLinePeriod) return;
                currentLinePeriod = period;

                document.querySelectorAll('.segment-btn[data-period]').forEach((b) => {
                    b.classList.toggle('active', b === btn);
                });

                try {
                    await renderViewsTrendLineChart(currentLinePeriod);
                } catch (err) {
                    window.Auth.showToast('Lỗi tải dữ liệu biểu đồ: ' + err.message, 'error');
                }
            });
        });
    }

    async function bootstrapDashboard() {
        window.Auth.initAdminShell();
        bindPeriodFilterButtons();

        const loadingEl = document.getElementById('dashboardLoading');
        const contentEl = document.getElementById('dashboardContent');

        try {
            const user = await window.Auth.requireAuthAsync();
            if (!user) return;

            await Promise.all([
                renderMetricCards(),
                renderTopVideosBarChart(),
                renderViewsTrendLineChart(currentLinePeriod),
                renderRecentVideosTable()
            ]);

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        } catch (err) {
            console.error('[Dashboard] Lỗi kết nối Supabase:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `<span style="color:var(--danger);font-weight:600;">Lỗi kết nối Supabase: ${window.Auth.escapeHtml(err.message)}</span>`;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', bootstrapDashboard);
})(window);
