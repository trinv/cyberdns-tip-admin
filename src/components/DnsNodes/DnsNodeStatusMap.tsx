import React, { useEffect, useMemo, useRef } from 'react';
import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip, type MapRef } from '@/components/ui/map';
import { DnsNode } from '../../types';

interface DnsNodeStatusMapProps {
  nodes: DnsNode[];
}

// Shared, presentational map view for CyberDNS's DNS resolver fleet — used
// both by the full "Quản lý DNS Node" screen (DnsNodesView.tsx) and its
// read-only copy on the SOC Dashboard (Dashboard/DnsNodeStatusCard.tsx).
// Deliberately has no card/title chrome of its own and doesn't fetch data
// itself — callers own both, so this stays a single source of truth for
// the actual map/marker rendering instead of two JSX copies drifting out
// of sync over time.
//
// mapcn's <Map> — src/components/ui/map.tsx, vendored from
// https://mapcn.dev, using its default CARTO basemap styles (see that
// file's own fork note for the license terms to be aware of). The
// container below is wrapped in Tailwind's `isolate` (CSS `isolation:
// isolate`) as defense-in-depth — the same fix that resolved a real bug
// the earlier Leaflet map had here (its internal control panes' high
// z-index painting over the Add/Edit modal despite being earlier in the
// DOM); MapLibre's own controls don't exhibit that bug, but there's no
// downside to keeping the container's stacking self-contained regardless
// of which map library renders inside it.
export const DnsNodeStatusMap: React.FC<DnsNodeStatusMapProps> = ({ nodes }) => {
  const mapRef = useRef<MapRef>(null);

  const pinnedNodes = useMemo(
    () => nodes.filter((n): n is DnsNode & { latitude: number; longitude: number } => n.latitude != null && n.longitude != null),
    [nodes]
  );

  // Default view: the WHOLE world, fit exactly to this container's real
  // aspect ratio (not a guessed zoom number) — runs whenever there's
  // nothing real to zoom to yet (no nodes, or none with coordinates).
  // `duration: 0` — a snap, not an animation, since this is the very
  // first camera placement, not a user-driven transition.
  useEffect(() => {
    if (!mapRef.current || pinnedNodes.length > 0) return;
    mapRef.current.fitBounds(
      [
        [-180, -85],
        [180, 85],
      ],
      { padding: 20, duration: 0 }
    );
  }, [pinnedNodes]);

  // Fit the viewport to every pinned node once there are any (mirrors the
  // previous Leaflet map's own fitBounds behavior) — MapLibre's `center`/
  // bounds coordinates are [longitude, latitude], the opposite order from
  // Leaflet's [lat, lng]. Takes over from the world-bounds effect above
  // the moment real node coordinates exist.
  useEffect(() => {
    if (!mapRef.current || pinnedNodes.length === 0) return;
    const lngs = pinnedNodes.map((n) => n.longitude);
    const lats = pinnedNodes.map((n) => n.latitude);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 10, duration: 400 }
    );
  }, [pinnedNodes]);

  return (
    <div className="w-full h-[420px] isolate rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
      <Map
        ref={mapRef}
        center={[106.0, 16.0]} // [lng, lat] — initial placement only, roughly Việt Nam; the effects above take over immediately
        zoom={2}
        scrollZoom
        dragRotate={false}
        pitchWithRotate={false}
      >
        <MapControls />
        {pinnedNodes.map((n) => (
          <MapMarker key={n.id} longitude={n.longitude} latitude={n.latitude}>
            <MarkerContent>
              <span
                className={`block w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow cursor-pointer transition-transform hover:scale-125 ${
                  n.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </MarkerContent>
            <MarkerTooltip
              offset={10}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-lg font-sans"
            >
              <div className="font-bold">{n.name}</div>
              <div className="text-slate-500 dark:text-slate-400">
                {n.tier} · {n.status === 'active' ? 'Active' : 'Inactive'}
              </div>
              <div className="font-mono text-slate-500 dark:text-slate-400">{n.ipAddress}</div>
              {n.location && <div className="text-slate-400 dark:text-slate-500">{n.location}</div>}
            </MarkerTooltip>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
};
