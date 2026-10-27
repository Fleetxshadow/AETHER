import { z } from 'zod';
export const telemetry = {
  temperature: [26.4, 31.2, 38.6, 42.8, 34.2],
  speed: [38.2, 18.4, 27.6, 23.1, 34.7],
  rainfall: [0, 2.4, 12.8, 8.4, 1.2],
  water: [8.2, 12.1, 22.4, 28.6, 19.3],
  health: [92.4, 92.2, 91.8, 91.2, 91.2],
} as const;
export type SensorChannel = keyof typeof telemetry;
export const sensorReadingSchema = z.object({
  sensorId: z.string(),
  channel: z.enum(['temperature', 'speed', 'rainfall', 'water', 'health']),
  observedAt: z.string().datetime(),
  value: z.number().finite(),
  unit: z.string(),
  source: z.literal('DEMO'),
});
export type SensorReading = z.infer<typeof sensorReadingSchema>;
const units: Record<SensorChannel, string> = {
  temperature: '°C',
  speed: 'km/h',
  rainfall: 'mm',
  water: 'cm',
  health: '%',
};
export const sensorReadings: SensorReading[] = (Object.keys(telemetry) as SensorChannel[]).flatMap(
  (channel) =>
    telemetry[channel].map((value, step) => ({
      sensorId: `DEMO-${channel.toUpperCase()}-01`,
      channel,
      observedAt: `2026-10-12T${String(step * 3).padStart(2, '0')}:30:00.000Z`,
      value,
      unit: units[channel],
      source: 'DEMO',
    })),
);
