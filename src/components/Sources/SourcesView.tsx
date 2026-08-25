import React, { useState } from 'react';
import { FeedSource, CategoryInfo } from '../../types';
import {
  RefreshCw, Plus, Globe, CheckCircle2, AlertTriangle,
  Trash2, Edit3, Clock, ArrowRight, ShieldCheck, Activity, Pause, Play
} from 'lucide-react';

interface SourcesViewProps {
  sources: FeedSource[];
  categories: CategoryInfo[];
  onSyncAll: () => void;
  onSyncSingle: (id: string) => Promise<void> | void;
  onAddSource: (newSource: Partial<FeedSource>) => void;
  onPauseSource: (id: string) => Promise<void> | void;
  onResumeSource: (id: string) => Promise<void> | void;
  onDeleteSource: (id: string) => Promise<void> | void;
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
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceCategory, setNewSourceCategory] = useState('malware-phishing');
  const [newSourceInterval, setNewSourceInterval] = useState('4 giờ');

  // Sync IS whatever `src.status === 'syncing'` says, straight from the
  // server (see App.tsx's polling effect) — no local "isSyncing" flag here.
  // That's what makes progress survive switching away from this tab and
  // back: this component can fully unmount mid-sync and remount later, and
  // it will correctly show the sync still in progress because the truth
  // lives in PostgreSQL, not in this component's state.
  const handleSyncClick = (id: string) => {
    onSyncSingle(id);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

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
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Quản lý nguồn cấp dữ liệu (Threat Intel Feeds)</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Cấu hình định kỳ đồng bộ danh sách chặn từ các nguồn uy tín toàn cầu (Hagezi, OISD) và Crawler nội bộ CyberDNS.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs active-press"
          >
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Thêm nguồn mới</span>
          </button>

          <button
            onClick={onSyncAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active-press"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Đồng bộ tất cả</span>
          </button>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sources.map((src) => (
          <div
            key={src.id}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between transition-all"
          >
            <div className="space-y-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: src.color }}
                  ></span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans">{src.name}</h3>
                </div>

                {src.isPaused ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono uppercase font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                    paused
                  </span>
                ) : (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono uppercase font-bold ${
                      src.status === 'healthy'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : src.status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : src.status === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : src.status === 'syncing'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {src.status}
                  </span>
                )}
              </div>

              <div className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {src.url}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-xs uppercase font-sans font-bold mb-0.5">QUY MÔ</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                    {src.domainCount.toLocaleString('vi-VN')} domain
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-xs uppercase font-sans font-bold mb-0.5">CHU KỲ</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold font-sans">{src.syncInterval}</span>
                </div>
              </div>

              {/* Real progress bar — percent + current phase, both driven
                  directly by the server-persisted syncProgress/syncPhase
                  (see runFeedSourceSyncJob), so it's accurate whether this
                  card was mounted the whole time or just got remounted after
                  a tab switch mid-sync. */}
              {src.status === 'syncing' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-blue-700 dark:text-blue-300 font-semibold truncate pr-2">{src.syncPhase || 'Đang đồng bộ...'}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">{src.syncProgress ?? 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${src.syncProgress ?? 0}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {src.status === 'error' && src.errorMessage && (
                <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900 p-3 rounded-xl text-xs text-rose-800 dark:text-rose-200 leading-relaxed flex items-start space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{src.errorMessage}</span>
                </div>
              )}

              {src.status === 'warning' && src.errorMessage && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900 p-3 rounded-xl text-xs text-amber-800 dark:text-amber-200 leading-relaxed flex items-start space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{src.errorMessage}</span>
                </div>
              )}

              {src.status === 'healthy' && src.lastSyncMessage && (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900 p-3 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{src.lastSyncMessage}</span>
                </div>
              )}

              {src.isPaused && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start space-x-1.5">
                  <Pause className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>Đã tạm dừng — mọi tên miền của nguồn này đã chuyển sang "Thôi chặn". Bấm "Tiếp tục" để đồng bộ lại và tự động chặn lại đúng những tên miền đó.</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 text-xs">
                Lần đồng bộ: {src.lastSync ? src.lastSync : 'Chưa đồng bộ lần nào'}
              </span>
              <div className="flex items-center justify-between gap-2">
                {src.isPaused ? (
                  <button
                    onClick={() => onResumeSource(src.id)}
                    className="flex-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer active-press"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Tiếp tục</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSyncClick(src.id)}
                    disabled={src.status === 'syncing'}
                    className="flex-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer active-press disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${src.status === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>{src.status === 'syncing' ? `Đang nạp... ${src.syncProgress ?? 0}%` : 'Đồng bộ'}</span>
                  </button>
                )}

                {!src.isPaused && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Tạm dừng nguồn "${src.name}"? Mọi tên miền đang chặn nhờ nguồn này sẽ chuyển sang "Thôi chặn" ngay lập tức.`)) {
                        onPauseSource(src.id);
                      }
                    }}
                    disabled={src.status === 'syncing'}
                    title="Tạm dừng nguồn"
                    className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer active-press disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => {
                    if (window.confirm(`Xoá vĩnh viễn nguồn "${src.name}"? Mọi tên miền đang chặn nhờ nguồn này sẽ chuyển sang "Thôi chặn". Không thể hoàn tác.`)) {
                      onDeleteSource(src.id);
                    }
                  }}
                  disabled={src.status === 'syncing'}
                  title="Xoá nguồn"
                  className="p-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 rounded-xl transition-colors cursor-pointer active-press disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Custom Feed Source */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-xs text-slate-700 dark:text-slate-300">
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-sans">Thêm nguồn Threat Feed mới</h2>
            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold">Tên nguồn</label>
                <input
                  type="text"
                  required
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="ví dụ: phishtank/verified-online"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold">URL Feed (Raw txt/hosts)</label>
                <input
                  type="url"
                  required
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://data.phishtank.com/data/online-valid.txt"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-800 dark:text-slate-200 font-bold">Nhóm mặc định</label>
                  <select
                    value={newSourceCategory}
                    onChange={(e) => setNewSourceCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-emerald-700 dark:text-emerald-300 font-bold focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-800 dark:text-slate-200 font-bold">Chu kỳ đồng bộ</label>
                  <select
                    value={newSourceInterval}
                    onChange={(e) => setNewSourceInterval(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
                  >
                    <option value="1 giờ">1 giờ</option>
                    <option value="4 giờ">4 giờ</option>
                    <option value="12 giờ">12 giờ</option>
                    <option value="24 giờ">24 giờ</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
                >
                  Lưu nguồn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
