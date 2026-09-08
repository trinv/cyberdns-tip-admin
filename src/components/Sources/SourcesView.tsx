import React, { useState, useEffect } from 'react';
import { FeedSource, CategoryInfo } from '../../types';
import {
  RefreshCw, Plus, CheckCircle2, AlertTriangle,
  Trash2, Pause, Play,
  LayoutGrid, List
} from 'lucide-react';
import { ConfirmModal, ConfirmTone } from '../Modals/ConfirmModal';

interface SourcesViewProps {
  sources: FeedSource[];
  categories: CategoryInfo[];
  onSyncAll: () => void;
  onSyncSingle: (id: string) => Promise<void> | void;
  onAddSource: (newSource: Partial<FeedSource>) => void;
  onPauseSource: (id: string) => Promise<void> | void;
  onResumeSource: (id: string) => Promise<void> | void;
  onDeleteSource: (id: string) => Promise<void> | void;
  // Jumps to Domain Explorer filtered to exactly the domains this source
  // currently backs (via domain_categories.feedSourceId) — mirrors
  // ReleasesView's onViewDomainsList (category-scoped) in App.tsx.
  onViewDomainsList: (feedSourceId: string) => void;
}

// Status badge variant — real semantic mapping shared by both the grid
// cards and the compact table below.
function statusBadgeVariant(src: FeedSource): string {
  if (src.isPaused) return 'text-bg-secondary';
  switch (src.status) {
    case 'healthy': return 'text-bg-success-subtle text-success';
    case 'warning': return 'text-bg-warning-subtle text-warning';
    case 'error': return 'text-bg-danger-subtle text-danger';
    case 'syncing': return 'text-bg-info-subtle text-info';
    default: return 'text-bg-secondary-subtle';
  }
}

export const SourcesView: React.FC<SourcesViewProps> = ({
  sources,
  categories,
  onSyncAll,
  onSyncSingle,
  onAddSource,
  onPauseSource,
  onResumeSource,
  onDeleteSource,
  onViewDomainsList,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  // Starts empty rather than a hardcoded guess like 'malware-phishing' — an
  // id that only happens to exist on some installs. `categories` comes from
  // the real DB and can differ (or not have loaded yet) on any given
  // deployment; the effect below picks a REAL category id once `categories`
  // is available, and re-anchors if the previously-picked one is deleted.
  const [newSourceCategory, setNewSourceCategory] = useState('');
  useEffect(() => {
    if (categories.length === 0) return;
    if (!categories.some((c) => c.id === newSourceCategory)) {
      setNewSourceCategory(categories[0].id);
    }
  }, [categories, newSourceCategory]);
  const [newSourceInterval, setNewSourceInterval] = useState('4 giờ');

  // Card view is fine for a handful of sources but doesn't scale — a
  // compact list is easier to scan/act on once there are many. Persisted
  // per-browser so it doesn't reset every time this tab is revisited.
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>(() => {
    try {
      return (localStorage.getItem('cyberdns_sources_view') as 'grid' | 'compact') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const handleSetViewMode = (mode: 'grid' | 'compact') => {
    setViewMode(mode);
    try {
      localStorage.setItem('cyberdns_sources_view', mode);
    } catch {
      // localStorage unavailable (e.g. private browsing) — the choice just
      // won't survive a reload, nothing else to do about it here.
    }
  };

  const getCategoryInfo = (categoryId: string) => categories.find((c) => c.id === categoryId);

  // Pending destructive/state-changing action awaiting confirmation via the
  // shared ConfirmModal — replaces window.confirm(), which renders as an
  // unstyled native browser prompt that can't match the app's theme.
  const [confirmAction, setConfirmAction] = useState<{
    source: FeedSource;
    kind: 'pause' | 'delete';
  } | null>(null);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setIsConfirmProcessing(true);
    try {
      if (confirmAction.kind === 'pause') {
        await onPauseSource(confirmAction.source.id);
      } else {
        await onDeleteSource(confirmAction.source.id);
      }
      setConfirmAction(null);
    } finally {
      setIsConfirmProcessing(false);
    }
  };

  // Sync IS whatever `src.status === 'syncing'` says, straight from the
  // server (see App.tsx's polling effect) — no local "isSyncing" flag here.
  const handleSyncClick = (id: string) => {
    onSyncSingle(id);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim() || !newSourceCategory) return;

    // domainCount/lastSync/status are intentionally NOT sent — a source
    // that has never been synced has no real value for any of them; the
    // backend starts it at 0 / null / 'idle' honestly (see createFeedSource).
    onAddSource({
      name: newSourceName,
      url: newSourceUrl,
      category: newSourceCategory,
      syncInterval: newSourceInterval,
      color: '#10b981',
      isCustom: true,
    });

    setIsAddModalOpen(false);
    setNewSourceName('');
    setNewSourceUrl('');
  };

  return (
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-bold mb-1">Quản lý nguồn cấp dữ liệu (Threat Intel Feeds)</h1>
            <p className="text-body-secondary small mb-0">
              Cấu hình định kỳ đồng bộ danh sách chặn từ các nguồn uy tín toàn cầu (Hagezi, OISD) và Crawler nội bộ CyberDNS.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Card / compact view toggle */}
            <div className="btn-group" role="group">
              <button
                onClick={() => handleSetViewMode('grid')}
                title="Dạng thẻ"
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => handleSetViewMode('compact')}
                title="Dạng rút gọn"
                className={`btn btn-sm ${viewMode === 'compact' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <List size={16} />
              </button>
            </div>

            <button onClick={() => setIsAddModalOpen(true)} className="btn btn-light btn-sm border d-flex align-items-center gap-2">
              <Plus size={16} />
              <span>Thêm nguồn mới</span>
            </button>

            <button onClick={onSyncAll} className="btn btn-primary btn-sm d-flex align-items-center gap-2">
              <RefreshCw size={16} />
              <span>Đồng bộ tất cả</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'compact' ? (
        <SourcesCompactList
          sources={sources}
          getCategoryInfo={getCategoryInfo}
          onSyncSingle={handleSyncClick}
          onResumeSource={onResumeSource}
          onPause={(src) => setConfirmAction({ source: src, kind: 'pause' })}
          onDelete={(src) => setConfirmAction({ source: src, kind: 'delete' })}
          onViewDomainsList={onViewDomainsList}
        />
      ) : (
        /* Sources Grid */
        <div className="row g-4">
          {sources.map((src) => (
            <div className="col-12 col-md-6 col-lg-4" key={src.id}>
              <div className="card h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <span className="rounded-circle flex-shrink-0" style={{ width: 12, height: 12, backgroundColor: src.color }} />
                      <h3 className="fs-6 fw-bold mb-0">{src.name}</h3>
                    </div>
                    <span className={`badge rounded-pill font-monospace text-uppercase ${statusBadgeVariant(src)}`}>
                      {src.isPaused ? 'paused' : src.status}
                    </span>
                  </div>

                  <div className="font-monospace small text-body-secondary text-truncate bg-body-tertiary p-2 rounded-2 border">
                    {src.url}
                  </div>

                  <div>
                    <span className="d-block text-body-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.6875rem' }}>Nhóm</span>
                    {(() => {
                      const cat = getCategoryInfo(src.category);
                      return cat ? (
                        <span className="d-inline-flex align-items-center gap-2 fw-semibold">
                          <span className="rounded-circle flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: cat.color }} />
                          <span className="text-truncate">{cat.name}</span>
                        </span>
                      ) : (
                        <span className="fst-italic text-body-secondary">Không rõ nhóm</span>
                      );
                    })()}
                  </div>

                  <div className="row g-2 font-monospace">
                    <div className="col-6">
                      <span className="d-block text-body-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.6875rem' }}>Số lượng tên miền</span>
                      <button
                        onClick={() => onViewDomainsList(src.id)}
                        title={`Xem danh sách tên miền đang thuộc nguồn "${src.name}"`}
                        className="btn btn-link p-0 fw-bold text-decoration-none"
                      >
                        {src.domainCount.toLocaleString('vi-VN')}
                      </button>
                    </div>
                    <div className="col-6">
                      <span className="d-block text-body-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.6875rem' }}>Chu kỳ</span>
                      <span className="fw-semibold">{src.syncInterval}</span>
                    </div>
                  </div>

                  {/* Real progress bar — percent + current phase, both driven
                      directly by the server-persisted syncProgress/syncPhase
                      (see runFeedSourceSyncJob). */}
                  {src.status === 'syncing' && (
                    <div>
                      <div className="d-flex align-items-center justify-content-between font-monospace small mb-1">
                        <span className="text-info text-truncate pe-2">{src.syncPhase || 'Đang đồng bộ...'}</span>
                        <span className="text-info fw-bold flex-shrink-0">{src.syncProgress ?? 0}%</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div className="progress-bar bg-info" style={{ width: `${src.syncProgress ?? 0}%` }} />
                      </div>
                    </div>
                  )}

                  {src.status === 'error' && src.errorMessage && (
                    <div className="alert alert-danger d-flex align-items-start gap-2 py-2 px-3 small mb-0">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
                      <span>{src.errorMessage}</span>
                    </div>
                  )}

                  {src.status === 'warning' && src.errorMessage && (
                    <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 small mb-0">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
                      <span>{src.errorMessage}</span>
                    </div>
                  )}

                  {src.status === 'healthy' && src.lastSyncMessage && (
                    <div className="alert alert-success d-flex align-items-start gap-2 py-2 px-3 small mb-0">
                      <CheckCircle2 size={16} className="flex-shrink-0 mt-1" />
                      <span>{src.lastSyncMessage}</span>
                    </div>
                  )}

                  {src.isPaused && (
                    <div className="alert alert-secondary d-flex align-items-start gap-2 py-2 px-3 small mb-0">
                      <Pause size={16} className="flex-shrink-0 mt-1" />
                      <span>Đã tạm dừng — mọi tên miền của nguồn này đã chuyển sang "Thôi chặn". Bấm "Tiếp tục" để đồng bộ lại và tự động chặn lại đúng những tên miền đó.</span>
                    </div>
                  )}
                </div>

                <div className="card-footer bg-body d-flex flex-column gap-2">
                  <span className="text-body-secondary small">
                    Lần đồng bộ: {src.lastSync ? src.lastSync : 'Chưa đồng bộ lần nào'}
                  </span>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    {src.isPaused ? (
                      <button onClick={() => onResumeSource(src.id)} className="btn btn-outline-success btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2">
                        <Play size={14} />
                        <span>Tiếp tục</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSyncClick(src.id)}
                        disabled={src.status === 'syncing'}
                        className="btn btn-outline-success btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                      >
                        <RefreshCw size={14} className={src.status === 'syncing' ? 'spin-slow' : ''} />
                        <span>{src.status === 'syncing' ? `Đang nạp... ${src.syncProgress ?? 0}%` : 'Đồng bộ'}</span>
                      </button>
                    )}

                    {!src.isPaused && (
                      <button
                        onClick={() => setConfirmAction({ source: src, kind: 'pause' })}
                        disabled={src.status === 'syncing'}
                        title="Tạm dừng nguồn"
                        className="btn btn-outline-secondary btn-sm flex-shrink-0"
                      >
                        <Pause size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => setConfirmAction({ source: src, kind: 'delete' })}
                      disabled={src.status === 'syncing'}
                      title="Xoá nguồn"
                      className="btn btn-outline-danger btn-sm flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Custom Feed Source — real Bootstrap modal markup,
          shown/hidden by React state directly (no Bootstrap JS needed). */}
      {isAddModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={handleAddSubmit}>
                  <div className="modal-header">
                    <h2 className="modal-title fs-6 fw-bold">Thêm nguồn Threat Feed mới</h2>
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-close" />
                  </div>
                  <div className="modal-body d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Tên nguồn</label>
                      <input
                        type="text"
                        required
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder="ví dụ: phishtank/verified-online"
                        className="form-control"
                      />
                    </div>

                    <div>
                      <label className="form-label small fw-bold">URL Feed (Raw txt/hosts)</label>
                      <input
                        type="url"
                        required
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="https://data.phishtank.com/data/online-valid.txt"
                        className="form-control font-monospace"
                      />
                    </div>

                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label small fw-bold">Nhóm mặc định</label>
                        <select
                          value={newSourceCategory}
                          onChange={(e) => setNewSourceCategory(e.target.value)}
                          className="form-select"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold">Chu kỳ đồng bộ</label>
                        <select
                          value={newSourceInterval}
                          onChange={(e) => setNewSourceInterval(e.target.value)}
                          className="form-select"
                        >
                          <option value="Cho đến khi bật đồng bộ">Cho đến khi bật đồng bộ (thủ công)</option>
                          <option value="1 giờ">1 giờ</option>
                          <option value="4 giờ">4 giờ</option>
                          <option value="12 giờ">12 giờ</option>
                          <option value="24 giờ">24 giờ</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-light border">Hủy</button>
                    <button type="submit" className="btn btn-primary">Lưu nguồn</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!confirmAction}
        tone={(confirmAction?.kind === 'delete' ? 'danger' : 'warning') as ConfirmTone}
        title={confirmAction?.kind === 'delete' ? 'Xoá vĩnh viễn nguồn?' : 'Tạm dừng nguồn?'}
        message={
          confirmAction?.kind === 'delete'
            ? `Xoá vĩnh viễn nguồn "${confirmAction.source.name}"? Mọi tên miền đang chặn nhờ nguồn này sẽ chuyển sang "Thôi chặn". Không thể hoàn tác.`
            : confirmAction
            ? `Tạm dừng nguồn "${confirmAction.source.name}"? Mọi tên miền đang chặn nhờ nguồn này sẽ chuyển sang "Thôi chặn" ngay lập tức.`
            : ''
        }
        confirmLabel={confirmAction?.kind === 'delete' ? 'Xoá vĩnh viễn' : 'Tạm dừng'}
        isProcessing={isConfirmProcessing}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

// Dense one-row-per-source alternative to the card grid above — same data,
// same actions, laid out to stay legible/scannable once there are many
// sources instead of scrolling through a wall of cards.
const SourcesCompactList: React.FC<{
  sources: FeedSource[];
  getCategoryInfo: (categoryId: string) => CategoryInfo | undefined;
  onSyncSingle: (id: string) => void;
  onResumeSource: (id: string) => Promise<void> | void;
  onPause: (src: FeedSource) => void;
  onDelete: (src: FeedSource) => void;
  onViewDomainsList: (feedSourceId: string) => void;
}> = ({ sources, getCategoryInfo, onSyncSingle, onResumeSource, onPause, onDelete, onViewDomainsList }) => {
  return (
    <div className="card">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0" style={{ minWidth: 760 }}>
          <thead>
            <tr className="small">
              <th>Nguồn</th>
              <th>Nhóm</th>
              <th className="text-end">Số lượng tên miền</th>
              <th>Chu kỳ</th>
              <th>Trạng thái</th>
              <th>Lần đồng bộ</th>
              <th className="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody className="small">
            {sources.map((src) => {
              const cat = getCategoryInfo(src.category);
              return (
                <tr key={src.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: src.color }} />
                      <span className="fw-bold text-truncate" style={{ maxWidth: 220 }} title={src.name}>{src.name}</span>
                    </div>
                  </td>
                  <td>
                    {cat ? (
                      <span className="d-inline-flex align-items-center gap-2">
                        <span className="rounded-circle flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: cat.color }} />
                        <span className="text-truncate" style={{ maxWidth: 140 }}>{cat.name}</span>
                      </span>
                    ) : (
                      <span className="fst-italic text-body-secondary">Không rõ</span>
                    )}
                  </td>
                  <td className="text-end fw-bold text-primary font-monospace">
                    <button onClick={() => onViewDomainsList(src.id)} title={`Xem danh sách tên miền đang thuộc nguồn "${src.name}"`} className="btn btn-link p-0 text-decoration-none">
                      {src.domainCount.toLocaleString('vi-VN')}
                    </button>
                  </td>
                  <td className="text-body-secondary text-nowrap">{src.syncInterval}</td>
                  <td>
                    <span className={`badge rounded-pill font-monospace text-uppercase ${statusBadgeVariant(src)}`}>
                      {src.isPaused ? 'paused' : src.status === 'syncing' ? `${src.syncProgress ?? 0}%` : src.status}
                    </span>
                  </td>
                  <td className="text-body-secondary text-nowrap">{src.lastSync ? src.lastSync : 'Chưa đồng bộ'}</td>
                  <td>
                    <div className="d-flex align-items-center justify-content-end gap-1">
                      {src.isPaused ? (
                        <button onClick={() => onResumeSource(src.id)} title="Tiếp tục" className="btn btn-outline-success btn-sm">
                          <Play size={14} />
                        </button>
                      ) : (
                        <button onClick={() => onSyncSingle(src.id)} disabled={src.status === 'syncing'} title="Đồng bộ" className="btn btn-outline-success btn-sm">
                          <RefreshCw size={14} className={src.status === 'syncing' ? 'spin-slow' : ''} />
                        </button>
                      )}
                      {!src.isPaused && (
                        <button onClick={() => onPause(src)} disabled={src.status === 'syncing'} title="Tạm dừng nguồn" className="btn btn-outline-secondary btn-sm">
                          <Pause size={14} />
                        </button>
                      )}
                      <button onClick={() => onDelete(src)} disabled={src.status === 'syncing'} title="Xoá nguồn" className="btn btn-outline-danger btn-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
