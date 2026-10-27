import { NextRequest, NextResponse } from 'next/server';
import { sourceSchema, commandSchema } from '@/lib/traffic/contract';
import { readTraffic, mutateTraffic, adminTrafficView } from '@/lib/traffic/repository';
import { trafficActor, trafficFailure, trafficHeaders, trafficLimit } from '@/lib/traffic/server';
import { sameOrigin, boundedBody, newSession, sessionCookie } from '@/lib/response-server';
import { TrafficError } from '@/lib/traffic/engine';
import { siteId } from '@/lib/firebase/config';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const source = sourceSchema.parse(request.nextUrl.searchParams.get('source') || 'DEMO');
    const actor = await trafficActor(request, source);
    if (!actor)
      return NextResponse.json({ authorized: false, state: null }, { headers: trafficHeaders });
    if (actor.role === 'INGESTOR') throw new TrafficError('Investigation access required.', 403);
    trafficLimit('read:' + actor.id, 120);
    return NextResponse.json(
      {
        authorized: true,
        role: actor.role,
        state: adminTrafficView(await readTraffic(siteId, source, actor.id)),
      },
      { headers: trafficHeaders },
    );
  } catch (e) {
    return trafficFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const source = sourceSchema.parse(request.nextUrl.searchParams.get('source') || 'DEMO');
    const command = commandSchema.parse(JSON.parse(await boundedBody(request)));
    let actor = await trafficActor(request, source),
      token: string | undefined;
    if (!actor && source === 'DEMO' && command.action === 'start-demo') {
      trafficLimit('start:' + request.headers.get('host'), 60);
      const created = newSession();
      token = created.token;
      actor = { id: created.session.principal, role: 'DEMO_OPERATOR', source };
    }
    if (!actor) throw new TrafficError('Start a private demonstration first.', 401);
    trafficLimit('write:' + actor.id, 60);
    const state = await mutateTraffic(siteId, actor, command);
    const response = NextResponse.json(
      actor.role === 'INGESTOR'
        ? { revision: state.revision }
        : { authorized: true, role: actor.role, state: adminTrafficView(state) },
      { headers: trafficHeaders },
    );
    if (token) sessionCookie(response, token, request);
    return response;
  } catch (e) {
    return trafficFailure(e);
  }
}
