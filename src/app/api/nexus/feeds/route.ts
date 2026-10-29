import { NextResponse } from 'next/server';
import { fetchNexusFeeds } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feeds = await fetchNexusFeeds();
    return NextResponse.json(feeds, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: 'OFFLINE',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'NEXUS feeds service unreachable',
        devices: [],
        telemetry: [],
        cameraStatus: [],
        aiDetections: [],
        observations: [],
        incidents: [],
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  }
}
