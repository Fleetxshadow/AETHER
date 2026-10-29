import { NextResponse } from 'next/server';
import { observations, snapshotSchema } from '@/lib/data';
import { sensorReadings } from '@/lib/telemetry';
export async function GET() {
  const data = snapshotSchema.parse({
    source: 'DEMO',
    generatedAt: '2026-10-12T12:30:00.000Z',
    observations,
    readings: sensorReadings,
  });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
