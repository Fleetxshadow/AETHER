import { z } from 'zod';
import {
  causes,
  idSchema,
  levels,
  roadSchema,
  inspectionStatuses,
  publicHazardSchema,
  type TrafficState,
  sourceSchema,
  geometrySchema,
} from './contract';

const time = z.string().datetime(),
  note = z.string().max(2000),
  speed = z.number().min(0).max(180).nullable();
const meta = { schemaVersion: z.literal(1), id: idSchema, siteId: idSchema, source: sourceSchema };
const stateFields = {
  status: z.enum(['ACTIVE', 'RESOLVED', 'EXPIRED']),
  severity: z.enum(levels),
  cause: z.enum(causes),
  causeStatus: z.enum(['UNKNOWN', 'POSSIBLE', 'VERIFIED', 'REJECTED']),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED']),
};
const estimate = z
  .object({
    level: z.enum(levels),
    observedSpeedKmh: speed,
    baselineSpeedKmh: speed,
    ratio: z.number().min(0).max(36).nullable(),
    independentSamples: z.number().int().min(0).max(200),
    quality: z.enum(['HIGH', 'FAIR', 'INSUFFICIENT']),
    reason: note,
    observedAt: time.nullable(),
    trend: z.enum(['IMPROVING', 'STABLE', 'WORSENING', 'UNKNOWN']),
  })
  .strict();
const segment = roadSchema.safeExtend({
  estimate,
  lowSince: time.nullable(),
  recoverySince: time.nullable(),
  history: z.array(z.object({ at: time, speedKmh: speed, level: z.enum(levels) }).strict()).max(96),
});
const incident = z
  .object({
    ...meta,
    ...stateFields,
    verifiedAt: time.nullable().default(null),
    networkVersion: idSchema.nullable().default(null),
    observationKinds: z
      .array(z.enum(['AUTHORIZED_SENSOR', 'LICENSED_PROVIDER', 'CONSENTED_AGGREGATE', 'DEMO']))
      .max(4)
      .default([]),
    segmentIds: z.array(idSchema).min(1).max(200),
    roadName: note,
    observedSpeedKmh: speed,
    baselineSpeedKmh: speed,
    firstDetectedAt: time,
    updatedAt: time,
    expiresAt: time,
    affectedGeometry: z.array(geometrySchema).min(1).max(200),
    affectedDistanceM: z.number().nonnegative().max(1000000),
    investigationId: idSchema.nullable(),
    priority: z.number().int().min(0).max(100),
  })
  .strict();
const investigation = z
  .object({
    ...meta,
    incidentId: idSchema,
    observationIds: z.array(idSchema).max(150),
    relevantAggregates: z
      .array(
        z
          .object({
            segmentId: idSchema,
            roadClass: z.enum(['ARTERIAL', 'COLLECTOR', 'LOCAL', 'UNKNOWN']),
            estimate,
          })
          .strict(),
      )
      .max(200)
      .default([]),
    candidates: z
      .array(
        z
          .object({
            cause: z.enum(causes),
            description: note,
            evidenceIds: z.array(idSchema).min(1).max(150),
            confidence: z.number().min(0).max(1).nullable(),
          })
          .strict(),
      )
      .max(150),
    uncertainty: note,
    nextStep: note,
    publicDraft: note,
    method: z.enum(['DETERMINISTIC_RULES', 'DEMO_FIXTURE_ANNOTATIONS']),
    updatedAt: time,
    reviewer: z.string().max(200).nullable(),
    notes: note,
  })
  .strict();
const request = z
  .object({
    ...meta,
    incidentId: idSchema,
    requestReason: note,
    areaOfInterest: z.array(geometrySchema).max(200),
    requestedObservationType: note,
    priority: z.number().min(0).max(100),
    supportingEvidence: z.array(idSchema).max(150),
    status: z.enum(inspectionStatuses),
    createdAt: time,
    reviewedAt: time.nullable(),
    authorizedReviewer: z.string().max(200).nullable(),
    linkedObservationIds: z.array(idSchema).max(150),
  })
  .strict();
const evidence = z
  .object({
    ...meta,
    incidentId: idSchema,
    requestId: idSchema,
    capturedAt: time,
    receivedAt: time,
    expiresAt: time,
    kind: z.literal('DEMO_ILLUSTRATION'),
    fixture: z.enum(['obstruction', 'water']),
    description: note,
    authorizedBy: z.string().max(200),
    humanReviewStatus: z.enum(['UNREVIEWED', 'CONFIRMED', 'REJECTED']),
  })
  .strict();
const event = z
  .object({
    ...meta,
    at: time,
    recordedAt: time,
    actor: z.string().max(200),
    incidentId: idSchema.nullable(),
    action: z.string().max(80),
    detail: note,
    revision: z.number().int().nonnegative(),
    snapshot: z.object(stateFields).strict().nullable(),
  })
  .strict();
const sample = z
  .object({
    kind: z.enum(['AUTHORIZED_SENSOR', 'LICENSED_PROVIDER', 'CONSENTED_AGGREGATE', 'DEMO']),
    id: z.string().max(400),
    contributor: z.string().max(400),
    speed: z.number().min(0).max(180),
    at: time,
    accuracy: z.number().min(0).max(30),
    confidence: z.number().min(0.65).max(1),
  })
  .strict();
export const trafficStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    siteId: idSchema,
    source: sourceSchema,
    revision: z.number().int().nonnegative(),
    clock: time,
    createdAt: time,
    expiresAt: time,
    demoStep: z.number().int().nonnegative(),
    segments: z.array(segment).max(200),
    incidents: z.array(incident).max(300),
    investigations: z.array(investigation).max(300),
    requests: z.array(request).max(600),
    evidence: z.array(evidence).max(150),
    hazards: z.array(publicHazardSchema).max(300),
    events: z.array(event).max(2000),
    windows: z.record(idSchema, z.array(sample).max(200)),
    seenIds: z.record(z.string().max(400), z.number().finite().nonnegative()),
  })
  .strict()
  .superRefine((s, c) => {
    const problem = (message: string) => c.addIssue({ code: 'custom', message });
    const roads = new Set(s.segments.map((r) => r.id)),
      cases = new Set(s.incidents.map((i) => i.id));
    for (const rows of [
      s.segments,
      s.incidents,
      s.investigations,
      s.requests,
      s.evidence,
      s.hazards,
      s.events,
    ]) {
      if (new Set(rows.map((r) => r.id)).size !== rows.length) problem('Duplicate record IDs');
      for (const row of rows)
        if (row.siteId !== s.siteId || row.source !== s.source) problem('Site/source mismatch');
    }
    for (const i of s.incidents) {
      if (i.verificationStatus === 'VERIFIED' && (!i.verifiedAt || i.verifiedAt > i.updatedAt))
        problem('Verified incident requires a canonical review timestamp');
      if (!i.segmentIds.every((id) => roads.has(id))) problem('Missing road reference');
      if (i.firstDetectedAt > i.updatedAt) problem('Invalid incident chronology');
      if (
        (i.causeStatus === 'VERIFIED') !== (i.verificationStatus === 'VERIFIED') ||
        (i.verificationStatus === 'VERIFIED' && i.cause === 'UNKNOWN')
      )
        problem('Invalid verification state');
    }
    for (const r of [...s.requests, ...s.investigations, ...s.evidence, ...s.hazards])
      if (!cases.has(r.incidentId)) problem('Missing incident reference');
    if (Object.keys(s.windows).some((k) => !roads.has(k)) || Object.keys(s.seenIds).length > 40000)
      problem('Invalid aggregation window');
    if (s.source === 'LIVE' && s.evidence.length) problem('Demo evidence prohibited in LIVE');
    if (
      s.source === 'LIVE' &&
      Object.values(s.windows).some((rows) => rows.some((v) => v.kind === 'DEMO'))
    )
      problem('Demo samples prohibited in LIVE');
  });
export function validateTrafficState(
  value: unknown,
  siteId: string,
  source: 'DEMO' | 'LIVE',
): TrafficState {
  // Only the pre-release local demo format is backfilled. LIVE migrations require review.
  if (source === 'DEMO' && value && typeof value === 'object') {
    const old = structuredClone(value) as TrafficState;
    if (
      Array.isArray(old.incidents) &&
      Array.isArray(old.events) &&
      old.windows &&
      typeof old.windows === 'object'
    ) {
      for (const i of old.incidents)
        if (i.verifiedAt === undefined)
          i.verifiedAt =
            i.verificationStatus === 'VERIFIED'
              ? (old.events
                  .filter((e) => e.incidentId === i.id && e.action === 'CAUSE_VERIFIED')
                  .at(-1)?.at ?? null)
              : null;
      for (const rows of Object.values(old.windows))
        if (Array.isArray(rows))
          for (const sample of rows) if (sample.kind === undefined) sample.kind = 'DEMO';
      value = old;
    }
  }
  if (source === 'DEMO' && value && typeof value === 'object') {
    const old = value as TrafficState;
    if (Array.isArray(old.incidents) && Array.isArray(old.segments))
      for (const i of old.incidents)
        if (i.networkVersion === undefined) {
          const roads = old.segments.filter((r) => i.segmentIds.includes(r.id));
          i.networkVersion =
            roads.length && roads.every((r) => r.networkVersion === roads[0].networkVersion)
              ? roads[0].networkVersion
              : null;
        }
  }
  const s = trafficStateSchema.parse(value);
  if (s.siteId !== siteId || s.source !== source) throw new Error('Workspace mismatch');
  return s;
}
