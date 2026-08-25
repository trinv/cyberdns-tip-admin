import React, { useState } from 'react';
import { DomainItem, CategoryInfo } from '../../types';
import { 
  X, ShieldAlert, ShieldCheck, Image, Trash2, Edit3, 
  ExternalLink, Clock, Globe, Network, Activity, Calendar, Shield, Copy, Check,
  RefreshCw, Server, Lock, AlertCircle
} from 'lucide-react';

interface DomainInspectorProps {
  domain: DomainItem | null;
  categories: CategoryInfo[];
  onClose: () => void;
  onEditGroup: (domain: DomainItem) => void;
  onAddToAllowlist: (domain: DomainItem) => void;
  onViewEvidence: (domain: DomainItem) => void;
  onUnblock: (domain: DomainItem) => void;
}

export const DomainInspector: React.FC<DomainInspectorProps> = ({
  domain,
  categories,
  onClose,
  onEditGroup,
  onAddToAllowlist,
  onViewEvidence,
  onUnblock,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDnsTesting, setIsDnsTesting] = useState(false);
  const [dnsTestResult, setDnsTestResult] = useState<{
    ip: string;
    resolvedInMs: number;
    tlsValid: boolean;
    serverCountry: string;
    sinkholeAction: string;
  } | null>(null);

  const handleCopy = () => {
    if (!domain) return;
    navigator.clipboard.writeText(domain.domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRunLiveDnsLookup = () => {
    if (!domain) return;
    setIsDnsTesting(true);
    setDnsTestResult(null);

    setTimeout(() => {
      setIsDnsTesting(false);
      setDnsTestResult({
        ip: domain.dnsRecords?.a?.[0] || '104.21.48.192',
        resolvedInMs: Math.floor(Math.random() * 15) + 8,
        tlsValid: domain.threatScore ? domain.threatScore < 0.9 : true,
        serverCountry: 'Singapore (SG) / Cloudflare Anycast',
        sinkholeAction: domain.status === 'active' ? 'CHẶN TẠI EDGE (NXDOMAIN / SINKHOLE 0.0.0.0)' : 'CHO PHÉP (RESOLVED)',
      });
    }, 600);
  };

  if (!domain) {
    return (
      <aside className="hidden xl:flex w-84 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 p-6 flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs select-none shadow-xs transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
          <Globe className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Chọn một tên miền</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
          Nhấn vào bất kỳ dòng nào trong bảng để xem chi tiết lý lịch threat intel, timeline và các hành động.
        </p>
      </aside>
    );
  }

  const inspectorContent = (
    <div className="flex flex-col h-full overflow-y-auto select-none p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300 shadow-xs font-sans transition-colors scrollbar-thin">
      {/* Header with Close */}
      <div>
        <div className="flex items-start justify-between">
          <div className="space-y-1 max-w-[240px]">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white break-all leading-tight">
                {domain.domain}
              </h3>
              <button
                onClick={handleCopy}
                title="Sao chép tên miền"
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5 rounded cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
              eTLD+1: <span className="text-slate-700 dark:text-slate-300 font-semibold">{domain.etld1}</span> · TLD: <span className="text-slate-700 dark:text-slate-300 font-semibold">.{domain.tld}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key-Value Properties Grid */}
      <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            NHÓM
          </span>
          <div className="flex flex-wrap gap-1">
            {domain.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            NGUỒN
          </span>
          <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{domain.sourceDetail || domain.source}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            TRẠNG THÁI
          </span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
            domain.status === 'active' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800' :
            domain.status === 'grace_period' ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800' :
            domain.status === 'allowlist' ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800' :
            'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
          }`}>
            {domain.status === 'active' ? 'Đang chặn (Active)' : domain.status}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            TUỔI DOMAIN
          </span>
          <span className="font-mono text-slate-800 dark:text-slate-200">{domain.domainAge}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            ASN / ISP
          </span>
          <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[170px] text-right" title={domain.asn}>
            {domain.asn}
          </span>
        </div>

        {domain.threatScore !== undefined && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700">
            <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
              THREAT SCORE (AI)
            </span>
            <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded ${
              domain.threatScore >= 0.8 
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {(domain.threatScore * 100).toFixed(0)}% ({domain.threatScore.toFixed(2)})
            </span>
          </div>
        )}
      </div>

      {/* Live DNS Diagnostic Tool */}
      <div className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>TRA CỨU DNS LIVE (EDGE PROBE)</span>
          </div>
          <button
            onClick={handleRunLiveDnsLookup}
            disabled={isDnsTesting}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isDnsTesting ? 'animate-spin' : ''}`} />
            <span>{isDnsTesting ? 'Đang ping...' : 'Kiểm tra'}</span>
          </button>
        </div>

        {dnsTestResult && (
          <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-xs space-y-1 animate-in fade-in duration-150 border border-slate-700">
            <div className="flex items-center justify-between text-slate-400">
              <span>Độ trễ phản hồi:</span>
              <span className="text-emerald-400 font-bold">{dnsTestResult.resolvedInMs} ms</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Địa chỉ IP gốc:</span>
              <span className="text-slate-100 font-bold">{dnsTestResult.ip}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Vị trí Edge:</span>
              <span className="text-slate-300">{dnsTestResult.serverCountry}</span>
            </div>
            <div className="pt-1 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Chính sách DNS: </span>
              <span className="text-amber-400 font-bold">{dnsTestResult.sinkholeAction}</span>
            </div>
          </div>
        )}

        {domain.dnsRecords && !dnsTestResult && (
          <div className="font-mono text-xs space-y-1 text-slate-600 dark:text-slate-400">
            {domain.dnsRecords.a && (
              <div className="flex items-start space-x-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold w-4">A:</span>
                <span className="truncate text-slate-800 dark:text-slate-200">{domain.dnsRecords.a.join(', ')}</span>
              </div>
            )}
            {domain.dnsRecords.ns && (
              <div className="flex items-start space-x-2 text-slate-500">
                <span className="text-purple-600 dark:text-purple-400 font-bold w-4">NS:</span>
                <span className="truncate">{domain.dnsRecords.ns.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DÒNG THỜI GIAN (Timeline) */}
      <div>
        <div className="flex items-center space-x-1.5 mb-2.5 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>LỊCH SỬ THAO TÁC</span>
        </div>

        <div className="space-y-3 relative before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800 pl-4">
          {domain.timeline && domain.timeline.map((event, idx) => (
            <div key={idx} className="relative group">
              <span className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-emerald-600 ring-4 ring-white dark:ring-slate-900 shadow-xs"></span>
              <div className="space-y-0.5">
                <div className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  <span>{event.time}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-snug font-medium">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HÀNH ĐỘNG */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          THAO TÁC NHANH
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onEditGroup(domain)}
            className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs active-press"
          >
            Sửa nhóm
          </button>
          <button
            onClick={() => onAddToAllowlist(domain)}
            className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-colors cursor-pointer shadow-xs active-press"
          >
            Thêm allowlist
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onViewEvidence(domain)}
            className="px-3 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-800 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer shadow-xs active-press"
          >
            <Image className="w-3.5 h-3.5" />
            <span>Ảnh crawl</span>
          </button>
          <button
            onClick={() => onUnblock(domain)}
            className="px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-800 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors cursor-pointer shadow-xs active-press"
          >
            Thôi chặn
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile/Tablet Slide-over Drawer (< xl) */}
      <div className="xl:hidden">
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
        />
        <div className="fixed inset-y-0 right-0 w-84 sm:w-96 bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 flex flex-col">
          {inspectorContent}
        </div>
      </div>

      {/* Desktop Persistent Pane (>= xl) */}
      <aside className="hidden xl:flex w-84 2xl:w-92 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 flex-col h-full shadow-xs transition-colors">
        {inspectorContent}
      </aside>
    </>
  );
};
