import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import {
  extractIncident,
  intakeSchema,
  incidentSchema,
  applyReview,
  callEventSchema,
} from '../src/lib/response';
import { placeSpatialLabels } from '../src/lib/spatial-labels';
import {
  createIncident,
  newSession,
  listIncidents,
  reviewIncident,
  deleteIncident,
  prune,
} from '../src/lib/response-server';
import { verifyDemoSignature, handleDemoCall } from '../src/lib/demo-calls';
import { demoConversationIntake, conversationConclusion } from '../src/lib/demo-conversation';
import { createDemoTelephonyAdapter, acceptTelephoneEvent } from '../src/lib/telephony';
test('English, Hindi and mixed extraction keeps urgency, missing fields and supplied facts', () => {
  for (const [language, text] of [
    ['en-IN', '2 people trapped in fire'],
    ['hi-IN', 'आग लगी है, 2 लोग फँसे हैं'],
    ['hinglish', 'aag lagi hai, 2 log trapped'],
  ] as const) {
    const report = extractIncident(intakeSchema.parse({ text, language }));
    assert.equal(report.urgency, 'urgent');
    assert.equal(report.category, 'fire');
    assert.equal(report.affected, 2);
    assert.equal(report.coordinates, null);
    assert.equal(report.location, '');
    assert.ok(report.uncertainties.length >= 2);
  }
  const report = extractIncident(
    intakeSchema.parse({ text: 'A tree fell near East interchange', language: 'en-IN' }),
  );
  assert.equal(report.location, 'East interchange');
  assert.equal(report.affected, null);
});
test('consent and trust-boundary schemas reject fabricated dispatch, unsupported fields and invalid locations', () => {
  assert.equal(
    intakeSchema.safeParse({ text: 'fire', language: 'en-IN', callback: '9876543210' }).success,
    false,
  );
  assert.equal(
    intakeSchema.safeParse({ text: 'fire', language: 'en-IN', coordinates: [190, 40] }).success,
    false,
  );
  assert.equal(
    intakeSchema.safeParse({ text: 'fire', language: 'en-IN', source: 'LIVE' }).success,
    false,
  );
  assert.equal(
    extractIncident(
      intakeSchema.parse({ text: 'phone 9876543210, medical help', language: 'en-IN' }),
    ).description.includes('9876543210'),
    false,
  );
  const supplied = extractIncident(
    intakeSchema.parse({
      text: 'medical help',
      language: 'en-IN',
      location: 'call 9876543210',
      landmark: 'callback 9876543210',
    }),
  );
  assert.equal(supplied.location.includes('9876543210'), false);
  assert.equal(supplied.landmark.includes('9876543210'), false);
  const record = createIncident(
    intakeSchema.parse({ text: 'Fire reported', language: 'en-IN' }),
    randomUUID(),
  );
  assert.equal(
    incidentSchema.safeParse({ ...record, externalContactConfirmed: true }).success,
    false,
  );
});
test('selected co-located labels retain full targets and fit with gaps; overflow hides alternatives', () => {
  const labels = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    x: 70,
    y: 70,
    width: 44,
    height: 44,
    priority: i === 5 ? 0 : 1,
  }));
  const placed = placeSpatialLabels(labels, 180, 180);
  assert.equal(placed[0].id, '5');
  assert.equal(placed[0].visible, true);
  const visible = placed.filter((p) => p.visible);
  assert.ok(visible.length > 1);
  for (const [i, a] of visible.entries()) {
    assert.ok(a.x - 22 >= 7 && a.y - 22 >= 7 && a.x + 22 <= 173 && a.y + 22 <= 173);
    for (const b of visible.slice(i + 1))
      assert.ok(Math.abs(a.x - b.x) >= 50 || Math.abs(a.y - b.y) >= 50);
  }
  assert.equal(
    placeSpatialLabels(labels, 40, 40).some((p) => p.visible),
    false,
  );
});
test('session isolation, server roles, concurrency, workflow and deletion enforce invariants', () => {
  const a = newSession().session,
    b = newSession().session,
    operator = newSession(true).session;
  const record = createIncident(
    intakeSchema.parse({ text: 'urgent fire', language: 'en-IN' }),
    a.principal,
  );
  assert.ok(listIncidents(a).some((i) => i.id === record.id));
  assert.equal(
    listIncidents(b).some((i) => i.id === record.id),
    false,
  );
  const action = {
    id: record.id,
    version: 1,
    action: 'refer' as const,
    note: 'Urgent simulated referral',
  };
  assert.throws(() => reviewIncident(action, a), /operator/);
  const next = reviewIncident(action, operator);
  assert.equal(next.status, 'REFERRED');
  assert.equal(next.externalContactConfirmed, false);
  assert.throws(() => reviewIncident(action, operator), /changed/);
  assert.throws(
    () => applyReview(record, { ...action, action: 'verify' }, new Date().toISOString()),
    /Invalid/,
  );
  assert.throws(() => deleteIncident(record.id, next.version, b), /unavailable/);
  deleteIncident(record.id, next.version, a);
  assert.equal(listIncidents(a).length, 0);
  const expiring = createIncident(
    intakeSchema.parse({ text: 'demo road report', language: 'en-IN' }),
    a.principal,
  );
  prune(Date.parse(expiring.expiresAt) + 1);
  assert.equal(listIncidents(a).length, 0);
});
test('demo webhook signatures bind exact bytes and expire; call lifecycle requires consent', () => {
  const secret = 'test-only-secret',
    raw = '{"example":1}',
    timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  assert.equal(verifyDemoSignature(raw, timestamp, signature, secret), true);
  assert.equal(verifyDemoSignature(raw + ' ', timestamp, signature, secret), false);
  assert.equal(
    verifyDemoSignature(raw, timestamp, signature, secret, Number(timestamp) + 300001),
    false,
  );
  const sessionId = randomUUID();
  const make = (type: string, text?: string, transcriptionConsent = false) =>
    callEventSchema.parse({ eventId: randomUUID(), sessionId, type, text, transcriptionConsent });
  assert.equal(handleDemoCall(make('incoming')).state, 'connected');
  assert.equal(
    callEventSchema.safeParse({
      eventId: randomUUID(),
      sessionId,
      type: 'transcript',
      text: 'fire',
    }).success,
    false,
  );
  const report = handleDemoCall(make('transcript', 'Fire near park', true));
  assert.equal(report.state, 'human-handoff');
  assert.ok(report.incidentId);
  assert.equal(report.externalContactConfirmed, false);
  assert.equal(handleDemoCall(make('ended')).state, 'ended');
  assert.throws(() => handleDemoCall(make('language')), /closed/);
});
test('sample dialogue extracts only supplied caller facts and confirms saving truthfully', () => {
  const extracted = extractIncident(demoConversationIntake);
  assert.equal(extracted.category, 'flood');
  assert.equal(extracted.location, 'Sector 51, Gurugram');
  assert.equal(extracted.coordinates, null);
  assert.equal(extracted.affected, null);
  assert.equal(demoConversationIntake.channel, 'simulated-call');
  assert.equal(extracted.description.includes('Could you share'), false);
  assert.equal(conversationConclusion(false, false).includes("I've added"), false);
  assert.equal(conversationConclusion(false, true).includes("I've added"), false);
  assert.ok(conversationConclusion(true, false).includes('simulated waterlogging report'));
});
test('provider-neutral demo adapter verifies raw events, creates sessions and keeps real media disabled', () => {
  const secret = 'test-only-adapter-secret';
  const adapter = createDemoTelephonyAdapter(secret);
  assert.equal(adapter.audio, null);
  assert.equal(adapter.recognition, null);
  assert.equal(adapter.synthesis, null);
  const event = {
    eventId: randomUUID(),
    sessionId: randomUUID(),
    type: 'incoming',
    language: 'hinglish',
  };
  const raw = JSON.stringify(event),
    timestamp = String(Date.now());
  const headers = new Headers({
    'x-nexus-timestamp': timestamp,
    'x-nexus-signature': createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex'),
  });
  const normalized = acceptTelephoneEvent(adapter, raw, headers);
  assert.equal(adapter.handleInbound(normalized).state, 'connected');
  assert.throws(() => acceptTelephoneEvent(adapter, raw + ' ', headers), /signature/);
  assert.throws(
    () => acceptTelephoneEvent({ ...adapter, mode: 'authorized-test' }, raw, headers),
    /disabled/,
  );
  assert.equal(
    adapter.handleInbound(
      callEventSchema.parse({ ...event, eventId: randomUUID(), type: 'connected' }),
    ).state,
    'connected',
  );
});
