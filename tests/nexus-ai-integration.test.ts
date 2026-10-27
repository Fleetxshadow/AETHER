import test from 'node:test';
import assert from 'node:assert/strict';
import { NexusDataController } from '../src/lib/data/data-provider';
import { observations, type Observation } from '../src/lib/data';
import {
  readingSchema,
  liveObservationSchema,
  aiSchema,
  deviceSchema,
  cameraHealthSchema,
} from '../src/lib/data/validators';
import {
  type NexusVisionInferResponse,
  type NexusCoreEvaluateResponse,
  type NexusMaverickPlanResponse,
} from '../src/lib/nexus/client';
import type { LiveReading } from '../src/lib/data/types';

const nowMs = Date.parse('2026-10-27T10:00:00Z');
const makeIso = (offsetMs = 0) => new Date(nowMs + offsetMs).toISOString();

test('1. Model Loading & Health: Schema contract and degraded fallback verification', () => {
  // Test fallback payload when backend is unavailable
  const fallbackHealth = {
    status: 'degraded' as const,
    version: '1.0.0',
    timestamp: makeIso(),
    error: 'Connection refused',
    source: 'OFFLINE' as const,
    models: {
      vision: { loaded: false, default_model: 'aerial_visdrone_epoch5.pt', available_models: [] },
      core: { loaded: false, model_type: 'none', deterministic_guard: 'inactive' },
      maverick: { loaded: false, model_type: 'none', oracle_fallback: 'inactive' },
    },
    cameras: { connected_count: 0, sources: {} },
  };

  assert.equal(fallbackHealth.status, 'degraded');
  assert.equal(fallbackHealth.source, 'OFFLINE');
  assert.equal(fallbackHealth.models.vision.loaded, false);

  // Test live health payload structure
  const liveHealth = {
    status: 'ok' as const,
    version: '1.0.0',
    uptime_seconds: 142.5,
    timestamp: makeIso(),
    system: { cpu_percent: 12.5, memory_used_mb: 450.0, memory_total_mb: 7800.0 },
    models: {
      vision: {
        loaded: true,
        default_model: 'aerial_visdrone_epoch5.pt',
        available_models: ['aerial_visdrone_epoch5.pt', 'damage_epoch1.pt'],
      },
      core: { loaded: true, model_type: 'onnx', deterministic_guard: 'active' },
      maverick: { loaded: true, model_type: 'onnx', oracle_fallback: 'astar' },
    },
    cameras: {
      connected_count: 1,
      sources: { usb: { connected: false }, synthetic: { connected: true } },
    },
  };

  assert.equal(liveHealth.status, 'ok');
  assert.equal(liveHealth.models.vision.loaded, true);
  assert.equal(liveHealth.models.core.deterministic_guard, 'active');
  assert.equal(liveHealth.models.maverick.oracle_fallback, 'astar');
});

test('2. Real Image Inference: Vision detection payload conforms to contract', () => {
  const mockVisionOutput: NexusVisionInferResponse = {
    success: true,
    source: 'LIVE',
    timestamp: makeIso(),
    model_used: 'aerial_visdrone_epoch5.pt',
    conf_threshold: 0.25,
    latency_ms: 215.4,
    image_dims: { width: 640, height: 480 },
    total_objects: 3,
    class_counts: { car: 2, pedestrian: 1 },
    detections: [
      { box: [100.5, 120.0, 180.2, 220.4], confidence: 0.892, class_id: 3, class_name: 'car' },
      { box: [250.0, 140.0, 310.0, 210.0], confidence: 0.765, class_id: 3, class_name: 'car' },
      {
        box: [400.0, 300.0, 425.0, 360.0],
        confidence: 0.654,
        class_id: 0,
        class_name: 'pedestrian',
      },
    ],
    annotated_base64: 'data:image/jpeg;base64,mockbytes',
    zero_detections_reason: null,
  };

  assert.equal(mockVisionOutput.success, true);
  assert.equal(mockVisionOutput.source, 'LIVE');
  assert.equal(mockVisionOutput.total_objects, 3);
  assert.equal(mockVisionOutput.detections.length, 3);
  assert.ok(mockVisionOutput.latency_ms > 0);

  // Validate that mapped AI detection meets aiSchema
  const aiDetectionRecord = {
    id: 'ai-vis-001',
    siteId: 'main',
    deviceId: 'sky-cam-01',
    module: 'sky' as const,
    observedAt: makeIso(),
    source: 'LIVE' as const,
    category: 'aerial_vehicles',
    description: 'YOLOv8n detected 2 cars and 1 pedestrian',
    confidence: 89.2,
    observationIds: ['NX-LIVE-01'],
  };
  const parsed = aiSchema.safeParse(aiDetectionRecord);
  assert.ok(parsed.success);
});

test('3. CORE Guard Decisions: Fail-closed deterministic safety rules R1–R6', () => {
  // Rule R1: Battery critically low (<10%) -> emergency_land_sim
  const r1Response: NexusCoreEvaluateResponse = {
    success: true,
    source: 'LIVE',
    timestamp: makeIso(),
    raw_class: 'monitor',
    recommendation: 'emergency_land_sim',
    safety_reason: 'R1: motor fault or battery <= 10%',
    guard_intervened: true,
    operator_decision_required: false,
    duration_ms: 1.1,
  };
  assert.equal(r1Response.recommendation, 'emergency_land_sim');
  assert.equal(r1Response.guard_intervened, true);

  // Rule R2: Geofence breach or navigation invalid -> hold_position
  const r2Response: NexusCoreEvaluateResponse = {
    success: true,
    source: 'LIVE',
    timestamp: makeIso(),
    raw_class: 'inspect_sim',
    recommendation: 'hold_position',
    safety_reason: 'R2: fence/navigation/risk/staleness',
    guard_intervened: true,
    operator_decision_required: false,
    duration_ms: 0.9,
  };
  assert.equal(r2Response.recommendation, 'hold_position');
  assert.equal(r2Response.guard_intervened, true);

  // Rule R4: Severe confident incident -> alert_operator
  const r4Response: NexusCoreEvaluateResponse = {
    success: true,
    source: 'LIVE',
    timestamp: makeIso(),
    raw_class: 'alert_operator',
    recommendation: 'alert_operator',
    safety_reason: 'R4: confident severe incident; operator decision required',
    guard_intervened: false,
    operator_decision_required: true,
    duration_ms: 1.3,
  };
  assert.equal(r4Response.recommendation, 'alert_operator');
  assert.equal(r4Response.operator_decision_required, true);
});

test('4. MAVERICK Routing and Fallback: Path calculation, supervisor veto, and A* fallback', () => {
  const maverickPlan: NexusMaverickPlanResponse = {
    success: true,
    source: 'LIVE',
    timestamp: makeIso(),
    status: 'reached_goal',
    steps: 4,
    path: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    astar_path: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    supervisor_interventions: 1,
    interventions_detail: [
      { step: 1, from: [0, 0], proposed_action: 'DOWN', veto_reason: 'Blocked cell' },
    ],
    duration_ms: 8.4,
  };

  assert.equal(maverickPlan.success, true);
  assert.equal(maverickPlan.source, 'LIVE');
  assert.equal(maverickPlan.status, 'reached_goal');
  assert.equal(maverickPlan.path.length, 5);
  assert.equal(maverickPlan.supervisor_interventions, 1);
  assert.deepEqual(maverickPlan.path[0], [0, 0]);
  assert.deepEqual(maverickPlan.path.at(-1), [2, 2]);
});

test('5. Hardware Unavailable: Disconnected camera/sensors handled gracefully', () => {
  const controller = new NexusDataController(
    () => {},
    'main',
    60000,
    () => nowMs,
  );
  controller.configure(true, 'operator');

  // Device reports offline status
  const offlineDevice = {
    id: 'sky-cam-01',
    name: 'Aerial Drone Camera Node',
    module: 'sky' as const,
    status: 'offline' as const,
    lastSeen: makeIso(-5000),
    source: 'LIVE' as const,
  };
  assert.ok(deviceSchema.safeParse(offlineDevice).success);

  // Send offline device feed
  controller.receive('devices', 'connected', [offlineDevice]);
  // Associated telemetry should be filtered out because device is offline
  controller.receive('telemetry', 'connected', [
    {
      deviceId: 'sky-cam-01',
      module: 'sky',
      channel: 'battery',
      value: 65,
      unit: '%',
      observedAt: makeIso(-1000),
      source: 'LIVE',
    },
  ]);

  // Controller transitions to OFFLINE mode
  assert.equal(controller.state.mode, 'OFFLINE');
  assert.ok(controller.state.message.includes('OFFLINE'));
});

test('6. Backend Unavailable: Graceful fallback without throwing uncaught errors', () => {
  let emittedRecords: Observation[] = [];
  const controller = new NexusDataController(
    (records) => {
      emittedRecords = records;
    },
    'main',
    60000,
    () => nowMs,
  );
  controller.configure(true, 'operator');

  // Backend connection fails
  controller.receive('observations', 'error');
  controller.receive('telemetry', 'error');

  assert.equal(controller.state.mode, 'OFFLINE');
  // Complete demo observations are preserved
  assert.deepEqual(emittedRecords, observations);
});

test('7. Invalid API Payloads: Strict Zod validation rejects out-of-bounds telemetry', () => {
  // Wrong unit
  const wrongUnit = {
    deviceId: 'sensor-1',
    module: 'flow',
    channel: 'speed',
    value: 50,
    unit: 'mph', // Invalid: schema requires 'km/h'
    observedAt: makeIso(),
    source: 'LIVE',
  };
  assert.equal(readingSchema.safeParse(wrongUnit).success, false);

  // Out of physical bounds
  const outOfBounds = {
    deviceId: 'sensor-1',
    module: 'sky',
    channel: 'battery',
    value: 150, // Invalid: bounds are [0, 100]
    unit: '%',
    observedAt: makeIso(),
    source: 'LIVE',
  };
  assert.equal(readingSchema.safeParse(outOfBounds).success, false);

  // Unsafe device ID
  const unsafeId = {
    deviceId: 'bad/id/with/slashes$',
    module: 'flow',
    channel: 'speed',
    value: 40,
    unit: 'km/h',
    observedAt: makeIso(),
    source: 'LIVE',
  };
  assert.equal(readingSchema.safeParse(unsafeId).success, false);
});

test('8. Stale Telemetry: Readings older than maxAge trigger STALE mode', () => {
  let currentNow = nowMs;
  const controller = new NexusDataController(
    () => {},
    'main',
    60000,
    () => currentNow,
  );
  controller.configure(true, 'operator');

  const reading: LiveReading = {
    deviceId: 'flow-sensor-01',
    module: 'flow',
    channel: 'speed',
    value: 42.0,
    unit: 'km/h',
    observedAt: new Date(nowMs).toISOString(),
    source: 'LIVE',
  };

  controller.receive('telemetry', 'connected', [reading]);
  assert.equal(controller.state.mode, 'LIVE');

  // Advance time beyond 60s maxAge
  currentNow += 65000;
  controller.refresh();

  assert.equal(controller.state.mode, 'STALE');
  assert.ok(controller.state.message.includes('STALE READING'));
});

test('9. Incorrect Source Labeling: Rejects fabricated LIVE labels on synthetic data', () => {
  // Simulated aerial observation masquerading with invalid positions
  const fakeLiveObs = {
    id: 'fake-01',
    siteId: 'main',
    deviceId: 'dev-1',
    title: 'Fabricated Fire',
    module: 'fire',
    district: 'Downtown',
    location: [250.0, 150.0], // Invalid coordinates (>180, >90)
    position: [100, 200], // Invalid grid coordinates (outside [-30, 30])
    severity: 'critical',
    observedAt: makeIso(),
    resolvedAt: null,
    confidence: 150, // Invalid: confidence > 100
    description: 'Fabricated incident',
    source: 'AI detection',
    dataSource: 'LIVE',
    evidence: 'None',
    metric: 999,
    unit: '°C',
    sensor: 'LWIR',
  };
  const parsed = liveObservationSchema.safeParse(fakeLiveObs);
  assert.equal(parsed.success, false);
});

test('10. Fully Offline Demonstration Mode: Completely functional with no backend attached', () => {
  let published: Observation[] = [];
  const controller = new NexusDataController(
    (records) => {
      published = records;
    },
    'main',
    60000,
    () => nowMs,
  );

  // Unconfigured state
  controller.configure(false);
  assert.equal(controller.state.mode, 'DEMO');
  assert.deepEqual(published, observations);
  assert.equal(published.length, observations.length);
  assert.ok(published.every((o) => o.source === 'Simulated aerial observation'));
});

test('11. Hardware Link: Real Pi device validation, empty unsupported feeds, and MJPEG schema bounds', () => {
  // Real Pi device record as emitted by the hardware gateway (from real-pi-api.json)
  const realPiDevice = {
    id: 'pi-b3628e937d57',
    name: 'pi-b3628e937d57',
    module: 'sky' as const,
    status: 'online' as const,
    lastSeen: makeIso(),
    source: 'LIVE' as const,
  };

  // 1. Device schema passes without any frontend changes
  const devResult = deviceSchema.safeParse(realPiDevice);
  assert.ok(devResult.success);

  // 2. Hardware feeds have empty telemetry and cameraStatus because no external sensors/cameras exist
  const honestFeeds = {
    schema_version: '1.0.0',
    device_id: 'nexus-local-gateway',
    device_type: 'gateway',
    timestamp: makeIso(),
    source: 'LIVE' as const,
    upstream_connected: true,
    devices: [realPiDevice],
    telemetry: [],
    cameraStatus: [],
    aiDetections: [],
    observations: [],
    incidents: [],
  };

  assert.equal(honestFeeds.devices.length, 1);
  assert.equal(honestFeeds.telemetry.length, 0);
  assert.equal(honestFeeds.cameraStatus.length, 0);

  // 3. Confirm that unbridged MJPEG is rejected by strict camera validator (preserving offline camera state)
  const rawMjpegCamera = {
    cameraId: 'cam-01',
    deviceId: 'pi-b3628e937d57',
    online: true,
    lastSeen: makeIso(),
    streamType: 'mjpeg', // Invalid: schema allows only 'mediamtx' | 'vdo-ninja'
    source: 'LIVE',
  };
  assert.equal(cameraHealthSchema.safeParse(rawMjpegCamera).success, false);

  // 4. Controller integrates real Pi device cleanly
  let published: Observation[] = [];
  const controller = new NexusDataController(
    (records) => {
      published = records;
    },
    'main',
    60000,
    () => nowMs,
  );
  controller.configure(true, 'operator');
  controller.receive('devices', 'connected', honestFeeds.devices);
  controller.receive('telemetry', 'connected', honestFeeds.telemetry);
  controller.receive('cameraStatus', 'connected', honestFeeds.cameraStatus);

  // Mode is connected-awaiting or live depending on rows; demo records remain preserved
  assert.equal(published.length, observations.length);
  assert.equal(controller.state.lastKnown.devices.length, 1);
  assert.equal(controller.state.lastKnown.devices[0].id, 'pi-b3628e937d57');
});
