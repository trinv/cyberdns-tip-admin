import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, FileText, Code2, Database, Shield, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { DomainItem } from '../../types';
import { copyToClipboard } from '../../lib/clipboard';

export type ExportFormat = 'txt' | 'csv' | 'hosts' | 'rpz' | 'adblock' | 'dnsmasq';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedDomains: DomainItem[];
  activeCategory: string;
  // Real total for the current filter (e.g. the selected group), used to
  // show the true scope before the full list has finished loading.
  totalFilteredCount: number;
  // Fetches EVERY domain matching the current Domain Explorer filters — not
  // just the currently loaded page — so "Tất cả" really means the whole
  // category, however large. Called once per modal open, on demand.
  fetchAllFilteredDomains: () => Promise<DomainItem[]>;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string; icon: React.ElementType; iconClass: string }[] = [
  { value: 'txt', label: '.TXT (Plain Text)', desc: 'Một tên miền mỗi dòng, phù hợp cho custom script & parser', icon: FileText, iconClass: 'text-success' },
  { value: 'csv', label: '.CSV (Full Data)', desc: 'Đầy đủ các cột nhóm, trạng thái và mốc thời gian', icon: FileSpreadsheet, iconClass: 'text-info' },
  { value: 'hosts', label: '.HOSTS (0.0.0.0)', desc: 'Định dạng chuẩn Pi-hole, AdGuard Home và OS Hosts file', icon: Database, iconClass: 'text-primary' },
  { value: 'rpz', label: '.RPZ (BIND Zone)', desc: 'Response Policy Zone cho ISP Edge Resolver (BIND9, Knot, PowerDNS)', icon: Code2, iconClass: 'text-warning-emphasis' },
  { value: 'adblock', label: 'AdBlock Syntax', desc: 'Cú pháp quy tắc chặn ||domain.com^ cho trình duyệt & extension', icon: Shield, iconClass: 'text-danger' },
  { value: 'dnsmasq', label: 'Dnsmasq Conf', desc: 'Cấu hình address=/domain/0.0.0.0 cho Router OpenWRT & MikroTik', icon: Code2, iconClass: 'text-info' },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  selectedDomains,
  activeCategory,
  totalFilteredCount,
  fetchAllFilteredDomains,
}) => {
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [scope, setScope] = useState<'filtered' | 'selected'>('filtered');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [copied, setCopied] = useState(false);

  // The full (unpaginated) result set for the current filter — fetched lazily
  // once per modal session, not reused across re-opens (filters may have
  // changed since).
  const [allFilteredDomains, setAllFilteredDomains] = useState<DomainItem[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset on close, not just the fetched data — "scope" defaulting
      // back to "Toàn bộ" every time the modal is freshly opened means a
      // "Chỉ N đã chọn" choice from a PREVIOUS export session can never
      // silently carry over and combine with whatever happens to be
      // selected this time (an unrelated bulk-action selection, say) into
      // an export the user never consciously asked for.
      setAllFilteredDomains(null);
      setLoadError(null);
      setScope('filtered');
      return;
    }
    if (scope !== 'filtered' || allFilteredDomains !== null || isLoadingAll) return;
    let cancelled = false;
    setIsLoadingAll(true);
    setLoadError(null);
    fetchAllFilteredDomains()
      .then((list) => { if (!cancelled) setAllFilteredDomains(list); })
      .catch((err) => { if (!cancelled) setLoadError(err?.message || 'Không thể tải toàn bộ danh sách — vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setIsLoadingAll(false); });
    return () => { cancelled = true; };
  }, [isOpen, scope, allFilteredDomains, isLoadingAll, fetchAllFilteredDomains]);

  if (!isOpen) return null;

  const targetList = scope === 'selected' && selectedDomains.length > 0 ? selectedDomains : (allFilteredDomains || []);
  const isReady = scope === 'selected' ? true : allFilteredDomains !== null;

  // Generate file content based on selected format
  const generateExportContent = () => {
    const timestamp = new Date().toISOString();
    const count = targetList.length;

    switch (format) {
      case 'txt': {
        const header = includeHeader
          ? `# CyberDNS Threat Intelligence Blocklist\n# Category: ${activeCategory}\n# Exported: ${timestamp}\n# Total Domains: ${count}\n# Syntax: Plain text domain list (one domain per line)\n# --------------------------------------------------\n`
          : '';
        return header + targetList.map((d) => d.domain).join('\n');
      }

      case 'csv': {
        const header = 'domain,etld1,tld,primary_category,categories,status,first_seen,last_seen\n';
        const rows = targetList.map((d) =>
          `"${d.domain}","${d.etld1}","${d.tld}","${d.primaryCategory}","${d.categories.join(';')}","${d.status}","${d.firstSeen}","${d.lastSeen}"`
        ).join('\n');
        return header + rows;
      }

      case 'hosts': {
        const header = `# CyberDNS Hosts Blocklist\n# Category: ${activeCategory}\n# Exported: ${timestamp}\n# Total: ${count}\n# --------------------------------------------------\n127.0.0.1 localhost\n::1 localhost\n\n`;
        return header + targetList.map((d) => `0.0.0.0 ${d.domain}`).join('\n');
      }

      case 'rpz': {
        const header = `$TTL 30\n@ IN SOA localhost. root.localhost. ( ${new Date().getFullYear()}082201 1h 15m 30d 2h )\n  IN NS  localhost.\n\n; CyberDNS RPZ Policy Zone: ${activeCategory}\n; Generated at: ${timestamp}\n\n`;
        const body = targetList.map((d) => `${d.domain} CNAME .\n*.${d.domain} CNAME .`).join('\n');
        return header + body;
      }

      case 'adblock': {
        const header = `! Title: CyberDNS Threat Filter - ${activeCategory}\n! Exported: ${timestamp}\n! Count: ${count}\n! Homepage: https://cyberdns.vn/\n! --------------------------------------------------\n`;
        return header + targetList.map((d) => `||${d.domain}^`).join('\n');
      }

      case 'dnsmasq': {
        const header = `# CyberDNS dnsmasq format\n# Category: ${activeCategory}\n# Total: ${count}\n`;
        return header + targetList.map((d) => `address=/${d.domain}/0.0.0.0`).join('\n');
      }
    }
  };

  const previewText = generateExportContent();

  // Download action
  const handleDownload = () => {
    const content = generateExportContent();
    let filename = `cyberdns-blocklist-${activeCategory}-${Date.now()}`;
    let mimeType = 'text/plain;charset=utf-8';

    if (format === 'csv') {
      filename += '.csv';
      mimeType = 'text/csv;charset=utf-8';
    } else if (format === 'rpz') {
      filename += '.rpz.zone';
    } else if (format === 'hosts') {
      filename += '.hosts.txt';
    } else {
      filename += '.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleCopy = async () => {
    // See copyToClipboard's own note — the old direct
    // navigator.clipboard.writeText call silently did nothing outside a
    // secure (HTTPS) context, while still claiming success unconditionally.
    const ok = await copyToClipboard(previewText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                <Download size={16} className="text-primary" />
                <span>Xuất danh sách tên miền chặn (Export Blocklist)</span>
              </h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <div className="modal-body d-flex flex-column gap-3">
              {/* Format selection */}
              <div>
                <label className="form-label small fw-bold text-uppercase">Định dạng xuất (export format)</label>
                <div className="row g-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = format === opt.value;
                    return (
                      <div className="col-12 col-sm-6 col-lg-4" key={opt.value}>
                        <button
                          type="button"
                          onClick={() => setFormat(opt.value)}
                          className={`p-2 rounded-3 border text-start w-100 h-100 ${isActive ? 'border-primary bg-primary-subtle' : 'bg-body-tertiary'}`}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="fw-bold font-monospace small">{opt.label}</span>
                            <Icon size={16} className={opt.iconClass} />
                          </div>
                          <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>{opt.desc}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scope selection */}
              <div className="row g-3 bg-body-tertiary border rounded-3 p-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-bold">Phạm vi dữ liệu</label>
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="form-check">
                      <input
                        type="radio"
                        name="scope"
                        id="scope-filtered"
                        checked={scope === 'filtered'}
                        onChange={() => setScope('filtered')}
                        className="form-check-input"
                      />
                      <label htmlFor="scope-filtered" className="form-check-label small">
                        Toàn bộ danh mục đang chọn ({totalFilteredCount.toLocaleString('vi-VN')} domain)
                      </label>
                    </div>
                    {selectedCount > 0 && (
                      <div className="form-check">
                        <input
                          type="radio"
                          name="scope"
                          id="scope-selected"
                          checked={scope === 'selected'}
                          onChange={() => setScope('selected')}
                          className="form-check-input"
                        />
                        <label htmlFor="scope-selected" className="form-check-label small text-primary fw-medium">
                          Chỉ {selectedCount} đã chọn
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12 col-sm-6 d-flex align-items-end justify-content-sm-end">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="include-header"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                      className="form-check-input"
                    />
                    <label htmlFor="include-header" className="form-check-label small">Kèm metadata header</label>
                  </div>
                </div>
              </div>

              {/* Preview box */}
              <div>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-body-secondary text-uppercase fw-bold" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                    Xem trước nội dung xuất ({targetList.length} bản ghi)
                  </span>
                  <button
                    onClick={handleCopy}
                    disabled={!isReady}
                    className="btn btn-link btn-sm text-decoration-none d-flex align-items-center gap-1 p-0"
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    <span>{copied ? 'Đã sao chép!' : 'Sao chép nhanh'}</span>
                  </button>
                </div>
                {isLoadingAll ? (
                  <div className="bg-dark text-light font-monospace small p-3 rounded-3 d-flex align-items-center justify-content-center gap-2" style={{ height: 96 }}>
                    <Loader2 size={16} className="spin-slow" />
                    <span>Đang tải toàn bộ {totalFilteredCount.toLocaleString('vi-VN')} domain của danh mục...</span>
                  </div>
                ) : loadError ? (
                  <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3 mb-0">
                    <span className="d-flex align-items-center gap-2 small">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <span>{loadError}</span>
                    </span>
                    <button type="button" onClick={() => setAllFilteredDomains(null)} className="btn btn-light border btn-sm flex-shrink-0">Thử lại</button>
                  </div>
                ) : (
                  <pre className="bg-dark text-light font-monospace small p-3 rounded-3 mb-0" style={{ maxHeight: 192, overflowY: 'auto', lineHeight: 1.6 }}>
                    {previewText.split('\n').slice(0, 30).join('\n')}
                    {previewText.split('\n').length > 30 && (
                      <span className="d-block fst-italic pt-1" style={{ opacity: 0.6 }}>
                        ... và còn {previewText.split('\n').length - 30} dòng nữa
                      </span>
                    )}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="modal-footer d-flex flex-wrap align-items-center justify-content-between gap-3">
              <span className="text-body-secondary font-monospace small">
                Quy mô: {isReady ? targetList.length : '…'} domain · Nhóm: {activeCategory}
              </span>
              <div className="d-flex align-items-center gap-2">
                <button type="button" onClick={onClose} className="btn btn-light border">Đóng</button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!isReady || targetList.length === 0}
                  className="btn btn-primary d-flex align-items-center gap-2"
                >
                  {isLoadingAll ? <Loader2 size={16} className="spin-slow" /> : <Download size={16} />}
                  <span>Tải file .{format === 'csv' ? 'csv' : format === 'rpz' ? 'rpz' : 'txt'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
