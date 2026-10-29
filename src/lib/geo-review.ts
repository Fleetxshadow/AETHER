import { severityColor, type Observation } from './data';
import type { AIResult } from './data/types';
import type { Investigation, RoadSegment, TrafficIncident } from './traffic/contract';
import { type SpatialFeature, type SpatialProperties, type GeoCoordinate } from './geo-contracts';
import type { MapPoint } from './operational-map';
import { trafficColors } from './operational-map';
export const spatialSeverityColors = { ...severityColor, unknown: '#8e9995' };

export const spatialColors = {
  sky: '#35d3bc',
  flow: '#f5bc62',
  aqua: '#43cbe5',
  road: '#f68b5f',
  fire: '#f56e78',
  geo: '#9baedd',
  core: '#c0b4f1',
  command: '#a8bdb8',
};
export function spatialProperties(
  partial: Pick<SpatialProperties, 'siteId' | 'source' | 'title' | 'module' | 'observedAt'> &
    Partial<SpatialProperties>,
): SpatialProperties {
  return {
    schemaVersion: 1,
    audience: 'SITE',
    kind: 'OBSERVATION',
    location: '',
    description: partial.title,
    severity: 'normal',
    updatedAt: partial.observedAt,
    verification: 'UNDER_REVIEW',
    verifiedAt: null,
    verifiedBy: null,
    confidence: null,
    pathStatus: null,
    sampleTimes: [],
    sessionId: null,
    evidenceIds: [],
    geometryBasis: '',
    estimated: false,
    analysis: {
      finding: 'No processed analysis supplied.',
      suggestedCause: null,
      verifiedCause: null,
      method: 'NOT_PROVIDED',
    },
    ...partial,
  };
}
export function observationSpatialFeatures(
  records: Observation[],
  ai: AIResult[],
  test: boolean,
): SpatialFeature[] {
  return records.map((o) => {
    const finding = ai.find((a) => a.observationIds.includes(o.id));
    return {
      type: 'Feature',
      id: o.id,
      geometry: { type: 'Point', coordinates: o.location },
      properties: spatialProperties({
        siteId: o.siteId || 'main',
        source: o.dataSource === 'LIVE' && !test ? 'AUTHORIZED' : 'DEMO',
        title: o.title,
        module: o.module in spatialColors ? (o.module as SpatialProperties['module']) : 'command',
        observedAt: o.observedAt,
        description: o.description,
        location: o.district,
        severity: o.severity,
        confidence: finding?.confidence ?? o.confidence,
        evidenceIds: o.evidence ? [o.id] : [],
        geometryBasis: 'Original observation coordinate; no affected boundary inferred.',
        analysis: {
          finding: finding?.description || o.description,
          suggestedCause: null,
          verifiedCause: null,
          method: finding
            ? 'DEVICE_MODEL'
            : o.dataSource === 'LIVE'
              ? 'NOT_PROVIDED'
              : 'DEMO_ANNOTATION',
        },
      }),
    };
  });
}
export function trafficSpatialFeatures(
  roads: RoadSegment[],
  cases: TrafficIncident[],
  analyses: Investigation[],
): SpatialFeature[] {
  return roads
    .map<SpatialFeature | null>((r) => {
      const incident = cases
        .filter((c) => c.segmentIds.includes(r.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const analysis = analyses.find((a) => a.incidentId === incident?.id);
      const at = incident?.firstDetectedAt || r.estimate.observedAt;
      if (!at) return null;
      return {
        type: 'Feature' as const,
        id: r.id,
        geometry: r.geometry,
        properties: spatialProperties({
          siteId: r.siteId,
          source: r.source === 'LIVE' ? 'AUTHORIZED' : 'DEMO',
          module: 'flow',
          kind: 'ROAD_SEGMENT',
          title: r.roadName + ' / ' + r.direction,
          location: r.locality,
          description: r.estimate.reason,
          observedAt: at,
          updatedAt: incident?.updatedAt || at,
          trafficLevel: r.estimate.level,
          incidentStatus: incident?.status || null,
          incidentId: incident?.id || null,
          severity:
            r.estimate.level === 'UNKNOWN'
              ? 'unknown'
              : ['HEAVY', 'SEVERE'].includes(r.estimate.level)
                ? 'critical'
                : r.estimate.level === 'NORMAL'
                  ? 'normal'
                  : 'elevated',
          verification: incident?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNDER_REVIEW',
          verifiedAt: incident?.verifiedAt || null,
          verifiedBy: incident?.verifiedAt ? 'Existing traffic reviewer' : null,
          evidenceIds: [
            ...new Set([
              incident?.id || r.id,
              ...(analysis?.observationIds || []),
              ...(analysis?.candidates.flatMap((c) => c.evidenceIds) || []),
            ]),
          ].slice(0, 30),
          geometryBasis: r.geometryProvenance,
          analysis: {
            finding: analysis?.uncertainty || r.estimate.reason,
            suggestedCause: analysis?.candidates.map((c) => c.description).join(' / ') || null,
            verifiedCause:
              incident?.causeStatus === 'VERIFIED' ? incident.cause.replaceAll('_', ' ') : null,
            method:
              analysis?.method === 'DEMO_FIXTURE_ANNOTATIONS'
                ? 'DEMO_ANNOTATION'
                : analysis
                  ? 'DETERMINISTIC_RULES'
                  : 'NOT_PROVIDED',
          },
        }),
      };
    })
    .filter((f): f is SpatialFeature => f !== null);
}
export function spatialColor(feature: SpatialFeature) {
  if (feature.properties.trafficLevel) return trafficColors[feature.properties.trafficLevel];
  return feature.geometry.type === 'Point'
    ? spatialSeverityColors[feature.properties.severity]
    : spatialColors[feature.properties.module];
}
export function spatialTimes(features: SpatialFeature[]) {
  return [
    ...new Set(features.flatMap((f) => [f.properties.observedAt, ...f.properties.sampleTimes])),
  ].sort((a, b) => Date.parse(a) - Date.parse(b));
}
export function reviewSpatialFeatures(
  features: SpatialFeature[],
  cutoff: string | null,
): SpatialFeature[] {
  if (!cutoff) return features;
  const until = Date.parse(cutoff);
  return features.flatMap<SpatialFeature>((original) => {
    const p = original.properties;
    if (Date.parse(p.observedAt) > until) return [];
    const lateVerification = p.verifiedAt && Date.parse(p.verifiedAt) > until;
    const f = {
      ...original,
      properties: {
        ...p,
        ...(lateVerification
          ? { verification: 'UNDER_REVIEW' as const, verifiedAt: null, verifiedBy: null }
          : {}),
        ...(Date.parse(p.updatedAt) > until
          ? {
              analysis: {
                finding: 'No analysis snapshot supplied for this earlier time.',
                suggestedCause: null,
                verifiedCause: null,
                method: 'NOT_PROVIDED' as const,
              },
            }
          : {}),
      },
    };
    if (f.geometry.type !== 'LineString' || p.kind !== 'TRAIL' || p.pathStatus === 'PROPOSED')
      return [f];
    const length = p.sampleTimes.filter((t) => Date.parse(t) <= until).length;
    if (length < 2) return [];
    return [
      {
        ...f,
        geometry: {
          type: 'LineString' as const,
          coordinates: f.geometry.coordinates.slice(0, length),
        },
        properties: { ...f.properties, sampleTimes: p.sampleTimes.slice(0, length) },
      },
    ];
  });
}
export function spatialMapPoints(features: SpatialFeature[]): MapPoint[] {
  return features.flatMap<MapPoint>((f) => {
    const p = f.properties;
    const common = {
      selectionId: f.id,
      detail: `${p.kind.replaceAll('_', ' ')} · ${p.pathStatus || p.verification} · ${p.observedAt}`,
      source: p.source,
      color: p.pathStatus === 'PROPOSED' ? '#b1bac7' : spatialColor(f),
      overlays: [],
    };
    if (f.geometry.type === 'Point')
      return [
        {
          ...common,
          id: f.id,
          coordinate: f.geometry.coordinates,
          title: p.title,
          recent: p.source === 'AUTHORIZED' && Date.now() - Date.parse(p.observedAt) < 300000,
        },
      ];
    if (f.geometry.type === 'LineString' && p.kind === 'TRAIL')
      return [
        {
          ...common,
          id: f.id + '-start',
          coordinate: f.geometry.coordinates[0],
          title:
            p.title +
            (p.pathStatus === 'PROPOSED' ? ' · proposed start · no GPS recording' : ' · start'),
          markerKind: 'start' as const,
        },
        {
          ...common,
          id: f.id + '-end',
          coordinate: f.geometry.coordinates.at(-1)!,
          title:
            p.title +
            (p.pathStatus === 'PROPOSED'
              ? ' · proposed end · no GPS recording'
              : ' · latest available sample'),
          markerKind: 'end' as const,
        },
      ];
    return [];
  });
}
export type PixelPoint = {
  id: string;
  x: number;
  y: number;
  coordinate: GeoCoordinate;
  selected?: boolean;
  endpoint?: boolean;
};
// Viewport cells bound DOM marker count. Selected points and trail endpoints remain individual.
export function clusterPixels(points: PixelPoint[], cellSize = 64) {
  const cells = new Map<string, PixelPoint[]>();
  for (const p of points) {
    const key =
      p.selected || p.endpoint
        ? `point:${p.id}`
        : `cell:${Math.floor(p.x / cellSize)}:${Math.floor(p.y / cellSize)}`;
    const group = cells.get(key) || [];
    group.push(p);
    cells.set(key, group);
  }
  return [...cells.entries()].map(([id, members]) => ({
    id,
    members,
    x: members.reduce((s, p) => s + p.x, 0) / members.length,
    y: members.reduce((s, p) => s + p.y, 0) / members.length,
  }));
}
