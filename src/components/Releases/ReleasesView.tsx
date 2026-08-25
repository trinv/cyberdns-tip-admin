import React, { useState } from 'react';
import { ReleaseItem } from '../../types';
import {
  CheckCircle2, XCircle, AlertTriangle, Play, RotateCcw,
  ShieldAlert, GitCommit, FileCode, Check, Server, RefreshCw, Zap, Rocket
} from 'lucide-react';

interface ReleasesViewProps {
  release: ReleaseItem | null;
  releases?: ReleaseItem[];
  userRole: 'Analyst' | 'Admin' | 'Reviewer';
  onDeployRemaining: () => void;
  onAdminOverride: () => void;
  onRollbackRelease: (version: string) => void;
  onViewDomainsList: (category: string) => void;
}

export const ReleasesView: React.FC<ReleasesViewProps> = ({
  release,
  releases,
  userRole,
  onDeployRemaining,
  onAdminOverride,
  onRollbackRelease,
  onViewDomainsList,
}) => {
  // No release row exists until a real release pipeline generates one (this
  // app currently has no such generator — deploy/override/rollback only act
  // on an EXISTING release by version). Show an honest empty state instead
  // of crashing on `release.categories` or fabricating a fake one.
  if (!release) {
    return (
      <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
            <Rocket className="w-7 h-7" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Chưa có bản phát hành nào</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Danh sách chặn hiện tại chưa được đóng gói thành bản phát hành. Tính năng tạo bản phát hành (build artifact,
            tính delta, chạy cổng an toàn) sẽ xuất hiện tại đây khi được triển khai.
          </p>
        </div>
      </div>
    );
  }

  const releaseHistory = releases && releases.length > 0 ? releases : [release];

  const getStatusDotColor = (status: ReleaseItem['status']) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500';
      case 'blocked':
        return 'bg-rose-500';
      case 'rolled_back':
        return 'bg-amber-400';
      default:
        return 'bg-slate-300 dark:bg-slate-600';
    }
  };

  const getStatusBadge = (status: ReleaseItem['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
            đang chạy
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">
            bị chặn
          </span>
        );
      case 'rolled_back':
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800">
            đã rollback
          </span>
        );
      case 'staged':
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
            đã dàn dựng
          </span>
        );
      default:
        return null;
    }
  };
  const [activeDiffTab, setActiveDiffTab] = useState<'malware-phishing' | 'gambling'>('malware-phishing');
  const [pipelineProgress, setPipelineProgress] = useState<number | null>(null);

  const getSafetyGateBadge = (gate: 'passed' | 'warning' | 'failed' | 'unchanged') => {
    switch (gate) {
      case 'passed':
        return (
          <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800 inline-flex text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>đạt</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200/80 dark:border-rose-800 inline-flex text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>vượt ngưỡng -3%</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800 inline-flex text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>cảnh báo</span>
          </div>
        );
      case 'unchanged':
        return (
          <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span>không đổi</span>
          </div>
        );
    }
  };

  const handleSimulateDeploy = () => {
    setPipelineProgress(1);
    const interval = setInterval(() => {
      setPipelineProgress((prev) => {
        if (prev === null || prev >= 5) {
          clearInterval(interval);
          return 5;
        }
        return prev + 1;
      });
    }, 800);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Bản Phát hành {release.version}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Canary In-Progress
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            So sánh với bản <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">v2026.0822.03</span> · 4 giờ trước
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-xs">
            Vai trò vận hành: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{userRole}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Breakdown table, Alert banner, Diff */}
        <div className="lg:col-span-8 space-y-6">
          {/* Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Thống kê thay đổi theo Nhóm (Group Delta)</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">Kiểm tra tự động trước khi sync BIND9 / PowerDNS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3">NHÓM DANH MỤC</th>
                    <th className="px-5 py-3">HIỆN TẠI</th>
                    <th className="px-5 py-3">THÊM MỚI</th>
                    <th className="px-5 py-3">GỠ BỚT</th>
                    <th className="px-5 py-3">TỶ LỆ Δ</th>
                    <th className="px-5 py-3">CỔNG AN TOÀN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-700 dark:text-slate-300">
                  {release.categories.map((row) => (
                    <tr key={row.category} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3 font-sans">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {row.current.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        {row.added > 0 ? `+${row.added.toLocaleString('vi-VN')}` : '0'}
                      </td>
                      <td className="px-5 py-3 text-rose-600 dark:text-rose-400 font-bold">
                        {row.removed > 0 ? `-${row.removed.toLocaleString('vi-VN')}` : '0'}
                      </td>
                      <td className="px-5 py-3 font-bold">
                        {row.deltaPercent > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">+{row.deltaPercent.toFixed(2)}%</span>
                        ) : row.deltaPercent < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">{row.deltaPercent.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-sans">
                        {getSafetyGateBadge(row.safetyGate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Safety Gate Alert Banner */}
          <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900 rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span className="text-sm">PHÁT HÀNH BỊ CHẶN — NHÓM GAMBLING GỠ 37.778 DOMAIN (-7,36%)</span>
            </div>

            <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed sm:pl-7">
              Ngưỡng cảnh báo an toàn cho chiều gỡ là -3%. Nguyên nhân: nguồn upstream <span className="font-mono font-bold text-purple-700 dark:text-purple-300">hagezi/gambling</span> gỡ hàng loạt ở bản phát hành 10:40 hôm nay. Các domain này vẫn đang được bảo vệ nhờ cơ chế ân hạn 7 ngày — chưa có người dùng nào bị ảnh hưởng.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 sm:pl-7 pt-1">
              <button
                onClick={() => onViewDomainsList('gambling')}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl font-bold transition-colors cursor-pointer shadow-xs active-press"
              >
                Xem 37.778 domain bị gỡ
              </button>

              <button
                onClick={onDeployRemaining}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs active-press"
              >
                Phát hành 4 nhóm còn lại
              </button>

              <button
                onClick={onAdminOverride}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 active-press"
              >
                <span>Ghi đè (Admin Override)</span>
              </button>
            </div>
          </div>

          {/* DIFF CODE VIEWER */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
            <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-200 font-bold">
                <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">
                  DIFF MANIFEST — {activeDiffTab.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setActiveDiffTab('malware-phishing')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all ${
                    activeDiffTab === 'malware-phishing'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  malware-phishing (+3.625 / -12)
                </button>
                <button
                  onClick={() => setActiveDiffTab('gambling')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all ${
                    activeDiffTab === 'gambling'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  gambling (+3.628 / -37.778)
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 font-mono text-xs space-y-1 overflow-x-auto text-slate-200 max-h-56 overflow-y-auto">
              <div className="text-cyan-400 font-semibold">
                @@ artifact/{activeDiffTab}.txt +3.625 -12 @@
              </div>
              <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                + nohu-banca.pages.dev
              </div>
              <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                + nohu-ko66.com
              </div>
              <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                + nohu.band
              </div>
              <div className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded">
                - oldphish-2024.example
              </div>
              <div className="text-slate-500 italic pl-2">
                ... 3.634 dòng nữa
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quy trình phát hành, Lịch sử, Tự động rollback */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quy trình phát hành (Pipeline) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs transition-colors">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              QUY TRÌNH PHÁT HÀNH TỰ ĐỘNG
            </div>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs">
                  ✓
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">1. Build artifact</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">gom wildcard · sha256 · ký số ed25519</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs">
                  ✕
                </div>
                <div>
                  <div className="font-bold text-rose-700 dark:text-rose-400 text-xs">2. Cổng an toàn (Safety Gates)</div>
                  <div className="text-xs text-rose-600 dark:text-rose-400">1 trên 5 nhóm vượt ngưỡng cảnh báo</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  3
                </div>
                <div>
                  <div className="font-bold text-slate-600 dark:text-slate-400 text-xs">3. Canary 2 node</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">ngâm tải thực 30 phút</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  4
                </div>
                <div>
                  <div className="font-bold text-slate-600 dark:text-slate-400 text-xs">4. Cuốn chiếu toàn cụm DNS</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Cụm Anycast VNPT / Viettel / FPT</div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  5
                </div>
                <div>
                  <div className="font-bold text-slate-600 dark:text-slate-400 text-xs">5. Chuyển con trỏ latest</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSimulateDeploy}
              className="w-full mt-2 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer active-press"
            >
              <Zap className="w-4 h-4" />
              <span>Chạy thử nghiệm Pipeline Canary</span>
            </button>
          </div>

          {/* Lịch sử phát hành */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs transition-colors">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              LỊCH SỬ PHÁT HÀNH GẦN ĐÂY
            </div>

            <div className="space-y-3 font-mono text-xs">
              {releaseHistory.map((r) => (
                <div key={r.version} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDotColor(r.status)}`}></span>
                    <span
                      className={`font-medium ${
                        r.version === release.version
                          ? 'font-bold text-slate-800 dark:text-slate-200'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {r.version}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 dark:text-slate-500 text-xs">{r.timestamp}</span>
                    {r.status === 'rolled_back' || r.version === release.version ? (
                      getStatusBadge(r.status)
                    ) : (
                      <button
                        onClick={() => onRollbackRelease(r.version)}
                        className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        Khôi phục
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tự động rollback Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-2.5 shadow-xs transition-colors">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              TỰ ĐỘNG ROLLBACK & CON TRỎ
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Canary chạy trên 2 node trong 30 phút. Nếu tỉ lệ chặn của một nhóm lệch quá 3σ so với chuẩn, hoặc có phản hồi chặn nhầm, hệ thống tự trỏ lại manifest bản trước.
            </p>

            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              Thời gian khôi phục: dưới 10 giây — atomic pointer switch.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
