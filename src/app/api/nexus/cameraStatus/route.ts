import { NextResponse } from 'next/server';
import { getNexusBackendUrl } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = `${getNexusBackendUrl()}/api/nexus/cameraStatus`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`Camera status returned ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        source: 'OFFLINE',
        error: error instanceof Error ? error.message : 'Camera service offline',
        cameraStatus: [],
      },
      { status: 200 },
    );
  }
}
