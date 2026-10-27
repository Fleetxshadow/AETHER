import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{1,160}$/)
  .refine((id) => !Object.hasOwn(Object.prototype, id) && !['prototype', '.', '..'].includes(id));
export const sourceSchema = z.enum(['DEMO', 'LIVE']);
export type TrafficSource = z.infer<typeof sourceSchema>;
export const levels = ['NORMAL', 'LIGHT', 'MODERATE', 'HEAVY', 'SEVERE', 'UNKNOWN'] as const;
export type TrafficLevel = (typeof levels)[number];
export const causes = [
  'ACCIDENT',
  'VEHICLE_BREAKDOWN',
  'ROAD_CONSTRUCTION',
  'WATERLOGGING',
  'FLOODING',
  'ROAD_CLOSURE',
  'ROAD_DAMAGE',
  'EVENT_CROWDING',
  'SIGNAL_DISRUPTION',
  'GENERAL_VOLUME',
  'UNKNOWN',
] as const;
export type Cause = (typeof causes)[number];
export const inspectionStatuses = [
  'RECOMMENDED',
  'PENDING_REVIEW',
  'APPROVED_FOR_OPERATOR_PLANNING',
  'REJECTED',
  'OBSERVATION_AVAILABLE',
  'ANALYSIS_COMPLETE',
  'CANCELLED',
] as const;
export type InspectionStatus = (typeof inspectionStatuses)[number];
export const coordinateSchema = z.tuple([
  z.number().min(76.7).max(77.35),
  z.number().min(28.25).max(28.7),
]);
export type Coordinate = z.infer<typeof coordinateSchema>;
export const geometrySchema = z
  .object({ type: z.literal('LineString'), coordinates: z.array(coordinateSchema).min(2).max(128) })
  .strict();
export const baselineSchema = z
  .object({
    speedKmh: z.number().min(5).max(120),
    reliability: z.number().min(0).max(1),
    sampleDays: z.number().int().min(1).max(3650),
    dayType: z.enum(['WEEKDAY', 'WEEKEND']),
    startHourIST: z.number().int().min(0).max(23),
    endHourIST: z.number().int().min(1).max(24),
    provenance: z.string().min(5).max(200),
  })
  .strict()
  .refine((b) => b.endHourIST > b.startHourIST);
export const roadSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    siteId: idSchema,
    source: sourceSchema,
    roadName: z.string().min(2).max(120),
    locality: z.string().min(2).max(80),
    corridorId: idSchema,
    direction: z.string().min(1).max(40),
    bearing: z.number().min(0).max(359.99),
    classification: z.enum(['ARTERIAL', 'COLLECTOR', 'LOCAL', 'UNKNOWN']),
    legalSpeedKmh: z.number().positive().max(150).nullable(),
    geometry: geometrySchema,
    geometryProvenance: z.string().min(5).max(200),
    geometryStatus: z.enum(['REFERENCE_SKETCH', 'LICENSED']),
    networkVersion: idSchema.nullable(),
    baseline: baselineSchema.nullable(),
  })
  .strict()
  .refine(
    (r) => r.source === 'DEMO' || r.geometryStatus === 'LICENSED',
    'Live road registry requires licensed geometry provenance',
  );
export const observationSchema = z
  .object({
    schemaVersion: z.literal(1),
    observationId: idSchema,
    segmentId: idSchema.optional(),
    contributorId: idSchema,
    source: sourceSchema,
    kind: z.enum(['AUTHORIZED_SENSOR', 'LICENSED_PROVIDER', 'CONSENTED_AGGREGATE', 'DEMO']),
    consented: z.boolean(),
    location: coordinateSchema,
    heading: z.number().min(0).max(359.99),
    speedKmh: z.number().min(0).max(180),
    accuracyM: z.number().min(0).max(200),
    providerConfidence: z.number().min(0).max(1),
    observedAt: z.string().datetime(),
  })
  .strict()
  .refine((o) => o.kind !== 'CONSENTED_AGGREGATE' || o.consented, 'Consented aggregation required')
  .refine((o) => (o.source === 'DEMO') === (o.kind === 'DEMO'), 'Demo source and kind must agree');
export type SpeedObservation = z.infer<typeof observationSchema>;
export interface Estimate {
  level: TrafficLevel;
  observedSpeedKmh: number | null;
  baselineSpeedKmh: number | null;
  ratio: number | null;
  independentSamples: number;
  quality: 'HIGH' | 'FAIR' | 'INSUFFICIENT';
  reason: string;
  observedAt: string | null;
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
}
export type RoadSegment = z.infer<typeof roadSchema> & {
  estimate: Estimate;
  lowSince: string | null;
  recoverySince: string | null;
  history: { at: string; speedKmh: number | null; level: TrafficLevel }[];
};
export interface Sample {
  kind: SpeedObservation['kind'];
  id: string;
  contributor: string;
  speed: number;
  at: string;
  accuracy: number;
  confidence: number;
}
export interface TrafficIncident {
  schemaVersion: 1;
  id: string;
  siteId: string;
  source: TrafficSource;
  segmentIds: string[];
  roadName: string;
  severity: TrafficLevel;
  observedSpeedKmh: number | null;
  baselineSpeedKmh: number | null;
  cause: Cause;
  causeStatus: 'UNKNOWN' | 'POSSIBLE' | 'VERIFIED' | 'REJECTED';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED';
  verifiedAt: string | null;
  observationKinds: SpeedObservation['kind'][];
  networkVersion: string | null;
  status: 'ACTIVE' | 'RESOLVED' | 'EXPIRED';
  firstDetectedAt: string;
  updatedAt: string;
  expiresAt: string;
  affectedGeometry: z.infer<typeof geometrySchema>[];
  affectedDistanceM: number;
  investigationId: string | null;
  priority: number;
}
export interface Investigation {
  schemaVersion: 1;
  id: string;
  siteId: string;
  source: TrafficSource;
  incidentId: string;
  observationIds: string[];
  relevantAggregates: {
    segmentId: string;
    roadClass: RoadSegment['classification'];
    estimate: Estimate;
  }[];
  candidates: {
    cause: Cause;
    description: string;
    evidenceIds: string[];
    confidence: number | null;
  }[];
  uncertainty: string;
  nextStep: string;
  publicDraft: string;
  method: 'DETERMINISTIC_RULES' | 'DEMO_FIXTURE_ANNOTATIONS';
  updatedAt: string;
  reviewer: string | null;
  notes: string;
}
export interface InspectionRequest {
  schemaVersion: 1;
  id: string;
  siteId: string;
  source: TrafficSource;
  incidentId: string;
  requestReason: string;
  areaOfInterest: z.infer<typeof geometrySchema>[];
  requestedObservationType: string;
  priority: number;
  supportingEvidence: string[];
  status: InspectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  authorizedReviewer: string | null;
  linkedObservationIds: string[];
}
export interface IncidentEvidence {
  schemaVersion: 1;
  id: string;
  siteId: string;
  source: TrafficSource;
  incidentId: string;
  requestId: string;
  capturedAt: string;
  receivedAt: string;
  expiresAt: string;
  kind: 'DEMO_ILLUSTRATION';
  fixture: 'obstruction' | 'water';
  description: string;
  authorizedBy: string;
  humanReviewStatus: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
}
export interface PublicHazard {
  schemaVersion: 1;
  id: string;
  siteId: string;
  source: TrafficSource;
  incidentId: string;
  segmentIds: string[];
  roadName: string;
  severity: TrafficLevel;
  cause: Cause;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED';
  status: 'ACTIVE' | 'RESOLVED';
  summary: string;
  approved: true;
  publishedAt: string;
  updatedAt: string;
  expiresAt: string;
  revision: number;
  etaChangeMinutes: null;
}
export interface AuditEvent {
  schemaVersion: 1;
  siteId: string;
  source: TrafficSource;
  id: string;
  at: string;
  recordedAt: string;
  actor: string;
  incidentId: string | null;
  action: string;
  detail: string;
  revision: number;
  snapshot: Pick<
    TrafficIncident,
    'status' | 'severity' | 'cause' | 'causeStatus' | 'verificationStatus'
  > | null;
}
export interface TrafficState {
  schemaVersion: 1;
  siteId: string;
  source: TrafficSource;
  revision: number;
  clock: string;
  createdAt: string;
  expiresAt: string;
  demoStep: number;
  segments: RoadSegment[];
  incidents: TrafficIncident[];
  investigations: Investigation[];
  requests: InspectionRequest[];
  evidence: IncidentEvidence[];
  hazards: PublicHazard[];
  events: AuditEvent[];
  windows: Record<string, Sample[]>;
  seenIds: Record<string, number>;
}
export const settingsSchema = z
  .object({
    freshnessMs: z.number().int().min(30000).max(600000),
    minimumSamples: z.number().int().min(3).max(30),
    minimumPersistenceMs: z.number().int().min(30000).max(900000),
    recoveryMs: z.number().int().min(60000).max(900000),
    cooldownMs: z.number().int().min(60000).max(3600000),
    expiryMs: z.number().int().min(180000).max(3600000),
    ratios: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  })
  .strict()
  .refine((s) => s.ratios.every((v, i, a) => v > 0 && v < 1 && (!i || a[i - 1] > v)));
export type TrafficSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: TrafficSettings = {
  freshnessMs: 90000,
  minimumSamples: 4,
  minimumPersistenceMs: 120000,
  recoveryMs: 180000,
  cooldownMs: 600000,
  expiryMs: 900000,
  ratios: [0.85, 0.65, 0.45, 0.25],
};
export const commandSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('start-demo'),
      expectedRevision: z.number().int().min(0).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('demo-observations'),
      expectedRevision: z.number().int().min(0),
      phase: z.enum(['normal', 'slow', 'recovery', 'advance']),
    })
    .strict(),
  z
    .object({
      action: z.literal('ingest'),
      expectedRevision: z.number().int().min(0),
      observations: z.array(observationSchema).min(1).max(40),
    })
    .strict(),
  z
    .object({
      action: z.literal('register-roads'),
      expectedRevision: z.number().int().min(0),
      roads: z.array(roadSchema).min(1).max(12),
    })
    .strict(),
  z
    .object({
      action: z.literal('analyze'),
      expectedRevision: z.number().int().min(0),
      incidentId: idSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('request-review'),
      expectedRevision: z.number().int().min(0),
      requestId: idSchema,
      status: z.enum(['PENDING_REVIEW', 'APPROVED_FOR_OPERATOR_PLANNING', 'REJECTED', 'CANCELLED']),
      notes: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('attach-sample'),
      expectedRevision: z.number().int().min(0),
      requestId: idSchema,
      fixture: z.enum(['obstruction', 'water']),
      rightsConfirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('verify'),
      expectedRevision: z.number().int().min(0),
      incidentId: idSchema,
      decision: z.enum(['confirm', 'reject']),
      cause: z.enum(causes),
      notes: z.string().trim().min(15).max(1000),
      reviewedEvidence: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('publish'),
      expectedRevision: z.number().int().min(0),
      incidentId: idSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('resolve'),
      expectedRevision: z.number().int().min(0),
      incidentId: idSchema,
      notes: z.string().trim().min(15).max(1000),
    })
    .strict(),
]);
export type TrafficCommand = z.infer<typeof commandSchema>;
export const publicHazardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    siteId: idSchema,
    source: sourceSchema,
    incidentId: idSchema,
    segmentIds: z.array(idSchema).min(1).max(40),
    roadName: z.string().max(120),
    severity: z.enum(levels),
    cause: z.enum(causes),
    verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED']),
    status: z.enum(['ACTIVE', 'RESOLVED']),
    summary: z.string().max(600),
    approved: z.literal(true),
    publishedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    revision: z.number().int().min(1),
    etaChangeMinutes: z.null(),
  })
  .strict()
  .refine((h) => h.cause === 'UNKNOWN' || h.verificationStatus === 'VERIFIED');
