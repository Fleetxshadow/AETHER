import { createHmac, timingSafeEqual } from 'node:crypto';
import { createIncident, ResponseError } from './response-server';
import { intakeSchema, type CallEvent, type CallState, type IntakeLanguage } from './response';
interface DemoCall {
  id: string;
  state: CallState;
  language: IntakeLanguage;
  incidentId: string | null;
  expires: number;
}
const globalCalls = globalThis as typeof globalThis & { nexusDemoCalls?: Map<string, DemoCall> };
const calls = (globalCalls.nexusDemoCalls ??= new Map());
export function verifyDemoSignature(
  raw: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 5 * 60 * 1000 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export function handleDemoCall(event: CallEvent) {
  for (const [id, call] of calls) if (call.expires < Date.now()) calls.delete(id);
  let call = calls.get(event.sessionId);
  if (event.type === 'incoming') {
    if (call) throw new ResponseError('Call session already exists.', 409);
    if (calls.size >= 300) throw new ResponseError('Demo call capacity reached.', 503);
    call = {
      id: event.sessionId,
      state: 'connected',
      language: event.language,
      incidentId: null,
      expires: Date.now() + 30 * 60 * 1000,
    };
    calls.set(call.id, call);
    setTimeout(() => calls.delete(event.sessionId), 30 * 60 * 1000).unref();
  } else {
    if (!call) throw new ResponseError('Unknown call session.', 404);
    if (['ended', 'error'].includes(call.state))
      throw new ResponseError('Call session closed.', 409);
    if (event.type === 'language') call.language = event.language;
    if (event.type === 'connected') call.state = 'connected';
    if (event.type === 'transcript') {
      if (call.incidentId)
        throw new ResponseError(
          'Demo call already submitted. Create a new call for a new report.',
          409,
        );
      const incident = createIncident(
        intakeSchema.parse({
          text: event.text,
          language: call.language,
          channel: 'simulated-call',
        }),
        `webhook:${call.id}`,
      );
      call.incidentId = incident.id;
      call.state = 'human-handoff';
    }
    if (event.type === 'handoff') call.state = 'human-handoff';
    if (event.type === 'ended') call.state = 'ended';
    if (event.type === 'error') call.state = 'error';
  }
  return {
    sessionId: call.id,
    state: call.state,
    language: call.language,
    incidentId: call.incidentId,
    source: 'DEMO' as const,
    externalContactConfirmed: false as const,
  };
}
