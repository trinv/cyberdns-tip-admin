import React from 'react';
import {
  X, Shield, AlertTriangle, Layers, ArrowUpRight,
  CheckCircle2, Clock,
  ExternalLink, PieChart, AlertOctagon
} from 'lucide-react';
import { FeedSource, CategoryInfo, DashboardStats, ReviewDomainItem } from '../../types';

export type MetricType = 'total_blocked' | 'soc_queue' | 'sources_coverage';

interface MetricDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: MetricType | null;
  onNavigateToTab: (tab: string) => void;
  sources: FeedSource[];
  categories: CategoryInfo[];
  stats: DashboardStats | null;
  reviewItems: ReviewDomainItem[];
}

// Severity band derived from review_queue's own real threatScore column
// (distinct from domains — see schema.ts: domains.threatScore was removed,
// never having been backed by a real scoring pipeline; review_queue's is a
// separate field still in use for pending items) — a real aggregation of
// stored data, not a fabricated P1/P2/P3 split.
function getSeverityBand(score: number): 'Critical' | 'High' | 'Medium' {
  if (score >= 0.9) return 'Critical';
  if (score >= 0.7) return 'High';
  return 'Medium';
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active (đang chặn)',
  grace_period: 'Ân hạn (Grace)',
  allowlist: 'Allowlist',
  unblocked: 'Đã thôi chặn',
  protected: 'Được bảo vệ',
};

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
  isOpen,
  onClose,
  metricType,
  onNavigateToTab,
  sources,
  categories,
  stats,
  reviewItems,
}) => {
  if (!isOpen || !metricType) return null;

  // Real severity breakdown of the pending review queue, computed from each
  // item's actual threatScore — not a fabricated P1/P2/P3 split.
  const severityCounts = { Critical: 0, High: 0, Medium: 0 } as Record<string, number>;
  for (const item of reviewItems) {
    severityCounts[getSeverityBand(item.threatScore ?? 0)]++;
  }

  const totalSourceDomains = sources.reduce((acc, s) => acc + (s.domainCount || 0), 0);
  const healthySources = sources.filter((s) => s.status === 'healthy').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            {metricType === 'total_blocked' && (
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
            )}
            {metricType === 'soc_queue' && (
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {metricType === 'sources_coverage' && (
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {metricType === 'total_blocked' && 'Chi Tiết: Tổng Domain Chặn (IOCs)'}
                {metricType === 'soc_queue' && 'Chi Tiết & Phân Tích: Hàng Đợi Duyệt SOC'}
                {metricType === 'sources_coverage' && 'Chi Tiết & Phân Tích: Nguồn Cấp Threat & Danh Mục'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {metricType === 'total_blocked' && `Phân tích ${(stats?.totalAll ?? 0).toLocaleString('vi-VN')} tên miền trong hệ thống, theo trạng thái xử lý thực tế`}
                {metricType === 'soc_queue' && `${reviewItems.length} tên miền đang chờ kiểm duyệt và cấp phát nhãn rủi ro`}
                {metricType === 'sources_coverage' && `${sources.length} nguồn feed & ${categories.length} nhóm danh mục`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-800 dark:text-slate-200 text-xs">

          {/* 1. TOP STATS ROW — every number here comes straight from
              GET /api/dashboard/stats or the props passed in; nothing is
              fabricated or estimated. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricType === 'total_blocked' && (
              stats ? (
                (['active', 'grace_period', 'allowlist', 'unblocked'] as const).map((statusKey) => {
                  const row = stats.statusBreakdown.find((s) => s.status === statusKey);
                  return (
                    <div key={statusKey} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs text-slate-400 font-bold uppercase">{STATUS_LABELS[statusKey]}</span>
                      <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                        {(row?.count ?? 0).toLocaleString('vi-VN')}
                      </div>
                      <span className="text-xs text-slate-400">{(row?.percent ?? 0).toFixed(1)}% tổng số</span>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-4 text-center py-4 text-slate-400">Đang tải dữ liệu từ CyberDNSTIP-DB...</div>
              )
            )}

            {metricType === 'soc_queue' && (
              <>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Chờ Xử Lý</span>
                  <div className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{reviewItems.length} Tên miền</div>
                  <span className="text-xs text-rose-600 font-semibold">Cần phân loại</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Critical (Threat ≥ 90%)</span>
                  <div className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{severityCounts.Critical}</div>
                  <span className="text-xs text-slate-400">Theo threat score thực</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">High (70–89%)</span>
                  <div className="text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{severityCounts.High}</div>
                  <span className="text-xs text-slate-400">Theo threat score thực</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Medium (&lt;70%)</span>
                  <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-0.5">{severityCounts.Medium}</div>
                  <span className="text-xs text-slate-400">Theo threat score thực</span>
                </div>
              </>
            )}

            {metricType === 'sources_coverage' && (
              <>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Nguồn Cấp Feed</span>
                  <div className="text-lg font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{sources.length}</div>
                  <span className="text-xs text-emerald-600 font-semibold">{healthySources}/{sources.length || 0} hoạt động tốt</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Nhóm Danh Mục</span>
                  <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-0.5">{categories.length}</div>
                  <span className="text-xs text-slate-400">Cấu hình phân loại</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Tổng IOC Từ Nguồn</span>
                  <div className="text-lg font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-0.5">{totalSourceDomains.toLocaleString('vi-VN')}</div>
                  <span className="text-xs text-slate-400">Cộng dồn domainCount mỗi nguồn</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Tổng Domain (DB)</span>
                  <div className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{(stats?.totalAll ?? 0).toLocaleString('vi-VN')}</div>
                  <span className="text-xs text-slate-400">Sau khi loại trùng theo danh mục</span>
                </div>
              </>
            )}
          </div>

          {/* 2. DETAILED BREAKDOWNS — all real */}
          {metricType === 'total_blocked' && (
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 font-sans flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Phân Bổ Theo Nhóm Danh Mục (domain đang active)</span>
              </h4>
              {!stats || stats.categoryBreakdown.length === 0 ? (
                <div className="text-center py-6 text-slate-400">Chưa có domain đang chặn nào.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {stats.categoryBreakdown.map((c) => {
                    const meta = categories.find((cat) => cat.id === c.category);
                    return (
                      <div key={c.category} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.color || '#64748b' }}></span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-200 font-sans truncate">{meta?.name || c.category}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{c.count.toLocaleString('vi-VN')} domain</div>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold font-mono text-slate-700 dark:text-slate-300 flex-shrink-0">{c.percent.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {metricType === 'soc_queue' && (
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Danh Sách Đang Chờ Duyệt (mới nhất trước)</span>
              </h4>
              {reviewItems.length === 0 ? (
                <div className="text-center py-6 text-slate-400">Hàng đợi duyệt hiện đang trống.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {reviewItems.slice(0, 20).map((item) => {
                    const band = getSeverityBand(item.threatScore ?? 0);
                    const bandClass =
                      band === 'Critical' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
                      band === 'High' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                    return (
                      <div key={item.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">{item.domain}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">Đề xuất: {item.proposedCategory} · Nguồn: {item.reportedBy}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${bandClass}`}>
                          {((item.threatScore ?? 0) * 100).toFixed(0)}% ({band})
                        </span>
                      </div>
                    );
                  })}
                  {reviewItems.length > 20 && (
                    <div className="text-center text-xs text-slate-400 pt-1">... và còn {reviewItems.length - 20} mục nữa</div>
                  )}
                </div>
              )}
            </div>
          )}

          {metricType === 'sources_coverage' && (
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Danh Sách Nguồn Cung Cấp Dữ Liệu Tình Báo Mối Đe Dọa (Threat Feeds)</span>
              </h4>

              {sources.length === 0 ? (
                <div className="text-center py-6 text-slate-400">Chưa có nguồn feed nào được cấu hình.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sources.map((src) => (
                    <div key={src.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: src.color }}></span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{src.name}</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase flex-shrink-0">{src.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 font-mono text-xs">
                        <span className="text-slate-500">Quy mô IOCs:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{src.domainCount.toLocaleString('vi-VN')}</strong>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
                        <span>Đồng bộ gần nhất:</span>
                        <span>{src.lastSync}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Direct Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dữ liệu tổng hợp trực tiếp từ CyberDNSTIP-DB
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {metricType === 'total_blocked' && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToTab('domain');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <span>Mở Domain Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            {metricType === 'soc_queue' && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToTab('review');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <span>Đi Tới Hàng Đợi Duyệt (Review Queue)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            {metricType === 'sources_coverage' && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToTab('sources');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <span>Quản Lý Feed Sources</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
