import { observationStatus, type Observation } from './data';
import type { ModuleId } from './modules';
import type { RoadSegment, TrafficIncident, TrafficLevel } from './traffic/contract';

// Display projections only. Firebase/mobile records, coordinates and permissions stay unchanged.
export type MapCoordinate = [longitude: number, latitude: number];
export type MapSource = 'AUTHORIZED' | 'DEMO' | 'TEST' | 'LOCAL';
export interface MapPoint {
  id: string;
  selectionId?: string;
  coordinate: MapCoordinate;
  title: string;
  detail: string;
  source: MapSource;
  color: string;
  overlays: ModuleId[];
  caseCount?: number;
  markerKind?: 'start' | 'end';
  recent?: boolean;
}
export interface MapLine {
  id: string;
  coordinate: MapCoordinate[];
  title: string;
  source: MapSource;
  color: string;
}
export const gurugram = { lat: 28.4595, lng: 77.0266 };
export const trafficColors: Record<TrafficLevel, string> = {
  NORMAL: '#64c99a',
  LIGHT: '#edce64',
  MODERATE: '#f5a65b',
  HEAVY: '#f77767',
  SEVERE: '#bd3858',
  UNKNOWN: '#8e9995',
};
export function validCoordinate(value: readonly number[]): value is MapCoordinate {
  return (
    value.length === 2 &&
    value.every(Number.isFinite) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}
export const latLng = ([lng, lat]: MapCoordinate) => ({ lat, lng });
export function observationPoints(
  records: Observation[],
  step: number,
  colors: Record<Observation['severity'], string>,
  test = false,
  coreSources: ReadonlySet<string> = new Set(),
): MapPoint[] {
  return records
    .filter((o) => validCoordinate(o.location))
    .map((o) => ({
      id: o.id,
      coordinate: o.location,
      title: o.title,
      detail: `${o.module.toUpperCase()} · ${o.severity} · ${observationStatus(o, step)} · ${o.observedAt} · ${o.evidence || 'No linked evidence'}`,
      source: o.dataSource === 'LIVE' ? (test ? 'TEST' : 'AUTHORIZED') : 'DEMO',
      color: colors[o.severity],
      overlays: [
        ...new Set([
          ...(o.module === 'core' ? [] : [o.module]),
          ...(coreSources.has(o.id) || (o.module === 'core' && !!o.evidence.trim())
            ? ['core' as const]
            : []),
        ]),
      ],
    }));
}
export function trafficMapData(roads: RoadSegment[], incidents: TrafficIncident[]) {
  const lines: MapLine[] = roads
    .filter((r) => r.geometry.coordinates.every(validCoordinate))
    .map((r) => ({
      id: r.id,
      coordinate: r.geometry.coordinates,
      title: `${r.roadName} / ${r.direction}`,
      source: r.source === 'LIVE' ? 'AUTHORIZED' : 'DEMO',
      color: trafficColors[r.estimate.level],
    }));
  const points: MapPoint[] = roads.flatMap((r) => {
    const coordinate = r.geometry.coordinates[Math.floor(r.geometry.coordinates.length / 2)];
    if (!coordinate || !validCoordinate(coordinate)) return [];
    const cases = incidents.filter((i) => i.segmentIds.includes(r.id));
    const active = cases.filter((i) => i.status === 'ACTIVE');
    return [
      {
        id: r.id,
        coordinate,
        title: `${r.roadName} / ${r.direction}`,
        detail: active.length
          ? active
              .map(
                (i) =>
                  `${i.severity} · cause ${i.causeStatus} · ${i.verificationStatus} · ${i.investigationId ? 'investigation linked' : 'no investigation'} · ${i.updatedAt}`,
              )
              .join(' / ')
          : `${r.estimate.level} · ${r.estimate.reason} · ${r.geometryProvenance}`,
        source: r.source === 'LIVE' ? ('AUTHORIZED' as const) : ('DEMO' as const),
        color: trafficColors[r.estimate.level],
        overlays: ['flow' as const, 'command' as const],
        caseCount: cases.length,
      },
    ];
  });
  return { points, lines };
}

// Instant fit is also used with reduced motion: Google's fitBounds may animate implicitly.
export function fitCamera(coordinates: MapCoordinate[], width: number, height: number) {
  if (!coordinates.length) return { center: gurugram, zoom: 12 };
  const xs = coordinates.map(([lng]) => (lng + 180) / 360);
  const ys = coordinates.map(([, lat]) => {
    const sin = Math.sin((Math.max(-85.051, Math.min(85.051, lat)) * Math.PI) / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  });
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const zoom = Math.max(
    2,
    Math.min(
      16,
      Math.log2(
        Math.min(
          Math.max(64, width - 120) / (256 * Math.max(maxX - minX, 0.00001)),
          Math.max(64, height - 120) / (256 * Math.max(maxY - minY, 0.00001)),
        ),
      ),
    ),
  );
  return {
    center: {
      lng: (minX + maxX) * 180 - 180,
      lat: (Math.atan(Math.sinh(Math.PI * (1 - minY - maxY))) * 180) / Math.PI,
    },
    zoom,
  };
}
