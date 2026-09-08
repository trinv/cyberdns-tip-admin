import React from 'react';
import {
  Shield, AlertTriangle, Layers,
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
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="d-flex align-items-center gap-3">
                {metricType === 'total_blocked' && (
                  <div className="kpi-icon bg-success-subtle text-success">
                    <Shield size={18} />
                  </div>
                )}
                {metricType === 'soc_queue' && (
                  <div className="kpi-icon bg-danger-subtle text-danger">
                    <AlertTriangle size={18} />
                  </div>
                )}
                {metricType === 'sources_coverage' && (
                  <div className="kpi-icon bg-info-subtle text-info">
                    <Layers size={18} />
                  </div>
                )}

                <div>
                  <h2 className="modal-title fs-6 fw-bold">
                    {metricType === 'total_blocked' && 'Chi Tiết: Tổng Domain Chặn (IOCs)'}
                    {metricType === 'soc_queue' && 'Chi Tiết & Phân Tích: Hàng Đợi Duyệt SOC'}
                    {metricType === 'sources_coverage' && 'Chi Tiết & Phân Tích: Nguồn Cấp Threat & Danh Mục'}
                  </h2>
                  <p className="text-body-secondary small mb-0 mt-1">
                    {metricType === 'total_blocked' && `Phân tích ${(stats?.totalAll ?? 0).toLocaleString('vi-VN')} tên miền trong hệ thống, theo trạng thái xử lý thực tế`}
                    {metricType === 'soc_queue' && `${reviewItems.length} tên miền đang chờ kiểm duyệt và cấp phát nhãn rủi ro`}
                    {metricType === 'sources_coverage' && `${sources.length} nguồn feed & ${categories.length} nhóm danh mục`}
                  </p>
                </div>
              </div>

              <button onClick={onClose} className="btn-close" />
            </div>

            {/* Modal Body */}
            <div className="modal-body d-flex flex-column gap-4">
              {/* 1. TOP STATS ROW — every number here comes straight from
                  GET /api/dashboard/stats or the props passed in; nothing is
                  fabricated or estimated. */}
              <div className="row g-2">
                {metricType === 'total_blocked' && (
                  stats ? (
                    (['active', 'allowlist', 'unblocked'] as const).map((statusKey) => {
                      const row = stats.statusBreakdown.find((s) => s.status === statusKey);
                      return (
                        <div className="col-6 col-sm-4" key={statusKey}>
                          <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                            <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>{STATUS_LABELS[statusKey]}</span>
                            <div className="fs-5 fw-bold font-monospace mt-1">{(row?.count ?? 0).toLocaleString('vi-VN')}</div>
                            <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>{(row?.percent ?? 0).toFixed(1)}% tổng số</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-12 text-center py-4 text-body-secondary">Đang tải dữ liệu từ CyberDNSTIP-DB...</div>
                  )
                )}

                {metricType === 'soc_queue' && (
                  <>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Chờ xử lý</span>
                        <div className="fs-5 fw-bold font-monospace text-danger mt-1">{reviewItems.length} Tên miền</div>
                        <span className="text-danger fw-semibold" style={{ fontSize: '0.75rem' }}>Cần phân loại</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Critical (≥ 90%)</span>
                        <div className="fs-5 fw-bold font-monospace text-danger mt-1">{severityCounts.Critical}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Theo threat score thực</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>High (70–89%)</span>
                        <div className="fs-5 fw-bold font-monospace text-warning-emphasis mt-1">{severityCounts.High}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Theo threat score thực</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Medium (&lt;70%)</span>
                        <div className="fs-5 fw-bold font-monospace mt-1">{severityCounts.Medium}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Theo threat score thực</span>
                      </div>
                    </div>
                  </>
                )}

                {metricType === 'sources_coverage' && (
                  <>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Nguồn cấp feed</span>
                        <div className="fs-5 fw-bold font-monospace text-info mt-1">{sources.length}</div>
                        <span className="text-success fw-semibold" style={{ fontSize: '0.75rem' }}>{healthySources}/{sources.length || 0} hoạt động tốt</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Nhóm danh mục</span>
                        <div className="fs-5 fw-bold font-monospace mt-1">{categories.length}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Cấu hình phân loại</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Tổng IOC từ nguồn</span>
                        <div className="fs-5 fw-bold font-monospace mt-1">{totalSourceDomains.toLocaleString('vi-VN')}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Cộng dồn domainCount mỗi nguồn</span>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="border rounded-3 p-2 bg-body-tertiary h-100">
                        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem' }}>Tổng domain (DB)</span>
                        <div className="fs-5 fw-bold font-monospace text-success mt-1">{(stats?.totalAll ?? 0).toLocaleString('vi-VN')}</div>
                        <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Sau khi loại trùng theo danh mục</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 2. DETAILED BREAKDOWNS — all real */}
              {metricType === 'total_blocked' && (
                <div className="border rounded-3 p-3">
                  <h3 className="fs-6 fw-bold mb-2 d-flex align-items-center gap-2">
                    <PieChart size={16} className="text-success" />
                    <span>Phân Bổ Theo Nhóm Danh Mục (domain đang active)</span>
                  </h3>
                  {!stats || stats.categoryBreakdown.length === 0 ? (
                    <div className="text-center py-4 text-body-secondary">Chưa có domain đang chặn nào.</div>
                  ) : (
                    <div className="row g-2">
                      {stats.categoryBreakdown.map((c) => {
                        const meta = categories.find((cat) => cat.id === c.category);
                        return (
                          <div className="col-12 col-sm-6" key={c.category}>
                            <div className="bg-body-tertiary border rounded-3 p-2 d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2 min-w-0">
                                <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: meta?.color || '#64748b' }} />
                                <div className="min-w-0">
                                  <div className="fw-bold text-truncate small">{meta?.name || c.category}</div>
                                  <div className="text-body-secondary font-monospace mt-1" style={{ fontSize: '0.75rem' }}>{c.count.toLocaleString('vi-VN')} domain</div>
                                </div>
                              </div>
                              <span className="fw-bold font-monospace flex-shrink-0">{c.percent.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {metricType === 'soc_queue' && (
                <div className="bg-body-tertiary border rounded-3 p-3">
                  <h3 className="fs-6 fw-bold mb-2 d-flex align-items-center gap-2">
                    <AlertOctagon size={16} className="text-danger" />
                    <span>Danh Sách Đang Chờ Duyệt (mới nhất trước)</span>
                  </h3>
                  {reviewItems.length === 0 ? (
                    <div className="text-center py-4 text-body-secondary">Hàng đợi duyệt hiện đang trống.</div>
                  ) : (
                    <div className="d-flex flex-column gap-2" style={{ maxHeight: 256, overflowY: 'auto' }}>
                      {reviewItems.slice(0, 20).map((item) => {
                        const band = getSeverityBand(item.threatScore ?? 0);
                        const badgeClass =
                          band === 'Critical' ? 'text-bg-danger-subtle text-danger' :
                          band === 'High' ? 'text-bg-warning-subtle text-warning-emphasis' :
                          'text-bg-secondary-subtle';
                        return (
                          <div key={item.id} className="bg-body border rounded-3 p-2 d-flex align-items-center justify-content-between gap-2">
                            <div className="min-w-0">
                              <div className="font-monospace fw-bold text-truncate">{item.domain}</div>
                              <div className="text-body-secondary small">Đề xuất: {item.proposedCategory} · Nguồn: {item.reportedBy}</div>
                            </div>
                            <span className={`badge flex-shrink-0 ${badgeClass}`}>{((item.threatScore ?? 0) * 100).toFixed(0)}% ({band})</span>
                          </div>
                        );
                      })}
                      {reviewItems.length > 20 && (
                        <div className="text-center text-body-secondary small pt-1">... và còn {reviewItems.length - 20} mục nữa</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {metricType === 'sources_coverage' && (
                <div className="bg-body-tertiary border rounded-3 p-3">
                  <h3 className="fs-6 fw-bold mb-2 d-flex align-items-center gap-2">
                    <Layers size={16} className="text-info" />
                    <span>Danh Sách Nguồn Cung Cấp Dữ Liệu Tình Báo Mối Đe Dọa (Threat Feeds)</span>
                  </h3>

                  {sources.length === 0 ? (
                    <div className="text-center py-4 text-body-secondary">Chưa có nguồn feed nào được cấu hình.</div>
                  ) : (
                    <div className="row g-2">
                      {sources.map((src) => (
                        <div className="col-12 col-sm-6" key={src.id}>
                          <div className="bg-body border rounded-3 p-2">
                            <div className="d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2 min-w-0">
                                <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: src.color }} />
                                <span className="fw-bold text-truncate small">{src.name}</span>
                              </div>
                              <span className="text-success text-uppercase fw-bold flex-shrink-0" style={{ fontSize: '0.6875rem' }}>{src.status}</span>
                            </div>
                            <div className="d-flex align-items-center justify-content-between mt-2 font-monospace small">
                              <span className="text-body-secondary">Quy mô IOCs:</span>
                              <strong>{src.domainCount.toLocaleString('vi-VN')}</strong>
                            </div>
                            <div className="d-flex align-items-center justify-content-between mt-1 text-body-secondary small">
                              <span>Đồng bộ gần nhất:</span>
                              <span>{src.lastSync}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer with Direct Actions */}
            <div className="modal-footer d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="text-body-secondary small">Dữ liệu tổng hợp trực tiếp từ CyberDNSTIP-DB</div>

              <div className="d-flex align-items-center gap-2">
                <button onClick={onClose} className="btn btn-light border">Đóng</button>

                {metricType === 'total_blocked' && (
                  <button
                    onClick={() => { onClose(); onNavigateToTab('domain'); }}
                    className="btn btn-primary d-flex align-items-center gap-2"
                  >
                    <span>Mở Domain Explorer</span>
                    <ExternalLink size={14} />
                  </button>
                )}

                {metricType === 'soc_queue' && (
                  <button
                    onClick={() => { onClose(); onNavigateToTab('review'); }}
                    className="btn btn-danger d-flex align-items-center gap-2"
                  >
                    <span>Đi Tới Hàng Đợi Duyệt (Review Queue)</span>
                    <ExternalLink size={14} />
                  </button>
                )}

                {metricType === 'sources_coverage' && (
                  <button
                    onClick={() => { onClose(); onNavigateToTab('sources'); }}
                    className="btn btn-info d-flex align-items-center gap-2"
                  >
                    <span>Quản Lý Feed Sources</span>
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
