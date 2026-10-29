import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTraffic, demoObservations } from '../src/lib/traffic/demo';
import {
  applyCommand,
  classify,
  ingestObservations,
  mapMatch,
  refreshTraffic,
  analytics,
  type TrafficActor,
} from '../src/lib/traffic/engine';
import {
  commandSchema,
  observationSchema,
  settingsSchema,
  defaultSettings,
  type TrafficState,
  type TrafficCommand,
  type SpeedObservation,
} from '../src/lib/traffic/contract';
import { trafficStateSchema, validateTrafficState } from '../src/lib/traffic/validation';
import {
  mobileTrafficIncidentSchema,
  relevantPublications,
  toMobileIncident,
  selectPublicTraffic,
} from '../src/lib/traffic/mobile-contract';

const now = Date.parse('2026-10-19T05:00:00.000Z');
const actor: TrafficActor = { id: 'test-reviewer', role: 'DEMO_OPERATOR', source: 'DEMO' };
const fresh = () => initialTraffic('main', 'DEMO', now);
type Action = TrafficCommand extends infer C
  ? C extends TrafficCommand
    ? Omit<C, 'expectedRevision'>
    : never
  : never;
function send(s: TrafficState, a: Action, who = actor) {
  applyCommand(s, commandSchema.parse({ ...a, expectedRevision: s.revision }), who);
  s.revision++;
}
function batch(
  s: TrafficState,
  overrides: Partial<SpeedObservation> = {},
  n = 6,
): SpeedObservation[] {
  return Array.from({ length: n }, (_, i) => ({
    schemaVersion: 1,
    observationId: `o-${s.clock.replaceAll(':', '-')}-${i}`,
    segmentId: s.segments[0].id,
    contributorId: `contributor-${i}`,
    source: 'DEMO',
    kind: 'DEMO',
    consented: true,
    location: s.segments[0].geometry.coordinates[1],
    heading: s.segments[0].bearing,
    speedKmh: 10,
    accuracyM: 5,
    providerConfidence: 0.9,
    observedAt: s.clock,
    ...overrides,
  }));
}
function congested() {
  const s = fresh();
  demoObservations(s, 'normal');
  demoObservations(s, 'slow');
  return s;
}
function planned() {
  const s = congested(),
    incidentId = s.incidents[0].id;
  send(s, { action: 'analyze', incidentId });
  const requestId = s.requests[0].id;
  send(s, {
    action: 'request-review',
    requestId,
    status: 'PENDING_REVIEW',
    notes: 'Reviewed feasibility of synthetic inspection.',
  });
  send(s, {
    action: 'request-review',
    requestId,
    status: 'APPROVED_FOR_OPERATOR_PLANNING',
    notes: 'Approved planning demonstration; no flight command.',
  });
  return s;
}
function analyzed() {
  const s = planned();
  send(s, {
    action: 'attach-sample',
    requestId: s.requests[0].id,
    fixture: 'obstruction',
    rightsConfirmed: true,
  });
  send(s, { action: 'analyze', incidentId: s.incidents[0].id });
  return s;
}
function verified() {
  const s = analyzed();
  send(s, {
    action: 'verify',
    incidentId: s.incidents[0].id,
    decision: 'confirm',
    cause: 'VEHICLE_BREAKDOWN',
    notes: 'Reviewed original synthetic image and uncertainty.',
    reviewedEvidence: true,
  });
  return s;
}

test('trust boundary rejects invalid positions, speeds, consent, versions and unsafe identifiers', () => {
  const s = fresh(),
    o = batch(s)[0];
  assert(observationSchema.safeParse(o).success);
  for (const value of [
    { ...o, speedKmh: -1 },
    { ...o, location: [0, 0] },
    { ...o, schemaVersion: 2 },
    { ...o, kind: 'CONSENTED_AGGREGATE', consented: false },
    { ...o, contributorId: '__proto__' },
    { ...o, contributorId: 'toString' },
    { ...o, source: 'LIVE' },
    { ...o, extra: 'private' },
  ])
    assert(!observationSchema.safeParse(value).success);
  assert(!settingsSchema.safeParse({ ...defaultSettings, ratios: [0.2, 0.4, 0.6, 0.8] }).success);
  assert(
    !commandSchema.safeParse({
      action: 'verify',
      expectedRevision: 0,
      incidentId: 'x',
      decision: 'confirm',
      cause: 'ACCIDENT',
      notes: 'enough characters here',
      reviewedEvidence: false,
    }).success,
  );
});
test('sparse, duplicate-device and unsuitable data remain UNKNOWN; direction is distinct', () => {
  const s = fresh();
  ingestObservations(s, batch(s, {}, 1), actor);
  assert.equal(s.segments[0].estimate.level, 'UNKNOWN');
  const d = fresh();
  const same = batch(d, { contributorId: 'same-device' });
  ingestObservations(d, same, actor);
  assert.equal(d.segments[0].estimate.independentSamples, 1);
  assert.equal(d.incidents.length, 0);
  assert.equal(mapMatch({ ...batch(s)[0], heading: 198 }, s.segments), null);
  for (const override of [
    { accuracyM: 60 },
    { providerConfidence: 0.2 },
    { observedAt: new Date(now - 900000).toISOString() },
    { observedAt: new Date(now + 60000).toISOString() },
  ]) {
    const state = fresh();
    const result = ingestObservations(state, batch(state, override), actor);
    assert.equal(result.accepted, 0);
  }
});
test('median/MAD handles outliers; baseline must match road/day/time; configurable classification', () => {
  const s = fresh();
  const observations = batch(s);
  observations.push({
    ...observations[0],
    observationId: 'outlier',
    contributorId: 'other',
    speedKmh: 180,
  });
  ingestObservations(s, observations, actor);
  assert.equal(s.segments[0].estimate.observedSpeedKmh, 10);
  assert.equal(s.segments[0].estimate.level, 'SEVERE');
  assert.equal(s.segments[1].estimate.level, 'UNKNOWN');
  const r = structuredClone(s.segments[0]);
  r.baseline = null;
  assert.equal(classify(r, s.windows[r.id], now).level, 'UNKNOWN');
  r.baseline = { ...s.segments[0].baseline!, dayType: 'WEEKEND' };
  assert.equal(classify(r, s.windows[r.id], now).level, 'UNKNOWN');
  assert.equal(
    classify(s.segments[0], s.windows[r.id], now, {
      ...defaultSettings,
      ratios: [0.85, 0.65, 0.45, 0.1],
    }).level,
    'HEAVY',
  );
});
test('observation IDs deduplicate; a stale gap breaks congestion persistence', () => {
  const s = fresh(),
    o = batch(s);
  assert.equal(ingestObservations(s, o, actor).accepted, 6);
  assert.equal(ingestObservations(s, o, actor).duplicates, 6);
  s.clock = new Date(now + 120000).toISOString();
  ingestObservations(s, batch(s), actor);
  assert.equal(s.incidents.length, 0);
  assert.equal(s.segments[0].lowSince, s.clock);
});
test('normal → severe creates one persistent case; updates merge rather than duplicate', () => {
  const s = congested();
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].cause, 'UNKNOWN');
  assert.equal(s.incidents[0].severity, 'SEVERE');
  assert.deepEqual(s.incidents[0].observationKinds, ['DEMO']);
  const id = s.incidents[0].id;
  demoObservations(s, 'slow');
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].id, id);
  assert(s.events.some((e) => e.action === 'CONGESTION_DETECTED'));
  assert(trafficStateSchema.safeParse(s).success);
});
test('sustained recovery resolves; absence expires as UNKNOWN, never recovered', () => {
  const s = congested();
  demoObservations(s, 'recovery');
  assert.equal(s.incidents[0].status, 'RESOLVED');
  assert.equal(s.segments[0].estimate.level, 'NORMAL');
  const stale = congested();
  demoObservations(stale, 'advance');
  assert.equal(stale.incidents[0].status, 'EXPIRED');
  assert.equal(stale.segments[0].estimate.level, 'UNKNOWN');
  assert.equal(analytics(stale).resolved, 0);
  assert.equal(analytics(stale).expired, 1);
  demoObservations(s, 'slow');
  assert.equal(s.incidents.length, 1, 'cooldown suppresses immediate recreation');
});
test('distant segments sharing a corridor do not merge; adjacent components do', () => {
  for (const adjacent of [false, true]) {
    const s = fresh();
    const extra = structuredClone(s.segments[0]);
    extra.id = 'extra';
    extra.geometry.coordinates = adjacent
      ? [
          [77.103, 28.438],
          [77.105, 28.442],
        ]
      : [
          [77.15, 28.5],
          [77.16, 28.52],
        ];
    s.segments.push(extra);
    for (let t = 0; t <= 120000; t += 30000) {
      s.clock = new Date(now + t).toISOString();
      ingestObservations(
        s,
        [
          ...batch(s),
          ...batch(
            s,
            {
              segmentId: extra.id,
              location: extra.geometry.coordinates[0],
              observationId: `extra-${t}`,
              contributorId: 'extra',
            },
            1,
          ),
          ...Array.from({ length: 5 }, (_, n) => ({
            ...batch(s)[0],
            segmentId: extra.id,
            location: extra.geometry.coordinates[1],
            observationId: `extra-${t}-${n}`,
            contributorId: `extra-${n}`,
          })),
        ],
        actor,
      );
    }
    assert.equal(s.incidents.length, adjacent ? 1 : 2);
    if (adjacent) assert.equal(s.incidents[0].segmentIds.length, 2);
  }
});
test('CORE makes conservative, deduplicated recommendations and does not infer accident', () => {
  const s = congested(),
    id = s.incidents[0].id;
  send(s, { action: 'analyze', incidentId: id });
  send(s, { action: 'analyze', incidentId: id });
  assert.equal(s.requests.length, 1);
  assert.equal(s.investigations[0].candidates.length, 0);
  assert.equal(s.incidents[0].cause, 'UNKNOWN');
  assert.match(s.investigations[0].uncertainty, /congestion only/);
  assert.equal(s.requests[0].status, 'RECOMMENDED');
  assert(s.requests[0].supportingEvidence.length);
});
test('planning requires ordered review; rejection/cancellation do not attach evidence', () => {
  for (const status of ['REJECTED', 'CANCELLED'] as const) {
    const s = congested();
    send(s, { action: 'analyze', incidentId: s.incidents[0].id });
    const requestId = s.requests[0].id;
    assert.throws(
      () =>
        send(s, {
          action: 'request-review',
          requestId,
          status: 'APPROVED_FOR_OPERATOR_PLANNING',
          notes: 'Cannot skip review stage.',
        }),
      /transition/,
    );
    send(s, {
      action: 'request-review',
      requestId,
      status,
      notes: 'Documented reviewer decision.',
    });
    assert.throws(
      () =>
        send(s, { action: 'attach-sample', requestId, fixture: 'water', rightsConfirmed: true }),
      /approval/,
    );
    send(s, { action: 'analyze', incidentId: s.incidents[0].id });
    assert.equal(s.requests.length, 1);
  }
});
test('sample evidence is explicit, conservative and unverified until human review', () => {
  const s = analyzed();
  assert.equal(s.requests[0].status, 'ANALYSIS_COMPLETE');
  assert.equal(s.evidence[0].kind, 'DEMO_ILLUSTRATION');
  assert.equal(s.investigations[0].candidates[0].confidence, null);
  assert.equal(s.incidents[0].verificationStatus, 'UNVERIFIED');
  assert.equal(s.incidents[0].causeStatus, 'POSSIBLE');
  assert.equal(s.incidents[0].cause, 'UNKNOWN');
  send(s, { action: 'publish', incidentId: s.incidents[0].id });
  assert.equal(s.hazards[0].cause, 'UNKNOWN');
  send(s, {
    action: 'verify',
    incidentId: s.incidents[0].id,
    decision: 'reject',
    cause: 'VEHICLE_BREAKDOWN',
    notes: 'Illustration insufficient to support this candidate.',
    reviewedEvidence: true,
  });
  assert.equal(s.incidents[0].causeStatus, 'REJECTED');
  assert.equal(s.evidence[0].humanReviewStatus, 'REJECTED');
  assert.equal(relevantPublications(s, [s.segments[0].id], 'nexus-gurugram-sketch-v1').length, 0);
});
test('human verification, publication, recovery and strict mobile contract agree', () => {
  const s = verified(),
    id = s.incidents[0].id;
  assert(s.incidents[0].verifiedAt);
  send(s, { action: 'publish', incidentId: id });
  const dto = toMobileIncident(s.hazards[0], s.incidents[0], s);
  assert(mobileTrafficIncidentSchema.safeParse(dto).success);
  assert.equal(dto.cause, 'BREAKDOWN');
  assert.equal(dto.source, 'DEMO');
  assert.equal(typeof dto.updatedAt, 'number');
  assert.equal(dto.verificationStatus, 'VERIFIED');
  assert(!mobileTrafficIncidentSchema.safeParse({ ...dto, siteId: 'main' }).success);
  assert(!('notes' in dto));
  s.events = [];
  assert.equal(
    toMobileIncident(s.hazards[0], s.incidents[0], s).lastVerifiedAt,
    Date.parse(s.incidents[0].verifiedAt!),
    'review timestamp survives bounded audit retention',
  );
  demoObservations(s, 'recovery');
  const recovered = toMobileIncident(s.hazards[0], s.incidents[0], s);
  assert.equal(recovered.status, 'RESOLVED');
  assert.equal(recovered.causeStatus, 'RESOLVED');
  assert.equal(recovered.restriction, 'NONE');
  s.segments[0].networkVersion = 'new-routing-graph';
  assert.equal(
    toMobileIncident(s.hazards[0], s.incidents[0], s).networkVersion,
    'nexus-gurugram-sketch-v1',
    'publication keeps the case network identity',
  );
  assert(trafficStateSchema.safeParse(s).success);
});
test('public snapshot selection rejects irrelevant, stale, malformed, future and wrong-environment records', () => {
  const s = verified();
  send(s, { action: 'publish', incidentId: s.incidents[0].id });
  const dto = toMobileIncident(s.hazards[0], s.incidents[0], s),
    clock = Date.parse(s.clock),
    ids = [s.segments[0].id],
    network = 'nexus-gurugram-sketch-v1';
  const select = (rows: unknown[], at = clock) =>
    selectPublicTraffic(rows, ids, network, 'DEMO', at);
  assert.equal(select([dto]).length, 1);
  assert.equal(
    select([
      { ...dto, publicApproved: false },
      { ...dto, source: 'AUTHORIZED' },
      { ...dto, networkVersion: 'wrong' },
      { ...dto, segmentIds: ['elsewhere'] },
      { ...dto, extra: true },
      { ...dto, updatedAt: clock + 1000 },
    ]).length,
    0,
  );
  assert.equal(select([dto], clock + 900001).length, 0);
  assert.equal(selectPublicTraffic([dto], ids, null, 'DEMO', clock).length, 0);
  assert.equal(relevantPublications(s, ids, 'wrong').length, 0);
});
test('revision checks and roles guard privileged commands; demo cannot enter LIVE', () => {
  const s = congested(),
    incidentId = s.incidents[0].id;
  assert.throws(
    () => applyCommand(s, { action: 'analyze', incidentId, expectedRevision: 99 }, actor),
    /changed/,
  );
  for (const role of ['ANALYST', 'INGESTOR'] as const)
    assert.throws(() => send(s, { action: 'publish', incidentId }, { ...actor, role }), /reviewer/);
  assert.throws(
    () => send(s, { action: 'analyze', incidentId }, { ...actor, role: 'INGESTOR' }),
    /role/,
  );
  assert.throws(
    () =>
      applyCommand(
        initialTraffic('main', 'LIVE', now),
        { action: 'analyze', incidentId, expectedRevision: 0 },
        actor,
      ),
    /authorization/,
  );
  const live = initialTraffic('main', 'LIVE', now);
  assert.equal(live.segments.length, 0);
  assert.throws(() => demoObservations(live, 'slow'), /LIVE/);
});
test('persisted state validation rejects source mismatch and broken relationships; analytics use records', () => {
  const s = verified();
  assert.equal(analytics(s).verified, 1);
  assert.equal(analytics(s).active, 1);
  assert.equal(analytics(s).knownCoverage, 1);
  const mixed = structuredClone(s);
  mixed.incidents[0].siteId = 'other';
  assert.throws(() => validateTrafficState(mixed, 'main', 'DEMO'));
  const broken = structuredClone(s);
  broken.incidents[0].segmentIds = ['missing'];
  assert(!trafficStateSchema.safeParse(broken).success);
  demoObservations(s, 'recovery');
  s.clock = new Date(Date.parse(s.clock) + 8 * 86400000).toISOString();
  refreshTraffic(s);
  assert.equal(s.evidence.length, 0);
  assert.equal(s.incidents.length, 0);
});
