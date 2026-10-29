import { NextRequest, NextResponse } from 'next/server';
import { evaluateNexusCore, type NexusCoreEvaluateResponse } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.observation || typeof body.observation !== 'object') {
      return NextResponse.json(
        {
          error: 'Valid observation object is required',
          code: 'INVALID_PAYLOAD',
          source: 'OFFLINE',
        },
        { status: 400 },
      );
    }

    const result: NexusCoreEvaluateResponse = await evaluateNexusCore(body.observation);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'CORE evaluation service unreachable',
        source: 'OFFLINE',
        recommendation: 'hold_position',
        safety_reason: 'Backend evaluation service unreachable; fail-closed',
        guard_intervened: true,
      },
      { status: 503 },
    );
  }
}
