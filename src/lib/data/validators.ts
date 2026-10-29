import { z } from 'zod';
import { observationSchema } from '../data';
import { moduleIds } from '../modules';
import type { Feed, LiveFeeds } from './types';
export const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const date = z.string().datetime();
const moduleId = z.enum(moduleIds);
const live = z.literal('LIVE');
export const channelUnits = {
  temperature: '°C',
  speed: 'km/h',
  rainfall: 'mm',
  water: 'cm',
  health: '%',
  altitude: 'm',
  battery: '%',
} as const;
const bounds = {
  temperature: [-100, 2000],
  speed: [0, 350],
  rainfall: [0, 5000],
  water: [0, 100000],
  health: [0, 100],
  altitude: [0, 50000],
  battery: [0, 100],
} as const;
export const readingSchema = z
  .object({
    deviceId: safeId,
    module: moduleId,
    channel: z.enum(['temperature', 'speed', 'rainfall', 'water', 'health', 'altitude', 'battery']),
    value: z.number().finite(),
    unit: z.string().max(12),
    observedAt: date,
    source: live,
  })
  .strict()
  .refine(
    (v) =>
      v.unit === channelUnits[v.channel] &&
      v.value >= bounds[v.channel][0] &&
      v.value <= bounds[v.channel][1],
    'Reading units or range invalid',
  );
export const deviceSchema = z
  .object({
    id: safeId,
    name: z.string().min(1).max(100),
    module: moduleId,
    status: z.enum(['online', 'offline']),
    lastSeen: date,
    source: live,
  })
  .strict();
export const cameraHealthSchema = z
  .object({
    cameraId: safeId,
    deviceId: safeId,
    online: z.boolean(),
    lastSeen: date,
    streamType: z.enum(['vdo-ninja', 'mediamtx']),
    source: live,
    resolution: z
      .string()
      .regex(/^\d{2,5}x\d{2,5}$/)
      .optional(),
    fps: z.number().positive().max(240).optional(),
  })
  .strict();
export const liveObservationSchema = observationSchema
  .extend({
    id: safeId,
    siteId: safeId,
    deviceId: safeId,
    source: z.enum(['Device observation', 'AI detection']),
    dataSource: live,
    title: z.string().min(1).max(160),
    description: z.string().max(2000),
    district: z.string().min(1).max(100),
    evidence: z.string().max(300),
    sensor: z.string().max(100),
    unit: z.string().max(20),
    metric: z.number().finite(),
    position: z.tuple([z.number().min(-30).max(30), z.number().min(-30).max(30)]),
  })
  .strict();
export const aiSchema = z
  .object({
    id: safeId,
    siteId: safeId,
    deviceId: safeId,
    module: moduleId,
    observedAt: date,
    source: live,
    category: z.string().min(1).max(100),
    description: z.string().max(2000),
    confidence: z.number().min(0).max(100),
    observationIds: z.array(safeId).max(50),
  })
  .strict();
export const liveIncidentSchema = z
  .object({
    id: safeId,
    siteId: safeId,
    reportedAt: date,
    source: live,
    category: z.string().min(1).max(100),
    description: z.string().max(2000),
    location: z.string().max(300),
    status: z.string().min(1).max(80),
    externalContactConfirmed: z.boolean(),
  })
  .strict();
const schemas = {
  observations: liveObservationSchema,
  telemetry: readingSchema,
  devices: deviceSchema,
  cameraStatus: cameraHealthSchema,
  aiDetections: aiSchema,
  incidents: liveIncidentSchema,
  responseReports: liveIncidentSchema,
};
export function eventTime(value: unknown): number {
  const row = value as Record<string, unknown>;
  return Date.parse(String(row.observedAt ?? row.lastSeen ?? row.reportedAt));
}
export function validateFeed<K extends Feed>(
  feed: K,
  rows: unknown[],
  now: number,
  siteId: string,
): { data: LiveFeeds[K]; invalid: number } {
  const data: unknown[] = [];
  let invalid = 0;
  for (const row of rows.slice(0, 500)) {
    const result = schemas[feed].safeParse(row);
    if (
      !result.success ||
      eventTime(result.data) > now + 30000 ||
      ('siteId' in result.data && result.data.siteId !== siteId)
    ) {
      invalid++;
      continue;
    }
    data.push(result.data);
  }
  return { data: data as LiveFeeds[K], invalid: invalid + Math.max(0, rows.length - 500) };
}
