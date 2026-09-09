import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MarkerLabel,
  MapClusterLayer,
  MapPopup,
  type MapRef,
} from '@/components/ui/map';
import { Flag } from 'lucide-react';
import { DnsNode } from '../../types';

// Marker mặc định, cố định — không phụ thuộc dữ liệu DNS node — đánh dấu
// chủ quyền Việt Nam đối với 2 quần đảo. Toạ độ tâm theo dữ liệu do người
// dùng cung cấp trực tiếp (không lấy từ API), nên khai báo tĩnh ngay tại
// đây thay vì fetch.
const SOVEREIGNTY_MARKERS: { id: string; name: string; lat: number; lng: number }[] = [
  { id: 'hoang-sa', name: 'Quần đảo Hoàng Sa', lat: 16.5, lng: 112.0 },
  { id: 'truong-sa', name: 'Quần đảo Trường Sa', lat: 9.3, lng: 114.2 },
];

interface DnsNodeStatusMapProps {
  nodes: DnsNode[];
  // Tailwind height classes for the map's container — each caller picks
  // what fits its own layout (e.g. DnsNodesView.tsx's full-page map vs.
  // Dashboard/DnsNodeStatusCard.tsx's compact card copy), rather than one
  // fixed size forced on every caller. Defaults to the Dashboard's own
  // single-fixed-height convention (see DnsNodeStatusMap's own note below)
  // so a caller that doesn't care can just omit this prop.
  heightClassName?: string;
}

// What a DNS node's GeoJSON point carries for MapClusterLayer/MapPopup
// below — just what the click popup renders, not the full DnsNode shape.
interface DnsNodePointProperties {
  id: number;
  name: string;
  tier: string;
  status: 'active' | 'inactive';
  ipAddress: string | null;
  ipv6Address: string | null;
  location: string | null;
}

type PinnedDnsNode = DnsNode & { latitude: number; longitude: number };

function toFeatureCollection(
  pinnedNodes: PinnedDnsNode[]
): GeoJSON.FeatureCollection<GeoJSON.Point, DnsNodePointProperties> {
  return {
    type: 'FeatureCollection',
    features: pinnedNodes.map((n) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] },
      properties: {
        id: n.id,
        name: n.name,
        tier: n.tier,
        status: n.status,
        ipAddress: n.ipAddress,
        ipv6Address: n.ipv6Address,
        location: n.location,
      },
    })),
  };
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
export const DnsNodeStatusMap: React.FC<DnsNodeStatusMapProps> = ({ nodes, heightClassName = 'h-[420px]' }) => {
  const mapRef = useRef<MapRef>(null);

  const pinnedNodes = useMemo(
    () => nodes.filter((n): n is PinnedDnsNode => n.latitude != null && n.longitude != null),
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
  // the moment real node coordinates exist. Unaffected by how nodes are
  // actually rendered below (individual markers vs. cluster layers) —
  // this only ever reads raw lat/lng off pinnedNodes.
  //
  // Deliberately does NOT factor SOVEREIGNTY_MARKERS into this bounds
  // calculation — they're always drawn on the map (see the JSX below),
  // but forcing every fit to also cover both archipelagos (which span
  // lat 9-17, lng 111-117) would zoom this view out far past what's
  // needed to see the actual DNS node cluster, defeating the point of a
  // tight operational fit. Users can pan/zoom (scrollZoom is on) to see
  // them; the world-bounds effect above already shows everything when no
  // node is pinned yet.
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

  // Nodes render via mapcn's MapClusterLayer (src/components/ui/map.tsx)
  // instead of one MapMarker per node — per explicit request, so nodes at
  // the same/nearby location (e.g. several in one city) merge into a count
  // bubble instead of stacking into indistinguishable overlapping dots,
  // and un-merge automatically on zoom-in. Split into two layers (active /
  // inactive) rather than one, since MapClusterLayer's `pointColor` is a
  // single flat color per layer instance — this is how the existing
  // green=Active / gray=Inactive distinction survives the move away from
  // individually-colored MapMarkers. A side effect worth knowing: an
  // active and an inactive node at the exact same spot cluster into TWO
  // separate nearby bubbles (one per status) rather than one blended
  // count — intentional, an ops map shouldn't hide "how many are down"
  // inside a combined number.
  //
  // Trade-off accepted along with this (see MapClusterLayer's own doc
  // comment): points/clusters are a native GL layer, not DOM markers, so
  // there's no hover tooltip anymore — clicking a point opens the
  // MapPopup below instead; clicking a cluster zooms in (MapClusterLayer's
  // own default when onClusterClick isn't provided, left as-is here).
  const activeFeatures = useMemo(
    () => toFeatureCollection(pinnedNodes.filter((n) => n.status === 'active')),
    [pinnedNodes]
  );
  const inactiveFeatures = useMemo(
    () => toFeatureCollection(pinnedNodes.filter((n) => n.status !== 'active')),
    [pinnedNodes]
  );

  const [selectedPoint, setSelectedPoint] = useState<{
    coordinates: [number, number];
    properties: DnsNodePointProperties;
  } | null>(null);

  const handlePointClick = (
    feature: GeoJSON.Feature<GeoJSON.Point, DnsNodePointProperties>,
    coordinates: [number, number]
  ) => {
    setSelectedPoint({ coordinates, properties: feature.properties });
  };

  return (
    <div className={`w-full ${heightClassName} isolate rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800`}>
      <Map
        ref={mapRef}
        center={[106.0, 16.0]} // [lng, lat] — initial placement only, roughly Việt Nam; the effects above take over immediately
        zoom={2}
        scrollZoom
        dragRotate={false}
        pitchWithRotate={false}
      >
        <MapControls />
        {SOVEREIGNTY_MARKERS.map((m) => (
          <MapMarker key={m.id} longitude={m.lng} latitude={m.lat}>
            <MarkerContent>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900 shadow cursor-pointer transition-transform hover:scale-110">
                <Flag className="w-3 h-3 text-white" fill="currentColor" />
              </span>
            </MarkerContent>
            <MarkerLabel
              position="top"
              className="text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 rounded shadow-sm"
            >
              {m.name}
            </MarkerLabel>
            <MarkerTooltip
              offset={12}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-lg font-sans"
            >
              <div className="font-bold">{m.name}</div>
              <div className="text-slate-500 dark:text-slate-400">Chủ quyền: Việt Nam</div>
            </MarkerTooltip>
          </MapMarker>
        ))}

        {/* Active nodes — emerald, matches the status dot color the old
            per-node MapMarker used. */}
        <MapClusterLayer<DnsNodePointProperties>
          data={activeFeatures}
          pointColor="#10b981"
          clusterColors={['#34d399', '#10b981', '#059669']}
          onPointClick={handlePointClick}
        />
        {/* Inactive nodes — slate, same reasoning. */}
        <MapClusterLayer<DnsNodePointProperties>
          data={inactiveFeatures}
          pointColor="#94a3b8"
          clusterColors={['#cbd5e1', '#94a3b8', '#64748b']}
          onPointClick={handlePointClick}
        />

        {selectedPoint && (
          <MapPopup
            key={selectedPoint.properties.id}
            longitude={selectedPoint.coordinates[0]}
            latitude={selectedPoint.coordinates[1]}
            onClose={() => setSelectedPoint(null)}
            closeOnClick={false}
            focusAfterOpen={false}
            closeButton
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-sans"
          >
            <div className="font-bold pr-4">{selectedPoint.properties.name}</div>
            <div className="text-slate-500 dark:text-slate-400">
              {selectedPoint.properties.tier} · {selectedPoint.properties.status === 'active' ? 'Active' : 'Inactive'}
            </div>
            {selectedPoint.properties.ipAddress && (
              <div className="font-mono text-slate-500 dark:text-slate-400">{selectedPoint.properties.ipAddress}</div>
            )}
            {selectedPoint.properties.ipv6Address && (
              <div className="font-mono text-slate-500 dark:text-slate-400">{selectedPoint.properties.ipv6Address}</div>
            )}
            {selectedPoint.properties.location && (
              <div className="text-slate-400 dark:text-slate-500">{selectedPoint.properties.location}</div>
            )}
          </MapPopup>
        )}
      </Map>
    </div>
  );
};
