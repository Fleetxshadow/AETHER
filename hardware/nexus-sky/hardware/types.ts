/** Server-side hardware contract v1; city telemetry is a separate schema. */
export type Provenance = 'LIVE' | 'DEMO' | 'STALE' | 'OFFLINE';
export interface Envelope {
  schema_version: '1.0.0';
  device_id: string;
  device_type: 'raspberry-pi' | 'gateway';
  timestamp: string;
  source: Provenance;
}
export interface Measurement {
  device_id: string;
  component: 'cpu' | 'system';
  channel: 'cpu_percent' | 'ram_percent' | 'cpu_temperature' | 'storage_available';
  value: number | null;
  unit: '%' | '°C' | 'bytes';
  observed_at: string | null;
  source: 'LIVE' | 'OFFLINE';
  error: string | null;
  calibration: { kind: 'kernel-reported'; offset: null };
}
export interface CameraStatus {
  id: string;
  device_type: 'esp32' | 'csi' | 'v4l2';
  online: boolean;
  source: 'LIVE' | 'STALE' | 'OFFLINE';
  last_seen: string | null;
  frame_age_seconds: number | null;
  frames_received: number;
  error_count: number;
  capture_ms: number | null;
  target_fps: number;
  received_fps: number | null;
  error: string | null;
  transport: 'mjpeg';
  calibration: { kind: 'none'; note: string };
}
export interface Telemetry extends Envelope { measurements: Measurement[] }
export interface Cameras extends Envelope { cameras: CameraStatus[]; discovered?: unknown[] }
export interface DeviceError {
  error: string;
  code: 'UNAUTHORIZED' | 'READ_ONLY' | 'INVALID_CAMERA_ID' | 'UNKNOWN_CAMERA' |
        'NO_FRESH_FRAME' | 'VIEWER_LIMIT' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  details: Record<string, never>;
  timestamp: string;
  source: 'OFFLINE';
}
