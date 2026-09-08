import React, { useState } from 'react';
import { ReviewDomainItem, CategoryInfo } from '../../types';
import { CheckCircle2, Check, CheckCheck } from 'lucide-react';

interface ReviewQueueViewProps {
  items: ReviewDomainItem[];
  categories: CategoryInfo[];
  onApprove: (id: string, category: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  items,
  categories,
  onApprove,
  onReject,
  onApproveAll,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredItems = items.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.proposedCategory === selectedFilter;
  });

  return (
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-bold mb-1 d-flex align-items-center gap-2">
              <span>Hàng đợi kiểm duyệt (Review Queue)</span>
              <span className="badge rounded-pill text-bg-danger-subtle text-danger">{items.length} domain cần xử lý</span>
            </h1>
            <p className="text-body-secondary small mb-0">
              Các tên miền có dấu hiệu độc hại / cờ bạc do AI Crawler và hệ thống giám sát bất thường DNS phát hiện tự động.
            </p>
          </div>

          {items.length > 0 && (
            <button onClick={onApproveAll} className="btn btn-primary d-flex align-items-center gap-2">
              <CheckCheck size={16} />
              <span>Duyệt chặn toàn bộ ({items.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>Lọc theo:</span>
        <button
          onClick={() => setSelectedFilter('all')}
          className={`btn btn-sm ${selectedFilter === 'all' ? 'btn-primary' : 'btn-light border'}`}
        >
          Tất cả ({items.length})
        </button>
        {categories.map((c) => {
          const count = items.filter((i) => i.proposedCategory === c.id).length;
          if (count === 0) return null;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedFilter(c.id)}
              className={`btn btn-sm ${selectedFilter === c.id ? 'btn-primary' : 'btn-light border'}`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Review Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <CheckCircle2 size={48} className="text-success mx-auto mb-2" />
            <p className="fw-bold fs-6 mb-1">Hàng đợi trống</p>
            <p className="text-body-secondary small mb-0">Tất cả tên miền nghi vấn đã được duyệt hoặc xử lý an toàn!</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filteredItems.map((item) => (
            <div className="col-12 col-md-6" key={item.id}>
              <div className="card h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex align-items-start justify-content-between">
                    <div>
                      <div className="font-monospace fw-bold d-flex align-items-center gap-2">
                        <span>{item.domain}</span>
                        <span className="badge rounded-pill" style={{ backgroundColor: 'var(--bs-purple-bg-subtle, #f3ecfd)', color: 'var(--bs-purple, #6f42c1)' }}>
                          {item.proposedCategory}
                        </span>
                      </div>
                      <div className="text-body-secondary font-monospace mt-1" style={{ fontSize: '0.75rem' }}>
                        Phát hiện: {item.createdAt} · {item.reportedBy}
                      </div>
                    </div>

                    <div className="text-end font-monospace flex-shrink-0">
                      <div className="fw-bold text-danger" style={{ fontSize: '0.75rem' }}>Threat: {(item.threatScore * 100).toFixed(0)}%</div>
                      <div className="text-body-secondary fw-semibold mt-1" style={{ fontSize: '0.75rem' }}>{item.queryCount24h.toLocaleString('vi-VN')} req/24h</div>
                    </div>
                  </div>

                  {/* Reason box */}
                  <div className="bg-body-tertiary border rounded-3 p-3">
                    <div className="small">
                      <span className="text-body-secondary fw-bold">Lý do: </span>
                      {item.reason}
                    </div>
                    <div className="font-monospace text-success fw-semibold mt-1 small">{item.evidenceNotes}</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top">
                    <button onClick={() => onReject(item.id)} className="btn btn-light btn-sm border">Từ chối (R)</button>
                    <button onClick={() => onApprove(item.id, item.proposedCategory)} className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                      <Check size={14} />
                      <span>Duyệt chặn (A)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
