import React, { useState } from 'react';
import { CategoryInfo } from '../../types';
import {
  Upload, FileText, Globe, CheckCircle2, AlertTriangle, ShieldCheck,
  ArrowRight, Sparkles, Filter, Database, RefreshCw, Layers
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
  const [selectedCategory, setSelectedCategory] = useState<string>('gambling');
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
    if (parsed.uniqueValid.length === 0 || !reason.trim()) return;

    setIsParsing(true);
    setTimeout(() => {
      onImportDomains(parsed.uniqueValid, selectedCategory, reason);
      setIsParsing(false);
      setSuccessMessage(`Đã gửi ${parsed.uniqueValid.length} domain vào Hàng đợi duyệt (nhóm ${selectedCategory}) — chờ xác nhận trước khi chặn.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 500);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
          <span>Nhập danh sách tên miền (Batch Import & Smart Parser)</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
          Hỗ trợ phân tích cú pháp hosts, URL feeds, wildcard regex và tự động bảo vệ các tên miền chính thống (Protected Domains).
        </p>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl flex items-center space-x-3 text-sm font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-7 space-y-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-colors">
          {/* Method Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <button
              type="button"
              onClick={() => setImportTab('text')}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer transition-all ${
                importTab === 'text'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dán văn bản / Hosts</span>
            </button>
            <button
              type="button"
              onClick={() => setImportTab('file')}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer transition-all ${
                importTab === 'file'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Tải file .txt / .csv</span>
            </button>
            <button
              type="button"
              onClick={() => setImportTab('url')}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer transition-all ${
                importTab === 'url'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Từ URL Threat Feed</span>
            </button>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            {importTab === 'text' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  DỮ LIỆU ĐẦU VÀO (Tự động lọc URL, IP, Wildcard, Comments)
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán danh sách tên miền vào đây (mỗi dòng một tên miền)..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl p-3 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-xs resize-y"
                />
              </div>
            )}

            {importTab === 'file' && (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-2 hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-800/40">
                <Upload className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Kéo thả file vào đây hoặc bấm để chọn file</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Hỗ trợ định dạng .txt, .csv, AdGuard, Pi-hole blocklist</p>
              </div>
            )}

            {importTab === 'url' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  URL NGUỒN FEED THREAT INTEL
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/threat-feed.txt"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs active-press"
                  >
                    Tải về
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  NHÓM CHẶN ÁP DỤNG <span className="text-emerald-600 dark:text-emerald-400">*</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3 py-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 focus:outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.count.toLocaleString('vi-VN')} domain)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  TRẠNG THÁI KHỞI TẠO
                </label>
                <select
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-semibold"
                  disabled
                >
                  <option>Chờ duyệt (Hàng đợi duyệt)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                LÝ DO NHẬP <span className="text-rose-500">*</span> (Bắt buộc kiểm toán)
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập mục đích và nguồn gốc đợt import này..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium focus:outline-none shadow-xs transition-all"
              />
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={parsed.uniqueValid.length === 0 || !reason.trim() || isParsing}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center space-x-2 cursor-pointer shadow-xs active-press"
              >
                {isParsing ? (
                  <span>Đang phân tích & nạp...</span>
                ) : (
                  <>
                    <span>Nạp {parsed.uniqueValid.length} domain vào staging</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Real-time Parser Validation & Preview */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs transition-colors">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              KẾT QUẢ PHÂN TÍCH TỰ ĐỘNG
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
              <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3">
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {parsed.uniqueValid.length}
                </div>
                <div className="text-xs text-emerald-800 dark:text-emerald-400 font-bold uppercase mt-0.5">Hợp lệ</div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 rounded-xl p-3">
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {parsed.protectedDomains.length}
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-400 font-bold uppercase mt-0.5">Bảo vệ</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl p-3">
                <div className="text-xl font-bold text-slate-500 dark:text-slate-400">
                  {parsed.invalidLines.length}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">Bỏ qua / Lỗi</div>
              </div>
            </div>

            {/* Protected Domain Warning */}
            {parsed.protectedDomains.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 space-y-1 text-amber-900 dark:text-amber-200">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>PHÁT HIỆN TÊN MIỀN PROTECTED:</span>
                </div>
                <div className="font-mono text-xs pl-5 font-bold text-slate-900 dark:text-slate-100">
                  {parsed.protectedDomains.join(', ')}
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 pl-5 pt-0.5">
                  Các domain này tự động bị loại khỏi danh sách chặn để tránh gián đoạn dịch vụ thiết yếu quốc gia.
                </p>
              </div>
            )}

            {/* Valid Domains Preview Box */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                DANH SÁCH DOMAIN HỢP LỆ TRÍCH XUẤT:
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl p-3.5 font-mono text-xs text-emerald-800 dark:text-emerald-300 max-h-52 overflow-y-auto space-y-1">
                {parsed.uniqueValid.length > 0 ? (
                  parsed.uniqueValid.map((d, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <span className="text-slate-400 dark:text-slate-500 w-5 font-sans font-medium">{i + 1}.</span>
                      <span className="font-semibold">{d}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 italic">Chưa có domain hợp lệ</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
