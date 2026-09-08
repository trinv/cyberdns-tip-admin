import React, { useState, useMemo, useRef, useEffect } from 'react';
// Only the pieces this file's doughnut chart actually needs — 'chart.js/auto'
// registers every controller/scale/element Chart.js ships (bar, line, radar,
// scales, etc.), which would bloat the bundle for a chart type this Dashboard
// never uses.
import { Chart, DoughnutController, ArcElement, Tooltip, type ChartConfiguration } from 'chart.js';
Chart.register(DoughnutController, ArcElement, Tooltip);
import {
  ShieldAlert, ShieldCheck, Activity, Globe, Database,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  TrendingUp, Layers, RefreshCw, BarChart3, Download,
  Radio, PieChart as PieIcon, ChevronRight, ExternalLink,
  Shield, Server, Eye, FileText, Check, MoreVertical,
  Zap, Lock, AlertOctagon, Terminal, Radar, Filter,
  Crosshair, Flame, Share2, Search, ArrowRight, PlayCircle,
  Link2, Copy, Files
} from 'lucide-react';
import { FeedSource, CategoryInfo, DashboardStats, ReviewDomainItem, AppUser } from '../../types';
import { MetricDetailModal, MetricType } from './MetricDetailModal';
import { copyToClipboard } from '../../lib/clipboard';
import { buildBlocklistUrl } from '../../lib/blocklistUrl';

// Chart.js draws onto a <canvas> once, at creation time — unlike CSS, it
// has no way to react to a CSS variable changing on its own, so a chart
// built under light mode keeps its light colors baked in even after the
// user flips to dark mode (the exact bug admin-portal-style's chart spec
// calls out). This hook bumps a counter whenever <html>'s `dark` class
// toggles (see App.tsx's theme effect), so a chart-building useEffect can
// list it as a dependency and rebuild with freshly-read
// getComputedStyle(...) colors on every theme change — no prop threading
// through App.tsx needed for this.
function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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
  // counts across ALL domains, not just active ones, replacing what used
  // to be a fabricated QPS/telemetry chart with no backing data pipeline.
  const STATUS_LABELS: Record<string, string> = {
    active: 'Đang chặn',
    allowlist: 'Allowlist',
    unblocked: 'Đã thôi chặn',
    protected: 'Được bảo vệ',
  };
  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-500', // status color, not the app's primary blue — see DomainTable's renderStatus for the same reasoning
    allowlist: 'bg-blue-500',
    unblocked: 'bg-slate-400',
    protected: 'bg-slate-300',
  };
  const statusBreakdown = stats?.statusBreakdown || [];

  // Donut slices — Chart.js (see the canvas effect below) computes its own
  // arc geometry now, so this no longer needs to hand-compute start/end
  // angles the way the old SVG version did.
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
    // Read real theme colors fresh on every (re)build — see useThemeVersion's
    // own note on why Chart.js can't just pick these up from CSS on its own.
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--bg-surface').trim() || '#ffffff';
    const inverse = styles.getPropertyValue('--bg-inverse').trim() || '#1d2630';
    const inverseFg = styles.getPropertyValue('--text-inverse')?.trim() || '#ffffff';

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
  // reflects each TLD's share of the current blocklist volume — NOT a
  // "malicious rate" (that would require knowing how many domains exist
  // under each TLD in total, which this system doesn't track), so the
  // label below is phrased as a share, not a risk rate.
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

  // Most recently seen active domains, real data straight from CyberDNSTIP-DB
  // (see getDashboardStats' recentActive) — no ASN/threat-score fields exist
  // anymore (removed: neither was ever backed by a real lookup/scoring
  // pipeline, just an honest-default placeholder or a fixed constant).
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
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto h-full p-4 sm:p-6 transition-colors">
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        {/* Hero banner: real greeting (logged-in user) + real date + a
            one-line summary built from real numbers already in props — the
            reference template's own "Welcome back" pattern, but with zero
            fabricated data (no week-over-week % — no historical time-series
            exists yet to compute a real delta from). Replaces the former
            static "SOC Status Bar" title with a personalized one; keeps the
            same live-monitoring badge and radar icon. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[.14em] text-slate-400 dark:text-slate-500 font-mono mb-0.5">
                {heroDateLabel}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Chào, {heroUserName}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                  ACTIVE MONITORING
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {heroSummaryLine}
              </p>
            </div>
          </div>
        </div>

        {/* Blocklist URL cho Blocky DNS — mỗi Category có 1 URL text thuần,
            công khai không cần xác thực (Blocky tự động tải lại định kỳ,
            không có cách nào truyền credential), dạng
            {origin}/v1/blocklist/{category}.txt, khớp cách các nhà cung
            cấp blocklist thật (OISD, Hagezi...) công bố danh sách của họ. */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Blocklist URL cho Blocky DNS
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Mỗi Category có 1 URL text thuần để Blocky (hoặc bộ chặn DNS khác) tải định kỳ
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyAllBlocklistUrls}
              title="Sao chép toàn bộ URL của mọi Category, mỗi dòng một URL"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer active-press flex-shrink-0"
            >
              {copiedBlocklistId === 'all' ? (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Files className="w-3.5 h-3.5" />
              )}
              <span>{copiedBlocklistId === 'all' ? 'Đã sao chép' : 'Sao chép tất cả'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {categories.map((cat) => {
              const url = buildBlocklistUrl(cat.id);
              const isCopied = copiedBlocklistId === cat.id;
              return (
                <div key={cat.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#64748b' }}
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-32 sm:w-40 flex-shrink-0 truncate">
                    {cat.name}
                  </span>
                  <code className="flex-1 min-w-0 truncate text-xs font-mono text-slate-500 dark:text-slate-400" title={url}>
                    {url}
                  </code>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCopyBlocklistUrl(cat.id)}
                      title="Sao chép URL"
                      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở URL trong tab mới"
                      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="py-3 text-xs text-slate-400 dark:text-slate-600">Chưa có Category nào.</p>
            )}
          </div>
        </div>

      {/* Row 1: 3 Key SOC Operational Metric Cards - Simplified General Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Tổng IOC Tên miền Đang chặn */}
        <div 
          onClick={() => setSelectedMetricModal('total_blocked')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md dark:hover:border-emerald-700/60 hover:border-emerald-500/60 transition-all cursor-pointer group active-press"
          title="Nhấp để xem đồ thị và phân tích chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                IOCs / TỔNG DOMAIN CHẶN
              </span>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 flex items-center space-x-1">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <div className="text-[28px] leading-9 font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {stats ? totalActiveDisplay : '—'}
            </div>
            <div className="flex items-center space-x-1.5 mt-3 pt-3 border-t border-dashed border-[var(--color-border-soft)] text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{stats ? 'Cập nhật trực tiếp từ CyberDNSTIP-DB' : 'Đang tải...'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: SOC Triage Queue */}
        <div 
          onClick={() => setSelectedMetricModal('soc_queue')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md dark:hover:border-rose-700/60 hover:border-rose-500/60 transition-all cursor-pointer group active-press"
          title="Nhấp để xem đồ thị và phân tích chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                HÀNG ĐỢI DUYỆT SOC
              </span>
            </div>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-800/60 flex items-center space-x-1">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <div className="text-[28px] leading-9 font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {reviewCount} Tên miền
            </div>
            <div className="flex items-center space-x-1.5 mt-3 pt-3 border-t border-dashed border-[var(--color-border-soft)] text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4" />
              <span>Chờ phê duyệt thủ công</span>
            </div>
          </div>
        </div>

        {/* Card 3: Nguồn cấp IOC & Phân loại Danh mục */}
        <div 
          onClick={() => setSelectedMetricModal('sources_coverage')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md dark:hover:border-indigo-700/60 hover:border-indigo-500/60 transition-all cursor-pointer group active-press"
          title="Nhấp để xem nguồn cấp và phân loại chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                NGUỒN CẤP & DANH MỤC
              </span>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 flex items-center space-x-1">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <div className="text-[28px] leading-9 font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {sources.length} Feeds / {categories.length} Nhóm
            </div>
            <div className="flex items-center space-x-1.5 mt-3 pt-3 border-t border-dashed border-[var(--color-border-soft)] text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {sources.filter((s) => s.status === 'healthy').length}/{sources.length || 0} nguồn hoạt động tốt
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Main Telemetry Spline Chart + Category Donut Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real status breakdown across every domain in the DB */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                  Phân Bổ Theo Trạng Thái Xử Lý
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Số lượng tên miền thật trong CyberDNSTIP-DB theo từng trạng thái (đang chặn, ân hạn, allowlist, đã thôi chặn...)
                </p>
              </div>
            </div>

            {!stats ? (
              <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">Đang tải dữ liệu từ CyberDNSTIP-DB...</div>
            ) : statusBreakdown.length === 0 || statusBreakdown.every((s) => s.count === 0) ? (
              <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">Chưa có tên miền nào trong hệ thống.</div>
            ) : (
              <div className="space-y-3">
                {statusBreakdown
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((s) => (
                    <div key={s.status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{STATUS_LABELS[s.status] || s.status}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-white">{s.count.toLocaleString('vi-VN')}</strong> · {s.percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`${STATUS_COLORS[s.status] || 'bg-slate-400'} h-full rounded-full transition-all`}
                          style={{ width: `${s.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Tổng số tên miền trong DB</span>
            <span className="font-extrabold font-mono text-slate-900 dark:text-white">{(stats?.totalAll ?? 0).toLocaleString('vi-VN')}</span>
          </div>
        </div>

        {/* Right 1 Col: Donut Chart - Threat Category Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight">
                  Phân Bổ Danh Mục Nguy Cơ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Tỷ trọng {totalActiveDisplay} domain đang chặn (active)
                </p>
              </div>
              <button 
                onClick={() => setSelectedMetricModal('sources_coverage')}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tùy chọn hiển thị & phân tích"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {donutSlices.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                {stats ? 'Chưa có domain đang chặn nào để phân bổ.' : 'Đang tải dữ liệu từ CyberDNSTIP-DB...'}
              </div>
            ) : (
            <>
            {/* Real Chart.js doughnut (was a hand-drawn SVG arc-math donut).
                Hover is driven by Chart.js's own onHover callback into the
                SAME activeDonutIndex state the center readout and the 2x2
                cards below already used — their JSX is unchanged. Chart.js
                also supplies its own native tooltip now, so the old
                hand-positioned "floating pill" (computed from the SVG's own
                angle math, which no longer exists) was removed rather than
                reimplemented against canvas coordinates. */}
            <div className="relative w-full h-64 flex items-center justify-center my-3">
              <div className="w-56 h-56">
                <canvas ref={donutCanvasRef} role="img" aria-label="Phân bổ danh mục nguy cơ" />
              </div>

              {/* Center Donut Readout */}
              {(() => {
                const activeItem = donutSlices[activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0];
                return (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span
                      className="text-xs font-bold font-sans transition-colors duration-200"
                      style={{ color: activeItem.color }}
                    >
                      {activeItem.shortName}
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {activeItem.count}
                    </span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 font-medium">
                      {activeItem.percent} tỷ trọng
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* 2x2 Category Metrics Cards below Donut */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              {donutSlices.map((cat, i) => {
                const isSelected = (activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0) === i;
                return (
                  <div
                    key={cat.id}
                    onMouseEnter={() => setActiveDonutIndex(i)}
                    onClick={() => onNavigateToTab('domain')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected 
                        ? 'bg-slate-50/90 dark:bg-slate-800/90 border-slate-300 dark:border-slate-600 shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-700' 
                        : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: cat.color }}
                      ></span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate font-sans">
                        {cat.shortName.split('/')[0].trim()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                        {cat.count}
                      </span>
                      {cat.delta ? (
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                          <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" />
                          {cat.delta}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300 dark:text-slate-600">{cat.percent}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
            )}
          </div>

          <button
            onClick={() => onNavigateToTab('domain')}
            className="w-full mt-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer active-press font-sans flex items-center justify-center space-x-1.5"
          >
            <span>Mở Bộ Lọc Domain Explorer Theo Nhóm</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 3: High-Risk TLD & ASNs (real data only — the brand-impersonation
          panel that used to sit alongside this was 100% fabricated with no
          backing data source, so it was removed rather than left showing
          fake numbers). */}
      <div className="grid grid-cols-1 gap-6">
        {/* High Risk TLDs and ASNs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                  Mật Độ Tên Miền Theo Đuôi (TLD) & ASN
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tỷ trọng trong danh sách chặn hiện tại — không phải tỷ lệ độc hại tuyệt đối của toàn bộ đuôi tên miền
                </p>
              </div>
            </div>

            {/* TLD Progress Grid */}
            {tldBreakdownSource.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                {stats ? 'Chưa có dữ liệu TLD.' : 'Đang tải...'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {tldBreakdownSource.map((t, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{t.tld}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        <strong className="text-rose-600 dark:text-rose-400">{t.sharePercent.toFixed(1)}%</strong> tổng chặn · {t.blocked.toLocaleString('vi-VN')} domain
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all"
                        style={{ width: `${t.widthPercent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Row 4: Real-time SOC Threat Stream */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                Tên Miền Đang Chặn Gần Đây Nhất
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sắp xếp theo thời điểm phát hiện gần nhất, lấy trực tiếp từ CyberDNSTIP-DB
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigateToTab('review')}
              className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-bold text-xs rounded-xl transition-colors cursor-pointer active-press"
            >
              Hàng đợi Duyệt (Review Queue)
            </button>
            <button
              onClick={() => onNavigateToTab('logs')}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer active-press"
            >
              Nhật Ký (Audit Logs)
            </button>
          </div>
        </div>

        {/* Recently-blocked Domains Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              {/* Header style matches the reference template's .table thead
                  th exactly: mono, uppercase, wide letter-spacing, muted —
                  not just a bold sans label. */}
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 font-mono font-medium text-[10px] tracking-[.14em] uppercase border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Tên miền</th>
                <th className="px-4 py-3">Nhóm danh mục</th>
                <th className="px-4 py-3">Nguồn phát hiện</th>
                <th className="px-4 py-3">Phát hiện lúc</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {recentActiveDomains.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    {stats ? 'Chưa có tên miền nào trong danh sách chặn.' : 'Đang tải dữ liệu từ CyberDNSTIP-DB...'}
                  </td>
                </tr>
              )}
              {recentActiveDomains.map((d) => {
                return (
                  <tr
                    key={d.id}
                    className={`hover:bg-emerald-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      selectedIncident === String(d.id) ? 'bg-emerald-50/70 dark:bg-slate-800/70 font-medium' : ''
                    }`}
                    onClick={() => setSelectedIncident(String(d.id))}
                  >
                    <td className="px-4 py-3 font-mono">
                      <div className="font-bold text-rose-600 dark:text-rose-400">{d.domain}</div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {categories.find((c) => c.id === d.primaryCategory)?.name || d.primaryCategory}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                      {d.source}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">
                      {new Date(d.lastSeen).toLocaleString('vi-VN')}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                      đang chặn
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToTab('domain');
                        }}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer shadow-xs active-press"
                      >
                        Kiểm tra
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
