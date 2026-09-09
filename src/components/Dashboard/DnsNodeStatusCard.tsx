import React, { useEffect, useState } from 'react';
import { DnsNodeStatusMap } from '../DnsNodes/DnsNodeStatusMap';
import { DnsNode } from '../../types';
import { fetchDnsNodes, ApiError } from '../../lib/api';

// Read-only copy of DnsNodesView.tsx's "Bản đồ vị trí & trạng thái node"
// card, for a quick glance from the SOC Dashboard — same title/chrome,
// same shared DnsNodeStatusMap rendering, no add/edit/ACL controls (those
// stay exclusively on the "Quản lý DNS Node" screen).
//
// Self-contained (fetches its own data, like DnsNodesView.tsx and
// LoginHistoryView.tsx already do) rather than threaded through
// DashboardView's props — GET /api/dns-nodes is Admin-gated
// (requireRole('Admin'), see server.ts), so a non-Admin's request always
// 401/403s. This silently renders nothing in that case (and on any other
// fetch failure) rather than showing an error banner — DashboardView only
// mounts this component at all when isAdmin is true (see its own lazy-load
// gate), so in practice the 401/403 path is just defense in depth, not the
// expected case.
export const DnsNodeStatusCard: React.FC = () => {
  const [nodes, setNodes] = useState<DnsNode[] | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    fetchDnsNodes()
      .then(setNodes)
      .catch((err) => {
        console.warn('DnsNodeStatusCard: fetchDnsNodes failed, hiding card:', err instanceof ApiError ? err.status : err);
        setIsHidden(true);
      });
  }, []);

  if (isHidden) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
      <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans mb-3">CyberDNS Pop MAP</h3>
      {nodes === null ? (
        <div className="h-[320px] sm:h-[400px] lg:h-[460px] flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
          Đang tải...
        </div>
      ) : (
        <DnsNodeStatusMap nodes={nodes} />
      )}
    </div>
  );
};
