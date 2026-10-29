import { NextRequest, NextResponse } from 'next/server';
import { sourceSchema, idSchema } from '@/lib/traffic/contract';
import { readTraffic } from '@/lib/traffic/repository';
import { relevantPublications } from '@/lib/traffic/mobile-contract';
import { trafficActor, trafficFailure, trafficHeaders, trafficLimit } from '@/lib/traffic/server';
import { TrafficError } from '@/lib/traffic/engine';
import { siteId } from '@/lib/firebase/config';
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams,
      source = sourceSchema.parse(query.get('source') || 'DEMO');
    const segmentIds = (query.get('segments') || '')
      .split(',')
      .filter(Boolean)
      .map((v) => idSchema.parse(v));
    if (!segmentIds.length || segmentIds.length > 50)
      throw new TrafficError('Supply 1–50 directed route segment IDs.');
    const networkVersion = idSchema.parse(query.get('networkVersion'));
    // LIVE public app subscribes to its existing Firestore projection. This private preview
    // endpoint never grants access to a demo owned by another browser session.
    const actor = await trafficActor(request, source);
    if (!actor) throw new TrafficError('Demo session required.', 401);
    trafficLimit('public:' + actor.id, 120);
    const state = await readTraffic(siteId, source, actor.id);
    return NextResponse.json(
      {
        source,
        clock: state.clock,
        incidents: relevantPublications(state, segmentIds, networkVersion),
      },
      { headers: trafficHeaders },
    );
  } catch (e) {
    return trafficFailure(e);
  }
}
