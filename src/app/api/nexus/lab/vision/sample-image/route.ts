import { NextRequest, NextResponse } from 'next/server';
import { getNexusBackendUrl } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('filename') || '';
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  try {
    const url = `${getNexusBackendUrl()}/api/lab/vision/sample-image?filename=${encodeURIComponent(filename)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Sample image unavailable', { status: 404 });
  }
}
