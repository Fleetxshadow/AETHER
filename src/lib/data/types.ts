import type { Observation } from '../data';
import type { ModuleId } from '../modules';
export type DataMode = 'DEMO' | 'LIVE' | 'OFFLINE' | 'STALE';
export type Feed =
  | 'observations'
  | 'telemetry'
  | 'devices'
  | 'cameraStatus'
  | 'aiDetections'
  | 'incidents'
  | 'responseReports';
export type Connection = 'connecting' | 'connected' | 'offline' | 'error';
export type Channel =
  'temperature' | 'speed' | 'rainfall' | 'water' | 'health' | 'altitude' | 'battery';
export interface LiveReading {
  deviceId: string;
  module: ModuleId;
  channel: Channel;
  value: number;
  unit: string;
  observedAt: string;
  source: 'LIVE';
}
export interface Device {
  id: string;
  name: string;
  module: ModuleId;
  status: 'online' | 'offline';
  lastSeen: string;
  source: 'LIVE';
}
export interface CameraHealth {
  cameraId: string;
  deviceId: string;
  online: boolean;
  lastSeen: string;
  streamType: 'vdo-ninja' | 'mediamtx';
  source: 'LIVE';
  resolution?: string;
  fps?: number;
}
export interface AIResult {
  id: string;
  siteId: string;
  deviceId: string;
  module: ModuleId;
  observedAt: string;
  source: 'LIVE';
  category: string;
  description: string;
  confidence: number;
  observationIds: string[];
}
export interface LiveIncident {
  id: string;
  siteId: string;
  reportedAt: string;
  source: 'LIVE';
  category: string;
  description: string;
  location: string;
  status: string;
  externalContactConfirmed: boolean;
}
export interface LiveFeeds {
  observations: Observation[];
  telemetry: LiveReading[];
  devices: Device[];
  cameraStatus: CameraHealth[];
  aiDetections: AIResult[];
  incidents: LiveIncident[];
  responseReports: LiveIncident[];
}
export interface IntegrationState {
  activeObservations: number;
  configured: boolean;
  mode: DataMode;
  message: string;
  invalid: number;
  test: boolean;
  connections: Partial<Record<Feed, Connection>>;
  lastKnown: LiveFeeds;
  fresh: LiveFeeds;
  role: 'viewer' | 'operator' | null;
}
export const emptyFeeds = (): LiveFeeds => ({
  observations: [],
  telemetry: [],
  devices: [],
  cameraStatus: [],
  aiDetections: [],
  incidents: [],
  responseReports: [],
});
export const initialIntegration = (): IntegrationState => ({
  activeObservations: 0,
  configured: false,
  mode: 'DEMO',
  message: 'DEMO DATA · no Firebase configuration',
  invalid: 0,
  test: false,
  connections: {},
  lastKnown: emptyFeeds(),
  fresh: emptyFeeds(),
  role: null,
});
export interface DataProvider {
  subscribe(
    emit: (event: { feed: Feed; connection: Connection; data?: unknown[] }) => void,
  ): () => void;
}
