import {
  type TrafficState,
  type RoadSegment,
  type TrafficSource,
  type TrafficSettings,
  defaultSettings,
} from './contract';
import {
  emptyEstimate,
  ingestObservations,
  recordEvent,
  refreshTraffic,
  TrafficError,
} from './engine';

export function initialTraffic(
  siteId: string,
  source: TrafficSource,
  now = Date.now(),
): TrafficState {
  const clock = new Date(now).toISOString();
  const state: TrafficState = {
    schemaVersion: 1,
    siteId,
    source,
    revision: 0,
    clock,
    createdAt: clock,
    expiresAt: new Date(now + 86400000).toISOString(),
    demoStep: 0,
    segments: [],
    incidents: [],
    investigations: [],
    requests: [],
    evidence: [],
    hazards: [],
    events: [],
    windows: {},
    seenIds: {},
  };
  if (source === 'LIVE') return state;
  const day = new Date(now + 330 * 60000).getUTCDay();
  const roads = [
    [
      'demo-gcr-n1',
      'Golf Course Road',
      'Sector 54',
      'gcr',
      'NORTHBOUND',
      18,
      [
        [77.0975, 28.4235],
        [77.101, 28.431],
        [77.103, 28.438],
      ],
    ],
    [
      'demo-gcr-s1',
      'Golf Course Road',
      'Sector 54',
      'gcr',
      'SOUTHBOUND',
      198,
      [
        [77.103, 28.438],
        [77.101, 28.431],
        [77.0975, 28.4235],
      ],
    ],
    [
      'demo-extension-w',
      'Golf Course Extension Road',
      'Sector 65',
      'extension',
      'WESTBOUND',
      262,
      [
        [77.0975, 28.4235],
        [77.077, 28.421],
        [77.059, 28.419],
      ],
    ],
    [
      'demo-sohna-n',
      'Sohna Road',
      'Sector 49',
      'sohna',
      'NORTHBOUND',
      340,
      [
        [77.059, 28.419],
        [77.052, 28.441],
        [77.046, 28.459],
      ],
    ],
    [
      'demo-sector-e',
      'Sector connector',
      'Sector 51',
      'connector',
      'EASTBOUND',
      90,
      [
        [77.046, 28.459],
        [77.075, 28.457],
        [77.103, 28.438],
      ],
    ],
    [
      'demo-nh48-n',
      'NH 48 reference corridor',
      'Cyber City',
      'nh48',
      'NORTHBOUND',
      35,
      [
        [77.015, 28.454],
        [77.032, 28.477],
        [77.061, 28.502],
      ],
    ],
  ] as const;
  state.segments = roads.map(
    ([id, roadName, locality, corridorId, direction, bearing, coordinates]) =>
      ({
        schemaVersion: 1,
        id,
        siteId,
        source: 'DEMO',
        roadName,
        locality,
        corridorId,
        direction,
        bearing,
        classification: 'ARTERIAL',
        legalSpeedKmh: null,
        geometry: { type: 'LineString', coordinates: coordinates.map((p) => [...p]) },
        geometryProvenance:
          'Original approximate Gurugram corridor sketch, not surveyed or routable geography',
        geometryStatus: 'REFERENCE_SKETCH',
        networkVersion: 'nexus-gurugram-sketch-v1',
        baseline: {
          speedKmh: 45,
          reliability: 0.9,
          sampleDays: 14,
          dayType: day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY',
          startHourIST: 0,
          endHourIST: 24,
          provenance: 'Synthetic matched-day baseline. No historical observations claimed.',
        },
        estimate: emptyEstimate(),
        lowSince: null,
        recoverySince: null,
        history: [],
      }) as RoadSegment,
  );
  recordEvent(
    state,
    'DEMO_ADAPTER',
    'SIMULATION_STARTED',
    'Private simulation. Traffic, baselines, imagery and routes are synthetic; no live coverage or flight is claimed.',
  );
  return state;
}
export function demoObservations(
  s: TrafficState,
  phase: 'normal' | 'slow' | 'recovery' | 'advance',
  config: TrafficSettings = defaultSettings,
) {
  if (s.source !== 'DEMO') throw new TrafficError('Simulation cannot mutate LIVE state.', 403);
  const actor = {
    id: 'demo-sensor-adapter',
    role: 'DEMO_OPERATOR' as const,
    source: 'DEMO' as const,
  };
  if (phase === 'advance') {
    s.clock = new Date(Date.parse(s.clock) + config.expiryMs + 1000).toISOString();
    refreshTraffic(s, config);
    recordEvent(
      s,
      actor.id,
      'SIMULATION_CLOCK_ADVANCED',
      'No readings added. Missing data is UNKNOWN, not recovered.',
    );
    return;
  }
  const duration =
    phase === 'normal'
      ? 30000
      : (phase === 'recovery' ? config.recoveryMs : config.minimumPersistenceMs) + 30000;
  const count = Math.ceil(duration / 30000);
  for (let batch = 0; batch < count; batch++) {
    const increment = 30000;
    s.clock = new Date(Date.parse(s.clock) + increment).toISOString();
    const road = s.segments[0];
    const day = new Date(Date.parse(s.clock) + 330 * 60000).getUTCDay();
    if (road.baseline) road.baseline.dayType = day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
    const observations = Array.from({ length: 6 }, (_, i) => ({
      schemaVersion: 1,
      observationId: `demo_${s.demoStep}_${batch}_${i}`,
      segmentId: road.id,
      contributorId: `independent-demo-${i}`,
      source: 'DEMO',
      kind: 'DEMO',
      consented: true,
      location: road.geometry.coordinates[1],
      heading: road.bearing,
      speedKmh: (phase === 'slow' ? 9 : 42) + [0, 1, -1, 2, 0, 1][i],
      accuracyM: 5,
      providerConfidence: 0.9,
      observedAt: s.clock,
    }));
    ingestObservations(s, observations, actor, config);
  }
  s.demoStep++;
}
