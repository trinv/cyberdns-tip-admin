import React, { useState, useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, Activity, Globe, Database,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  TrendingUp, Layers, RefreshCw, BarChart3, Download,
  Radio, PieChart as PieIcon, ChevronRight, ExternalLink,
  Shield, Server, Eye, FileText, Check, MoreVertical,
  Zap, Lock, AlertOctagon, Terminal, Radar, Filter,
  Crosshair, Flame, Share2, Search, ArrowRight, PlayCircle
} from 'lucide-react';
import { FeedSource, CategoryInfo, DashboardStats, ReviewDomainItem } from '../../types';
import { MetricDetailModal, MetricType } from './MetricDetailModal';

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
  unreleasedCount?: number;
  onOpenDiff?: () => void;
  onOpenRelease?: () => void;
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
  unreleasedCount,
  onOpenDiff,
  onOpenRelease,
}) => {
  const reviewCount = reviewItems.length;
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedMetricModal, setSelectedMetricModal] = useState<MetricType | null>(null);

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

  // Processing-status breakdown (active / grace_period / allowlist /
  // unblocked / protected) — real counts across ALL domains, not just
  // active ones, replacing what used to be a fabricated QPS/telemetry chart
  // with no backing data pipeline.
  const STATUS_LABELS: Record<string, string> = {
    active: 'Đang chặn',
    grace_period: 'Trong ân hạn',
    allowlist: 'Allowlist',
    unblocked: 'Đã thôi chặn',
    protected: 'Được bảo vệ',
  };
  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-500',
    grace_period: 'bg-amber-500',
    allowlist: 'bg-blue-500',
    unblocked: 'bg-slate-400',
    protected: 'bg-slate-300',
  };
  const statusBreakdown = stats?.statusBreakdown || [];

  // Calculate Donut Slices
  const totalCategoryVal = categoryBreakdownSource.reduce((acc, c) => acc + c.value, 0);
  let currentAngle = 0;
  const donutSlices = categoryBreakdownSource.map((cat) => {
    const angle = totalCategoryVal > 0 ? (cat.value / totalCategoryVal) * 360 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;
    return { ...cat, startAngle, endAngle, angle };
  });

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

  // ASN breakdown: real counts grouped from the `asn` column, which already
  // stores "AS#### ORG NAME" as one string in this schema — no separate
  // country field exists, so it's simply not shown for live data.
  const asnBreakdownSource = stats?.asnBreakdown || [];

  // Severity band derived from the domain's real threatScore column — an
  // honest transformation of stored data, unlike the specific attack-type /
  // victim / query-hit-rate fields the old mock rows fabricated (those need
  // a classification + telemetry pipeline this system doesn't have).
  const getThreatBand = (score: number) => {
    if (score >= 0.9) return { label: 'Critical', className: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' };
    if (score >= 0.7) return { label: 'High', className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
    return { label: 'Medium', className: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
  };

  const recentHighThreatDomains = stats?.recentHighThreat || [];

  const handleTriggerEdgeSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto h-full p-4 sm:p-6 transition-colors">
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Banner: Real-time SOC Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Bảng Giám Sát Đe Dọa DNS SOC (Threat Intelligence Operations)
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                  ACTIVE MONITORING
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Hệ thống quản lý danh sách chặn DNS · Đồng bộ từ nguồn feed threat intel và nhập liệu thủ công
              </p>
            </div>
          </div>
        </div>

        {/* Dedicated Scientific Cluster: Cụm Điều Phối & Phát Hành Edge DNS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left Compartment: Edge Cluster Status, Release state & Metadata */}
            <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/80 dark:to-teal-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    ĐIỀU PHỐI ĐỒNG BỘ &amp; PHÁT HÀNH EDGE DNS
                  </span>
                  {unreleasedCount && unreleasedCount > 0 ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>{unreleasedCount} thay đổi chờ phát hành</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Edge Anycast đã đồng bộ toàn mạng</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Compartment: Scientific Action Cluster */}
            <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
              {/* Button 1: Trigger Edge DNS Sync */}
              <button
                onClick={handleTriggerEdgeSync}
                disabled={isSyncing}
                title="Kích hoạt phát tán chính sách RPZ tới các Edge Resolver"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50 active-press"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Edge DNS'}</span>
              </button>

              {/* Button 2: Inspect Diff */}
              {unreleasedCount && unreleasedCount > 0 && onOpenDiff && (
                <button
                  onClick={onOpenDiff}
                  title="Kiểm tra chi tiết danh sách thay đổi và phân loại rủi ro"
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer active-press"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>So sánh Diff ({unreleasedCount})</span>
                </button>
              )}

              {/* Button 3: Release Pipeline */}
              {onOpenRelease && (
                <button
                  onClick={onOpenRelease}
                  title="Chuyển đến màn hình phát hành chính sách bảo vệ"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer active-press"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Phát hành Staging / Live</span>
                </button>
              )}
            </div>
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
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {stats ? totalActiveDisplay : '—'}
            </div>
            <div className="flex items-center space-x-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{stats ? 'Cập nhật trực tiếp từ CyberDNSTIP-DB' : 'Đang tải...'}</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">· Nhấp để xem đồ thị</span>
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
            <div className="text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {reviewCount} Tên miền
            </div>
            <div className="flex items-center space-x-1.5 mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4" />
              <span>Chờ phê duyệt thủ công</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">· Nhấp để duyệt</span>
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
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {sources.length} Feeds / {categories.length} Nhóm
            </div>
            <div className="flex items-center space-x-1.5 mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
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
            {/* SVG Donut Chart */}
            <div className="relative w-full h-64 flex items-center justify-center my-3">
              <svg viewBox="0 0 200 200" className="w-56 h-56 overflow-visible">
                {donutSlices.map((slice, i) => {
                  const outerR = 82;
                  const innerR = 56;
                  const cx = 100;
                  const cy = 100;

                  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
                  const startRad = toRad(slice.startAngle);
                  const endRad = toRad(slice.endAngle);

                  const x1 = cx + outerR * Math.cos(startRad);
                  const y1 = cy + outerR * Math.sin(startRad);
                  const x2 = cx + outerR * Math.cos(endRad);
                  const y2 = cy + outerR * Math.sin(endRad);

                  const x3 = cx + innerR * Math.cos(endRad);
                  const y3 = cy + innerR * Math.sin(endRad);
                  const x4 = cx + innerR * Math.cos(startRad);
                  const y4 = cy + innerR * Math.sin(startRad);

                  const largeArc = slice.angle > 180 ? 1 : 0;
                  const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

                  const isHovered = (activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0) === i;

                  return (
                    <path
                      key={slice.id}
                      d={pathData}
                      fill={slice.color}
                      className="transition-all duration-200 cursor-pointer"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      style={{
                        color: 'var(--bg-card, #ffffff)',
                        opacity: isHovered ? 1 : 0.9,
                        filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' : 'none',
                        transformOrigin: '100px 100px',
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                      }}
                      onMouseEnter={() => setActiveDonutIndex(i)}
                    />
                  );
                })}
              </svg>

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

              {/* Floating segment tooltip pill */}
              {(() => {
                const activeItem = donutSlices[activeDonutIndex !== null && activeDonutIndex < donutSlices.length ? activeDonutIndex : 0];
                const midAngle = (activeItem.startAngle + activeItem.endAngle) / 2;
                const midRad = ((midAngle - 90) * Math.PI) / 180;
                const px = 100 + 72 * Math.cos(midRad);
                const py = 100 + 72 * Math.sin(midRad);

                return (
                  <div 
                    className="absolute z-10 px-2.5 py-1 rounded-md text-xs font-bold font-mono text-white shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{
                      left: `${(px / 200) * 100}%`,
                      top: `${(py / 200) * 100}%`,
                      backgroundColor: activeItem.color,
                    }}
                  >
                    {activeItem.shortName.split('/')[0].trim()}: {activeItem.percent}
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

            {/* ASNs mini table */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                TOP AUTONOMOUS SYSTEMS
              </span>
              {asnBreakdownSource.length === 0 ? (
                <div className="py-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {stats ? 'Chưa có dữ liệu ASN.' : 'Đang tải...'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {asnBreakdownSource.map((a, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold truncate" title={a.asn}>
                        {a.asn}
                      </div>
                      <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
                        {a.count.toLocaleString('vi-VN')} domain
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                Tên Miền Rủi Ro Cao Đang Chặn
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Xếp hạng theo threat score, lấy trực tiếp từ CyberDNSTIP-DB (không phải luồng thời gian thực — cần pipeline sensor DNS để có mốc thời gian phát hiện chính xác)
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

        {/* High-threat Domains Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">TÊN MIỀN</th>
                <th className="px-4 py-3">NHÓM DANH MỤC</th>
                <th className="px-4 py-3">NGUỒN PHÁT HIỆN</th>
                <th className="px-4 py-3">THREAT SCORE</th>
                <th className="px-4 py-3">TRẠNG THÁI</th>
                <th className="px-4 py-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {recentHighThreatDomains.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    {stats ? 'Chưa có tên miền nào trong danh sách chặn.' : 'Đang tải dữ liệu từ CyberDNSTIP-DB...'}
                  </td>
                </tr>
              )}
              {recentHighThreatDomains.map((d) => {
                const band = getThreatBand(d.threatScore ?? 0);
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

                    <td className="px-4 py-3 font-mono">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold border ${band.className}`}>
                        {((d.threatScore ?? 0) * 100).toFixed(1)}% ({band.label})
                      </span>
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
