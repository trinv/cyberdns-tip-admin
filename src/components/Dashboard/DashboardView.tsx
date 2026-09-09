import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
// Only the pieces this file's charts actually need — 'chart.js/auto'
// registers every controller/scale/element Chart.js ships (radar, polar,
// etc.), which would bloat the bundle for chart types this Dashboard never
// uses.
import {
  Chart, DoughnutController, ArcElement, BarController, BarElement,
  LineController, LineElement, PointElement, Filler,
  LinearScale, CategoryScale, Tooltip, type ChartConfiguration,
} from 'chart.js';
Chart.register(
  DoughnutController, ArcElement, BarController, BarElement,
  LineController, LineElement, PointElement, Filler,
  LinearScale, CategoryScale, Tooltip
);
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

// Lazy-loaded, not a static import: DnsNodeStatusCard pulls in mapcn's
// <Map> (src/components/ui/map.tsx), which drags in MapLibre GL — a
// ~900KB+ dependency. Dashboard is the very first screen after login for
// EVERY user, so bundling that statically here would reintroduce exactly
// the "load khá chậm" bundle-bloat problem already fixed for the DNS Node
// tab itself (see App.tsx's own lazy-loaded DnsNodesView). Only actually
// rendered (and therefore only actually dynamically imported) when
// `isAdmin` is true below — a non-Admin viewing their Dashboard never
// triggers this import at all, not even to find out the card would 401/403.
const DnsNodeStatusCard = lazy(() =>
  import('./DnsNodeStatusCard').then((m) => ({ default: m.DnsNodeStatusCard }))
);

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
  // Gates the DNS Node status map card below — GET /api/dns-nodes is
  // Admin-only server-side (see server.ts), so there's nothing for a
  // non-Admin to see here. Defaults to false rather than assuming access.
  isAdmin?: boolean;
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
  isAdmin = false,
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

  // Processing-status breakdown (active / allowlist / unblocked —
  // 'grace_period' and 'protected' both removed per explicit request) —
  // real counts across ALL domains, not just active ones, replacing what
  // used to be a fabricated QPS/telemetry chart with no backing data
  // pipeline.
  const STATUS_LABELS: Record<string, string> = {
    active: 'Đang chặn',
    allowlist: 'Allowlist',
    unblocked: 'Đã thôi chặn',
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
  const STATUS_BAR_SHADES = ['#1d4ed8', '#2563eb', '#60a5fa'];

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
            // Same principle as the "Phân Bổ Danh Mục Nguy Cơ" donut chart:
            // background matches the hovered bar's OWN real color (the
            // exact same shade its bar is drawn with, by rank), text
            // always white.
            backgroundColor: (ctx) => {
              const dp = ctx.tooltip?.dataPoints?.[0];
              return dp ? STATUS_BAR_SHADES[dp.dataIndex % STATUS_BAR_SHADES.length] : inverse;
            },
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
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
    // Solid primary for the line/points/tooltip; primary-soft (already a
    // real translucent tint token, not a hand-rolled hex+alpha string —
    // --color-primary is an hsl(...) value in this app, so string-
    // concatenating an alpha suffix onto it wouldn't parse) for the area
    // gradient fill.
    const primary = styles.getPropertyValue('--color-primary').trim() || '#2563eb';
    const primarySoft = styles.getPropertyValue('--color-primary-soft').trim() || 'rgba(37,99,235,0.12)';
    const gridColor = styles.getPropertyValue('--border').trim() || '#e9ecef';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#8996a4';
    const surface = styles.getPropertyValue('--bg-surface').trim() || '#ffffff';

    // Vertical dashed guide line under the hovered point — Chart.js has no
    // built-in crosshair, so this is a small custom plugin (afterDraw hook)
    // reading the chart's own active tooltip element, same lightweight
    // technique already used for the status chart's in-bar labels (no new
    // npm dependency for one visual detail).
    const hoverGuideLine = {
      id: 'hoverGuideLine',
      afterDraw(chart: Chart) {
        const active = chart.getActiveElements();
        if (!active.length) return;
        const { x } = active[0].element as unknown as { x: number };
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = gridColor;
        ctx.stroke();
        ctx.restore();
      },
    };

    growthChartRef.current?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: domainGrowth.map((g) =>
          new Date(g.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        ),
        datasets: [
          {
            data: domainGrowth.map((g) => g.count),
            borderColor: primary,
            backgroundColor: (context) => {
              const { chart } = context;
              const { chartArea } = chart;
              if (!chartArea) return primarySoft;
              const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, primarySoft);
              gradient.addColorStop(1, 'transparent');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: primary,
            pointHoverBorderColor: surface,
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Same principle as the "Phân Bổ Danh Mục Nguy Cơ" donut chart:
            // background matches the series' own real color (this line's
            // primary blue — there's only one real series here, domain
            // count/day, so no fabricated second line), text always white.
            backgroundColor: primary,
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
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
            grid: { color: gridColor, },
            ticks: { color: textMuted, font: { size: 10 }, precision: 0 },
          },
        },
      },
      plugins: [hoverGuideLine],
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
          // Turned off per explicit request — the floating tooltip box
          // duplicated exactly what the center readout (name/count/percent,
          // driven by the same onHover→activeDonutIndex below) already
          // shows in the middle of the donut, so hovering a slice still
          // surfaces the real numbers, just without the extra popup.
          tooltip: { enabled: false },
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
            // Same principle as the "Phân Bổ Danh Mục Nguy Cơ" donut chart:
            // background matches the hovered bar's OWN real color (the
            // exact same shade its bar is drawn with), text always white.
            backgroundColor: (ctx) => {
              const dp = ctx.tooltip?.dataPoints?.[0];
              return dp ? TLD_BAR_COLORS[dp.dataIndex % TLD_BAR_COLORS.length] : inverse;
            },
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
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
        {/* Card 1: Tổng IOC Tên miền Đang chặn — gradient-tinted "hero
            metric" card style (per reference), each card's own semantic
            accent color used for the tint/icon/badge/footer instead of a
            flat white background. No week-over-week % anywhere here — see
            the growth-trend card just below for why (no reliable historical
            snapshot to compute a real delta against). */}
        <div
          onClick={() => setSelectedMetricModal('total_blocked')}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group active-press"
          title="Nhấp để xem đồ thị và phân tích chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                IOCs / Tổng domain chặn
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-2.5 py-1 rounded-full flex items-center space-x-1 flex-shrink-0">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-5">
            <div className="text-[32px] leading-none font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {stats ? totalActiveDisplay : '—'}
            </div>
            <div className="flex items-center space-x-1.5 mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{stats ? 'Cập nhật trực tiếp từ CyberDNSTIP-DB' : 'Đang tải...'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: SOC Triage Queue */}
        <div
          onClick={() => setSelectedMetricModal('soc_queue')}
          className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-white dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group active-press"
          title="Nhấp để xem đồ thị và phân tích chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100/80 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hàng đợi duyệt SOC
              </span>
            </div>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/50 px-2.5 py-1 rounded-full flex items-center space-x-1 flex-shrink-0">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-5">
            <div className="text-[32px] leading-none font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {reviewCount} Tên miền
            </div>
            <div className="flex items-center space-x-1.5 mt-3 text-xs font-medium text-rose-700 dark:text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Chờ phê duyệt thủ công</span>
            </div>
          </div>
        </div>

        {/* Card 3: Nguồn cấp IOC & Phân loại Danh mục */}
        <div
          onClick={() => setSelectedMetricModal('sources_coverage')}
          className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group active-press"
          title="Nhấp để xem nguồn cấp và phân loại chi tiết"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100/80 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nguồn cấp & danh mục
              </span>
            </div>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 px-2.5 py-1 rounded-full flex items-center space-x-1 flex-shrink-0">
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="mt-5">
            <div className="text-[32px] leading-none font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {sources.length} Feeds / {categories.length} Nhóm
            </div>
            <div className="flex items-center space-x-1.5 mt-3 text-xs font-medium text-indigo-700 dark:text-indigo-400">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
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
              Tên miền độc hại mới phát hiện
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theo dõi số lượng tên miền mới được phát hiện trong 30 ngày gần nhất.
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
                  Phân bố tên miền theo trạng thái xử lý
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Thống kê số lượng tên miền theo từng trạng thái xử lý trên nền tảng CyberDNS TI
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
                  Phân bố tên miền theo danh mục (Category) bị chặn
                </h3>
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
                  Phân bố theo đuôi tên miền (TLD)
                </h3>
              </div>
            </div>

            {/* TLD Bar Chart — real counts per TLD (top 20 by blocked-domain
                count), one bar each, hover for exact count + share (was a
                stacked list of horizontal percentage bars). */}
            {tldBreakdownSource.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                {stats ? 'Chưa có dữ liệu TLD.' : 'Đang tải...'}
              </div>
            ) : (
              <div className="h-72">
                <canvas ref={tldCanvasRef} role="img" aria-label="Phân bố theo đuôi tên miền (TLD)" />
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
                Mỗi Category có một URL riêng và được cập nhật định kỳ
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

      {/* DNS Node status map — read-only copy of DnsNodesView.tsx's own
          card, Admin-only (see isAdmin prop's own note above). Placed last
          on the page per explicit request — infrastructure/reference info,
          not an operational metric that needs to be seen first, same
          reasoning as the DNS Blocklist URL card just above it. */}
      {isAdmin && (
        <Suspense
          fallback={
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs text-xs text-slate-400 dark:text-slate-500">
              Đang tải...
            </div>
          }
        >
          <DnsNodeStatusCard />
        </Suspense>
      )}
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
