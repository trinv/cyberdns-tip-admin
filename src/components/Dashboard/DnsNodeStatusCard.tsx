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
        console.warn(
          'DnsNodeStatusCard: fetchDnsNodes failed, hiding card:',
          err instanceof ApiError ? err.status : err,
        );
        setIsHidden(true);
      });
  }, []);

  if (isHidden) return null;

  // Active/total node count for the header badge — same 'active'/'inactive'
  // status field DnsNodesView.tsx's own per-row pill already reads (see its
  // activeCount). Emerald when every node is active, rose when none are
  // (full outage), amber for anything in between — mirrors the
  // rose=danger / amber=warning / emerald=healthy convention DashboardView's
  // feed-error banner and DnsNodesView's status pill already use, rather
  // than always rendering green regardless of how many nodes are down.
  const activeCount = nodes?.filter((n) => n.status === 'active').length ?? 0;
  const totalCount = nodes?.length ?? 0;
  const allActive = totalCount === 0 || activeCount === totalCount;
  const noneActive = totalCount > 0 && activeCount === 0;
  const badgeTone = allActive
    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : noneActive
      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  const dotTone = allActive ? 'bg-emerald-500' : noneActive ? 'bg-rose-500' : 'bg-amber-500';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">CyberDNS Pop MAP</h3>
        {nodes !== null && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-sans border ${badgeTone}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotTone}`}></span>
            <span>
              {activeCount}/{totalCount} DNS Node Active
            </span>
          </span>
        )}
      </div>
      {nodes === null ? (
        <div className="h-[420px] flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
          Đang tải...
        </div>
      ) : (
        <DnsNodeStatusMap nodes={nodes} />
      )}
    </div>
  );
};
