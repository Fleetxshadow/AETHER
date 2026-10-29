import { NextRequest, NextResponse } from 'next/server';
import { getNexusBackendUrl, type NexusVisionInferResponse } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const url = `${getNexusBackendUrl()}/api/nexus/vision/infer`;

    let res: Response;
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000),
      });
    } else {
      const body = await request.json();
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || err.error || 'Vision inference error', source: 'OFFLINE' },
        { status: res.status },
      );
    }

    const data: NexusVisionInferResponse = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Vision inference service unreachable',
        source: 'OFFLINE',
      },
      { status: 503 },
    );
  }
}
