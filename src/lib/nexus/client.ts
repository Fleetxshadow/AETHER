/**
 * NEXUS AI Client & Adapter
 * Connects AETHER Next.js server/client to local Python FastAPI NEXUS engine.
 */

export const DEFAULT_NEXUS_URL = 'http://127.0.0.1:8000';

export function getNexusBackendUrl(): string {
  return process.env.NEXUS_BACKEND_URL || DEFAULT_NEXUS_URL;
}

export interface NexusHealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  system: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
  };
  models: {
    vision: {
      loaded: boolean;
      default_model: string;
      available_models: string[];
    };
    core: {
      loaded: boolean;
      model_type: string;
      deterministic_guard: string;
    };
    maverick: {
      loaded: boolean;
      model_type: string;
      oracle_fallback: string;
    };
  };
  cameras: {
    connected_count: number;
    sources: Record<string, { connected: boolean; [key: string]: unknown }>;
  };
}

export interface NexusDetection {
  box: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

export interface NexusVisionInferResponse {
  success: boolean;
  source: 'LIVE';
  timestamp: string;
  model_used: string;
  conf_threshold: number;
  latency_ms: number;
  image_dims: { width: number; height: number };
  total_objects: number;
  class_counts: Record<string, number>;
  detections: NexusDetection[];
  annotated_base64: string | null;
  zero_detections_reason?: string | null;
}

export interface NexusCoreEvaluateResponse {
  success: boolean;
  source: 'LIVE';
  timestamp: string;
  raw_class: string;
  recommendation: string;
  safety_reason: string;
  guard_intervened: boolean;
  operator_decision_required: boolean;
  duration_ms: number;
}

export interface NexusMaverickPlanResponse {
  success: boolean;
  source: 'LIVE';
  timestamp: string;
  status: string;
  steps: number;
  path: [number, number][];
  astar_path: [number, number][];
  supervisor_interventions: number;
  interventions_detail: unknown[];
  duration_ms: number;
}

export interface NexusFeedsResponse {
  source: 'LIVE';
  timestamp: string;
  devices: unknown[];
  telemetry: unknown[];
  cameraStatus: unknown[];
  aiDetections: unknown[];
  observations: unknown[];
  incidents: unknown[];
}

export async function fetchNexusHealth(signal?: AbortSignal): Promise<NexusHealthResponse> {
  const url = `${getNexusBackendUrl()}/api/nexus/health`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: signal || AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    throw new Error(`NEXUS health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchNexusFeeds(signal?: AbortSignal): Promise<NexusFeedsResponse> {
  const url = `${getNexusBackendUrl()}/api/nexus/feeds`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: signal || AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    throw new Error(`NEXUS feeds fetch failed with status ${res.status}`);
  }
  return res.json();
}

export async function inferNexusVision(
  payload: {
    image_base64?: string;
    sample_id?: string;
    model_name?: string;
    conf_threshold?: number;
    annotate?: boolean;
  },
  signal?: AbortSignal,
): Promise<NexusVisionInferResponse> {
  const url = `${getNexusBackendUrl()}/api/nexus/vision/infer`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: signal || AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.error || `Vision inference failed with status ${res.status}`,
    );
  }
  return res.json();
}

export async function evaluateNexusCore(
  observation: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<NexusCoreEvaluateResponse> {
  const url = `${getNexusBackendUrl()}/api/nexus/core/evaluate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ observation }),
    signal: signal || AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.error || `CORE evaluation failed with status ${res.status}`,
    );
  }
  return res.json();
}

export async function planNexusMaverick(
  terrain: number[][],
  start: [number, number],
  goal: [number, number],
  signal?: AbortSignal,
): Promise<NexusMaverickPlanResponse> {
  const url = `${getNexusBackendUrl()}/api/nexus/maverick/plan`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ terrain, start, goal }),
    signal: signal || AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.error || `MAVERICK planning failed with status ${res.status}`,
    );
  }
  return res.json();
}
