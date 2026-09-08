import React, { useState, useMemo, useRef, useEffect } from 'react';
// Only the pieces this file's charts actually need — 'chart.js/auto'
// registers every controller/scale/element Chart.js ships (radar, polar,
// etc.), which would bloat the bundle for chart types this Dashboard never
// uses.
import {
  Chart, DoughnutController, ArcElement, BarController, BarElement,
  LinearScale, CategoryScale, Tooltip, type ChartConfiguration,
} from 'chart.js';
Chart.register(DoughnutController, ArcElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip);
import {
  ShieldAlert, ShieldCheck, Activity, Globe, Database,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  TrendingUp, Layers, RefreshCw, BarChart3, Download,
  Radio, PieChart as PieIcon, ChevronRight, ExternalLink,
  Shield, Server, Eye, FileText, Check, MoreVertical,
  Zap, Lock, AlertOctagon, Terminal, Filter,
  Crosshair, Flame, Share2, Search, ArrowRight, PlayCircle,
  Link2, Copy, Files
} from 'lucide-react';
import { FeedSource, CategoryInfo, DashboardStats, ReviewDomainItem } from '../../types';
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
}) => {
  const reviewCount = reviewItems.length;
  // Declared once, up top: every chart effect in this file (status, growth,
  // TLD, donut) depends on this to rebuild with fresh colors on theme
  // toggle, so it must exist before all of them regardless of which order
  // they're declared in below.
  const themeVersion = useThemeVersion();
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
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
  const statusBreakdown = stats?.statusBreakdown || [];
  // Sorted descending once, real counts — both the chart and its own
  // in-bar/tooltip labels below read from this same sorted list, so what
  // you hover always matches what you see.
  const statusBreakdownSorted = useMemo(
    () => statusBreakdown.slice().sort((a, b) => b.count - a.count),
    [statusBreakdown]
  );

  // Status breakdown — horizontal bar chart, single blue family shading
  // darkest→lightest by rank (per explicit request to match a specific
  // reference style) rather than this app's usual per-status semantic
  // colors (green=active, etc. — still used everywhere else, e.g.
  // DomainTable's renderStatus) — a deliberate one-off for this chart only.
  const statusCanvasRef = useRef<HTMLCanvasElement>(null);
  const statusChartRef = useRef<Chart | null>(null);
  const STATUS_BAR_SHADES = ['#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd'];

  useEffect(() => {
    if (!statusCanvasRef.current || statusBreakdownSorted.length === 0) {
      statusChartRef.current?.destroy();
      statusChartRef.current = null;
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue('--border').trim() || '#e9ecef';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#8996a4';
    const inverse = styles.getPropertyValue('--bg-inverse').trim() || '#1d2630';
    const inverseFg = styles.getPropertyValue('--text-inverse')?.trim() || '#ffffff';

    // Draws each bar's real count as white bold text near its right edge,
    // INSIDE the bar (matching the reference style) — falls back to muted
    // text just outside the bar when a value is too small for the label to
    // fit inside it, so a tiny real count (e.g. 2 domains in Allowlist)
    // never renders as invisible white-on-white.
    const inBarValueLabels = {
      id: 'inBarValueLabels',
      afterDatasetsDraw(chart: Chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        meta.data.forEach((bar: any, i: number) => {
          const label = statusBreakdownSorted[i].count.toLocaleString('vi-VN');
          ctx.save();
          ctx.font = 'bold 12px inherit';
          const textWidth = ctx.measureText(label).width;
          const barWidth = bar.x - bar.base;
          if (textWidth + 16 <= barWidth) {
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.fillText(label, bar.x - 8, bar.y, undefined);
          } else {
            ctx.fillStyle = textMuted;
            ctx.textAlign = 'left';
            ctx.fillText(label, bar.x + 8, bar.y, undefined);
          }
          ctx.textBaseline = 'middle';
          ctx.restore();
        });
      },
    };

    statusChartRef.current?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: statusBreakdownSorted.map((s) => STATUS_LABELS[s.status] || s.status),
        datasets: [
          {
            data: statusBreakdownSorted.map((s) => s.count),
            backgroundColor: statusBreakdownSorted.map((_, i) => STATUS_BAR_SHADES[i % STATUS_BAR_SHADES.length]),
            borderRadius: 4,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        indexAxis: 'y',
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
                const s = statusBreakdownSorted[ctx.dataIndex];
                return `${s.count.toLocaleString('vi-VN')} tên miền (${s.percent.toFixed(1)}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textMuted, font: { size: 10 }, precision: 0 },
          },
          y: {
            grid: { display: false },
            ticks: { color: textMuted, font: { size: 11 } },
          },
        },
      },
      plugins: [inBarValueLabels],
    };
    statusChartRef.current = new Chart(statusCanvasRef.current, config);

    return () => {
      statusChartRef.current?.destroy();
      statusChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same reasoning
    // as the other chart effects: statusBreakdownSorted is a derived array.
  }, [JSON.stringify(statusBreakdownSorted), themeVersion]);

  // Donut slices — Chart.js (see the canvas effect below) computes its own
  // arc geometry now, so this no longer needs to hand-compute start/end
  // angles the way the old SVG version did.
  const donutSlices = categoryBreakdownSource;

  const donutCanvasRef = useRef<HTMLCanvasElement>(null);
  const donutChartRef = useRef<Chart | null>(null);

  // Real daily new-domain counts for the last 30 days (see getDashboardStats'
  // domainGrowth field) — every day in the window is present, even ones with
  // 0, so the trend chart never has a gap on the x-axis. No fabricated
  // week-over-week % anywhere here, just the real counts themselves.
  const growthCanvasRef = useRef<HTMLCanvasElement>(null);
  const growthChartRef = useRef<Chart | null>(null);
  const domainGrowth = stats?.domainGrowth || [];

  useEffect(() => {
    if (!growthCanvasRef.current || domainGrowth.length === 0) {
      growthChartRef.current?.destroy();
      growthChartRef.current = null;
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--color-primary').trim() || '#2563eb';
    const gridColor = styles.getPropertyValue('--border').trim() || '#e9ecef';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#8996a4';
    const inverse = styles.getPropertyValue('--bg-inverse').trim() || '#1d2630';
    const inverseFg = styles.getPropertyValue('--text-inverse')?.trim() || '#ffffff';

    growthChartRef.current?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: domainGrowth.map((g) =>
          new Date(g.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        ),
        datasets: [
          {
            data: domainGrowth.map((g) => g.count),
            backgroundColor: primary,
            borderRadius: 3,
            maxBarThickness: 14,
          },
        ],
      },
      options: {
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
              title: (items) => {
                const g = domainGrowth[items[0].dataIndex];
                return new Date(g.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
              },
              label: (ctx) => `${ctx.parsed.y.toLocaleString('vi-VN')} domain mới`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textMuted, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    };
    growthChartRef.current = new Chart(growthCanvasRef.current, config);

    return () => {
      growthChartRef.current?.destroy();
      growthChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same reasoning
    // as the donut chart's effect above: domainGrowth is a derived array
    // (new reference on every render), so comparing its real values (via
    // JSON) is what actually matters, not the reference.
  }, [JSON.stringify(domainGrowth), themeVersion]);

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
            // Background matches the hovered slice's OWN real color (the
            // same categories.color used for the slice itself and the 2x2
            // cards below) instead of a fixed dark box — text stays white
            // regardless of light/dark mode, per explicit request, since
            // it must stay readable against whichever slice color is
            // showing. Chart.js tooltip colors are scriptable (accept a
            // function of the tooltip context), so this reads the real
            // hovered dataIndex on every show rather than a static color.
            backgroundColor: (ctx) => {
              const dp = ctx.tooltip?.dataPoints?.[0];
              const slice = dp ? donutSlices[dp.dataIndex] : null;
              return slice?.color || inverse;
            },
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
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

  // TLD bar chart — real counts/shares from GET /api/dashboard/stats (same
  // tldBreakdownSource above). One distinct color per bar purely for visual
  // legibility (TLDs have no inherent color of their own, unlike categories)
  // — mirrors DomainTable's own category-badge palette, cycling through
  // Tailwind families this app's redefined emerald/blue/rose scales don't
  // touch, so it never collides with the primary/info/danger semantic tokens.
  const tldCanvasRef = useRef<HTMLCanvasElement>(null);
  const tldChartRef = useRef<Chart | null>(null);
  const TLD_BAR_COLORS = ['#2563eb', '#9333ea', '#0891b2', '#f59e0b', '#db2777', '#64748b'];

  useEffect(() => {
    if (!tldCanvasRef.current || tldBreakdownSource.length === 0) {
      tldChartRef.current?.destroy();
      tldChartRef.current = null;
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue('--border').trim() || '#e9ecef';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#8996a4';
    const inverse = styles.getPropertyValue('--bg-inverse').trim() || '#1d2630';
    const inverseFg = styles.getPropertyValue('--text-inverse')?.trim() || '#ffffff';

    tldChartRef.current?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: tldBreakdownSource.map((t) => t.tld),
        datasets: [
          {
            data: tldBreakdownSource.map((t) => t.blocked),
            backgroundColor: tldBreakdownSource.map((_, i) => TLD_BAR_COLORS[i % TLD_BAR_COLORS.length]),
            borderRadius: 6,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
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
                const t = tldBreakdownSource[ctx.dataIndex];
                return `${t.blocked.toLocaleString('vi-VN')} domain (${t.sharePercent.toFixed(1)}% tổng chặn)`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textMuted, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    };
    tldChartRef.current = new Chart(tldCanvasRef.current, config);

    return () => {
      tldChartRef.current?.destroy();
      tldChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same reasoning
    // as the other chart effects: tldBreakdownSource is a derived array.
  }, [JSON.stringify(tldBreakdownSource), themeVersion]);

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

      {/* Row 1b: Domain growth trend — real daily counts from firstSeen,
          last 30 days, every day present (even 0) so the bars never have a
          gap. No fabricated week-over-week % anywhere here. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
              Xu Hướng Domain Mới Bị Chặn
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Số tên miền phát hiện mới mỗi ngày (30 ngày gần nhất), theo thời điểm phát hiện thật trong CyberDNSTIP-DB
            </p>
          </div>
        </div>

        {!stats ? (
          <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">Đang tải dữ liệu từ CyberDNSTIP-DB...</div>
        ) : domainGrowth.every((g) => g.count === 0) ? (
          <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">Chưa có domain nào được phát hiện trong 30 ngày qua.</div>
        ) : (
          <div className="h-56">
            <canvas ref={growthCanvasRef} role="img" aria-label="Xu hướng domain mới bị chặn theo ngày" />
          </div>
        )}
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
              <div className="h-56">
                <canvas ref={statusCanvasRef} role="img" aria-label="Phân bổ theo trạng thái xử lý" />
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

            {/* TLD Bar Chart — real counts per TLD, one bar each, hover for
                exact count + share (was a stacked list of horizontal
                percentage bars). */}
            {tldBreakdownSource.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                {stats ? 'Chưa có dữ liệu TLD.' : 'Đang tải...'}
              </div>
            ) : (
              <div className="h-64">
                <canvas ref={tldCanvasRef} role="img" aria-label="Mật độ tên miền theo đuôi (TLD)" />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* DNS Blocklist URL — mỗi Category có 1 URL text thuần, công khai
          không cần xác thực (Blocky tự động tải lại định kỳ, không có cách
          nào truyền credential), dạng {origin}/v1/blocklist/{category}.txt,
          khớp cách các nhà cung cấp blocklist thật (OISD, Hagezi...) công
          bố danh sách của họ. Đặt ở cuối trang theo yêu cầu — đây là thông
          tin tra cứu/tích hợp, không phải chỉ số vận hành cần xem đầu tiên. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                DNS Blocklist URL
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
