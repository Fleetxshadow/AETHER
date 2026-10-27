import { NextRequest, NextResponse } from 'next/server';
import { planNexusMaverick, type NexusMaverickPlanResponse } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (
      !body ||
      !Array.isArray(body.terrain) ||
      !Array.isArray(body.start) ||
      !Array.isArray(body.goal)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid payload: terrain (2D array), start ([r,c]), and goal ([r,c]) required',
          code: 'INVALID_PAYLOAD',
          source: 'OFFLINE',
        },
        { status: 400 },
      );
    }

    const result: NexusMaverickPlanResponse = await planNexusMaverick(
      body.terrain,
      body.start as [number, number],
      body.goal as [number, number],
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'MAVERICK route planning service unreachable',
        source: 'OFFLINE',
        status: 'service_unavailable',
        path: [],
      },
      { status: 503 },
    );
  }
}
