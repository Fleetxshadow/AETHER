import {
  defaultSettings,
  observationSchema,
  settingsSchema,
  type TrafficState,
  type TrafficSettings,
  type RoadSegment,
  type SpeedObservation,
  type Estimate,
  type Coordinate,
  type TrafficIncident,
  type TrafficCommand,
  type Cause,
} from './contract';

export class TrafficError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export type TrafficActor = {
  id: string;
  role: 'DEMO_OPERATOR' | 'ANALYST' | 'REVIEWER' | 'INGESTOR';
  source: 'DEMO' | 'LIVE';
};
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const iso = (ms: number) => new Date(ms).toISOString();
const median = (n: number[]) => {
  const a = [...n].sort((x, y) => x - y);
  return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : 0;
};
export const emptyEstimate = (reason = 'No usable observations'): Estimate => ({
  level: 'UNKNOWN',
  observedSpeedKmh: null,
  baselineSpeedKmh: null,
  ratio: null,
  independentSamples: 0,
  quality: 'INSUFFICIENT',
  reason,
  observedAt: null,
  trend: 'UNKNOWN',
});
export function distanceM(a: Coordinate, b: Coordinate) {
  const x = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
    y = a[1] - b[1];
  return Math.hypot(x, y) * 111195;
}
export function roadLength(road: RoadSegment) {
  return road.geometry.coordinates
    .slice(1)
    .reduce((v, p, i) => v + distanceM(road.geometry.coordinates[i], p), 0);
}
function distanceToRoad(p: Coordinate, road: RoadSegment) {
  let best = Infinity;
  for (let i = 1; i < road.geometry.coordinates.length; i++) {
    const a = road.geometry.coordinates[i - 1],
      b = road.geometry.coordinates[i];
    const scale = Math.cos((p[1] * Math.PI) / 180),
      x = (b[0] - a[0]) * scale,
      y = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * scale * x + (p[1] - a[1]) * y) / (x * x + y * y || 1)),
    );
    best = Math.min(best, distanceM(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
  }
  return best;
}
export function mapMatch(o: SpeedObservation, segments: RoadSegment[]) {
  if (o.accuracyM > 30 || o.providerConfidence < 0.65) return null;
  return (
    segments
      .filter(
        (r) =>
          (!o.segmentId || o.segmentId === r.id) &&
          r.source === o.source &&
          Math.abs(((o.heading - r.bearing + 540) % 360) - 180) <= 35,
      )
      .map((r) => ({ r, d: distanceToRoad(o.location, r) }))
      .filter((x) => x.d <= Math.max(20, o.accuracyM * 1.5))
      .sort((a, b) => a.d - b.d)[0]?.r ?? null
  );
}
export function classify(
  road: RoadSegment,
  samples: TrafficState['windows'][string],
  now: number,
  config = defaultSettings,
): Estimate {
  const fresh = samples.filter(
    (s) => now - Date.parse(s.at) <= config.freshnessMs && Date.parse(s.at) <= now + 30000,
  );
  const independent = [
    ...new Map(
      [...fresh].sort((a, b) => a.at.localeCompare(b.at)).map((s) => [s.contributor, s]),
    ).values(),
  ];
  const center = median(independent.map((s) => s.speed)),
    mad = median(independent.map((s) => Math.abs(s.speed - center)));
  const clean = independent.filter((s) => Math.abs(s.speed - center) <= Math.max(6, mad * 3));
  const baseline = road.baseline,
    local = new Date(now + 330 * 60000),
    day = local.getUTCDay(),
    hour = local.getUTCHours();
  if (clean.length < config.minimumSamples)
    return {
      ...emptyEstimate('Insufficient independent fresh observations'),
      independentSamples: clean.length,
    };
  if (
    !baseline ||
    baseline.reliability < 0.75 ||
    baseline.sampleDays < 7 ||
    (day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY') !== baseline.dayType ||
    hour < baseline.startHourIST ||
    hour >= baseline.endHourIST
  )
    return {
      ...emptyEstimate('No reliable baseline for this road, day and IST time'),
      independentSamples: clean.length,
    };
  const speed = median(clean.map((s) => s.speed)),
    ratio = speed / baseline.speedKmh;
  const level =
    ratio >= config.ratios[0]
      ? 'NORMAL'
      : ratio >= config.ratios[1]
        ? 'LIGHT'
        : ratio >= config.ratios[2]
          ? 'MODERATE'
          : ratio >= config.ratios[3]
            ? 'HEAVY'
            : 'SEVERE';
  const previous = road.history.filter((h) => h.speedKmh !== null).at(-1)?.speedKmh;
  return {
    level,
    observedSpeedKmh: Math.round(speed * 10) / 10,
    baselineSpeedKmh: baseline.speedKmh,
    ratio: Math.round(ratio * 100) / 100,
    independentSamples: clean.length,
    quality: clean.every((s) => s.confidence >= 0.85) ? 'HIGH' : 'FAIR',
    reason: 'Independent median after direction, freshness, accuracy and MAD checks',
    observedAt: clean
      .map((s) => s.at)
      .sort()
      .at(-1)!,
    trend:
      previous == null
        ? 'UNKNOWN'
        : speed - previous > 3
          ? 'IMPROVING'
          : previous - speed > 3
            ? 'WORSENING'
            : 'STABLE',
  };
}
export function recordEvent(
  s: TrafficState,
  actor: string,
  action: string,
  detail: string,
  incident: TrafficIncident | null = null,
) {
  s.events.push({
    schemaVersion: 1,
    siteId: s.siteId,
    source: s.source,
    id: uid('event'),
    at: s.clock,
    recordedAt: new Date().toISOString(),
    actor,
    incidentId: incident?.id ?? null,
    action,
    detail,
    revision: s.revision + 1,
    snapshot: incident
      ? {
          status: incident.status,
          severity: incident.severity,
          cause: incident.cause,
          causeStatus: incident.causeStatus,
          verificationStatus: incident.verificationStatus,
        }
      : null,
  });
  s.events = s.events.slice(-2000);
}
function closeIncident(
  s: TrafficState,
  i: TrafficIncident,
  status: 'RESOLVED' | 'EXPIRED',
  actor: string,
  detail: string,
) {
  i.status = status;
  i.updatedAt = s.clock;
  for (const r of s.requests.filter(
    (r) =>
      r.incidentId === i.id && !['REJECTED', 'CANCELLED', 'ANALYSIS_COMPLETE'].includes(r.status),
  )) {
    r.status = 'CANCELLED';
    recordEvent(
      s,
      actor,
      'INSPECTION_CANCELLED',
      'Incident closed; recommendation is not a flight command.',
      i,
    );
  }
  for (const h of s.hazards.filter((h) => h.incidentId === i.id)) {
    h.updatedAt = s.clock;
    h.revision = s.revision + 1;
    if (status === 'RESOLVED') {
      h.status = 'RESOLVED';
      h.summary = `Traffic recovery reported on ${i.roadName}.`;
      h.expiresAt = iso(Date.parse(s.clock) + 300000);
    } else h.expiresAt = s.clock;
  }
  recordEvent(s, actor, status, detail, i);
}
export function refreshTraffic(s: TrafficState, config = defaultSettings) {
  const now = Date.parse(s.clock);
  for (const [id, until] of Object.entries(s.seenIds)) if (until < now) delete s.seenIds[id];
  for (const road of s.segments) {
    s.windows[road.id] = (s.windows[road.id] ?? [])
      .filter((v) => now - Date.parse(v.at) <= config.freshnessMs)
      .slice(-200);
    const previous = road.estimate;
    const next = classify(road, s.windows[road.id], now, config);
    const newSample = next.observedAt && next.observedAt !== previous.observedAt;
    if (
      !newSample &&
      next.level === previous.level &&
      next.independentSamples === previous.independentSamples
    )
      continue;
    if (!newSample && next.level !== 'UNKNOWN') next.trend = previous.trend;
    road.estimate = next;
    if (newSample || next.level !== previous.level)
      road.history.push({ at: s.clock, speedKmh: next.observedSpeedKmh, level: next.level });
    road.history = road.history.slice(-96);
    if (['HEAVY', 'SEVERE'].includes(next.level)) {
      road.lowSince ??= s.clock;
      road.recoverySince = null;
    } else if (['NORMAL', 'LIGHT'].includes(next.level)) {
      road.recoverySince ??= s.clock;
      road.lowSince = null;
    } else {
      road.lowSince = null;
      road.recoverySince = null;
    }
  }
  for (const i of s.incidents.filter((i) => i.status === 'ACTIVE')) {
    const roads = s.segments.filter((r) => i.segmentIds.includes(r.id));
    const supported = roads.filter((r) => ['HEAVY', 'SEVERE'].includes(r.estimate.level));
    if (supported.length) {
      const severity = supported.some((r) => r.estimate.level === 'SEVERE') ? 'SEVERE' : 'HEAVY';
      if (severity !== i.severity) {
        i.severity = severity;
        recordEvent(s, 'FLOW', 'SEVERITY_CHANGED', `Supported traffic level: ${severity}`, i);
      }
      i.observedSpeedKmh = median(supported.map((r) => r.estimate.observedSpeedKmh!));
      i.baselineSpeedKmh = median(supported.map((r) => r.estimate.baselineSpeedKmh!));
      i.observationKinds = [
        ...new Set([
          ...i.observationKinds,
          ...supported.flatMap((r) => (s.windows[r.id] ?? []).map((v) => v.kind)),
        ]),
      ];
      const latest = supported
        .map((r) => r.estimate.observedAt!)
        .sort()
        .at(-1)!;
      i.updatedAt = [i.updatedAt, latest].sort().at(-1)!;
      i.expiresAt = iso(Date.parse(latest) + config.expiryMs);
    }
    if (
      roads.length &&
      roads.every(
        (r) =>
          r.recoverySince &&
          now - Date.parse(r.recoverySince) >= config.recoveryMs &&
          ['NORMAL', 'LIGHT'].includes(r.estimate.level),
      )
    )
      closeIncident(
        s,
        i,
        'RESOLVED',
        'FLOW',
        'Sustained recovery supported by fresh independent measurements.',
      );
    else if (now >= Date.parse(i.expiresAt))
      closeIncident(
        s,
        i,
        'EXPIRED',
        'SYSTEM',
        'Observation support expired. This is not confirmed recovery.',
      );
  }
  for (const road of s.segments.filter(
    (r) =>
      r.lowSince &&
      now - Date.parse(r.lowSince) >= config.minimumPersistenceMs &&
      ['HEAVY', 'SEVERE'].includes(r.estimate.level),
  )) {
    const candidates = s.segments.filter(
      (r) =>
        r.corridorId === road.corridorId &&
        r.networkVersion === road.networkVersion &&
        r.direction === road.direction &&
        r.lowSince &&
        now - Date.parse(r.lowSince) >= config.minimumPersistenceMs &&
        ['HEAVY', 'SEVERE'].includes(r.estimate.level),
    );
    const group = [road];
    // Connected directional components only; a shared road name cannot merge distant jams.
    for (let n = 0; n < group.length; n++)
      for (const candidate of candidates)
        if (
          !group.includes(candidate) &&
          [group[n].geometry.coordinates[0], group[n].geometry.coordinates.at(-1)!].some((a) =>
            [candidate.geometry.coordinates[0], candidate.geometry.coordinates.at(-1)!].some(
              (b) => distanceM(a, b) < 100,
            ),
          )
        )
          group.push(candidate);
    const active = s.incidents.find(
      (i) => i.status === 'ACTIVE' && i.segmentIds.some((id) => group.some((r) => r.id === id)),
    );
    if (active) {
      const added = group.filter((r) => !active.segmentIds.includes(r.id));
      if (added.length) {
        active.segmentIds.push(...added.map((r) => r.id));
        active.affectedGeometry.push(...added.map((r) => r.geometry));
        active.affectedDistanceM += added.reduce((n, r) => n + roadLength(r), 0);
        recordEvent(
          s,
          'FLOW',
          'SEGMENTS_CORRELATED',
          'Affected directional corridor segments merged.',
          active,
        );
      }
      continue;
    }
    if (
      s.incidents.some(
        (i) =>
          i.status !== 'ACTIVE' &&
          i.segmentIds.includes(road.id) &&
          now - Date.parse(i.updatedAt) < config.cooldownMs,
      )
    )
      continue;
    if (s.incidents.length >= 300)
      throw new TrafficError(
        'Traffic retention capacity reached; archive closed cases before ingestion.',
        503,
      );
    const incident: TrafficIncident = {
      schemaVersion: 1,
      id: uid('traffic'),
      siteId: s.siteId,
      source: s.source,
      segmentIds: group.map((r) => r.id),
      roadName: road.roadName,
      severity: group.some((r) => r.estimate.level === 'SEVERE') ? 'SEVERE' : 'HEAVY',
      observedSpeedKmh: median(group.map((r) => r.estimate.observedSpeedKmh!)),
      baselineSpeedKmh: median(group.map((r) => r.estimate.baselineSpeedKmh!)),
      cause: 'UNKNOWN',
      causeStatus: 'UNKNOWN',
      verificationStatus: 'UNVERIFIED',
      verifiedAt: null,
      networkVersion: road.networkVersion,
      observationKinds: [
        ...new Set(group.flatMap((r) => (s.windows[r.id] ?? []).map((v) => v.kind))),
      ],
      status: 'ACTIVE',
      firstDetectedAt: road.lowSince!,
      updatedAt: s.clock,
      expiresAt: iso(now + config.expiryMs),
      affectedGeometry: group.map((r) => r.geometry),
      affectedDistanceM: Math.round(group.reduce((v, r) => v + roadLength(r), 0)),
      investigationId: null,
      priority:
        (road.estimate.level === 'SEVERE' ? 90 : 70) +
        (road.classification === 'ARTERIAL'
          ? 5
          : road.classification === 'LOCAL'
            ? -10
            : road.classification === 'UNKNOWN'
              ? -5
              : 0) -
        (road.estimate.quality === 'FAIR' ? 5 : 0),
    };
    s.incidents.push(incident);
    recordEvent(
      s,
      'FLOW',
      'CONGESTION_DETECTED',
      'Persistent independent low-speed observations. Cause remains UNKNOWN.',
      incident,
    );
  }
  s.evidence = s.evidence.filter((e) => Date.parse(e.expiresAt) > now);
  const retained = new Set(
    s.incidents
      .filter((i) => i.status === 'ACTIVE' || now - Date.parse(i.updatedAt) < 7 * 86400000)
      .map((i) => i.id),
  );
  s.incidents = s.incidents.filter((i) => retained.has(i.id));
  s.requests = s.requests.filter((r) => retained.has(r.incidentId));
  s.investigations = s.investigations.filter((a) => retained.has(a.incidentId));
  s.hazards = s.hazards.filter((h) => retained.has(h.incidentId));
}
export function ingestObservations(
  s: TrafficState,
  raw: unknown[],
  actor: TrafficActor,
  config = defaultSettings,
) {
  // Expired support breaks persistence before the next batch is considered.
  refreshTraffic(s, config);
  const now = Date.parse(s.clock);
  let accepted = 0,
    duplicates = 0,
    rejected = 0;
  for (const row of raw) {
    const parsed = observationSchema.safeParse(row);
    if (!parsed.success) {
      rejected++;
      continue;
    }
    const o = parsed.data;
    if (
      o.source !== s.source ||
      actor.source !== s.source ||
      (s.source === 'LIVE' && o.kind === 'DEMO') ||
      Date.parse(o.observedAt) > now + 30000 ||
      now - Date.parse(o.observedAt) > config.freshnessMs
    ) {
      rejected++;
      continue;
    }
    const id = `${actor.id}:${o.observationId}`;
    if (s.seenIds[id]) {
      duplicates++;
      continue;
    }
    const road = mapMatch(o, s.segments);
    if (!road) {
      rejected++;
      continue;
    }
    s.seenIds[id] = now + config.freshnessMs * 2;
    (s.windows[road.id] ??= []).push({
      id,
      contributor: `${actor.id}:${o.contributorId}`,
      speed: o.speedKmh,
      at: o.observedAt,
      accuracy: o.accuracyM,
      confidence: o.providerConfidence,
      kind: o.kind,
    });
    accepted++;
  }
  refreshTraffic(s, config);
  recordEvent(
    s,
    actor.id,
    'OBSERVATIONS_AGGREGATED',
    `${accepted} accepted; ${duplicates} duplicate; ${rejected} unsuitable. Raw positions are not retained.`,
  );
  return { accepted, duplicates, rejected };
}
export function analyzeIncident(
  s: TrafficState,
  incidentId: string,
  actor: TrafficActor,
  config = defaultSettings,
) {
  const i = s.incidents.find((i) => i.id === incidentId);
  if (!i || i.status !== 'ACTIVE') throw new TrafficError('Active incident unavailable.', 404);
  const evidence = s.evidence.filter(
    (e) =>
      e.incidentId === i.id &&
      e.humanReviewStatus !== 'REJECTED' &&
      Date.parse(e.expiresAt) > Date.parse(s.clock),
  );
  let analysis = s.investigations.find((a) => a.id === i.investigationId);
  if (!analysis) {
    analysis = {
      schemaVersion: 1,
      id: uid('investigation'),
      siteId: s.siteId,
      source: s.source,
      incidentId: i.id,
      observationIds: [],
      relevantAggregates: [],
      candidates: [],
      uncertainty: 'Congestion alone cannot establish cause.',
      nextStep: 'Review supporting data and inspection feasibility.',
      publicDraft: '',
      method: 'DETERMINISTIC_RULES',
      updatedAt: s.clock,
      reviewer: null,
      notes: '',
    };
    s.investigations.push(analysis);
    i.investigationId = analysis.id;
  }
  analysis.observationIds = evidence.map((e) => e.id);
  analysis.relevantAggregates = s.segments
    .filter((r) => i.segmentIds.includes(r.id))
    .map((r) => ({
      segmentId: r.id,
      roadClass: r.classification,
      estimate: structuredClone(r.estimate),
    }));
  analysis.updatedAt = s.clock;
  analysis.candidates = evidence.map((e) => ({
    cause: (e.fixture === 'water' ? 'WATERLOGGING' : 'VEHICLE_BREAKDOWN') as Cause,
    description:
      e.fixture === 'water'
        ? 'Possible water accumulation in the labeled demonstration frame.'
        : 'Possible stationary vehicle or obstruction in the labeled demonstration frame.',
    evidenceIds: [e.id],
    confidence: null,
  }));
  analysis.method = evidence.length ? 'DEMO_FIXTURE_ANNOTATIONS' : 'DETERMINISTIC_RULES';
  analysis.uncertainty = evidence.length
    ? 'Demo fixture annotations, not pixel inference. No calibrated confidence. A single frame does not prove causation.'
    : 'Speed patterns support congestion only. No supported cause has been identified. No linked authorized closure, weather or citizen-report context is available in this workspace.';
  if (i.verificationStatus !== 'VERIFIED') i.causeStatus = evidence.length ? 'POSSIBLE' : 'UNKNOWN';
  analysis.nextStep = evidence.length
    ? 'Authorized reviewer must inspect the frame and confirm or reject the candidate.'
    : 'Assess whether an authorized observation could improve understanding.';
  analysis.publicDraft = publicSummary(i);
  recordEvent(s, actor.id, 'CORE_ANALYSIS', analysis.uncertainty, i);
  for (const r of s.requests.filter(
    (r) => r.incidentId === i.id && r.status === 'OBSERVATION_AVAILABLE',
  )) {
    r.status = 'ANALYSIS_COMPLETE';
    recordEvent(
      s,
      'CORE',
      'ANALYSIS_COMPLETE',
      'Evidence analysis available for human verification.',
      i,
    );
  }
  const recentEvidence = evidence.some(
    (e) => Date.parse(s.clock) - Date.parse(e.capturedAt) < 300000,
  );
  const recentRequest = s.requests.some(
    (r) =>
      r.incidentId === i.id &&
      (!['CANCELLED', 'REJECTED'].includes(r.status) ||
        Date.parse(s.clock) - Date.parse(r.reviewedAt ?? r.createdAt) < config.cooldownMs),
  );
  if (
    !recentEvidence &&
    !recentRequest &&
    i.verificationStatus !== 'VERIFIED' &&
    i.priority >= 70 &&
    Date.parse(s.clock) - Date.parse(i.firstDetectedAt) >= config.minimumPersistenceMs
  ) {
    s.requests.push({
      schemaVersion: 1,
      id: uid('inspection'),
      siteId: s.siteId,
      source: s.source,
      incidentId: i.id,
      requestReason:
        'Persistent significant congestion with no supported cause. An authorized observation may improve evidence.',
      areaOfInterest: i.affectedGeometry,
      requestedObservationType: 'Road queue / obstruction context; no faces or vehicle ownership',
      priority: i.priority,
      supportingEvidence: s.events
        .filter((e) => e.incidentId === i.id && e.action === 'CONGESTION_DETECTED')
        .map((e) => e.id),
      status: 'RECOMMENDED',
      createdAt: s.clock,
      reviewedAt: null,
      authorizedReviewer: null,
      linkedObservationIds: [],
    });
    recordEvent(
      s,
      'CORE',
      'INSPECTION_RECOMMENDED',
      'Decision support only. No flight, destination or aircraft command was issued.',
      i,
    );
  }
}
export function publicSummary(i: TrafficIncident) {
  return i.status === 'RESOLVED'
    ? `Traffic recovery reported on ${i.roadName}.`
    : `${i.severity.toLowerCase()} congestion on ${i.roadName}. ${i.verificationStatus === 'VERIFIED' && i.cause !== 'UNKNOWN' ? `Reviewed cause: ${i.cause.toLowerCase().replaceAll('_', ' ')}.` : 'Cause remains unconfirmed.'}`;
}
export function applyCommand(
  s: TrafficState,
  command: TrafficCommand,
  actor: TrafficActor,
  configInput: TrafficSettings = defaultSettings,
) {
  const config = settingsSchema.parse(configInput);
  if (command.action === 'start-demo' || command.action === 'demo-observations')
    throw new TrafficError('Scenario actions belong to the demo adapter.');
  if (actor.source !== s.source || (s.source === 'LIVE' && actor.role === 'DEMO_OPERATOR'))
    throw new TrafficError('Source authorization rejected.', 403);
  if (command.expectedRevision !== s.revision)
    throw new TrafficError('Workspace changed. Refresh and review before retrying.', 409);
  const reviewer = ['REVIEWER', 'DEMO_OPERATOR'].includes(actor.role);
  if (command.action === 'ingest') {
    if (!['INGESTOR', 'DEMO_OPERATOR'].includes(actor.role))
      throw new TrafficError('Authorized ingestor required.', 403);
    return ingestObservations(s, command.observations, actor, config);
  }
  if (command.action === 'register-roads') {
    if (!reviewer) throw new TrafficError('Reviewer required.', 403);
    for (const raw of command.roads) {
      if (raw.siteId !== s.siteId || raw.source !== s.source)
        throw new TrafficError('Road site/source mismatch.');
      const index = s.segments.findIndex((r) => r.id === raw.id);
      if (
        index >= 0 &&
        s.incidents.some((i) => i.status === 'ACTIVE' && i.segmentIds.includes(raw.id))
      )
        throw new TrafficError('Cannot replace geometry used by an active investigation.', 409);
      const road = {
        ...raw,
        estimate: emptyEstimate(),
        lowSince: null,
        recoverySince: null,
        history: [],
      };
      if (index >= 0) s.segments[index] = road;
      else s.segments.push(road);
    }
    if (s.segments.length > 200) throw new TrafficError('Registry capacity exceeded.');
    recordEvent(
      s,
      actor.id,
      'ROAD_REGISTRY_UPDATED',
      'Licensed directional registry updated. No coverage is inferred.',
    );
    return;
  }
  if (command.action === 'analyze') {
    if (actor.role === 'INGESTOR') throw new TrafficError('Investigation role required.', 403);
    analyzeIncident(s, command.incidentId, actor, config);
    return;
  }
  if (!reviewer) throw new TrafficError('Authorized reviewer required.', 403);
  if (command.action === 'request-review' || command.action === 'attach-sample') {
    const r = s.requests.find((r) => r.id === command.requestId),
      i = s.incidents.find((i) => i.id === r?.incidentId);
    if (!r || !i || i.status !== 'ACTIVE')
      throw new TrafficError('Active recommendation unavailable.', 404);
    if (command.action === 'request-review') {
      const transitions: Record<string, string[]> = {
        RECOMMENDED: ['PENDING_REVIEW', 'REJECTED', 'CANCELLED'],
        PENDING_REVIEW: ['APPROVED_FOR_OPERATOR_PLANNING', 'REJECTED', 'CANCELLED'],
        APPROVED_FOR_OPERATOR_PLANNING: ['CANCELLED'],
      };
      if (!transitions[r.status]?.includes(command.status))
        throw new TrafficError('Invalid inspection transition.', 409);
      r.status = command.status;
      r.reviewedAt = s.clock;
      r.authorizedReviewer = actor.id;
      recordEvent(s, actor.id, command.status, command.notes, i);
    } else {
      if (s.source !== 'DEMO')
        throw new TrafficError('Demo samples cannot enter live investigations.', 403);
      if (r.status !== 'APPROVED_FOR_OPERATOR_PLANNING')
        throw new TrafficError(
          'Operator planning approval required before linking an observation.',
          409,
        );
      const e = {
        schemaVersion: 1 as const,
        id: uid('evidence'),
        siteId: s.siteId,
        source: s.source,
        incidentId: i.id,
        requestId: r.id,
        capturedAt: s.clock,
        receivedAt: s.clock,
        expiresAt: iso(Date.parse(s.clock) + 86400000),
        kind: 'DEMO_ILLUSTRATION' as const,
        fixture: command.fixture,
        description:
          'Original synthetic training illustration. Not aerial footage or an actual mission.',
        authorizedBy: actor.id,
        humanReviewStatus: 'UNREVIEWED' as const,
      };
      if (s.evidence.length >= 150) throw new TrafficError('Evidence capacity reached.', 503);
      s.evidence.push(e);
      r.linkedObservationIds.push(e.id);
      r.status = 'OBSERVATION_AVAILABLE';
      recordEvent(
        s,
        actor.id,
        'OBSERVATION_AVAILABLE',
        'Authorized labeled sample linked. No inspection flight is claimed.',
        i,
      );
    }
    return;
  }
  const i = s.incidents.find((i) => i.id === command.incidentId);
  if (!i || i.status !== 'ACTIVE') throw new TrafficError('Active incident unavailable.', 404);
  if (command.action === 'verify') {
    const a = s.investigations.find((a) => a.id === i.investigationId),
      candidate = a?.candidates.find((c) => c.cause === command.cause);
    if (
      !a ||
      !candidate ||
      !candidate.evidenceIds.every((id) =>
        s.evidence.some((e) => e.id === id && Date.parse(e.expiresAt) > Date.parse(s.clock)),
      )
    )
      throw new TrafficError(
        'Current supporting evidence and an analyzed candidate are required.',
        409,
      );
    a.reviewer = actor.id;
    a.notes = command.notes;
    i.cause = command.decision === 'confirm' ? command.cause : 'UNKNOWN';
    i.causeStatus = command.decision === 'confirm' ? 'VERIFIED' : 'REJECTED';
    i.verificationStatus = command.decision === 'confirm' ? 'VERIFIED' : 'UNVERIFIED';
    i.verifiedAt = command.decision === 'confirm' ? s.clock : null;
    i.updatedAt = s.clock;
    for (const e of s.evidence.filter((e) => candidate.evidenceIds.includes(e.id)))
      e.humanReviewStatus = command.decision === 'confirm' ? 'CONFIRMED' : 'REJECTED';
    a.publicDraft = publicSummary(i);
    recordEvent(
      s,
      actor.id,
      command.decision === 'confirm' ? 'CAUSE_VERIFIED' : 'CANDIDATE_REJECTED',
      command.notes,
      i,
    );
    // Previously published cause must be withdrawn if its verification changes.
    for (const h of s.hazards.filter((h) => h.incidentId === i.id)) h.expiresAt = s.clock;
  } else if (command.action === 'publish') {
    if (Date.parse(i.expiresAt) <= Date.parse(s.clock))
      throw new TrafficError('Incident support expired. Refresh before publication.', 409);
    const h = {
      schemaVersion: 1 as const,
      id: i.id,
      siteId: s.siteId,
      source: s.source,
      incidentId: i.id,
      segmentIds: [...i.segmentIds],
      roadName: i.roadName,
      severity: i.severity,
      cause: i.verificationStatus === 'VERIFIED' ? i.cause : ('UNKNOWN' as Cause),
      verificationStatus: i.verificationStatus,
      status: 'ACTIVE' as const,
      summary: publicSummary(i),
      approved: true as const,
      publishedAt: s.clock,
      updatedAt: s.clock,
      expiresAt: iso(Math.min(Date.parse(i.expiresAt), Date.parse(s.clock) + 900000)),
      revision: s.revision + 1,
      etaChangeMinutes: null,
    };
    s.hazards = s.hazards.filter((h) => h.incidentId !== i.id);
    s.hazards.push(h);
    recordEvent(s, actor.id, 'PUBLICATION_APPROVED', h.summary, i);
  } else if (command.action === 'resolve')
    closeIncident(s, i, 'RESOLVED', actor.id, `Human-reviewed resolution: ${command.notes}`);
}
export function analytics(s: TrafficState) {
  const active = s.incidents.filter((i) => i.status === 'ACTIVE');
  return {
    active: active.length,
    severe: active.filter((i) => i.severity === 'SEVERE').length,
    pending: s.requests.filter((r) => ['RECOMMENDED', 'PENDING_REVIEW'].includes(r.status)).length,
    verified: active.filter((i) => i.verificationStatus === 'VERIFIED').length,
    recommendations: s.requests.filter((r) =>
      ['RECOMMENDED', 'PENDING_REVIEW', 'APPROVED_FOR_OPERATOR_PLANNING'].includes(r.status),
    ).length,
    improving: s.segments.filter(
      (r) => r.estimate.trend === 'IMPROVING' && r.estimate.level !== 'UNKNOWN',
    ).length,
    knownCoverage: s.segments.filter((r) => r.estimate.level !== 'UNKNOWN').length,
    total: s.segments.length,
    resolved: s.incidents.filter((i) => i.status === 'RESOLVED').length,
    expired: s.incidents.filter((i) => i.status === 'EXPIRED').length,
  };
}
