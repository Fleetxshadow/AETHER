import { z } from 'zod';
import type { ModuleId } from './modules';
import { telemetry, sensorReadingSchema } from './telemetry';

export const observationSchema = z.object({
  id: z.string(),
  title: z.string(),
  module: z.enum([
    'sky',
    'flow',
    'rescue',
    'thermal',
    'aqua',
    'road',
    'fire',
    'twin',
    'core',
    'command',
  ]),
  district: z.string(),
  location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  position: z.tuple([z.number(), z.number()]),
  severity: z.enum(['critical', 'elevated', 'normal']),
  observedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  confidence: z.number().min(0).max(100),
  description: z.string(),
  source: z.enum(['Simulated aerial observation', 'Device observation', 'AI detection']),
  dataSource: z.enum(['DEMO', 'LIVE']).optional(),
  deviceId: z.string().optional(),
  siteId: z.string().optional(),
  evidence: z.string(),
  metric: z.number(),
  unit: z.string(),
  sensor: z.string(),
});
export type Observation = z.infer<typeof observationSchema>;
export const snapshotSchema = z.object({
  source: z.literal('DEMO'),
  generatedAt: z.string().datetime(),
  observations: z.array(observationSchema),
  readings: z.array(sensorReadingSchema),
});
export type DataSnapshot = z.infer<typeof snapshotSchema>;
export interface ObservationAdapter {
  load(signal?: AbortSignal): Promise<DataSnapshot>;
}

export const normalizeStep = (step: number) =>
  Number.isFinite(step) ? Math.max(0, Math.min(4, Math.round(step))) : 3;
export const hours = [6, 9, 12, 15, 18] as const;
export const demoDate = '2026-10-12';
export const snapshotTime = (step: number) =>
  `${demoDate}T${String(hours[normalizeStep(step)] - 6).padStart(2, '0')}:30:00.000Z`;
export const timeLabel = (step: number) =>
  `${String(hours[normalizeStep(step)]).padStart(2, '0')}:00 IST`;
const at = (hour: number, minute = 0) =>
  `${demoDate}T${String(hour - 5 - (minute < 30 ? 1 : 0)).padStart(2, '0')}:${String((minute + 30) % 60).padStart(2, '0')}:00.000Z`;

export const observations: Observation[] = [
  {
    id: 'NX-2401',
    title: 'Surface heat anomaly',
    module: 'thermal',
    district: 'Central district',
    location: [77.596, 12.976],
    position: [2, 3],
    severity: 'elevated',
    observedAt: at(8, 42),
    resolvedAt: null,
    confidence: 94.6,
    description:
      'Illustrative rooftop surface temperature exceeds the neighborhood baseline by 8.2°C. Review the thermal sample before making any operational decision.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic thermal frame / TH-024',
    metric: 42.8,
    unit: '°C',
    sensor: 'LWIR / 640 × 512',
  },
  {
    id: 'NX-2402',
    title: 'Junction congestion',
    module: 'flow',
    district: 'East interchange',
    location: [77.606, 12.97],
    position: [13, -4],
    severity: 'elevated',
    observedAt: at(7, 15),
    resolvedAt: at(16, 10),
    confidence: 96.2,
    description:
      'Simulated queue length reaches 180 m on the eastern approach. Vehicle speeds remain below the modeled morning baseline.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic mobility sequence / FL-018',
    metric: 18.4,
    unit: 'km/h',
    sensor: 'RGB / optical flow',
  },
  {
    id: 'NX-2403',
    title: 'Drainage overflow risk',
    module: 'aqua',
    district: 'Riverfront sector',
    location: [77.582, 12.968],
    position: [-14, -7],
    severity: 'critical',
    observedAt: at(11, 22),
    resolvedAt: null,
    confidence: 91.8,
    description:
      'A modeled rainfall pulse raises the illustrative channel level. The simulated drainage system is operating at 82% of its assumed capacity.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic water level frame / AQ-006',
    metric: 28.6,
    unit: 'cm',
    sensor: 'Depth estimate / RGB',
  },
  {
    id: 'NX-2404',
    title: 'Road surface fracture',
    module: 'road',
    district: 'North corridor',
    location: [77.59, 12.984],
    position: [-5, 13],
    severity: 'elevated',
    observedAt: at(10, 8),
    resolvedAt: null,
    confidence: 97.3,
    description:
      'A synthetic 1.4 m surface defect is marked for review. Severity is an illustrative model output and requires physical inspection.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic pavement frame / RD-031',
    metric: 1.4,
    unit: 'm',
    sensor: 'RGB / surface classifier',
  },
  {
    id: 'NX-2405',
    title: 'Smoke signature detected',
    module: 'fire',
    district: 'Industrial quarter',
    location: [77.603, 12.983],
    position: [11, 12],
    severity: 'critical',
    observedAt: at(14, 12),
    resolvedAt: null,
    confidence: 87.5,
    description:
      'A synthetic smoke plume and thermal signature overlap in the industrial sector. This demonstration is not a verified fire alert.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic smoke sequence / FI-009',
    metric: 67.2,
    unit: '°C',
    sensor: 'RGB + LWIR fusion',
  },
  {
    id: 'NX-2406',
    title: 'Assistance observation',
    module: 'rescue',
    district: 'Civic square',
    location: [77.588, 12.974],
    position: [-7, 2],
    severity: 'critical',
    observedAt: at(12, 40),
    resolvedAt: at(17, 20),
    confidence: 92.1,
    description:
      'Illustrative assistance request at the civic plaza. The recorded scenario demonstrates incident review and status progression; no response has been dispatched.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic incident recording / RS-012',
    metric: 4.2,
    unit: 'min',
    sensor: 'RGB / scene observation',
  },
  {
    id: 'NX-2407',
    title: 'Aerial survey completed',
    module: 'sky',
    district: 'West parkland',
    location: [77.581, 12.979],
    position: [-15, 7],
    severity: 'normal',
    observedAt: at(5, 50),
    resolvedAt: null,
    confidence: 98.1,
    description:
      'The bundled sample survey covers 2.4 km² of conceptual city geometry. Telemetry is prerecorded demonstration data.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic survey log / SK-001',
    metric: 120,
    unit: 'm',
    sensor: 'RGB / multispectral',
  },
  {
    id: 'NX-2408',
    title: 'Green corridor baseline',
    module: 'thermal',
    district: 'West parkland',
    location: [77.58, 12.975],
    position: [-16, 3],
    severity: 'normal',
    observedAt: at(5, 40),
    resolvedAt: null,
    confidence: 95.4,
    description:
      'Illustrative canopy temperature is 6.4°C below the central district. This baseline provides context for the thermal demonstration.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic canopy frame / TH-021',
    metric: 29.1,
    unit: '°C',
    sensor: 'LWIR / vegetation mask',
  },
  {
    id: 'NX-2409',
    title: 'Evening mobility recovery',
    module: 'flow',
    district: 'South boulevard',
    location: [77.597, 12.96],
    position: [4, -15],
    severity: 'normal',
    observedAt: at(17, 5),
    resolvedAt: null,
    confidence: 96.8,
    description:
      'Recorded demo traffic returns toward the modeled baseline along the south boulevard.',
    source: 'Simulated aerial observation',
    evidence: 'Synthetic mobility sequence / FL-026',
    metric: 34.7,
    unit: 'km/h',
    sensor: 'RGB / optical flow',
  },
];

export function visibleObservations(
  records: readonly Observation[],
  step: number,
  module?: ModuleId,
  query = '',
) {
  const cutoff = Date.parse(snapshotTime(step));
  const term = query.trim().toLowerCase();
  return records.filter(
    (o) =>
      (o.dataSource === 'LIVE' || Date.parse(o.observedAt) <= cutoff) &&
      (!module ||
        module === 'command' ||
        module === 'twin' ||
        module === 'core' ||
        o.module === module) &&
      (!term || `${o.id} ${o.title} ${o.district} ${o.module}`.toLowerCase().includes(term)),
  );
}
export function observationStatus(o: Observation, step: number) {
  return o.resolvedAt &&
    Date.parse(o.resolvedAt) <=
      (o.dataSource === 'LIVE' ? Date.now() : Date.parse(snapshotTime(step)))
    ? 'resolved'
    : 'review required';
}
export function metricsAt(step: number, records: readonly Observation[] = observations) {
  step = normalizeStep(step);
  const visible = visibleObservations(records, step);
  return {
    active: visible.filter(
      (o) => observationStatus(o, step) !== 'resolved' && o.severity !== 'normal',
    ).length,
    observations: visible.length,
    temperature: telemetry.temperature[step],
    speed: telemetry.speed[step],
    rainfall: telemetry.rainfall[step],
    water: telemetry.water[step],
    health: telemetry.health[step],
  };
}
export const demoAdapter: ObservationAdapter = {
  async load(signal) {
    const response = await fetch('/api/observations', { signal });
    if (!response.ok) throw new Error(`Demo service unavailable (${response.status})`);
    return snapshotSchema.parse(await response.json());
  },
};
export const severityColor = { critical: '#f99072', elevated: '#ffb347', normal: '#d8ed86' };
export function formatObservedAt(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
