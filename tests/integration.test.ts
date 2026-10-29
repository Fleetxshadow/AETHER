import test from 'node:test';
import assert from 'node:assert/strict';
import { NexusDataController } from '../src/lib/data/data-provider';
import { observations } from '../src/lib/data';
import { validateFeed } from '../src/lib/data/validators';
import { validateCameraInput, vdoConnectionEvent } from '../src/lib/cameras/registry';
import type { DataProvider, LiveReading } from '../src/lib/data/types';

const start = Date.parse('2026-10-18T06:30:00Z');
const reading = (overrides: Partial<LiveReading> = {}): LiveReading => ({
  deviceId: 'pi-1',
  module: 'thermal',
  channel: 'temperature',
  value: 31.5,
  unit: '°C',
  observedAt: new Date(start).toISOString(),
  source: 'LIVE',
  ...overrides,
});
function harness() {
  let now = start;
  let output = observations,
    history: LiveReading[] = [];
  const controller = new NexusDataController(
    (records, _state, samples) => {
      output = records;
      history = samples;
    },
    'main',
    60000,
    () => now,
  );
  controller.configure(false);
  return {
    controller,
    get records() {
      return output;
    },
    get history() {
      return history;
    },
    advance(ms: number) {
      now += ms;
      controller.refresh();
    },
  };
}
test('unconfigured and connected-empty providers retain complete labeled demo', () => {
  const h = harness();
  assert.equal(h.controller.state.mode, 'DEMO');
  assert.deepEqual(h.records, observations);
  h.controller.configure(true, 'viewer');
  h.controller.receive('telemetry', 'connected', []);
  assert.equal(h.controller.state.message, 'Connected — awaiting device data');
  assert.deepEqual(h.records, observations);
  assert.equal(h.history.length, 0);
});
test('actual updates create only received history and deduplicate identical timestamps', () => {
  const h = harness();
  h.controller.configure(true, 'viewer');
  h.controller.receive('telemetry', 'connected', [reading()]);
  assert.equal(h.controller.state.mode, 'LIVE');
  assert.equal(h.history.length, 1);
  h.controller.receive('telemetry', 'connected', [reading()]);
  assert.equal(h.history.length, 1);
  h.controller.receive('telemetry', 'connected', [
    reading({ value: 32, observedAt: new Date(start + 1000).toISOString() }),
  ]);
  assert.deepEqual(
    h.history.map((r) => r.value),
    [31.5, 32],
  );
});
test('lost connection falls back immediately and preserves inspectable last known value', () => {
  const h = harness();
  h.controller.configure(true, 'viewer');
  h.controller.receive('telemetry', 'connected', [reading()]);
  h.controller.receive('telemetry', 'error');
  assert.equal(h.controller.state.mode, 'OFFLINE');
  assert.equal(h.history.length, 0);
  assert.equal(h.controller.state.lastKnown.telemetry[0].value, 31.5);
  assert.deepEqual(h.records, observations);
});
test('stale readings and offline device reports cannot supply a current metric', () => {
  const h = harness();
  h.controller.configure(true, 'viewer');
  h.controller.receive('telemetry', 'connected', [reading()]);
  h.advance(60001);
  assert.equal(h.controller.state.mode, 'STALE');
  assert.equal(h.history.length, 0);
  assert.equal(h.controller.state.lastKnown.telemetry.length, 1);
  h.controller.receive('telemetry', 'connected', [
    reading({ observedAt: new Date(start + 60001).toISOString() }),
  ]);
  h.controller.receive('devices', 'connected', [
    {
      id: 'pi-1',
      name: 'Test Pi',
      module: 'thermal',
      status: 'offline',
      lastSeen: new Date(start + 60001).toISOString(),
      source: 'LIVE',
    },
  ]);
  assert.equal(h.controller.state.mode, 'OFFLINE');
  assert.equal(h.controller.state.fresh.telemetry.length, 0);
});
test('wrong units, non-finite values, future timestamps, extra fields and wrong sites are rejected', () => {
  const invalid = [
    reading({ unit: 'F' }),
    reading({ value: Infinity }),
    reading({ observedAt: new Date(start + 30001).toISOString() }),
    { ...reading(), secret: 'forbidden' },
  ];
  assert.equal(validateFeed('telemetry', invalid, start, 'main').invalid, 4);
  const obs = {
    ...observations[0],
    id: 'real-1',
    siteId: 'other-site',
    deviceId: 'pi-1',
    source: 'Device observation',
    dataSource: 'LIVE',
    observedAt: new Date(start).toISOString(),
  };
  assert.equal(validateFeed('observations', [obs], start, 'main').data.length, 0);
});
test('live module observations replace only that module; demo replay cannot hide current live records', () => {
  const h = harness();
  h.controller.configure(true, 'viewer');
  const live = {
    ...observations[0],
    id: 'real-1',
    siteId: 'main',
    deviceId: 'pi-1',
    source: 'Device observation',
    dataSource: 'LIVE',
    observedAt: new Date(start).toISOString(),
    resolvedAt: null,
  };
  h.controller.receive('observations', 'connected', [live]);
  assert.equal(h.records.filter((o) => o.module === 'thermal').length, 1);
  assert.ok(h.records.some((o) => o.module === 'aqua'));
  assert.ok(h.records.some((o) => o.id === 'real-1'));
  h.controller.receive('observations', 'offline');
  assert.deepEqual(h.records, observations);
});
test('cleanup rejects late callbacks and sign-out clears protected records and history', () => {
  const h = harness();
  h.controller.configure(true, 'operator');
  let listener: Parameters<DataProvider['subscribe']>[0] = () => {};
  let unsubscribed = false;
  const stop = h.controller.attach({
    subscribe(emit) {
      listener = emit;
      return () => {
        unsubscribed = true;
      };
    },
  });
  listener({ feed: 'telemetry', connection: 'connected', data: [reading()] });
  assert.equal(h.history.length, 1);
  stop();
  listener({ feed: 'telemetry', connection: 'connected', data: [reading()] });
  assert.ok(unsubscribed);
  assert.equal(h.controller.state.role, null);
  assert.equal(h.history.length, 0);
  assert.equal(h.controller.state.lastKnown.telemetry.length, 0);
});
test('camera health metadata alone never establishes live measurements', () => {
  const h = harness();
  h.controller.configure(true, 'viewer');
  h.controller.receive('cameraStatus', 'connected', [
    {
      cameraId: 'cam-1',
      deviceId: 'pi-1',
      online: true,
      lastSeen: new Date(start).toISOString(),
      streamType: 'mediamtx',
      source: 'LIVE',
    },
  ]);
  assert.equal(h.controller.state.mode, 'DEMO');
  assert.equal(h.controller.state.fresh.cameraStatus.length, 1);
});
test('only approved read-only camera destinations and parameter sets are accepted', () => {
  const base = {
    id: 'cam-1',
    deviceId: 'pi-1',
    name: 'Test camera',
    provider: 'vdo-ninja',
    url: 'https://vdo.ninja/?view=private-view',
  };
  assert.ok(validateCameraInput(base, []).url.includes('view=private-view'));
  for (const url of [
    'https://evil.test/?view=x',
    'https://vdo.ninja/?push=secret',
    'https://vdo.ninja/?view=x&password=secret',
    'https://vdo.ninja/?view=x&view=y',
    'javascript:alert(1)',
  ])
    assert.throws(() => validateCameraInput({ ...base, url }, []));
  const media = { ...base, provider: 'mediamtx', url: 'https://media.example.test/pi/whep' };
  assert.ok(validateCameraInput(media, ['https://media.example.test']));
  for (const url of [
    'https://other.test/pi/whep',
    'https://u:secret@media.example.test/pi/whep',
    'https://media.example.test/pi/whep?token=secret',
    'http://media.example.test/pi/whep',
  ])
    assert.throws(() => validateCameraInput({ ...media, url }, ['https://media.example.test']));
  assert.throws(() =>
    validateCameraInput({ ...media, url: 'http://127.0.0.1:8890/pi/whep' }, [
      'http://127.0.0.1:8890',
    ]),
  );
  assert.ok(
    validateCameraInput(
      { ...media, url: 'http://127.0.0.1:8890/pi/whep' },
      ['http://127.0.0.1:8890'],
      true,
    ),
  );
});
test('VDO connection messages must identify the expected stream and documented action', () => {
  assert.equal(
    vdoConnectionEvent({ action: 'view-connection', streamID: 'x', value: true }, 'x'),
    'connected',
  );
  assert.equal(
    vdoConnectionEvent({ action: 'view-connection', streamID: 'wrong', value: true }, 'x'),
    null,
  );
  assert.equal(
    vdoConnectionEvent({ action: 'push-connection', streamID: 'x', value: false }, 'x'),
    'disconnected',
  );
  assert.equal(vdoConnectionEvent({ connected: true }, 'x'), null);
});
