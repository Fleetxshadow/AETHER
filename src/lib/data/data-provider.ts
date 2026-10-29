import { observations, type Observation } from '../data';
import {
  emptyFeeds,
  initialIntegration,
  type Feed,
  type Connection,
  type IntegrationState,
  type DataProvider,
  type LiveReading,
} from './types';
import { eventTime, validateFeed } from './validators';

// One owner for freshness, validation, demo replacement and subscription lifetime.
export class NexusDataController {
  state = initialIntegration();
  private demo: Observation[] = observations;
  private history: LiveReading[] = [];
  private lastPublish = '';
  constructor(
    private publish: (
      records: Observation[],
      state: IntegrationState,
      history: LiveReading[],
    ) => void,
    readonly siteId = 'main',
    readonly maxAge = 60000,
    private now = () => Date.now(),
  ) {}
  setDemo(records: Observation[]) {
    this.demo = records;
    this.refresh();
  }
  configure(configured: boolean, role: IntegrationState['role'] = null, test = false) {
    this.state = { ...initialIntegration(), configured, role, test };
    this.history = [];
    this.refresh();
  }
  receive(feed: Feed, connection: Connection, rows?: unknown[]) {
    this.state = { ...this.state, connections: { ...this.state.connections, [feed]: connection } };
    if (rows) {
      const { data, invalid } = validateFeed(feed, rows, this.now(), this.siteId);
      this.state.lastKnown = { ...this.state.lastKnown, [feed]: data };
      this.state.invalid += invalid;
      if (feed === 'telemetry') {
        const merged = [...this.history, ...(data as LiveReading[])];
        this.history = [
          ...new Map(merged.map((v) => [`${v.deviceId}:${v.channel}:${v.observedAt}`, v])).values(),
        ]
          .sort((a, b) => eventTime(a) - eventTime(b))
          .slice(-500);
      }
    }
    this.refresh();
  }
  refresh() {
    const fresh = emptyFeeds();
    const now = this.now();
    for (const feed of Object.keys(fresh) as Feed[]) {
      if (this.state.connections[feed] === 'connected') {
        const rows = this.state.lastKnown[feed].filter((v) => now - eventTime(v) <= this.maxAge);
        Object.assign(fresh, { [feed]: rows });
      }
    }
    const offlineDevices = new Set(
      fresh.devices.filter((d) => d.status === 'offline').map((d) => d.id),
    );
    fresh.telemetry = fresh.telemetry.filter((r) => !offlineDevices.has(r.deviceId));
    const measured =
      fresh.telemetry.length +
      fresh.observations.length +
      fresh.aiDetections.length +
      fresh.incidents.length +
      fresh.responseReports.length;
    const retained = Object.values(this.state.lastKnown).flat();
    const stale = retained.some((v) => now - eventTime(v) > this.maxAge);
    const failed =
      offlineDevices.size > 0 ||
      Object.values(this.state.connections).some((v) => v === 'error' || v === 'offline');
    const connected = Object.values(this.state.connections).some((v) => v === 'connected');
    const mode = measured ? 'LIVE' : failed ? 'OFFLINE' : stale ? 'STALE' : 'DEMO';
    const message = measured
      ? 'LIVE DATA · other panels retain labeled demo samples'
      : failed
        ? 'DEVICE OFFLINE · demonstration fallback'
        : stale
          ? 'STALE READING · demonstration fallback'
          : connected
            ? 'Connected — awaiting device data'
            : this.state.configured
              ? this.state.role
                ? 'Connecting · demonstration fallback'
                : 'DEMO DATA · sign in for protected device data'
              : 'DEMO DATA · no Firebase configuration';
    this.state = {
      ...this.state,
      mode,
      message,
      fresh,
      activeObservations: fresh.observations.filter(
        (r) => r.severity !== 'normal' && (!r.resolvedAt || Date.parse(r.resolvedAt) > now),
      ).length,
    };
    const modules = new Set(fresh.observations.map((o) => o.module));
    const ids = new Set(fresh.observations.map((o) => o.id));
    const records = [
      ...this.demo.filter((o) => !modules.has(o.module) && !ids.has(o.id)),
      ...fresh.observations,
    ];
    const usableHistory =
      this.state.connections.telemetry === 'connected'
        ? this.history.filter((v) =>
            fresh.telemetry.some((r) => r.deviceId === v.deviceId && r.channel === v.channel),
          )
        : [];
    const digest = JSON.stringify([records, this.state, usableHistory]);
    if (digest !== this.lastPublish) {
      this.lastPublish = digest;
      this.publish(records, this.state, usableHistory);
    }
  }
  attach(provider: DataProvider) {
    let active = true;
    const unsubscribe = provider.subscribe((e) => {
      if (active) this.receive(e.feed, e.connection, e.data);
    });
    const timer = setInterval(() => this.refresh(), Math.min(5000, this.maxAge));
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
      this.configure(false);
    };
  }
}
