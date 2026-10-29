import { z } from 'zod';
import { type PublicHazard, type TrafficState, type TrafficIncident } from './contract';

// Read-only compatibility audit: Nexus Drone app/src/traffic/contract.ts, 19 Oct 2026.
// This is its public projection, not an export of private website cases.
const id = z.string().min(1).max(160),
  timestamp = z.number().int().nonnegative();
const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const mobileTrafficIncidentSchema = z
  .object({
    schemaVersion: z.literal(1),
    incidentId: id,
    segmentIds: z.array(id).max(500),
    networkVersion: id.nullable(),
    roadName: z.string().min(1).max(160),
    affectedGeometry: z
      .object({ type: z.literal('LineString'), coordinates: z.array(coordinate).min(2).max(2000) })
      .strict()
      .nullable(),
    severity: z.enum(['NORMAL', 'LIGHT', 'MODERATE', 'HEAVY', 'SEVERE', 'UNKNOWN']),
    trend: z.enum(['STABLE', 'WORSENING', 'RECOVERING', 'UNKNOWN']),
    observedSpeedKmh: z.number().min(0).max(180).nullable(),
    baselineSpeedKmh: z.number().positive().max(180).nullable(),
    cause: z.enum([
      'UNKNOWN',
      'BREAKDOWN',
      'ACCIDENT',
      'WATERLOGGING',
      'ROAD_DAMAGE',
      'ROADWORK',
      'OTHER',
    ]),
    causeStatus: z.enum(['UNKNOWN', 'INVESTIGATING', 'AI_SUGGESTED', 'VERIFIED', 'RESOLVED']),
    source: z.enum(['AUTHORIZED', 'DEMO']),
    verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED']),
    publicApproved: z.boolean(),
    provenance: z
      .array(
        z
          .object({
            system: z.enum([
              'NEXUS_FLOW',
              'NEXUS_CORE',
              'NEXUS_SKY',
              'NEXUS_AQUA',
              'NEXUS_ROAD',
              'NEXUS_COMMAND',
            ]),
            summary: z.string().min(1).max(500),
          })
          .strict(),
      )
      .max(10),
    status: z.enum(['ACTIVE', 'RESOLVED']),
    restriction: z.enum(['NONE', 'DELAY', 'CLOSED', 'PARTIAL']),
    firstDetectedAt: timestamp,
    updatedAt: timestamp,
    expiresAt: timestamp,
    lastVerifiedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.firstDetectedAt > v.updatedAt ||
      v.expiresAt <= v.updatedAt ||
      (v.lastVerifiedAt !== null && v.lastVerifiedAt > v.updatedAt)
    )
      c.addIssue({ code: 'custom', message: 'Invalid incident chronology' });
    if (
      v.causeStatus === 'VERIFIED' &&
      (v.cause === 'UNKNOWN' || v.lastVerifiedAt === null || v.verificationStatus !== 'VERIFIED')
    )
      c.addIssue({
        code: 'custom',
        message: 'Verified cause requires reviewed incident and verification time',
      });
    if ((v.status === 'RESOLVED') !== (v.causeStatus === 'RESOLVED'))
      c.addIssue({ code: 'custom', message: 'Resolution states must agree' });
  });
export type MobileTrafficIncident = z.infer<typeof mobileTrafficIncidentSchema>;
// One trust boundary for HTTP feeds, Firestore snapshots and cached/offline records.
export function selectPublicTraffic(
  records: unknown[],
  segmentIds: string[],
  networkVersion: string | null,
  source: 'DEMO' | 'AUTHORIZED',
  now: number,
): MobileTrafficIncident[] {
  if (!networkVersion || !segmentIds.length) return [];
  return records.flatMap((value) => {
    const parsed = mobileTrafficIncidentSchema.safeParse(value);
    if (!parsed.success) return [];
    const i = parsed.data;
    return i.publicApproved &&
      i.source === source &&
      i.networkVersion === networkVersion &&
      i.segmentIds.some((id) => segmentIds.includes(id)) &&
      i.updatedAt <= now &&
      now - i.updatedAt < 900000 &&
      i.expiresAt > now
      ? [i]
      : [];
  });
}
export function toMobileIncident(
  h: PublicHazard,
  i: TrafficIncident,
  s: TrafficState,
): MobileTrafficIncident {
  const mapped = {
    VEHICLE_BREAKDOWN: 'BREAKDOWN',
    ROAD_CONSTRUCTION: 'ROADWORK',
    ROAD_DAMAGE: 'ROAD_DAMAGE',
    WATERLOGGING: 'WATERLOGGING',
    FLOODING: 'WATERLOGGING',
    ACCIDENT: 'ACCIDENT',
    UNKNOWN: 'UNKNOWN',
  } as const;
  const known = h.verificationStatus === 'VERIFIED' && h.cause !== 'UNKNOWN';
  const roads = s.segments.filter((r) => h.segmentIds.includes(r.id));
  const trend = roads.some((r) => r.estimate.trend === 'IMPROVING')
    ? 'RECOVERING'
    : roads.some((r) => r.estimate.trend === 'WORSENING')
      ? 'WORSENING'
      : roads.every((r) => r.estimate.trend === 'STABLE')
        ? 'STABLE'
        : 'UNKNOWN';
  return mobileTrafficIncidentSchema.parse({
    schemaVersion: 1,
    incidentId: h.id,
    segmentIds: h.segmentIds,
    networkVersion: i.networkVersion,
    roadName: h.roadName,
    affectedGeometry: i.affectedGeometry.length === 1 ? i.affectedGeometry[0] : null,
    severity: h.severity,
    trend,
    observedSpeedKmh: i.observedSpeedKmh,
    baselineSpeedKmh: i.baselineSpeedKmh,
    cause: known ? (mapped[h.cause as keyof typeof mapped] ?? 'OTHER') : 'UNKNOWN',
    causeStatus: h.status === 'RESOLVED' ? 'RESOLVED' : known ? 'VERIFIED' : 'UNKNOWN',
    source: h.source === 'LIVE' ? 'AUTHORIZED' : 'DEMO',
    verificationStatus: h.verificationStatus,
    publicApproved: true,
    provenance: [
      {
        system: 'NEXUS_FLOW',
        summary:
          h.source === 'DEMO'
            ? 'Explicit synthetic traffic demonstration.'
            : 'Authorized aggregated traffic observations.',
      },
      {
        system: 'NEXUS_COMMAND',
        summary: 'Human-approved public projection. No private evidence or identities.',
      },
    ],
    status: h.status,
    restriction: h.status === 'RESOLVED' ? 'NONE' : 'DELAY',
    firstDetectedAt: Date.parse(i.firstDetectedAt),
    updatedAt: Date.parse(h.updatedAt),
    expiresAt: Date.parse(h.expiresAt),
    lastVerifiedAt: known && i.verifiedAt ? Date.parse(i.verifiedAt) : null,
  });
}
export function relevantPublications(
  s: TrafficState,
  segmentIds: string[],
  networkVersion: string | null,
  now = Date.parse(s.clock),
) {
  return s.hazards
    .filter(
      (h) =>
        h.approved &&
        Date.parse(h.updatedAt) <= now &&
        now - Date.parse(h.updatedAt) < 900000 &&
        Date.parse(h.expiresAt) > now &&
        h.segmentIds.some((id) => segmentIds.includes(id)),
    )
    .map((h) =>
      toMobileIncident(
        h,
        s.incidents.find((i) => i.id === h.incidentId)!,
        s,
      ),
    )
    .filter((i) => i.networkVersion === networkVersion);
}
