import { NextResponse } from 'next/server';
import { getNexusBackendUrl } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = `${getNexusBackendUrl()}/api/lab/vision/samples`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ samples: [] });
  }
}
