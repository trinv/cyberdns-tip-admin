import React from 'react';
import { X, GitCompare, FileCode, CheckCircle2 } from 'lucide-react';
import { ReleaseItem } from '../../types';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  release: ReleaseItem | null;
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  release,
}) => {
  if (!isOpen) return null;
  if (!release) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm text-center text-xs text-slate-600 dark:text-slate-300 space-y-3">
          <p>Chưa có bản phát hành nào để so sánh.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              Bản so sánh thay đổi (Staged Diff vs Running v2026.0822.03)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 rounded-xl p-4 space-y-2">
              <div className="text-emerald-800 dark:text-emerald-300 font-bold text-xs mb-2 flex items-center justify-between font-sans">
                <span>+ THÊM MỚI (9.185 DOMAIN)</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Artifact: Staging</span>
              </div>
              <div className="text-emerald-900 dark:text-emerald-200 space-y-1.5 max-h-80 overflow-y-auto text-xs font-mono">
                <div>+ nohu-banca.pages.dev [gambling]</div>
                <div>+ nohu-ko66.com [gambling, malware-phishing]</div>
                <div>+ nohu.art [gambling]</div>
                <div>+ nohu.buzz [gambling]</div>
                <div>+ nohu.cash [gambling]</div>
                <div>+ nohu.dog [gambling]</div>
                <div>+ nohu.fund [gambling]</div>
                <div>+ nohu88.top [gambling]</div>
                <div>+ vcb-digibank-login.click [malware-phishing]</div>
                <div>+ telemetry-metrics.adtrack-network.net [tracking-adware]</div>
                <div>+ binance-free-airdrop-usdt.xyz [crypto-scam]</div>
                <div>+ may88vn.top [gambling]</div>
                <div>+ phim18hd.cc [nsfw]</div>
                <div className="text-slate-400 dark:text-slate-500 italic font-sans">... và 9.172 domain khác</div>
              </div>
            </div>

            <div className="bg-rose-50/40 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 rounded-xl p-4 space-y-2">
              <div className="text-rose-800 dark:text-rose-300 font-bold text-xs mb-2 flex items-center justify-between font-sans">
                <span>- GỠ BỎ (38.661 DOMAIN)</span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Tự động ân hạn 7 ngày</span>
              </div>
              <div className="text-rose-900 dark:text-rose-200 space-y-1.5 max-h-80 overflow-y-auto text-xs font-mono">
                <div>- oldphish-2024.example [NXDOMAIN]</div>
                <div>- temp-ads-cdn99.biz [expired]</div>
                <div>- adserver-obsolete.xyz [decommissioned]</div>
                <div>- gambling-mirror-2023.top [dead]</div>
                <div className="text-slate-400 dark:text-slate-500 italic font-sans">... và 38.657 domain từ feed hagezi/gambling</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
            >
              Đóng Diff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
