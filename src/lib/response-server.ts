import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  applyReview,
  extractIncident,
  incidentSchema,
  type Incident,
  type Intake,
  type Review,
} from './response';

const ttl = 30 * 60 * 1000;
interface Session {
  principal: string;
  operator: boolean;
  expires: number;
}
interface DemoState {
  sessions: Map<string, Session>;
  incidents: Map<string, Incident>;
  limits: Map<string, { count: number; until: number }>;
  replays: Map<string, number>;
}
const globalState = globalThis as typeof globalThis & { nexusResponse?: DemoState };
const state = (globalState.nexusResponse ??= {
  sessions: new Map(),
  incidents: new Map(),
  limits: new Map(),
  replays: new Map(),
});
export class ResponseError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function prune(now = Date.now()) {
  for (const [key, item] of state.sessions) if (item.expires < now) state.sessions.delete(key);
  for (const [key, item] of state.incidents)
    if (Date.parse(item.expiresAt) < now) state.incidents.delete(key);
  for (const [key, item] of state.limits) if (item.until < now) state.limits.delete(key);
  for (const [key, until] of state.replays) if (until < now) state.replays.delete(key);
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  let matches = false;
  try {
    const supplied = new URL(origin || '');
    matches =
      ['http:', 'https:'].includes(supplied.protocol) &&
      supplied.host === request.headers.get('host');
  } catch {
    /* Missing or opaque origins are rejected. */
  }
  // Host is the browser-request authority; Next's internal URL can use the bind address.
  if (!matches || request.headers.get('sec-fetch-site') === 'cross-site')
    throw new ResponseError('Same-origin request required.', 403);
}
export async function boundedBody(request: NextRequest) {
  if (Number(request.headers.get('content-length')) > 12000)
    throw new ResponseError('Request too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ResponseError('Body required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 12000) {
      await reader.cancel();
      throw new ResponseError('Request too large.', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function rateLimit(key: string, max = 40) {
  prune();
  const item = state.limits.get(key) ?? { count: 0, until: Date.now() + 60000 };
  item.count++;
  state.limits.set(key, item);
  if (state.limits.size > 2000 || item.count > max)
    throw new ResponseError(
      'Demo request limit reached. For an emergency use Call 112 directly.',
      429,
    );
}
export function sessionFor(request: NextRequest) {
  prune();
  const token = request.cookies.get('nexus-response-session')?.value;
  return token ? state.sessions.get(token) : undefined;
}
export function newSession(operator = false, principal = randomUUID()) {
  prune();
  if (state.sessions.size >= 1000) throw new ResponseError('Demo capacity reached.', 503);
  const token = randomBytes(32).toString('hex');
  const session = { principal, operator, expires: Date.now() + ttl };
  state.sessions.set(token, session);
  setTimeout(() => state.sessions.delete(token), ttl).unref();
  return { token, session };
}
export function sessionCookie(response: NextResponse, token: string, request: NextRequest) {
  response.cookies.set('nexus-response-session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: request.nextUrl.protocol === 'https:',
    path: '/api/response',
    maxAge: 1800,
  });
}
export function passwordMatches(password: string) {
  const secret = process.env.NEXUS_OPERATOR_PASSWORD;
  if (!secret)
    throw new ResponseError(
      'Operator access not configured. Set NEXUS_OPERATOR_PASSWORD on the server.',
      503,
    );
  return timingSafeEqual(
    createHash('sha256').update(password).digest(),
    createHash('sha256').update(secret).digest(),
  );
}
export function removeSession(request: NextRequest) {
  const token = request.cookies.get('nexus-response-session')?.value;
  if (token) state.sessions.delete(token);
}
export function createIncident(input: Intake, owner: string) {
  prune();
  if (state.incidents.size >= 300)
    throw new ResponseError('Demo storage full. For an emergency use Call 112 directly.', 503);
  const now = new Date().toISOString();
  const record = incidentSchema.parse({
    ...extractIncident(input),
    id: `NR-${randomUUID().slice(0, 8).toUpperCase()}`,
    owner,
    source: 'DEMO',
    version: 1,
    language: input.language,
    reportedAt: now,
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    callback: input.callbackConsent ? input.callback : '',
    callbackConsent: input.callbackConsent,
    locationVerified: false,
    status: 'RECEIVED',
    operator: 'Unassigned',
    evidence: 'not requested',
    channel: input.channel,
    externalContactConfirmed: false,
    history: [
      {
        at: now,
        actor: 'Reporter',
        event: 'Demo report received; no dispatch or external contact.',
      },
    ],
  });
  state.incidents.set(record.id, record);
  setTimeout(() => state.incidents.delete(record.id), ttl).unref();
  return record;
}
export function listIncidents(session: Session) {
  prune();
  return [...state.incidents.values()]
    .filter((r) => session.operator || r.owner === session.principal)
    .sort(
      (a, b) =>
        Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent') ||
        b.reportedAt.localeCompare(a.reportedAt),
    );
}
export function ownIncident(id: string, session: Session) {
  const record = state.incidents.get(id);
  if (!record || (!session.operator && record.owner !== session.principal))
    throw new ResponseError('Report unavailable.', 404);
  return record;
}
export function reviewIncident(input: Review, session: Session) {
  if (!session.operator) throw new ResponseError('Authenticated operator required.', 403);
  const record = ownIncident(input.id, session);
  if (record.version !== input.version)
    throw new ResponseError('Report changed. Refresh before retrying.', 409);
  const next = applyReview(record, input, new Date().toISOString());
  state.incidents.set(record.id, next);
  return next;
}
export function deleteIncident(id: string, version: number, session: Session) {
  const record = ownIncident(id, session);
  if (record.version !== version)
    throw new ResponseError('Report changed. Refresh before retrying.', 409);
  state.incidents.delete(id);
}
export function acceptEvent(id: string) {
  prune();
  if (state.replays.has(id)) throw new ResponseError('Duplicate webhook event.', 409);
  if (state.replays.size >= 2000) throw new ResponseError('Webhook capacity reached.', 503);
  state.replays.set(id, Date.now() + ttl);
}
export const responseJson = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
export function responseFailure(error: unknown) {
  return responseJson(
    {
      error:
        error instanceof ResponseError
          ? error.message
          : error instanceof Error && error.name !== 'ZodError'
            ? error.message
            : 'Invalid request.',
    },
    error instanceof ResponseError ? error.status : 400,
  );
}
