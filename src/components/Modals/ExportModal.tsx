import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, FileText, Code2, Database, Shield, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { DomainItem } from '../../types';

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

  const handleCopy = () => {
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              Xuất danh sách tên miền chặn (Export Blocklist)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Format selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              ĐỊNH DẠNG XUẤT (EXPORT FORMAT)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('txt')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'txt'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">.TXT (Plain Text)</span>
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Một tên miền mỗi dòng, phù hợp cho custom script & parser
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'csv'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">.CSV (Full Data)</span>
                  <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Đầy đủ các cột nhóm, trạng thái và mốc thời gian
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('hosts')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'hosts'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">.HOSTS (0.0.0.0)</span>
                  <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Định dạng chuẩn Pi-hole, AdGuard Home và OS Hosts file
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('rpz')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'rpz'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">.RPZ (BIND Zone)</span>
                  <Code2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Response Policy Zone cho ISP Edge Resolver (BIND9, Knot, PowerDNS)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('adblock')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'adblock'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">AdBlock Syntax</span>
                  <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Cú pháp quy tắc chặn ||domain.com^ cho trình duyệt & extension
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('dnsmasq')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'dnsmasq'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-950 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs font-mono">Dnsmasq Conf</span>
                  <Code2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Cấu hình address=/domain/0.0.0.0 cho Router OpenWRT & MikroTik
                </span>
              </button>
            </div>
          </div>

          {/* Scope selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs">PHẠM VI DỮ LIỆU</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center space-x-1.5 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'filtered'}
                    onChange={() => setScope('filtered')}
                    className="accent-emerald-600"
                  />
                  <span>Toàn bộ danh mục đang chọn ({totalFilteredCount.toLocaleString('vi-VN')} domain)</span>
                </label>
                {selectedCount > 0 && (
                  <label className="flex items-center space-x-1.5 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'selected'}
                      onChange={() => setScope('selected')}
                      className="accent-emerald-600"
                    />
                    <span>Chỉ {selectedCount} đã chọn</span>
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-1 flex items-center justify-start sm:justify-end">
              <label className="flex items-center space-x-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  className="accent-emerald-600 rounded"
                />
                <span>Kèm metadata header</span>
              </label>
            </div>
          </div>

          {/* Preview box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>XEM TRƯỚC NỘI DUNG XUẤT ({targetList.length} BẢN GHI)</span>
              <button
                onClick={handleCopy}
                disabled={!isReady}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-semibold flex items-center space-x-1 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép nhanh'}</span>
              </button>
            </div>
            {isLoadingAll ? (
              <div className="bg-slate-950 text-slate-400 font-mono text-xs p-3.5 rounded-xl h-24 flex items-center justify-center space-x-2 border border-slate-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tải toàn bộ {totalFilteredCount.toLocaleString('vi-VN')} domain của danh mục...</span>
              </div>
            ) : loadError ? (
              <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-mono text-xs p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3">
                <span className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loadError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAllFilteredDomains(null)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg font-sans font-semibold cursor-pointer flex-shrink-0"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <pre className="bg-slate-950 text-slate-200 font-mono text-xs p-3.5 rounded-xl max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
                {previewText.split('\n').slice(0, 30).join('\n')}
                {previewText.split('\n').length > 30 && (
                  <span className="text-slate-500 block italic pt-1">
                    ... và còn {previewText.split('\n').length - 30} dòng nữa
                  </span>
                )}
              </pre>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium font-mono">
            Quy mô: {isReady ? targetList.length : '…'} domain · Nhóm: {activeCategory}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!isReady || targetList.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs active-press disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Tải file .{format === 'csv' ? 'csv' : format === 'rpz' ? 'rpz' : 'txt'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
