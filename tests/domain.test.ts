import assert from 'node:assert/strict';
import test from 'node:test';
import {
  observations,
  snapshotSchema,
  snapshotTime,
  timeLabel,
  visibleObservations,
  observationStatus,
  metricsAt,
  normalizeStep,
} from '../src/lib/data';
import { useNexus } from '../src/lib/store';
import { buildings, worldToLngLat } from '../src/lib/city';
import { sensorReadings } from '../src/lib/telemetry';
import { moduleIds, modules, isWorkspace } from '../src/lib/modules';
import {
  fitCamera,
  observationPoints,
  trafficMapData,
  validCoordinate,
} from '../src/lib/operational-map';
import { severityColor } from '../src/lib/data';
import { initialTraffic } from '../src/lib/traffic/demo';

test('operational projection preserves coordinates and separates demo, authorized and test sources', () => {
  const real = {
    ...observations[0],
    id: 'device-observation',
    dataSource: 'LIVE' as const,
    location: [77.0266, 28.4595] as [number, number],
  };
  const points = observationPoints(
    [observations[0], real],
    3,
    severityColor,
    false,
    new Set([real.id]),
  );
  assert.deepEqual(points[0].coordinate, observations[0].location);
  assert.equal(points[0].source, 'DEMO');
  assert.deepEqual(points[1].coordinate, real.location);
  assert.equal(points[1].source, 'AUTHORIZED');
  assert.ok(points[1].overlays.includes('core'));
  assert.ok(!points[0].overlays.includes('core'));
  assert.ok(
    !observationPoints(
      [{ ...real, module: 'core', evidence: '' }],
      3,
      severityColor,
    )[0].overlays.includes('core'),
  );
  assert.equal(observationPoints([real], 3, severityColor, true)[0].source, 'TEST');
  assert.equal(observationPoints([{ ...real, location: [NaN, 28] }], 3, severityColor).length, 0);
  assert.equal(validCoordinate([181, 28]), false);
  assert.equal(validCoordinate([77, Infinity]), false);
});

test('traffic map uses existing registry geometry without promoting demo or unknown causes', () => {
  const state = initialTraffic('main', 'DEMO');
  const before = JSON.stringify(state);
  const data = trafficMapData(state.segments, state.incidents);
  assert.equal(data.lines.length, state.segments.length);
  assert.ok(data.points.every((p) => p.source === 'DEMO' && p.detail.includes('UNKNOWN')));
  assert.deepEqual(data.lines[0].coordinate, state.segments[0].geometry.coordinates);
  assert.equal(JSON.stringify(state), before);
});

test('instant map fit includes Gurugram and distant original demo coordinates', () => {
  const camera = fitCamera(
    [
      [77.02, 28.46],
      [77.59, 12.97],
    ],
    390,
    370,
  );
  assert.ok(
    Number.isFinite(camera.center.lat) && camera.center.lat > 12.97 && camera.center.lat < 28.46,
  );
  assert.ok(camera.zoom >= 2 && camera.zoom < 6);
  const polar = fitCamera([[0, 90]], 300, 350);
  assert.ok(Number.isFinite(polar.zoom) && Number.isFinite(polar.center.lat));
});

test('recording snapshots convert IST to UTC exactly', () => {
  assert.equal(snapshotTime(0), '2026-10-12T00:30:00.000Z');
  assert.equal(snapshotTime(3), '2026-10-12T09:30:00.000Z');
  assert.equal(snapshotTime(4), '2026-10-12T12:30:00.000Z');
  assert.equal(timeLabel(3), '15:00 IST');
  assert.equal(normalizeStep(NaN), 3);
  assert.equal(normalizeStep(-100), 0);
  assert.equal(normalizeStep(99), 4);
});
test('historical snapshots never expose future observations', () => {
  const counts = [2, 4, 6, 8, 9];
  counts.forEach((count, step) => {
    const records = visibleObservations(observations, step);
    assert.equal(records.length, count);
    assert.ok(records.every((o) => Date.parse(o.observedAt) <= Date.parse(snapshotTime(step))));
  });
});
test('resolution follows historical time rather than latest recorded status', () => {
  const flow = observations.find((o) => o.id === 'NX-2402')!;
  assert.equal(observationStatus(flow, 3), 'review required');
  assert.equal(observationStatus(flow, 4), 'resolved');
  assert.equal(metricsAt(0).active, 0);
  assert.equal(metricsAt(3).active, 6);
  assert.equal(metricsAt(4).active, 4);
});
test('module and text filters compose without creating records', () => {
  assert.deepEqual(
    visibleObservations(observations, 3, 'aqua', 'riverfront').map((o) => o.id),
    ['NX-2403'],
  );
  assert.equal(visibleObservations(observations, 0, 'aqua').length, 0);
  assert.equal(visibleObservations(observations, 3, 'command', 'no such district').length, 0);
});
test('shared selection clears when changing to an earlier snapshot', () => {
  useNexus.setState({ timeStep: 3, records: observations, selectedId: null });
  useNexus.getState().select('NX-2405');
  assert.equal(useNexus.getState().selectedId, 'NX-2405');
  assert.equal(useNexus.getState().camera, 'selected');
  useNexus.getState().setTime(0);
  assert.equal(useNexus.getState().selectedId, null);
  assert.equal(useNexus.getState().camera, 'overview');
  useNexus.getState().select('NX-2405');
  assert.equal(useNexus.getState().selectedId, null);
  useNexus.getState().setTime(3);
  useNexus.getState().select('NX-2407');
  useNexus.getState().setTime(0);
  assert.equal(useNexus.getState().selectedId, 'NX-2407');
});
test('schema rejects fabricated live labels, impossible positions and confidence', () => {
  const sample = {
    source: 'DEMO',
    generatedAt: snapshotTime(4),
    observations,
    readings: sensorReadings,
  };
  assert.ok(snapshotSchema.safeParse(sample).success);
  assert.equal(snapshotSchema.safeParse({ ...sample, source: 'LIVE' }).success, false);
  assert.equal(
    snapshotSchema.safeParse({ ...sample, observations: [{ ...observations[0], confidence: 120 }] })
      .success,
    false,
  );
  assert.equal(
    snapshotSchema.safeParse({
      ...sample,
      observations: [{ ...observations[0], location: [999, 999] }],
    }).success,
    false,
  );
  assert.ok(observations.every((o) => o.source === 'Simulated aerial observation'));
  assert.ok(observations.some((o) => o.unit === '°C'));
});
test('all ten modules have unique, valid workspaces', () => {
  assert.equal(modules.length, 10);
  assert.equal(new Set(modules.map((m) => m.id)).size, 10);
  assert.deepEqual(
    modules.map((m) => m.id),
    [...moduleIds],
  );
  assert.ok(modules.every((m) => isWorkspace(m.id)));
  assert.equal(isWorkspace('flight-control'), false);
});
test('conceptual geometry is finite, varied and geospatially valid', () => {
  assert.ok(buildings.length > 80);
  assert.equal(new Set(buildings.map((b) => b.id)).size, buildings.length);
  assert.ok(new Set(buildings.map((b) => b.style)).size >= 4);
  assert.ok(buildings.every((b) => [b.x, b.z, b.w, b.d, b.h].every(Number.isFinite)));
  assert.deepEqual(worldToLngLat(0, 0), [77.594, 12.974]);
});
