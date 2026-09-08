import React, { useState, useMemo, useRef, useEffect } from 'react';
// Only the pieces this file's doughnut chart actually needs — 'chart.js/auto'
// registers every controller/scale/element Chart.js ships (bar, line, radar,
// scales, etc.), which would bloat the bundle for a chart type this Dashboard
// never uses.
import { Chart, DoughnutController, ArcElement, Tooltip, type ChartConfiguration } from 'chart.js';
Chart.register(DoughnutController, ArcElement, Tooltip);
import {
  ArrowUpRight, AlertTriangle, CheckCircle2,
  Layers, ChevronRight, ExternalLink,
  Shield, Check, MoreVertical,
  AlertOctagon, Radar,
  Link2, Copy, Files
} from 'lucide-react';
import { FeedSource, CategoryInfo, DashboardStats, ReviewDomainItem, AppUser } from '../../types';
import { MetricDetailModal, MetricType } from './MetricDetailModal';
import { copyToClipboard } from '../../lib/clipboard';
import { buildBlocklistUrl } from '../../lib/blocklistUrl';

// Chart.js draws onto a <canvas> once, at creation time — unlike CSS, it
// has no way to react to a CSS variable changing on its own, so a chart
// built under light mode keeps its light colors baked in even after the
// user flips to dark mode. This hook bumps a counter whenever <html>'s
// `data-bs-theme` attribute toggles (see App.tsx's theme effect), so a
// chart-building useEffect can list it as a dependency and rebuild with
// freshly-read getComputedStyle(...) colors on every theme change.
function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
    return () => observer.disconnect();
  }, []);
  return version;
}

interface DashboardViewProps {
  onNavigateToTab: (tab: string) => void;
  sources: FeedSource[];
  categories: CategoryInfo[];
  reviewItems: ReviewDomainItem[];
  // Live aggregates from GET /api/dashboard/stats — null while loading, in
  // which case the sections below show a loading/empty state rather than
  // any placeholder numbers.
  stats: DashboardStats | null;
  onOpenReleaseAlert: () => void;
  onOpenCrawlerAlert: () => void;
  onOpenAllowlistAlert: () => void;
  // For the hero banner's greeting only — real logged-in user, never a
  // fabricated name.
  currentUser: AppUser | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTab,
  sources,
  categories,
  reviewItems,
  stats,
  onOpenReleaseAlert,
  onOpenCrawlerAlert,
  onOpenAllowlistAlert,
  currentUser,
}) => {
  const reviewCount = reviewItems.length;
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [selectedMetricModal, setSelectedMetricModal] = useState<MetricType | null>(null);
  // Which category's blocklist URL was just copied (for the per-row
  // checkmark below) — 'all' means the "copy all URLs" button.
  const [copiedBlocklistId, setCopiedBlocklistId] = useState<string | null>(null);

  // Category breakdown: real counts from GET /api/dashboard/stats, mapped
  // onto each category's display name/color. null while stats haven't
  // loaded yet or there is nothing to show (0 active domains) — rendered as
  // a loading/empty state rather than any placeholder numbers.
  const liveCategoryBreakdown = useMemo(() => {
    if (!stats || stats.categoryBreakdown.length === 0) return null;
    return stats.categoryBreakdown.map((c) => {
      const meta = categories.find((cat) => cat.id === c.category);
      return {
        id: c.category,
        name: meta?.name || c.category,
        shortName: meta?.name || c.category,
        value: c.count,
        color: meta?.color || '#64748b',
        percent: `${c.percent.toFixed(1)}%`,
        count: c.count.toLocaleString('vi-VN'),
        // No historical snapshot is stored yet, so a real "vs. last release"
        // delta can't be computed truthfully — left unset rather than guessed.
        delta: null as string | null,
        badge: c.category.toUpperCase(),
      };
    });
  }, [stats, categories]);

  const categoryBreakdownSource = liveCategoryBreakdown || [];
  const totalActiveDisplay = stats ? stats.totalActive.toLocaleString('vi-VN') : '—';

  // Hero banner greeting — real logged-in user's name, real current date,
  // and a one-line summary built entirely from real numbers already in
  // props (no fabricated week-over-week trend % — the system has no
  // historical time-series to compute a real delta from yet).
  const heroUserName = currentUser?.displayName || currentUser?.email || 'bạn';
  const heroDateLabel = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const heroSummaryLine = stats
    ? `Đang chặn ${totalActiveDisplay} tên miền trên ${sources.length} nguồn feed, ${categories.length} nhóm danh mục.`
    : 'Đang tải dữ liệu từ CyberDNSTIP-DB...';

  // Processing-status breakdown (active / allowlist / unblocked /
  // protected — 'grace_period' removed per explicit request) — real
  // counts across ALL domains, not just active ones.
  const STATUS_LABELS: Record<string, string> = {
    active: 'Đang chặn',
    allowlist: 'Allowlist',
    unblocked: 'Đã thôi chặn',
    protected: 'Được bảo vệ',
  };
  const STATUS_BAR_VARIANT: Record<string, string> = {
    active: 'bg-success', // status color, not the app's primary blue — same reasoning as DomainTable's renderStatus
    allowlist: 'bg-primary',
    unblocked: 'bg-secondary',
    protected: 'bg-secondary-subtle',
  };
  const statusBreakdown = stats?.statusBreakdown || [];

  // Donut slices — Chart.js (see the canvas effect below) computes its own
  // arc geometry now.
  const donutSlices = categoryBreakdownSource;

  const donutCanvasRef = useRef<HTMLCanvasElement>(null);
  const donutChartRef = useRef<Chart | null>(null);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    if (!donutCanvasRef.current || donutSlices.length === 0) {
      donutChartRef.current?.destroy();
      donutChartRef.current = null;
      return;
    }
    // Read real Bootstrap theme colors fresh on every (re)build.
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--bs-body-bg').trim() || '#ffffff';
    const inverse = styles.getPropertyValue('--bs-dark').trim() || '#1d2630';
    const inverseFg = '#ffffff';

    donutChartRef.current?.destroy();
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: donutSlices.map((s) => s.shortName),
        datasets: [
          {
            data: donutSlices.map((s) => s.value),
            backgroundColor: donutSlices.map((s) => s.color),
            borderColor: surface,
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        cutout: '68%',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: inverse,
            titleColor: inverseFg,
            bodyColor: inverseFg,
            padding: 8,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => {
                const slice = donutSlices[ctx.dataIndex];
                return `${slice.shortName}: ${slice.count} (${slice.percent})`;
              },
            },
          },
        },
        onHover: (_evt, elements) => {
          if (elements[0]) setActiveDonutIndex(elements[0].index);
        },
      },
    };
    donutChartRef.current = new Chart(donutCanvasRef.current, config);

    return () => {
      donutChartRef.current?.destroy();
      donutChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- donutSlices is
    // a derived array (new reference every render); comparing its actual
    // values (JSON) here is unnecessary since the effect is cheap and only
    // ever fires on a genuine stats/category refresh or theme change.
  }, [JSON.stringify(donutSlices), themeVersion]);

  // TLD breakdown: real counts from GET /api/dashboard/stats. The bar width
  // reflects each TLD's share of the current blocklist volume.
  const tldBreakdownSource = useMemo(() => {
    if (!stats || stats.tldBreakdown.length === 0) return [];
    const maxCount = Math.max(...stats.tldBreakdown.map((t) => t.count), 1);
    return stats.tldBreakdown.map((t) => ({
      tld: `.${t.tld}`,
      blocked: t.count,
      sharePercent: t.percent,
      widthPercent: (t.count / maxCount) * 100,
    }));
  }, [stats]);

  // Most recently seen active domains, real data straight from CyberDNSTIP-DB.
  const recentActiveDomains = stats?.recentActive || [];

  const handleCopyBlocklistUrl = async (categoryId: string) => {
    const ok = await copyToClipboard(buildBlocklistUrl(categoryId));
    if (ok) {
      setCopiedBlocklistId(categoryId);
      setTimeout(() => setCopiedBlocklistId((cur) => (cur === categoryId ? null : cur)), 1500);
    }
  };

  const handleCopyAllBlocklistUrls = async () => {
    const allUrls = categories.map((c) => buildBlocklistUrl(c.id)).join('\n');
    const ok = await copyToClipboard(allUrls);
    if (ok) {
      setCopiedBlocklistId('all');
      setTimeout(() => setCopiedBlocklistId((cur) => (cur === 'all' ? null : cur)), 1500);
    }
  };

  return (
    <div className="flex-grow-1 overflow-y-auto h-100 p-3 p-sm-4 bg-body">
      <div className="d-flex flex-column gap-4 mx-auto" style={{ maxWidth: 1280 }}>
        {/* Hero banner: real greeting (logged-in user) + real date + a
            one-line summary built from real numbers already in props — no
            fabricated week-over-week % (no historical time-series exists
            yet to compute a real delta from). */}
        <div className="card">
          <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="kpi-icon bg-success-subtle text-success flex-shrink-0">
                <Radar size={20} className="spin-slow" />
              </div>
              <div>
                <span className="d-block text-uppercase text-body-secondary font-monospace fw-bold mb-1" style={{ fontSize: '0.6875rem', letterSpacing: '.1em' }}>
                  {heroDateLabel}
                </span>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <h2 className="fw-bold fs-5 mb-0">Chào, {heroUserName}</h2>
                  <span className="badge rounded-pill text-bg-success-subtle text-success">ACTIVE MONITORING</span>
                </div>
                <p className="text-body-secondary small mt-1 mb-0">{heroSummaryLine}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Blocklist URL cho Blocky DNS — mỗi Category có 1 URL text thuần,
            công khai không cần xác thực, dạng {origin}/v1/blocklist/{category}.txt */}
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div className="d-flex align-items-center gap-3 min-w-0">
                <div className="kpi-icon bg-primary-subtle text-primary flex-shrink-0">
                  <Link2 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="d-block small fw-bold text-uppercase">Blocklist URL cho Blocky DNS</span>
                  <span className="d-block text-body-secondary" style={{ fontSize: '0.75rem' }}>
                    Mỗi Category có 1 URL text thuần để Blocky (hoặc bộ chặn DNS khác) tải định kỳ
                  </span>
                </div>
              </div>

              <button
                onClick={handleCopyAllBlocklistUrls}
                title="Sao chép toàn bộ URL của mọi Category, mỗi dòng một URL"
                className="btn btn-light btn-sm border d-flex align-items-center gap-2 flex-shrink-0"
              >
                {copiedBlocklistId === 'all' ? <Check size={14} className="text-success" /> : <Files size={14} />}
                <span>{copiedBlocklistId === 'all' ? 'Đã sao chép' : 'Sao chép tất cả'}</span>
              </button>
            </div>

            <div className="border-top">
              {categories.map((cat) => {
                const url = buildBlocklistUrl(cat.id);
                const isCopied = copiedBlocklistId === cat.id;
                return (
                  <div key={cat.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                    <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: cat.color || '#64748b' }} />
                    <span className="small fw-semibold text-truncate flex-shrink-0" style={{ width: 140 }}>{cat.name}</span>
                    <code className="flex-grow-1 text-truncate text-body-secondary small" title={url}>{url}</code>
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleCopyBlocklistUrl(cat.id)} title="Sao chép URL" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                        {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                      <a href={url} target="_blank" rel="noreferrer" title="Mở URL trong tab mới" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && <p className="py-3 text-body-secondary small mb-0">Chưa có Category nào.</p>}
            </div>
          </div>
        </div>

        {/* Row 1: 3 Key SOC Operational Metric Cards */}
        <div className="row g-3 g-sm-4">
          {/* Card 1: Tổng IOC Tên miền Đang chặn */}
          <div className="col-12 col-sm-6 col-lg-4">
            <div onClick={() => setSelectedMetricModal('total_blocked')} className="card kpi-card h-100" role="button" title="Nhấp để xem đồ thị và phân tích chi tiết">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="kpi-icon bg-success-subtle text-success">
                      <Shield size={18} />
                    </div>
                    <span className="small fw-bold text-uppercase text-body-secondary">IOCs / Tổng domain chặn</span>
                  </div>
                  <span className="badge rounded-pill text-bg-success-subtle text-success d-flex align-items-center gap-1">
                    <span>Chi tiết</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="kpi-value">{stats ? totalActiveDisplay : '—'}</div>
                  <div className="kpi-footer d-flex align-items-center gap-2 text-success">
                    <CheckCircle2 size={16} />
                    <span>{stats ? 'Cập nhật trực tiếp từ CyberDNSTIP-DB' : 'Đang tải...'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: SOC Triage Queue */}
          <div className="col-12 col-sm-6 col-lg-4">
            <div onClick={() => setSelectedMetricModal('soc_queue')} className="card kpi-card h-100" role="button" title="Nhấp để xem đồ thị và phân tích chi tiết">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="kpi-icon bg-danger-subtle text-danger">
                      <AlertTriangle size={18} />
                    </div>
                    <span className="small fw-bold text-uppercase text-body-secondary">Hàng đợi duyệt SOC</span>
                  </div>
                  <span className="badge rounded-pill text-bg-danger-subtle text-danger d-flex align-items-center gap-1">
                    <span>Chi tiết</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="kpi-value text-danger">{reviewCount} Tên miền</div>
                  <div className="kpi-footer d-flex align-items-center gap-2 text-danger">
                    <AlertOctagon size={16} />
                    <span>Chờ phê duyệt thủ công</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Nguồn cấp IOC & Phân loại Danh mục */}
          <div className="col-12 col-sm-6 col-lg-4">
            <div onClick={() => setSelectedMetricModal('sources_coverage')} className="card kpi-card h-100" role="button" title="Nhấp để xem nguồn cấp và phân loại chi tiết">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="kpi-icon bg-info-subtle text-info">
                      <Layers size={18} />
                    </div>
                    <span className="small fw-bold text-uppercase text-body-secondary">Nguồn cấp & danh mục</span>
                  </div>
                  <span className="badge rounded-pill text-bg-info-subtle text-info d-flex align-items-center gap-1">
                    <span>Chi tiết</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="kpi-value">{sources.length} Feeds / {categories.length} Nhóm</div>
                  <div className="kpi-footer d-flex align-items-center gap-2 text-info">
                    <CheckCircle2 size={16} />
                    <span>{sources.filter((s) => s.status === 'healthy').length}/{sources.length || 0} nguồn hoạt động tốt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Status Breakdown + Category Donut */}
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="card h-100">
              <div className="card-body d-flex flex-column">
                <div className="mb-3">
                  <h3 className="fs-6 fw-bold mb-1">Phân Bổ Theo Trạng Thái Xử Lý</h3>
                  <p className="text-body-secondary small mb-0">
                    Số lượng tên miền thật trong CyberDNSTIP-DB theo từng trạng thái (đang chặn, ân hạn, allowlist, đã thôi chặn...)
                  </p>
                </div>

                {!stats ? (
                  <div className="py-5 text-center text-body-secondary small">Đang tải dữ liệu từ CyberDNSTIP-DB...</div>
                ) : statusBreakdown.length === 0 || statusBreakdown.every((s) => s.count === 0) ? (
                  <div className="py-5 text-center text-body-secondary small">Chưa có tên miền nào trong hệ thống.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {statusBreakdown
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((s) => (
                        <div key={s.status}>
                          <div className="d-flex align-items-center justify-content-between small font-monospace mb-1">
                            <span className="fw-semibold">{STATUS_LABELS[s.status] || s.status}</span>
                            <span className="text-body-secondary">
                              <strong>{s.count.toLocaleString('vi-VN')}</strong> · {s.percent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="progress" style={{ height: 10 }}>
                            <div className={`progress-bar ${STATUS_BAR_VARIANT[s.status] || 'bg-secondary'}`} style={{ width: `${s.percent}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="mt-auto pt-3 mt-3 border-top d-flex align-items-center justify-content-between small">
                  <span className="text-body-secondary text-uppercase fw-bold">Tổng số tên miền trong DB</span>
                  <span className="fw-bold font-monospace">{(stats?.totalAll ?? 0).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Donut Chart */}
          <div className="col-12 col-lg-4">
            <div className="card h-100">
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between pb-3 border-bottom">
                  <div>
                    <h3 className="fs-6 fw-bold mb-1">Phân Bổ Danh Mục Nguy Cơ</h3>
                    <p className="text-body-secondary small mb-0">Tỷ trọng {totalActiveDisplay} domain đang chặn (active)</p>
                  </div>
                  <button
                    onClick={() => setSelectedMetricModal('sources_coverage')}
                    className="app-header-icon-btn"
                    style={{ width: 28, height: 28 }}
                    title="Tùy chọn hiển thị & phân tích"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>

                {donutSlices.length === 0 ? (
                  <div className="py-5 text-center text-body-secondary small">
                    {stats ? 'Chưa có domain đang chặn nào để phân bổ.' : 'Đang tải dữ liệu từ CyberDNSTIP-DB...'}
                  </div>
                ) : (
                  <>
                    <div className="position-relative d-flex align-items-center justify-content-center my-3" style={{ height: 224 }}>
                      <div style={{ width: 208, height: 208 }}>
                        <canvas ref={donutCanvasRef} role="img" aria-label="Phân bổ danh mục nguy cơ" />
                      </div>

                      {/* Center Donut Readout */}
                      {(() => {
                        const activeItem = donutSlices[activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0];
                        return (
                          <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex flex-column align-items-center justify-content-center text-center px-3" style={{ pointerEvents: 'none' }}>
                            <span className="small fw-bold" style={{ color: activeItem.color }}>{activeItem.shortName}</span>
                            <span className="fs-4 fw-bold font-monospace mt-1">{activeItem.count}</span>
                            <span className="text-body-secondary font-monospace small">{activeItem.percent} tỷ trọng</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2x2 Category Metrics Cards below Donut */}
                    <div className="row g-2 mt-1">
                      {donutSlices.map((cat, i) => {
                        const isSelected = (activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0) === i;
                        return (
                          <div className="col-6" key={cat.id}>
                            <div
                              onMouseEnter={() => setActiveDonutIndex(i)}
                              onClick={() => onNavigateToTab('domain')}
                              className={`p-2 rounded-3 border h-100 ${isSelected ? 'bg-body-tertiary' : ''}`}
                              role="button"
                            >
                              <div className="d-flex align-items-center gap-2">
                                <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: cat.color }} />
                                <span className="small fw-semibold text-truncate">{cat.shortName.split('/')[0].trim()}</span>
                              </div>
                              <div className="mt-2 d-flex align-items-baseline justify-content-between">
                                <span className="fw-bold font-monospace">{cat.count}</span>
                                {cat.delta ? (
                                  <span className="text-success font-monospace small d-flex align-items-center">
                                    <ArrowUpRight size={14} className="me-1" />
                                    {cat.delta}
                                  </span>
                                ) : (
                                  <span className="text-body-secondary font-monospace small">{cat.percent}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <button onClick={() => onNavigateToTab('domain')} className="btn btn-light border w-100 mt-4 d-flex align-items-center justify-content-center gap-2">
                  <span>Mở Bộ Lọc Domain Explorer Theo Nhóm</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: TLD Breakdown */}
        <div className="card">
          <div className="card-body">
            <div className="mb-3 pb-2 border-bottom">
              <h3 className="fs-6 fw-bold mb-1">Mật Độ Tên Miền Theo Đuôi (TLD) &amp; ASN</h3>
              <p className="text-body-secondary small mb-0">
                Tỷ trọng trong danh sách chặn hiện tại — không phải tỷ lệ độc hại tuyệt đối của toàn bộ đuôi tên miền
              </p>
            </div>

            {tldBreakdownSource.length === 0 ? (
              <div className="py-4 text-center text-body-secondary small">{stats ? 'Chưa có dữ liệu TLD.' : 'Đang tải...'}</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {tldBreakdownSource.map((t, idx) => (
                  <div key={idx}>
                    <div className="d-flex align-items-center justify-content-between small font-monospace mb-1">
                      <span className="fw-bold">{t.tld}</span>
                      <span className="text-body-secondary">
                        <strong className="text-danger">{t.sharePercent.toFixed(1)}%</strong> tổng chặn · {t.blocked.toLocaleString('vi-VN')} domain
                      </span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-bar bg-danger" style={{ width: `${t.widthPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Recently-blocked Domains Table */}
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-2 border-bottom">
              <div>
                <div className="d-flex align-items-center gap-2">
                  <span className="rounded-circle bg-danger" style={{ width: 10, height: 10 }} />
                  <h3 className="fs-6 fw-bold mb-0">Tên Miền Đang Chặn Gần Đây Nhất</h3>
                </div>
                <p className="text-body-secondary small mt-1 mb-0">Sắp xếp theo thời điểm phát hiện gần nhất, lấy trực tiếp từ CyberDNSTIP-DB</p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button onClick={() => onNavigateToTab('review')} className="btn btn-outline-success btn-sm">Hàng đợi Duyệt (Review Queue)</button>
                <button onClick={() => onNavigateToTab('logs')} className="btn btn-light btn-sm border">Nhật Ký (Audit Logs)</button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="text-body-secondary font-monospace text-uppercase" style={{ fontSize: '0.6875rem', letterSpacing: '.1em' }}>
                    <th>Tên miền</th>
                    <th>Nhóm danh mục</th>
                    <th>Nguồn phát hiện</th>
                    <th>Phát hiện lúc</th>
                    <th>Trạng thái</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {recentActiveDomains.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-body-secondary">
                        {stats ? 'Chưa có tên miền nào trong danh sách chặn.' : 'Đang tải dữ liệu từ CyberDNSTIP-DB...'}
                      </td>
                    </tr>
                  )}
                  {recentActiveDomains.map((d) => (
                    <tr
                      key={d.id}
                      className={selectedIncident === String(d.id) ? 'table-active' : ''}
                      onClick={() => setSelectedIncident(String(d.id))}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-monospace fw-bold text-danger">{d.domain}</td>
                      <td className="fw-semibold">{categories.find((c) => c.id === d.primaryCategory)?.name || d.primaryCategory}</td>
                      <td className="text-body-secondary">{d.source}</td>
                      <td className="font-monospace text-body-secondary">{new Date(d.lastSeen).toLocaleString('vi-VN')}</td>
                      <td className="text-body-secondary">đang chặn</td>
                      <td className="text-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigateToTab('domain'); }}
                          className="btn btn-light btn-sm border"
                        >
                          Kiểm tra
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Detail Modal when clicking on any of the 3 Top KPI Blocks */}
      <MetricDetailModal
        isOpen={selectedMetricModal !== null}
        onClose={() => setSelectedMetricModal(null)}
        metricType={selectedMetricModal}
        onNavigateToTab={onNavigateToTab}
        sources={sources}
        categories={categories}
        stats={stats}
        reviewItems={reviewItems}
      />
    </div>
  );
};
