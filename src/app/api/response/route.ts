import { NextRequest } from 'next/server';
import { z } from 'zod';
import { intakeSchema, reviewSchema } from '@/lib/response';
import {
  boundedBody,
  createIncident,
  deleteIncident,
  listIncidents,
  newSession,
  passwordMatches,
  rateLimit,
  removeSession,
  responseFailure,
  responseJson,
  ResponseError,
  reviewIncident,
  sameOrigin,
  sessionCookie,
  sessionFor,
} from '@/lib/response-server';
export const runtime = 'nodejs';
const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('intake'), input: intakeSchema }).strict(),
  z.object({ type: z.literal('login'), password: z.string().min(1).max(200) }).strict(),
  z.object({ type: z.literal('logout') }).strict(),
  z.object({ type: z.literal('review'), input: reviewSchema }).strict(),
  z
    .object({
      type: z.literal('delete'),
      id: z.string().max(80),
      version: z.number().int().positive(),
    })
    .strict(),
  z.object({ type: z.literal('seed') }).strict(),
]);
export async function GET(request: NextRequest) {
  try {
    let session = sessionFor(request),
      created;
    if (!session) {
      created = newSession();
      session = created.session;
    }
    const response = responseJson({
      operator: session.operator,
      incidents: listIncidents(session),
      retentionMinutes: 30,
    });
    if (created) sessionCookie(response, created.token, request);
    return response;
  } catch (error) {
    return responseFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const session = sessionFor(request);
    if (!session)
      throw new ResponseError('Session expired. Refresh to start a new demo session.', 401);
    rateLimit(session.principal);
    const body = requestSchema.parse(JSON.parse(await boundedBody(request)));
    if (body.type === 'login') {
      // Single local credential: global rate cap also prevents new-session brute force.
      rateLimit('operator-login', 8);
      if (!passwordMatches(body.password))
        throw new ResponseError('Operator credential rejected.', 401);
      const created = newSession(true, session.principal);
      removeSession(request);
      const response = responseJson({ operator: true, incidents: listIncidents(created.session) });
      sessionCookie(response, created.token, request);
      return response;
    }
    if (body.type === 'logout') {
      const created = newSession(false, session.principal);
      removeSession(request);
      const response = responseJson({ operator: false, incidents: listIncidents(created.session) });
      sessionCookie(response, created.token, request);
      return response;
    }
    if (body.type === 'intake') {
      const created = createIncident(body.input, session.principal);
      return responseJson({
        operator: session.operator,
        incidents: listIncidents(session),
        createdId: created.id,
      });
    }
    if (body.type === 'review') reviewIncident(body.input, session);
    if (body.type === 'delete') deleteIncident(body.id, body.version, session);
    if (body.type === 'seed') {
      if (!session.operator) throw new ResponseError('Authenticated operator required.', 403);
      for (const input of [
        {
          text: 'Smoke and fire near East interchange. 2 people trapped.',
          location: 'East interchange',
          coordinates: [77.597, 12.974],
        },
        {
          text: 'Riverfront mein paani bhar gaya, 3 log affected.',
          location: 'Riverfront',
          coordinates: [77.592, 12.977],
        },
      ])
        createIncident(
          intakeSchema.parse({ ...input, language: 'hinglish', channel: 'simulated-call' }),
          session.principal,
        );
    }
    return responseJson({ operator: session.operator, incidents: listIncidents(session) });
  } catch (error) {
    return responseFailure(error);
  }
}
