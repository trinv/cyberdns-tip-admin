import React, { useState, useEffect } from 'react';
import { CategoryInfo } from '../../types';
import {
  Upload, FileText, Globe, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';

interface ImportViewProps {
  categories: CategoryInfo[];
  onImportDomains: (domains: string[], category: string, reason: string) => void;
}

export const ImportView: React.FC<ImportViewProps> = ({ categories, onImportDomains }) => {
  const [importTab, setImportTab] = useState<'text' | 'file' | 'url'>('text');
  // Starts empty — a pre-filled example list here would risk being bulk-
  // imported for real if a user submits without reading it first.
  const [rawText, setRawText] = useState('');
  // Starts empty rather than a hardcoded guess like 'gambling' — see the
  // same fix in SourcesView.tsx for why: an id that doesn't actually exist
  // in this install's categories table passes client-side validation fine
  // but fails at the DB's foreign key the moment it's actually used.
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  useEffect(() => {
    if (categories.length === 0) return;
    if (!categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);
  const [reason, setReason] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Parse raw text into structured cleaned domains
  const parseDomains = (text: string) => {
    const lines = text.split('\n');
    const validDomains: string[] = [];
    const protectedDomains: string[] = [];
    const invalidLines: string[] = [];

    const protectedList = ['chinhphu.vn', 'gov.vn', 'edu.vn', 'vietcombank.com.vn', 'napas.com.vn'];

    lines.forEach((line) => {
      let cleaned = line.trim();
      if (!cleaned || cleaned.startsWith('#')) return;

      // Strip 0.0.0.0 or 127.0.0.1
      cleaned = cleaned.replace(/^(0\.0\.0\.0|127\.0\.0\.1)\s+/, '');
      // Strip protocols
      cleaned = cleaned.replace(/^(https?:\/\/)/i, '');
      // Strip path / query
      cleaned = cleaned.split('/')[0];
      cleaned = cleaned.split('?')[0];
      cleaned = cleaned.split('#')[0];
      // Strip port
      cleaned = cleaned.split(':')[0];
      // Strip wildcard prefix *.
      cleaned = cleaned.replace(/^\*\./, '');
      cleaned = cleaned.toLowerCase().trim();

      // Check domain format
      const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
      if (domainRegex.test(cleaned)) {
        const isProt = protectedList.some((p) => cleaned.endsWith(p));
        if (isProt) {
          protectedDomains.push(cleaned);
        } else {
          validDomains.push(cleaned);
        }
      } else {
        invalidLines.push(line);
      }
    });

    const uniqueValid = Array.from(new Set(validDomains));
    return { uniqueValid, protectedDomains, invalidLines };
  };

  const parsed = parseDomains(rawText);

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed.uniqueValid.length === 0 || !reason.trim() || !selectedCategory) return;

    setIsParsing(true);
    setTimeout(() => {
      onImportDomains(parsed.uniqueValid, selectedCategory, reason);
      setIsParsing(false);
      setSuccessMessage(`Đã gửi ${parsed.uniqueValid.length} domain vào Hàng đợi duyệt (nhóm ${selectedCategory}) — chờ xác nhận trước khi chặn.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 500);
  };

  return (
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body">
          <h1 className="fs-5 fw-bold mb-1">Nhập danh sách tên miền (Batch Import &amp; Smart Parser)</h1>
          <p className="text-body-secondary small mb-0">
            Hỗ trợ phân tích cú pháp hosts, URL feeds, wildcard regex và tự động bảo vệ các tên miền chính thống (Protected Domains).
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success d-flex align-items-center gap-3 fw-bold mb-0">
          <CheckCircle2 size={20} className="flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Input Form */}
        <div className="col-12 col-lg-7">
          <div className="card h-100">
            <div className="card-body d-flex flex-column gap-3">
              {/* Method Tabs */}
              <ul className="nav nav-pills gap-2 border-bottom pb-3">
                <li className="nav-item">
                  <button
                    type="button"
                    onClick={() => setImportTab('text')}
                    className={`nav-link d-flex align-items-center gap-2 ${importTab === 'text' ? 'active' : ''}`}
                  >
                    <FileText size={16} />
                    <span>Dán văn bản / Hosts</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    onClick={() => setImportTab('file')}
                    className={`nav-link d-flex align-items-center gap-2 ${importTab === 'file' ? 'active' : ''}`}
                  >
                    <Upload size={16} />
                    <span>Tải file .txt / .csv</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    onClick={() => setImportTab('url')}
                    className={`nav-link d-flex align-items-center gap-2 ${importTab === 'url' ? 'active' : ''}`}
                  >
                    <Globe size={16} />
                    <span>Từ URL Threat Feed</span>
                  </button>
                </li>
              </ul>

              <form onSubmit={handleImportSubmit} className="d-flex flex-column gap-3">
                {importTab === 'text' && (
                  <div>
                    <label className="form-label small fw-bold">
                      Dữ liệu đầu vào (tự động lọc URL, IP, wildcard, comments)
                    </label>
                    <textarea
                      rows={8}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Dán danh sách tên miền vào đây (mỗi dòng một tên miền)..."
                      className="form-control font-monospace"
                    />
                  </div>
                )}

                {importTab === 'file' && (
                  <div className="border border-2 rounded-3 p-5 text-center" style={{ borderStyle: 'dashed', cursor: 'pointer' }}>
                    <Upload size={40} className="text-primary mx-auto mb-2" />
                    <p className="fw-bold mb-1">Kéo thả file vào đây hoặc bấm để chọn file</p>
                    <p className="text-body-secondary small mb-0">Hỗ trợ định dạng .txt, .csv, AdGuard, Pi-hole blocklist</p>
                  </div>
                )}

                {importTab === 'url' && (
                  <div>
                    <label className="form-label small fw-bold">URL nguồn feed threat intel</label>
                    <div className="input-group">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/threat-feed.txt"
                        className="form-control font-monospace"
                      />
                      <button type="button" className="btn btn-primary">Tải về</button>
                    </div>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold">
                      Nhóm chặn áp dụng <span className="text-primary">*</span>
                    </label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="form-select">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.count.toLocaleString('vi-VN')} domain)</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold">Trạng thái khởi tạo</label>
                    <select className="form-select" disabled>
                      <option>Chờ duyệt (Hàng đợi duyệt)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label small fw-bold">
                    Lý do nhập <span className="text-danger">*</span> (bắt buộc kiểm toán)
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập mục đích và nguồn gốc đợt import này..."
                    className="form-control"
                  />
                </div>

                <div className="d-flex justify-content-end pt-2">
                  <button
                    type="submit"
                    disabled={parsed.uniqueValid.length === 0 || !reason.trim() || isParsing}
                    className="btn btn-primary d-flex align-items-center gap-2"
                  >
                    {isParsing ? (
                      <span>Đang phân tích &amp; nạp...</span>
                    ) : (
                      <>
                        <span>Nạp {parsed.uniqueValid.length} domain vào staging</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Parser Validation & Preview */}
        <div className="col-12 col-lg-5">
          <div className="card h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                Kết quả phân tích tự động
              </div>

              <div className="row g-2 text-center font-monospace">
                <div className="col-4">
                  <div className="rounded-3 border p-2 bg-success-subtle">
                    <div className="fs-5 fw-bold text-success">{parsed.uniqueValid.length}</div>
                    <div className="text-success fw-bold text-uppercase mt-1" style={{ fontSize: '0.6875rem' }}>Hợp lệ</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="rounded-3 border p-2 bg-warning-subtle">
                    <div className="fs-5 fw-bold text-warning-emphasis">{parsed.protectedDomains.length}</div>
                    <div className="text-warning-emphasis fw-bold text-uppercase mt-1" style={{ fontSize: '0.6875rem' }}>Bảo vệ</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="rounded-3 border p-2 bg-body-tertiary">
                    <div className="fs-5 fw-bold text-body-secondary">{parsed.invalidLines.length}</div>
                    <div className="text-body-secondary fw-bold text-uppercase mt-1" style={{ fontSize: '0.6875rem' }}>Bỏ qua / Lỗi</div>
                  </div>
                </div>
              </div>

              {/* Protected Domain Warning */}
              {parsed.protectedDomains.length > 0 && (
                <div className="alert alert-warning mb-0">
                  <div className="d-flex align-items-center gap-2 fw-bold small">
                    <AlertTriangle size={16} />
                    <span>Phát hiện tên miền protected:</span>
                  </div>
                  <div className="font-monospace small fw-bold ps-4 mt-1">{parsed.protectedDomains.join(', ')}</div>
                  <p className="small ps-4 pt-1 mb-0">
                    Các domain này tự động bị loại khỏi danh sách chặn để tránh gián đoạn dịch vụ thiết yếu quốc gia.
                  </p>
                </div>
              )}

              {/* Valid Domains Preview Box */}
              <div>
                <div className="text-body-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                  Danh sách domain hợp lệ trích xuất:
                </div>
                <div className="border rounded-3 p-3 font-monospace small text-success-emphasis" style={{ maxHeight: 208, overflowY: 'auto' }}>
                  {parsed.uniqueValid.length > 0 ? (
                    parsed.uniqueValid.map((d, i) => (
                      <div key={i} className="d-flex align-items-center gap-2">
                        <span className="text-body-secondary" style={{ width: 20 }}>{i + 1}.</span>
                        <span className="fw-semibold">{d}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-body-secondary fst-italic">Chưa có domain hợp lệ</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
