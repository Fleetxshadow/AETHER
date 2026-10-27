import type { Incident } from './response';
import type { Observation } from './data';
import { z } from 'zod';
export type GeoLayer = 'incident' | 'traffic' | 'flood' | 'road' | 'infrastructure';
export interface GeoFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    kind: GeoLayer;
    label: string;
    source: 'DEMO';
    observedAt: string;
    verified: boolean;
    sourceHref: string;
  };
}
export function geoFeatures(
  incidents: Incident[],
  observations: Observation[],
): { type: 'FeatureCollection'; features: GeoFeature[] } {
  return {
    type: 'FeatureCollection',
    features: [
      ...incidents
        .filter((i) => i.coordinates)
        .map((i) => ({
          type: 'Feature' as const,
          id: i.id,
          geometry: { type: 'Point' as const, coordinates: i.coordinates! },
          properties: {
            kind: 'incident' as const,
            label: i.location,
            source: 'DEMO' as const,
            observedAt: i.reportedAt,
            verified: i.locationVerified,
            sourceHref: `/command/response?incident=${encodeURIComponent(i.id)}`,
          },
        })),
      ...observations.map((o) => ({
        type: 'Feature' as const,
        id: o.id,
        geometry: { type: 'Point' as const, coordinates: o.location },
        properties: {
          kind: (o.module === 'flow'
            ? 'traffic'
            : o.module === 'aqua'
              ? 'flood'
              : o.module === 'road'
                ? 'road'
                : 'infrastructure') as GeoLayer,
          label: o.title,
          source: 'DEMO' as const,
          observedAt: o.observedAt,
          verified: false,
          sourceHref: `/command/${o.module}`,
        },
      })),
    ],
  };
}
// Future-only contract; no routing engine or safety guarantee implemented.
export interface PlannedRouteRequest {
  origin: [number, number];
  destination: [number, number];
  at: string;
  hazardFeatureIds: string[];
}
export interface PlannedRouteResult {
  state: 'not-configured';
  safeRouteConfirmed: false;
  reason: string;
}

// Review-only GeoJSON. No flight commands, publishing flags, URLs or personal fields.
const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,160}$/);
const text = z.string().trim().min(1).max(1000);
const date = z.string().datetime({ offset: true });
export const geoCoordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export type GeoCoordinate = z.infer<typeof geoCoordinate>;
const ring = z.array(geoCoordinate).min(4).max(128);
const polygon = z.array(ring).min(1).max(8);
const geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: geoCoordinate }).strict(),
  z
    .object({ type: z.literal('LineString'), coordinates: z.array(geoCoordinate).min(2).max(1000) })
    .strict(),
  z.object({ type: z.literal('Polygon'), coordinates: polygon }).strict(),
  z
    .object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1).max(8) })
    .strict(),
]);
export const geoModules = [
  'sky',
  'flow',
  'aqua',
  'road',
  'fire',
  'geo',
  'core',
  'command',
] as const;
const properties = z
  .object({
    schemaVersion: z.literal(1),
    siteId: id,
    module: z.enum(geoModules),
    kind: z.enum(['TRAIL', 'OBSERVATION', 'AFFECTED_AREA', 'ROAD_SEGMENT', 'GEOFENCE']),
    source: z.enum(['AUTHORIZED', 'DEMO', 'LOCAL']),
    audience: z.enum(['SITE', 'OPERATOR']),
    title: z.string().trim().min(1).max(160),
    location: z.string().max(200),
    description: text,
    severity: z.enum(['critical', 'elevated', 'normal', 'unknown']),
    trafficLevel: z
      .enum(['NORMAL', 'LIGHT', 'MODERATE', 'HEAVY', 'SEVERE', 'UNKNOWN'])
      .nullable()
      .optional(),
    incidentStatus: z.enum(['ACTIVE', 'RESOLVED', 'EXPIRED']).nullable().optional(),
    incidentId: id.nullable().optional(),
    observedAt: date,
    updatedAt: date,
    verification: z.enum(['UNDER_REVIEW', 'VERIFIED', 'REJECTED']),
    verifiedAt: date.nullable(),
    verifiedBy: z.string().max(100).nullable(),
    confidence: z.number().finite().min(0).max(100).nullable(),
    pathStatus: z.enum(['RECORDED', 'PROPOSED', 'SIMULATED']).nullable(),
    sampleTimes: z.array(date).max(1000),
    sessionId: id.nullable(),
    evidenceIds: z.array(id).max(30),
    geometryBasis: z.string().max(500),
    estimated: z.boolean(),
    analysis: z
      .object({
        finding: z.string().max(1000),
        suggestedCause: z.string().max(500).nullable(),
        verifiedCause: z.string().max(500).nullable(),
        method: z.enum(['DEVICE_MODEL', 'DETERMINISTIC_RULES', 'DEMO_ANNOTATION', 'NOT_PROVIDED']),
      })
      .strict(),
  })
  .strict();
export const spatialFeatureSchema = z
  .object({ type: z.literal('Feature'), id, geometry, properties })
  .strict();
export type SpatialFeature = z.infer<typeof spatialFeatureSchema>;
export type SpatialGeometry = SpatialFeature['geometry'];
export type SpatialProperties = SpatialFeature['properties'];
export type SpatialCollection = { type: 'FeatureCollection'; features: SpatialFeature[] };
export type SpatialRole = 'viewer' | 'operator' | null;
export function canViewSpatial(feature: SpatialFeature, role: SpatialRole) {
  const p = feature.properties;
  if (p.source === 'DEMO') return true;
  if (p.source === 'LOCAL') return role === 'operator';
  return !!role && (p.audience === 'SITE' || role === 'operator');
}

export function geometryCoordinates(g: SpatialGeometry): GeoCoordinate[] {
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'LineString':
      return g.coordinates;
    case 'Polygon':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
  }
}
const equal = (a: GeoCoordinate, b: GeoCoordinate) => a[0] === b[0] && a[1] === b[1];
const cross = (a: GeoCoordinate, b: GeoCoordinate, c: GeoCoordinate) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(a: GeoCoordinate, b: GeoCoordinate, p: GeoCoordinate) {
  return (
    Math.abs(cross(a, b, p)) < 1e-12 &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
function intersects(a: GeoCoordinate, b: GeoCoordinate, c: GeoCoordinate, d: GeoCoordinate) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    u = cross(c, d, a),
    v = cross(c, d, b);
  return (
    (((x > 0 && y < 0) || (x < 0 && y > 0)) && ((u > 0 && v < 0) || (u < 0 && v > 0))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function ringCrosses(a: GeoCoordinate[], b: GeoCoordinate[]) {
  return a.slice(1).some((p, i) => b.slice(1).some((q, j) => intersects(a[i], p, b[j], q)));
}
function inside(point: GeoCoordinate, boundary: GeoCoordinate[]) {
  let result = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i],
      b = boundary[j];
    if (onSegment(a, b, point)) return false;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
function validPolygon(rings: GeoCoordinate[][]): boolean {
  for (const r of rings) {
    if (!equal(r[0], r.at(-1)!)) return false;
    let area = 0;
    for (let i = 0; i < r.length - 1; i++) {
      if (equal(r[i], r[i + 1]) || Math.abs(r[i][0] - r[i + 1][0]) > 180) return false;
      area += cross(r[0], r[i], r[i + 1]);
      for (let j = i + 1; j < r.length - 1; j++) {
        if (j === i + 1 || (i === 0 && j === r.length - 2)) continue;
        if (intersects(r[i], r[i + 1], r[j], r[j + 1])) return false;
      }
    }
    if (Math.abs(area) < 1e-12) return false;
  }
  return rings
    .slice(1)
    .every(
      (hole, i) =>
        inside(hole[0], rings[0]) &&
        !ringCrosses(hole, rings[0]) &&
        rings
          .slice(1, i + 1)
          .every(
            (other) =>
              !ringCrosses(hole, other) && !inside(hole[0], other) && !inside(other[0], hole),
          ),
    );
}
export function validSpatialGeometry(g: SpatialGeometry) {
  if (g.type === 'Point') return true;
  if (g.type === 'LineString')
    return (
      g.coordinates.some((p) => !equal(p, g.coordinates[0])) &&
      g.coordinates.slice(1).every((p, i) => Math.abs(p[0] - g.coordinates[i][0]) <= 180)
    );
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const inPolygon = (point: GeoCoordinate, rings: GeoCoordinate[][]) =>
    inside(point, rings[0]) && !rings.slice(1).some((hole) => inside(point, hole));
  return (
    polygons.every(validPolygon) &&
    polygons.every((p, i) =>
      polygons
        .slice(0, i)
        .every(
          (q) =>
            !p.some((a) => q.some((b) => ringCrosses(a, b))) &&
            !inPolygon(p[0][0], q) &&
            !inPolygon(q[0][0], p),
        ),
    )
  );
}

// Access context comes from the caller, never from the file being imported.
export function readSpatialCollection(
  value: unknown,
  context: {
    origin: 'DEMO' | 'IMPORT' | 'BACKEND';
    role: SpatialRole;
    siteId: string;
    now?: number;
  },
): SpatialCollection {
  const parsed = z
    .object({
      type: z.literal('FeatureCollection'),
      features: z.array(spatialFeatureSchema).max(200),
    })
    .strict()
    .safeParse(value);
  if (!parsed.success)
    throw new Error(
      'Invalid GeoJSON contract. Use the supplied review example; unknown or private fields are rejected.',
    );
  const features = parsed.data.features;
  if (new Set(features.map((f) => f.id)).size !== features.length)
    throw new Error('Feature IDs must be unique.');
  if (features.reduce((sum, f) => sum + geometryCoordinates(f.geometry).length, 0) > 5000)
    throw new Error('Maximum 5,000 coordinate positions per review.');
  for (const f of features) {
    const p = f.properties,
      g = f.geometry;
    if (p.siteId !== context.siteId) throw new Error('Spatial data belongs to a different site.');
    if (
      (context.origin === 'DEMO' && p.source !== 'DEMO') ||
      (context.origin === 'IMPORT' && p.source === 'AUTHORIZED') ||
      (context.origin === 'BACKEND' && !context.role)
    )
      throw new Error('File provenance cannot establish authorized backend data.');
    if (!canViewSpatial(f, context.role))
      throw new Error('An authorized operator is required for private spatial observations.');
    if (
      p.source === 'LOCAL' &&
      (p.verification !== 'UNDER_REVIEW' ||
        p.verifiedAt ||
        p.verifiedBy ||
        p.analysis.verifiedCause)
    )
      throw new Error('Local imports must remain under review; a file cannot verify itself.');
    if (!validSpatialGeometry(g))
      throw new Error(
        'Geometry is degenerate, self-intersecting, unclosed, overlapping, or crosses the antimeridian.',
      );
    const expected =
      p.kind === 'OBSERVATION'
        ? 'Point'
        : p.kind === 'TRAIL' || p.kind === 'ROAD_SEGMENT'
          ? 'LineString'
          : 'AREA';
    if (expected === 'AREA' ? !['Polygon', 'MultiPolygon'].includes(g.type) : g.type !== expected)
      throw new Error('Feature kind and geometry disagree.');
    if (
      Date.parse(p.updatedAt) < Date.parse(p.observedAt) ||
      Date.parse(p.updatedAt) > (context.now ?? Date.now()) + 30000
    )
      throw new Error('Invalid observation chronology or future timestamp.');
    if (
      p.verification === 'VERIFIED' &&
      (!p.verifiedAt ||
        !p.verifiedBy ||
        Date.parse(p.verifiedAt) > Date.parse(p.updatedAt) ||
        Date.parse(p.verifiedAt) < Date.parse(p.observedAt))
    )
      throw new Error('Verified records require a reviewer and valid verification timestamp.');
    if (p.analysis.verifiedCause && p.verification !== 'VERIFIED')
      throw new Error('A verified cause requires human verification.');
    if (p.verification !== 'VERIFIED' && (p.verifiedAt || p.verifiedBy))
      throw new Error('Unverified records cannot assert a verification timestamp or reviewer.');
    if (p.kind === 'TRAIL') {
      if (
        !p.pathStatus ||
        (p.source === 'DEMO' && p.pathStatus === 'RECORDED') ||
        (p.source !== 'DEMO' && p.pathStatus === 'SIMULATED')
      )
        throw new Error('Trail provenance and path status disagree.');
      if (p.source !== 'DEMO' && p.audience !== 'OPERATOR')
        throw new Error('Operational trails must be restricted to operators.');
      if (
        g.type === 'LineString' &&
        p.pathStatus !== 'PROPOSED' &&
        (p.sampleTimes.length !== g.coordinates.length ||
          p.sampleTimes.some(
            (at, i) =>
              Date.parse(at) < Date.parse(p.observedAt) ||
              Date.parse(at) > Date.parse(p.updatedAt) ||
              (i > 0 && Date.parse(at) <= Date.parse(p.sampleTimes[i - 1])),
          ))
      )
        throw new Error('Recorded samples require one strictly ordered timestamp per coordinate.');
      if (p.pathStatus === 'PROPOSED' && p.sampleTimes.length)
        throw new Error('A proposal cannot contain completed GPS samples.');
    } else if (p.pathStatus || p.sampleTimes.length)
      throw new Error('GPS sample times belong only to trails.');
    if (
      (expected === 'AREA' || p.kind === 'ROAD_SEGMENT') &&
      (!p.evidenceIds.length || p.geometryBasis.trim().length < 8)
    )
      throw new Error('Boundaries and road geometry need explicit supporting provenance.');
    if (
      p.sessionId &&
      !features.some(
        (s) =>
          s.id === p.sessionId && s.properties.kind === 'TRAIL' && s.properties.source === p.source,
      )
    )
      throw new Error('Associated aerial session is missing or has different provenance.');
  }
  return { type: 'FeatureCollection', features };
}
