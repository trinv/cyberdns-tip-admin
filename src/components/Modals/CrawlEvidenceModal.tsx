import React from 'react';
import { X, ShieldAlert, Eye, Image as ImageIcon, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { DomainItem, ReviewDomainItem } from '../../types';

interface CrawlEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainItem | ReviewDomainItem | null;
}

export const CrawlEvidenceModal: React.FC<CrawlEvidenceModalProps> = ({
  isOpen,
  onClose,
  domain,
}) => {
  if (!isOpen || !domain) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              Bằng chứng trinh sát (Threat Intelligence Evidence): {domain.domain}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Screenshot simulation box */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>ẢNH CHỤP GIAO DIỆN (CRAWLER SCREENSHOT)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">1920x1080</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-video flex items-center justify-center group shadow-xs">
                <img
                  src="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=80"
                  alt="Crawler Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
                  <div className="font-mono text-xs text-white font-medium">
                    Target: https://{domain.domain}/
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence details */}
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 font-sans font-semibold">ĐIỂM ĐỘC HẠI:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
                    {((domain.threatScore || 0.95) * 100).toFixed(0)} / 100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 font-sans font-semibold">PHÂN LOẠI:</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                    {('primaryCategory' in domain ? domain.primaryCategory : domain.proposedCategory)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 font-sans font-semibold">MÁY CHỦ ASN:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{domain.asn || 'AS13335 CLOUDFLARE'}</span>
                </div>
              </div>

              <div className="bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-xl p-3.5 space-y-1.5 font-sans">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  DẤU HIỆU NHẬN DIỆN (IOC INDICATORS):
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                  <li>Phát hiện form nạp tiền tự động qua QR Code Ngân hàng & ví MoMo</li>
                  <li>Mã nguồn nhúng script cờ bạc nổ hũ APK bundle</li>
                  <li>Tên miền đăng ký dưới 30 ngày trên Cloudflare Pages proxy</li>
                  <li>Không có giấy phép G1 của Bộ TT&TT</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
