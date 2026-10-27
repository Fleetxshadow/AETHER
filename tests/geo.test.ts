import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readSpatialCollection,
  type SpatialCollection,
  type SpatialFeature,
} from '../src/lib/geo-contracts';
import {
  clusterPixels,
  observationSpatialFeatures,
  reviewSpatialFeatures,
  spatialMapPoints,
  trafficSpatialFeatures,
  spatialColor,
} from '../src/lib/geo-review';
import { observations } from '../src/lib/data';
import { latLng } from '../src/lib/operational-map';
import { initialTraffic } from '../src/lib/traffic/demo';

const fixture = JSON.parse(
  readFileSync('public/demo/aether-spatial-review.geojson', 'utf8'),
) as SpatialCollection;
const context = {
  origin: 'DEMO' as const,
  role: null,
  siteId: 'main',
  now: Date.parse('2026-10-22T06:00:00Z'),
};
const changed = (edit: (features: SpatialFeature[]) => void) => {
  const copy = structuredClone(fixture);
  edit(copy.features);
  return copy;
};
test('GeoJSON preserves exact coordinates, timestamps and explicit source across all four geometry types', () => {
  const data = readSpatialCollection(fixture, context);
  assert.equal(data.features.length, 13);
  assert.deepEqual(
    new Set(data.features.map((f) => f.geometry.type)),
    new Set(['Point', 'LineString', 'Polygon', 'MultiPolygon']),
  );
  assert.deepEqual(data, fixture);
  const p = data.features.find((f) => f.geometry.type === 'Point')!;
  assert.equal(p.geometry.type, 'Point');
  if (p.geometry.type === 'Point')
    assert.deepEqual(latLng(p.geometry.coordinates), {
      lng: p.geometry.coordinates[0],
      lat: p.geometry.coordinates[1],
    });
  assert(data.features.every((f) => f.properties.source === 'DEMO'));
});
test('invalid topology, coordinates, missing area provenance and kind mismatches are rejected', () => {
  const mutate = [
    (f: SpatialFeature[]) => {
      f[3].geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [77, 28],
            [77.1, 28],
            [77.1, 28.1],
            [77, 28.2],
          ],
        ],
      };
    },
    (f: SpatialFeature[]) => {
      f[3].geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [77, 28],
            [77.1, 28.1],
            [77, 28.1],
            [77.1, 28],
            [77, 28],
          ],
        ],
      };
    },
    (f: SpatialFeature[]) => {
      f[3].geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [77, 28],
            [77.1, 28],
            [77.2, 28],
            [77, 28],
          ],
        ],
      };
    },
    (f: SpatialFeature[]) => {
      f[3].geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [77, 28],
            [77.1, 28],
            [77.1, 28.1],
            [77, 28.1],
            [77, 28],
          ],
          [
            [78, 29],
            [78.01, 29],
            [78.01, 29.01],
            [78, 29.01],
            [78, 29],
          ],
        ],
      };
    },
    (f: SpatialFeature[]) => {
      f[4].geometry = { type: 'Point', coordinates: [200, 28] };
    },
    (f: SpatialFeature[]) => {
      f[4].geometry = { type: 'Point', coordinates: [77, Infinity] };
    },
    (f: SpatialFeature[]) => {
      f[3].properties.evidenceIds = [];
    },
    (f: SpatialFeature[]) => {
      f[3].geometry = { type: 'Point', coordinates: [77, 28] };
    },
    (f: SpatialFeature[]) => {
      f[10].geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [77, 28],
              [77.1, 28],
              [77.1, 28.1],
              [77, 28.1],
              [77, 28],
            ],
          ],
          [
            [
              [77.05, 28.05],
              [77.2, 28.05],
              [77.2, 28.2],
              [77.05, 28.2],
              [77.05, 28.05],
            ],
          ],
        ],
      };
    },
  ];
  mutate.forEach((edit) => assert.throws(() => readSpatialCollection(changed(edit), context)));
});
test('valid polygon holes and disjoint multipolygons remain interoperable GeoJSON', () => {
  const input = changed((f) => {
    f[3].geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [77, 28],
          [77.1, 28],
          [77.1, 28.1],
          [77, 28.1],
          [77, 28],
        ],
        [
          [77.02, 28.02],
          [77.02, 28.03],
          [77.03, 28.03],
          [77.03, 28.02],
          [77.02, 28.02],
        ],
      ],
    };
  });
  assert.deepEqual(
    readSpatialCollection(input, context).features[3].geometry,
    input.features[3].geometry,
  );
});
test('recorded GPS requires chronological per-position timestamps; proposals never become recordings', () => {
  for (const edit of [
    (f: SpatialFeature[]) => {
      f[0].properties.sampleTimes.pop();
    },
    (f: SpatialFeature[]) => {
      f[0].properties.sampleTimes.reverse();
    },
    (f: SpatialFeature[]) => {
      f[0].properties.pathStatus = 'RECORDED';
    },
    (f: SpatialFeature[]) => {
      f[1].properties.sampleTimes = [f[1].properties.observedAt];
    },
    (f: SpatialFeature[]) => {
      f[4].properties.sampleTimes = [f[4].properties.observedAt];
    },
    (f: SpatialFeature[]) => {
      f[4].properties.sessionId = 'unknown-private-session';
    },
  ])
    assert.throws(() => readSpatialCollection(changed(edit), context));
});
test('files cannot assert backend authority, expose private trails to viewers or self-verify', () => {
  const trail = structuredClone(fixture.features[0]);
  Object.assign(trail.properties, {
    source: 'LOCAL',
    audience: 'OPERATOR',
    pathStatus: 'RECORDED',
  });
  const file = { type: 'FeatureCollection', features: [trail] };
  assert.throws(() => readSpatialCollection(file, { ...context, origin: 'IMPORT' }), /operator/);
  assert.throws(
    () => readSpatialCollection(file, { ...context, origin: 'IMPORT', role: 'viewer' }),
    /operator/,
  );
  assert.equal(
    readSpatialCollection(file, { ...context, origin: 'IMPORT', role: 'operator' }).features[0]
      .properties.source,
    'LOCAL',
  );
  trail.properties.verification = 'VERIFIED';
  trail.properties.verifiedAt = trail.properties.updatedAt;
  trail.properties.verifiedBy = 'File claims reviewer';
  assert.throws(
    () => readSpatialCollection(file, { ...context, origin: 'IMPORT', role: 'operator' }),
    /verify itself/,
  );
  trail.properties.source = 'AUTHORIZED';
  assert.throws(
    () => readSpatialCollection(file, { ...context, origin: 'IMPORT', role: 'operator' }),
    /provenance/,
  );
  assert.throws(
    () => readSpatialCollection(file, { ...context, origin: 'BACKEND', role: 'viewer' }),
    /operator/,
  );
  assert.equal(
    readSpatialCollection(file, { ...context, origin: 'BACKEND', role: 'operator' }).features
      .length,
    1,
  );
  assert.throws(
    () =>
      readSpatialCollection(file, {
        ...context,
        origin: 'BACKEND',
        role: 'operator',
        siteId: 'another-site',
      }),
    /different site/,
  );
  const privateFields = {
    ...fixture,
    features: [
      {
        ...fixture.features[0],
        properties: { ...fixture.features[0].properties, callerPhone: 'private' },
      },
    ],
  };
  assert.throws(() => readSpatialCollection(privateFields, context), /private fields/);
});
test('timeline clips only recorded samples and withholds later verification and analysis without mutating source', () => {
  const before = structuredClone(fixture);
  const reviewed = reviewSpatialFeatures(fixture.features, '2026-10-12T04:36:00.000Z');
  const trail = reviewed.find((f) => f.id === 'DEMO-SKY-01')!;
  assert.equal(trail.geometry.type, 'LineString');
  if (trail.geometry.type === 'LineString') assert.equal(trail.geometry.coordinates.length, 4);
  assert.equal(trail.properties.sampleTimes.length, 4);
  assert(!reviewed.some((f) => f.id === 'DEMO-FIRE-AREA'));
  assert.equal(
    reviewed.find((f) => f.id === 'DEMO-SKY-PROPOSED')?.properties.pathStatus,
    'PROPOSED',
  );
  const earlier = reviewSpatialFeatures(fixture.features, '2026-10-12T04:29:00.000Z');
  assert.equal(earlier[0].properties.verification, 'UNDER_REVIEW');
  assert.equal(earlier[0].properties.verifiedAt, null);
  assert.deepEqual(fixture, before);
  const endpoints = spatialMapPoints([trail]);
  assert.deepEqual(
    endpoints.map((p) => p.markerKind),
    ['start', 'end'],
  );
  assert(endpoints.every((p) => p.selectionId === trail.id && p.source === 'DEMO'));
});
test('existing observation projections do not invent boundaries, verification or causes', () => {
  const original = structuredClone(observations);
  const live = {
    ...observations[0],
    id: 'trusted-point',
    siteId: 'main',
    deviceId: 'pi-1',
    dataSource: 'LIVE' as const,
    source: 'Device observation' as const,
  };
  const ai = {
    id: 'ai-1',
    siteId: 'main',
    deviceId: 'pi-1',
    module: live.module,
    observedAt: live.observedAt,
    source: 'LIVE' as const,
    category: 'observation',
    description: 'A queue was detected; cause not established.',
    confidence: 76,
    observationIds: [live.id],
  };
  const result = observationSpatialFeatures([live], [ai], false)[0];
  assert.equal(result.geometry.type, 'Point');
  assert.equal(result.properties.source, 'AUTHORIZED');
  assert.equal(result.properties.verification, 'UNDER_REVIEW');
  assert.equal(result.properties.analysis.suggestedCause, null);
  assert.equal(result.properties.analysis.verifiedCause, null);
  assert.equal(result.properties.confidence, 76);
  assert.equal(observationSpatialFeatures([live], [ai], true)[0].properties.source, 'DEMO');
  assert.deepEqual(observations, original);
});
test('feature and vertex budgets prevent oversized imports before geometry processing', () => {
  assert.throws(() =>
    readSpatialCollection(
      {
        type: 'FeatureCollection',
        features: Array.from({ length: 201 }, (_, i) => ({
          ...fixture.features[4],
          id: 'point-' + i,
        })),
      },
      context,
    ),
  );
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    ...fixture.features[1],
    id: 'path-' + i,
    geometry: {
      type: 'LineString',
      coordinates: Array.from({ length: 1000 }, (_, j) => [77 + j / 100000, 28]),
    },
  }));
  assert.throws(
    () => readSpatialCollection({ type: 'FeatureCollection', features: shapes }, context),
    /5,000/,
  );
});
test('co-located markers cluster while selected points and endpoints retain independent targets', () => {
  const points = Array.from({ length: 4 }, (_, i) => ({
    id: 'p' + i,
    x: 100,
    y: 100,
    coordinate: [77, 28] as [number, number],
    selected: i === 0,
    endpoint: i === 1,
  }));
  const groups = clusterPixels(points);
  assert.equal(groups.length, 3);
  assert.equal(groups.find((g) => g.members.length === 2)?.members.length, 2);
  assert(groups.some((g) => g.members.length === 1 && g.members[0].id === 'p0'));
  assert(groups.some((g) => g.members.length === 1 && g.members[0].id === 'p1'));
  assert.deepEqual(clusterPixels(points), groups);
});
test('FLOW preserves UNKNOWN and exact road geometry instead of labeling missing data as congestion', () => {
  const state = initialTraffic('main', 'DEMO', context.now);
  const roads = state.segments.map((r) => ({
    ...r,
    estimate: { ...r.estimate, observedAt: state.clock },
  }));
  const result = trafficSpatialFeatures(roads, [], []);
  assert.equal(result.length, roads.length);
  assert(
    result.every(
      (f) => f.properties.severity === 'unknown' && f.properties.trafficLevel === 'UNKNOWN',
    ),
  );
  assert(
    result.every(
      (f) =>
        spatialColor(f) === '#8e9995' &&
        f.properties.analysis.verifiedCause === null &&
        f.properties.analysis.suggestedCause === null,
    ),
  );
  assert.deepEqual(result[0].geometry, roads[0].geometry);
  assert(
    result.every((f) => f.properties.source === 'DEMO' && f.properties.incidentStatus === null),
  );
});
