import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getNexusAdmin } from '../firebase/admin';
import { siteId } from '../firebase/config';
import { sessionFor, ResponseError, rateLimit } from '../response-server';
import { TrafficError, type TrafficActor } from './engine';

export const trafficHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export async function trafficActor(
  request: NextRequest,
  source: 'DEMO' | 'LIVE',
): Promise<TrafficActor | null> {
  if (source === 'DEMO') {
    const session = sessionFor(request);
    return session ? { id: session.principal, role: 'DEMO_OPERATOR', source } : null;
  }
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer '))
    throw new TrafficError('Sign in with a traffic-authorized Firebase account.', 401);
  const admin = getNexusAdmin();
  if (!admin) throw new TrafficError('LIVE Firebase traffic access is not configured.', 503);
  const token = await admin.auth.verifyIdToken(bearer.slice(7), true).catch(() => null);
  if (
    !token ||
    token.nexusSite !== siteId ||
    !['ANALYST', 'REVIEWER', 'INGESTOR'].includes(token.nexusTrafficRole)
  )
    throw new TrafficError('Traffic role or site authorization rejected.', 403);
  return { id: token.uid, source, role: token.nexusTrafficRole };
}
export function trafficLimit(key: string, max = 60) {
  try {
    rateLimit('traffic:' + key, max);
  } catch (e) {
    if (e instanceof ResponseError && e.status === 429)
      throw new TrafficError('Traffic request limit reached. Retry after one minute.', 429);
    throw e;
  }
}
export function trafficFailure(error: unknown) {
  const known = error instanceof TrafficError || error instanceof ResponseError;
  return NextResponse.json(
    {
      error: known
        ? error.message
        : error instanceof ZodError || error instanceof SyntaxError
          ? 'Invalid traffic request or unsupported schema.'
          : 'Traffic storage unavailable. No action was committed.',
    },
    {
      status: known
        ? error.status
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 503,
      headers: trafficHeaders,
    },
  );
}
