import { NextResponse } from 'next/server';
import { fetchNexusHealth } from '@/lib/nexus/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await fetchNexusHealth();
    return NextResponse.json(health, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'NEXUS backend offline',
        source: 'OFFLINE',
        models: {
          vision: {
            loaded: false,
            default_model: 'aerial_visdrone_epoch5.pt',
            available_models: [],
          },
          core: { loaded: false, model_type: 'none', deterministic_guard: 'inactive' },
          maverick: { loaded: false, model_type: 'none', oracle_fallback: 'inactive' },
        },
        cameras: { connected_count: 0, sources: {} },
      },
      {
        status: 200, // Return 200 with degraded state so frontend receives clean fallback
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  }
}
