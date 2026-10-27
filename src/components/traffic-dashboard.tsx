'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Radio,
  RefreshCw,
  Route,
  Layers,
  BrainCircuit,
  ScanLine,
} from 'lucide-react';
import { onSnapshot, collection, query as firestoreQuery, where, limit } from 'firebase/firestore';
import { AppShell } from './app-shell';
import { useReducedMotion } from '@/lib/motion';
import { getFirebaseClient } from '@/lib/firebase/client';
import { requestTraffic } from '@/lib/traffic/client';
import {
  type TrafficState,
  type TrafficIncident,
  type TrafficCommand,
  type RoadSegment,
  levels,
} from '@/lib/traffic/contract';
import { analytics } from '@/lib/traffic/engine';
import {
  mobileTrafficIncidentSchema,
  selectPublicTraffic,
  type MobileTrafficIncident,
} from '@/lib/traffic/mobile-contract';

const TrafficMap = dynamic(() => import('./traffic-map'), {
  ssr: false,
  loading: () => <div className="traffic-map-loading">Preparing geographic workspace…</div>,
});
type View = Omit<TrafficState, 'windows' | 'seenIds'>;
type Action = TrafficCommand extends infer C
  ? C extends TrafficCommand
    ? Omit<C, 'expectedRevision'>
    : never
  : never;
const colors = {
  NORMAL: '#64c99a',
  LIGHT: '#edce64',
  MODERATE: '#f5a65b',
  HEAVY: '#f77767',
  SEVERE: '#bd3858',
  UNKNOWN: '#8e9995',
};
const readable = (s: string) => s.replaceAll('_', ' ').toLowerCase();
const time = (s: string) =>
  new Date(s).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
const stamp = (s: string) =>
  new Date(s).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
const kmh = (n: number | null) => (n === null ? 'Unknown' : `${n} km/h`);
export function TrafficDashboard() {
  const [source, setSource] = useState<'DEMO' | 'LIVE'>('DEMO'),
    [state, setState] = useState<View | null>(null),
    [role, setRole] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connection, setConnection] = useState('Connecting'),
    [selected, setSelected] = useState('');
  const [search, setSearch] = useState(''),
    [locality, setLocality] = useState('all'),
    [severity, setSeverity] = useState('all'),
    [heat, setHeat] = useState(false),
    [overlay, setOverlay] = useState(true),
    [playback, setPlayback] = useState<number | null>(null),
    [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const writes = useRef(0);
  const accept = useCallback((data: { state: View | null; role?: string }) => {
    setState((previous) =>
      data.state &&
      previous?.source === data.state.source &&
      previous.revision > data.state.revision
        ? previous
        : data.state,
    );
    setRole(data.role || '');
    setConnection(data.state ? 'Synced with backend' : 'No simulation started');
  }, []);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const version = writes.current;
      try {
        const data = await requestTraffic(source, undefined, signal);
        if (!signal?.aborted && version === writes.current) {
          accept(data);
          setError('');
        }
      } catch (e) {
        if (!signal?.aborted && version === writes.current) {
          setConnection('Offline / unavailable · previous snapshot retained');
          setError(e instanceof Error ? e.message : 'Traffic unavailable.');
        }
      }
    },
    [source, accept],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void reload(controller.signal), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void reload(controller.signal);
    }, 15000);
    const offline = () => setConnection('Offline · previous snapshot retained');
    window.addEventListener('offline', offline);
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('offline', offline);
    };
  }, [reload]);
  const current = state?.source === source ? state : null;
  const execute = async (action: Action) => {
    if (busy || !navigator.onLine) return;
    writes.current++;
    setBusy(true);
    setError('');
    try {
      accept(
        await requestTraffic(source, {
          ...action,
          ...(action.action === 'start-demo' ? {} : { expectedRevision: current?.revision ?? 0 }),
        }),
      );
      setPlayback(null);
      setPlaying(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No action committed.');
    } finally {
      setBusy(false);
    }
  };
  const choose = useCallback((id: string) => {
    setSelected(id);
    setPlayback(null);
    setPlaying(false);
  }, []);
  const metrics = current ? analytics({ ...current, windows: {}, seenIds: {} }) : null;
  const road = current?.segments.find((r) => r.id === selected) || current?.segments[0];
  const incident = current?.incidents
    .filter((i) => i.segmentIds.includes(road?.id || ''))
    .sort(
      (a, b) =>
        Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  const events = current?.events.filter((e) => e.incidentId === incident?.id) || [];
  const playbackEvent = playback === null ? null : events[playback];
  useEffect(() => {
    if (!playing || !events.length) return;
    const timer = setTimeout(
      () => {
        if ((playback ?? 0) >= events.length - 1) setPlaying(false);
        else setPlayback((playback ?? -1) + 1);
      },
      reduced ? 1800 : 1100,
    );
    return () => clearTimeout(timer);
  }, [playing, playback, events.length, reduced]);
  // Historical estimates are selected from stored samples; absent history stays UNKNOWN.
  const roads =
    current?.segments
      .filter(
        (r) =>
          (!search ||
            `${r.roadName} ${r.direction}`.toLowerCase().includes(search.toLowerCase())) &&
          (locality === 'all' || r.locality === locality) &&
          (severity === 'all' || r.estimate.level === severity),
      )
      .map((r) => {
        if (!playbackEvent) return r;
        const h = r.history.filter((h) => h.at <= playbackEvent.at).at(-1);
        return {
          ...r,
          estimate: {
            ...r.estimate,
            level: h?.level ?? 'UNKNOWN',
            observedSpeedKmh: h?.speedKmh ?? null,
          },
        } as RoadSegment;
      }) || [];
  const visibleIncidents = !playbackEvent
    ? current?.incidents || []
    : (current?.incidents || []).flatMap((i) => {
        const snapshot = current?.events
          .filter((e) => e.incidentId === i.id && e.at <= playbackEvent.at && e.snapshot)
          .at(-1)?.snapshot;
        return snapshot ? [{ ...i, ...snapshot }] : [];
      });
  return (
    <AppShell active="traffic" title="TRAFFIC">
      <div className="traffic-app">
        <main id="main">
          <motion.div
            className="traffic-intro"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div>
              <p className="traffic-kicker">CITY INTELLIGENCE / GURUGRAM, INDIA</p>
              <h1>
                Read the movement.
                <br />
                <span>Understand the cause.</span>
              </h1>
              <p>FLOW detects. CORE investigates. People verify.</p>
            </div>
            <div className="traffic-source">
              <label>
                DATA ENVIRONMENT
                <select
                  aria-label="Traffic data environment"
                  value={source}
                  disabled={busy}
                  onChange={(e) => {
                    setSource(e.target.value as 'DEMO' | 'LIVE');
                    setPlayback(null);
                    setPlaying(false);
                  }}
                >
                  <option value="DEMO">Private demonstration</option>
                  <option value="LIVE">Authorized live workspace</option>
                </select>
              </label>
              <span className="traffic-status">
                <i />
                {connection}
              </span>
              <small>
                {current
                  ? `${source === 'DEMO' ? 'Simulation' : 'Backend'} clock · ${stamp(current.clock)} IST`
                  : 'Live coverage requires authorized providers.'}
              </small>
              <button disabled={busy} onClick={() => void reload()}>
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </motion.div>
          <div className="traffic-disclosure">
            <Radio size={17} />
            <p>
              {source === 'DEMO'
                ? 'SIMULATED TRAFFIC · Synthetic observations, baselines, evidence and routes. Approximate Gurugram corridor sketches; not surveyed or routable. Demo time advances explicitly.'
                : 'LIVE WORKSPACE · Only authorized observations. Roads without fresh, adequate data remain UNKNOWN. No provider is implied by this interface.'}
            </p>
          </div>
          {error && (
            <p className="traffic-error" role="alert">
              {error}
            </p>
          )}
          {!current ? (
            <section className="traffic-empty">
              <Activity size={34} />
              <h2>
                {source === 'DEMO'
                  ? 'A complete investigation, in your hands.'
                  : 'Connect authorized intelligence.'}
              </h2>
              <p>
                {source === 'DEMO'
                  ? 'Start an isolated operator simulation. Follow low-speed observations through investigation, human review and a public-safe route update.'
                  : 'Sign in under Command settings. A server-verified traffic role, dedicated Firebase project and explicit backend opt-in are required.'}
              </p>
              {source === 'DEMO' ? (
                <button
                  className="traffic-primary"
                  disabled={busy}
                  onClick={() => void execute({ action: 'start-demo' })}
                >
                  {busy ? 'Preparing…' : 'Start private demo'}
                  <ArrowUpRight size={18} />
                </button>
              ) : (
                <Link className="traffic-primary" href="/command/settings">
                  Open access settings
                </Link>
              )}
            </section>
          ) : (
            <>
              <div className="traffic-workflow" aria-label="Workflow">
                <span>
                  <Activity size={16} />
                  01 FLOW <small>Detect congestion</small>
                </span>
                <span>
                  <BrainCircuit size={16} />
                  02 CORE <small>Investigate uncertainty</small>
                </span>
                <span>
                  <ScanLine size={16} />
                  03 SKY <small>Human-reviewed evidence</small>
                </span>
                <span>
                  <ShieldCheck size={16} />
                  04 MAP <small>Approved public update</small>
                </span>
              </div>
              <section className="traffic-kpis" aria-label="Traffic key metrics">
                {[
                  ['Active congestion', metrics!.active],
                  ['Severe incidents', metrics!.severe],
                  ['Reviews pending', metrics!.pending],
                  ['Verified active causes', metrics!.verified],
                  ['Open inspection plans', metrics!.recommendations],
                  ['Improving segments', metrics!.improving],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>
                      {source === 'DEMO' ? 'SIMULATED' : 'AUTHORIZED'} · current records
                    </small>
                  </div>
                ))}
              </section>
              {source === 'DEMO' && (
                <section className="traffic-scenario" aria-label="Demo observation controls">
                  <div>
                    <b>FLOW / Observation laboratory</b>
                    <p>
                      Six independent synthetic contributors. Persistence and recovery run in
                      30-second virtual steps.
                    </p>
                  </div>
                  <div>
                    {[
                      ['normal', 'Normal readings'],
                      ['slow', 'Generate sustained slowdown'],
                      ['recovery', 'Generate sustained recovery'],
                      ['advance', 'Advance without readings'],
                    ].map(([phase, label]) => (
                      <button
                        disabled={busy || playback !== null}
                        key={phase}
                        onClick={() =>
                          void execute({
                            action: 'demo-observations',
                            phase: phase as 'normal' | 'slow' | 'recovery' | 'advance',
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="traffic-map-section" aria-label="Citywide traffic intelligence">
                <div className="traffic-section-title">
                  <div>
                    <p className="traffic-kicker">
                      MONITORED CORRIDORS / {metrics!.knownCoverage} OF {metrics!.total} WITH
                      SUPPORTED DATA
                    </p>
                    <h2>City traffic intelligence</h2>
                  </div>
                  <span className="traffic-chip">
                    {playbackEvent
                      ? 'HISTORICAL SNAPSHOT'
                      : `${source} · ${role.replaceAll('_', ' ')}`}
                  </span>
                </div>
                <div className="traffic-toolbar">
                  <label>
                    Search roads
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Road or direction…"
                    />
                  </label>
                  <label>
                    Locality
                    <select value={locality} onChange={(e) => setLocality(e.target.value)}>
                      <option value="all">All monitored localities</option>
                      {[...new Set(current.segments.map((r) => r.locality))].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Traffic severity
                    <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                      <option value="all">All levels</option>
                      {levels.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <button aria-pressed={overlay} onClick={() => setOverlay(!overlay)}>
                    <Layers size={16} />
                    Incidents
                  </button>
                  <button aria-pressed={heat} onClick={() => setHeat(!heat)}>
                    Recurrence
                  </button>
                </div>
                <div className="traffic-map-layout">
                  <TrafficMap
                    roads={roads}
                    incidents={overlay ? visibleIncidents : []}
                    selected={road?.id || ''}
                    onSelect={choose}
                    heat={heat}
                  />
                  <aside className="traffic-queue">
                    <div>
                      <h3>Investigation queue</h3>
                      <span>
                        {current.incidents.filter((i) => i.status === 'ACTIVE').length} active ·
                        priority order
                      </span>
                    </div>
                    {current.incidents
                      .filter((i) => i.status === 'ACTIVE')
                      .sort((a, b) => b.priority - a.priority)
                      .map((i) => (
                        <button
                          key={i.id}
                          aria-pressed={i.id === incident?.id}
                          onClick={() => choose(i.segmentIds[0])}
                        >
                          <span className="traffic-level">
                            {i.severity} / P{i.priority}
                          </span>
                          <b>{i.roadName}</b>
                          <span>
                            {readable(i.causeStatus)} cause · {time(i.firstDetectedAt)} IST
                          </span>
                          <small>{i.id.slice(0, 21)}</small>
                        </button>
                      ))}
                    {!current.incidents.some((i) => i.status === 'ACTIVE') && (
                      <p>
                        No supported active incident. Unknown roads are not evidence of clear
                        traffic.
                      </p>
                    )}
                    <div className="traffic-legend" aria-label="Traffic severity legend">
                      {levels.map((l) => (
                        <span key={l}>
                          <i style={{ background: colors[l] }} />
                          {readable(l)}
                        </span>
                      ))}
                    </div>
                  </aside>
                </div>
                <div className="traffic-road-list" aria-label="Monitored road selection">
                  {roads.map((r) => (
                    <button
                      key={r.id}
                      aria-pressed={r.id === road?.id}
                      onClick={() => choose(r.id)}
                    >
                      <i style={{ background: colors[r.estimate.level] }} />
                      <b>{r.roadName}</b>
                      <span>
                        {r.direction} · {r.estimate.level}
                      </span>
                      <small>{kmh(r.estimate.observedSpeedKmh)}</small>
                    </button>
                  ))}
                  {!roads.length && <p>No roads match these filters.</p>}
                </div>
              </section>
              {road && (
                <section className="traffic-detail-grid" aria-label="Selected road investigation">
                  <div className="traffic-panel">
                    <p className="traffic-kicker">FLOW / DIRECTIONAL ROAD RECORD</p>
                    <h2>{road.roadName}</h2>
                    <p>
                      {road.locality} / {readable(road.direction)}
                    </p>
                    <dl className="traffic-facts">
                      {[
                        ['Traffic level', road.estimate.level],
                        ['Observed speed', kmh(road.estimate.observedSpeedKmh)],
                        ['Expected speed', kmh(road.estimate.baselineSpeedKmh)],
                        ['Trend', readable(road.estimate.trend)],
                        ['Independent samples', road.estimate.independentSamples],
                        ['Data quality', road.estimate.quality],
                        [
                          'Last reading',
                          road.estimate.observedAt
                            ? `${stamp(road.estimate.observedAt)} IST`
                            : 'None',
                        ],
                        ['Legal speed limit', kmh(road.legalSpeedKmh)],
                        [
                          'Affected distance',
                          incident
                            ? `≈ ${(incident.affectedDistanceM / 1000).toFixed(2)} km`
                            : 'No supported incident',
                        ],
                        ['Baseline provenance', road.baseline?.provenance || 'Unavailable'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="traffic-subtle">
                      {road.estimate.reason}. {road.geometryProvenance}.
                    </p>
                    <SpeedHistory road={road} />
                  </div>
                  {incident ? (
                    <InvestigationPanel
                      key={incident.id}
                      state={current}
                      incident={incident}
                      busy={busy || playback !== null || connection.startsWith('Offline')}
                      role={role}
                      execute={execute}
                    />
                  ) : (
                    <div className="traffic-panel traffic-no-incident">
                      <BrainCircuit size={38} />
                      <h2>Evidence before explanation.</h2>
                      <p>
                        No incident has met the persistence threshold on this directional road. CORE
                        will not invent a cause or an inspection.
                      </p>
                    </div>
                  )}
                </section>
              )}
              {incident && (
                <section className="traffic-panel traffic-timeline">
                  <div className="traffic-section-title">
                    <div>
                      <p className="traffic-kicker">
                        BACKEND EVENTS / IST ·{' '}
                        {source === 'DEMO' ? 'SIMULATION TIME' : 'RECORDED TIME'}
                      </p>
                      <h2>Traffic cause timeline</h2>
                    </div>
                    <div className="traffic-inline">
                      <button
                        disabled={!events.length}
                        aria-pressed={playing}
                        onClick={() => {
                          setPlaying(!playing);
                          if (!playing) setPlayback(0);
                        }}
                      >
                        {playing ? 'Pause playback' : 'Play incident history'}
                      </button>
                      <button
                        onClick={() => {
                          setPlayback(null);
                          setPlaying(false);
                        }}
                      >
                        Return to current
                      </button>
                    </div>
                  </div>
                  <label className="traffic-time-slider">
                    Incident playback
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, events.length - 1)}
                      value={playback ?? Math.max(0, events.length - 1)}
                      onChange={(e) => {
                        setPlaying(false);
                        setPlayback(Number(e.target.value));
                      }}
                    />
                  </label>
                  {playbackEvent && (
                    <div className="traffic-playback" role="status">
                      <b>
                        {time(playbackEvent.at)} IST · {readable(playbackEvent.action)}
                      </b>
                      <p>{playbackEvent.detail}</p>
                      <span>
                        {Object.entries(playbackEvent.snapshot || {})
                          .map(([k, v]) => `${readable(k)}: ${readable(v)}`)
                          .join(' · ')}
                      </span>
                      <small>
                        Recorded state snapshot. Review controls paused. Road geometry uses the
                        current registry.
                      </small>
                    </div>
                  )}
                  <ol>
                    {events.map((e, n) => (
                      <li key={e.id} data-selected={playback === n}>
                        <button
                          onClick={() => {
                            setPlayback(n);
                            setPlaying(false);
                          }}
                        >
                          <time dateTime={e.at}>{time(e.at)}</time>
                          <span>
                            <b>{readable(e.action)}</b>
                            <p>{e.detail}</p>
                            <small>
                              Revision {e.revision} · recorded {stamp(e.recordedAt)} IST
                            </small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <section className="traffic-bottom-grid">
                <TrafficAnalytics state={current} />
                <PublicPreview state={current} />
              </section>
              <footer className="traffic-footer">
                <span>AETHER CITY / UNDERSTAND THE CAUSE.</span>
                <p>
                  Server-enforced review · no aircraft controls · no municipal integration claimed
                </p>
                <Link href="/command">
                  Return to AETHER COMMAND <ArrowUpRight size={15} />
                </Link>
              </footer>
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}

function SpeedHistory({ road }: { road: RoadSegment }) {
  const points = road.history.filter((h) => h.speedKmh !== null);
  return (
    <div className="traffic-speed">
      <h3>Directional speed / km/h</h3>
      <span>
        Stored aggregate snapshots · {road.source} ·{' '}
        {points.length ? `${time(points[0].at)}–${time(points.at(-1)!.at)} IST` : 'no readings yet'}
      </span>
      {points.length > 1 && (
        <svg
          viewBox="0 0 500 100"
          role="img"
          aria-label={`Speed changed from ${points[0].speedKmh} to ${points.at(-1)!.speedKmh} kilometres per hour across ${points.length} aggregate snapshots`}
        >
          <path
            d={`M ${points.map((p, n) => `${(n / (points.length - 1)) * 490 + 5} ${92 - ((p.speedKmh ?? 0) / Math.max(60, ...points.map((h) => h.speedKmh ?? 0))) * 80}`).join(' L ')}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <details>
        <summary>Aggregate history table</summary>
        <table>
          <caption>Stored speed estimates; no individual traces</caption>
          <thead>
            <tr>
              <th>Time IST</th>
              <th>km/h</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {road.history.map((h, n) => (
              <tr key={`${h.at}-${n}`}>
                <td>{time(h.at)}</td>
                <td>{h.speedKmh ?? 'Unknown'}</td>
                <td>{h.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function InvestigationPanel({
  state,
  incident: i,
  busy,
  role,
  execute,
}: {
  state: View;
  incident: TrafficIncident;
  busy: boolean;
  role: string;
  execute: (a: Action) => Promise<void>;
}) {
  const [notes, setNotes] = useState(''),
    [fixture, setFixture] = useState<'obstruction' | 'water'>('obstruction'),
    [rights, setRights] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const analysis = state.investigations.find((a) => a.id === i.investigationId),
    request = state.requests.filter((r) => r.incidentId === i.id).at(-1),
    evidence = state.evidence.filter((e) => e.incidentId === i.id);
  const candidate = analysis?.candidates[0],
    reviewer = ['DEMO_OPERATOR', 'REVIEWER'].includes(role);
  const disabled = busy || i.status !== 'ACTIVE';
  return (
    <div className="traffic-panel traffic-investigation">
      <div className="traffic-section-title">
        <div>
          <p className="traffic-kicker">CORE × SKY / INVESTIGATION</p>
          <h2>
            {i.verificationStatus === 'VERIFIED'
              ? 'Cause reviewed.'
              : i.causeStatus === 'POSSIBLE'
                ? 'A possibility. Not proof.'
                : 'Cause remains unknown.'}
          </h2>
        </div>
        <span className="traffic-chip">{i.status}</span>
      </div>
      <p className="traffic-subtle">
        {i.id} · first detected {stamp(i.firstDetectedAt)} IST · updated {time(i.updatedAt)} IST ·
        expires {time(i.expiresAt)} IST
      </p>
      <div className="traffic-cause">
        <span>{readable(i.cause)}</span>
        <b>
          {i.verificationStatus} / {i.causeStatus}
        </b>
      </div>
      <button
        className="traffic-primary"
        disabled={disabled}
        onClick={() => void execute({ action: 'analyze', incidentId: i.id })}
      >
        <BrainCircuit size={17} />
        {analysis ? 'Analyze available evidence' : 'Run CORE analysis'}
      </button>
      {analysis && (
        <div className="traffic-finding">
          <b>Method / {readable(analysis.method)}</b>
          <p>{analysis.uncertainty}</p>
          {analysis.candidates.map((c) => (
            <div key={c.cause}>
              <strong>{readable(c.cause)} · UNVERIFIED CANDIDATE</strong>
              <p>{c.description}</p>
              <small>
                Confidence: {c.confidence === null ? 'not calibrated' : c.confidence} · Evidence:{' '}
                {c.evidenceIds.join(', ')}
              </small>
            </div>
          ))}
          <p>Next: {analysis.nextStep}</p>
          <details>
            <summary>Public-safe draft</summary>
            <p>{analysis.publicDraft}</p>
          </details>
        </div>
      )}
      {reviewer && (
        <>
          <label className="traffic-notes">
            Private operator review notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Document review, uncertainty or the reason for a decision (15+ characters)."
            />
          </label>
          {request && (
            <div className="traffic-inspection">
              <h3>SKY / Inspection recommendation</h3>
              <span className="traffic-chip">{readable(request.status)}</span>
              <p>{request.requestReason}</p>
              <small>
                AOI: affected road geometry on map. Human planning only; no aircraft destination or
                command.{' '}
                {request.authorizedReviewer
                  ? 'Operator review recorded.'
                  : 'Awaiting operator review.'}
              </small>
              <div className="traffic-inline">
                {request.status === 'RECOMMENDED' && (
                  <button
                    disabled={disabled || notes.trim().length < 15}
                    onClick={() =>
                      void execute({
                        action: 'request-review',
                        requestId: request.id,
                        status: 'PENDING_REVIEW',
                        notes,
                      })
                    }
                  >
                    Begin operator review
                  </button>
                )}
                {request.status === 'PENDING_REVIEW' && (
                  <button
                    disabled={disabled || notes.trim().length < 15}
                    onClick={() =>
                      void execute({
                        action: 'request-review',
                        requestId: request.id,
                        status: 'APPROVED_FOR_OPERATOR_PLANNING',
                        notes,
                      })
                    }
                  >
                    Approve for operator planning
                  </button>
                )}
                {['RECOMMENDED', 'PENDING_REVIEW'].includes(request.status) && (
                  <button
                    disabled={disabled || notes.trim().length < 15}
                    onClick={() =>
                      void execute({
                        action: 'request-review',
                        requestId: request.id,
                        status: 'REJECTED',
                        notes,
                      })
                    }
                  >
                    Reject recommendation
                  </button>
                )}
                {['RECOMMENDED', 'PENDING_REVIEW', 'APPROVED_FOR_OPERATOR_PLANNING'].includes(
                  request.status,
                ) && (
                  <button
                    disabled={disabled || notes.trim().length < 15}
                    onClick={() =>
                      void execute({
                        action: 'request-review',
                        requestId: request.id,
                        status: 'CANCELLED',
                        notes,
                      })
                    }
                  >
                    Cancel recommendation
                  </button>
                )}
              </div>
              {request.status === 'APPROVED_FOR_OPERATOR_PLANNING' && state.source === 'DEMO' && (
                <div className="traffic-evidence-link">
                  <label>
                    Original demo observation
                    <select
                      value={fixture}
                      onChange={(e) => setFixture(e.target.value as typeof fixture)}
                    >
                      <option value="obstruction">Labeled obstruction illustration</option>
                      <option value="water">Labeled water illustration</option>
                    </select>
                  </label>
                  <label className="traffic-check">
                    <input
                      type="checkbox"
                      checked={rights}
                      onChange={(e) => setRights(e.target.checked)}
                    />
                    I am linking the original synthetic sample, with no actual flight claimed.
                  </label>
                  <button
                    disabled={disabled || !rights}
                    onClick={() =>
                      void execute({
                        action: 'attach-sample',
                        requestId: request.id,
                        fixture,
                        rightsConfirmed: true,
                      })
                    }
                  >
                    Link labeled demo observation
                  </button>
                </div>
              )}
            </div>
          )}
          {evidence.map((e) => (
            <div className="traffic-evidence" key={e.id}>
              <SampleFrame fixture={e.fixture} />
              <p>{e.description}</p>
              <small>
                {e.id} · captured {time(e.capturedAt)} IST · {e.humanReviewStatus} · retained until{' '}
                {stamp(e.expiresAt)} IST
              </small>
            </div>
          ))}
          {candidate && (
            <div className="traffic-verification">
              <label className="traffic-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I inspected the labeled evidence and understand its uncertainty.
              </label>
              <div className="traffic-inline">
                <button
                  disabled={disabled || !reviewed || notes.trim().length < 15}
                  onClick={() =>
                    void execute({
                      action: 'verify',
                      incidentId: i.id,
                      decision: 'confirm',
                      cause: candidate.cause,
                      notes,
                      reviewedEvidence: true,
                    })
                  }
                >
                  Confirm sample finding
                </button>
                <button
                  disabled={disabled || !reviewed || notes.trim().length < 15}
                  onClick={() =>
                    void execute({
                      action: 'verify',
                      incidentId: i.id,
                      decision: 'reject',
                      cause: candidate.cause,
                      notes,
                      reviewedEvidence: true,
                    })
                  }
                >
                  Reject candidate cause
                </button>
              </div>
            </div>
          )}
          <div className="traffic-publication">
            <h3>COMMAND / Public review gate</h3>
            <p>
              Only reviewed causes are shared as known. Unknown-cause congestion can be published as
              unknown. Private notes and media are excluded.
            </p>
            <div className="traffic-inline">
              <button
                className="traffic-primary"
                disabled={disabled}
                onClick={() => void execute({ action: 'publish', incidentId: i.id })}
              >
                Approve public-safe summary
              </button>
              <button
                disabled={disabled || notes.trim().length < 15}
                onClick={() => void execute({ action: 'resolve', incidentId: i.id, notes })}
              >
                Resolve with review notes
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SampleFrame({ fixture }: { fixture: 'obstruction' | 'water' }) {
  return (
    <svg
      className="traffic-sample"
      viewBox="0 0 600 250"
      role="img"
      aria-label={`DEMO original synthetic ${fixture} observation illustration; not aerial footage`}
    >
      <rect width="600" height="250" fill="#233230" />
      <path d="M0 45H600M0 210H600" stroke="#748477" strokeWidth="12" />
      <path d="M0 125H600" stroke="#bcc8ac" strokeWidth="2" strokeDasharray="20 15" />
      {[80, 150, 220, 290, 360].map((x, n) => (
        <g key={x}>
          <rect x={x} y={80} width="36" height="17" rx="3" fill="#d1b174" />
          <rect x={x - 25} y={155} width="36" height="17" rx="3" fill="#80998d" />
          {n === 0 && (
            <text x="26" y="73" fill="#f2ead5" fontSize="14">
              Illustrative queue
            </text>
          )}
        </g>
      ))}
      {fixture === 'water' ? (
        <ellipse cx="480" cy="90" rx="65" ry="25" fill="#52a4a5" opacity=".8" />
      ) : (
        <>
          <rect
            x="455"
            y="78"
            width="44"
            height="22"
            rx="4"
            fill="#d97964"
            transform="rotate(-15 477 89)"
          />
          <circle
            cx="477"
            cy="89"
            r="39"
            fill="none"
            stroke="#edce64"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        </>
      )}
      <text x="16" y="24" fill="#f5e1ac" fontSize="15" fontFamily="monospace">
        DEMO / SYNTHETIC ILLUSTRATION / NOT FOOTAGE
      </text>
      <text x="340" y="237" fill="#f2ead5" fontSize="14">
        {fixture === 'water' ? 'Labeled water accumulation' : 'Labeled stationary obstruction'}
      </text>
    </svg>
  );
}

function TrafficAnalytics({ state }: { state: View }) {
  const byRoad = state.segments
    .map((r) => ({
      road: r,
      count: state.incidents.filter((i) => i.segmentIds.includes(r.id)).length,
    }))
    .filter((r) => r.count)
    .sort((a, b) => b.count - a.count);
  const hours = Array.from(
    { length: 24 },
    (_, h) =>
      state.incidents.filter(
        (i) => new Date(Date.parse(i.firstDetectedAt) + 330 * 60000).getUTCHours() === h,
      ).length,
  );
  const verified = state.incidents.filter((i) => i.verificationStatus === 'VERIFIED'),
    distribution = [...new Set(verified.map((i) => i.cause))].map((c) => ({
      cause: c,
      count: verified.filter((i) => i.cause === c).length,
    }));
  const m = analytics({ ...state, windows: {}, seenIds: {} }),
    freshEvidence = state.evidence.filter(
      (e) => Date.parse(state.clock) - Date.parse(e.capturedAt) < 300000,
    ).length;
  return (
    <section className="traffic-panel traffic-analytics">
      <p className="traffic-kicker">RETAINED WORKSPACE RECORDS / {state.source}</p>
      <h2>Patterns with provenance.</h2>
      <div className="traffic-analytic-facts">
        <span>
          <b>{state.investigations.length}</b>investigations recorded
        </span>
        <span>
          <b>{m.resolved}</b>resolved / {m.expired} expired
        </span>
        <span>
          <b>{freshEvidence}</b>evidence items under 5 min
        </span>
      </div>
      <h3>Incident starts / hour IST</h3>
      <div
        className="traffic-hour-chart"
        role="img"
        aria-label={hours.map((n, h) => `${h}:00 ${n} incidents`).join('; ')}
      >
        {hours.map((n, h) => (
          <div key={h} title={`${h}:00 IST · ${n} recorded incidents`}>
            <i style={{ height: `${(n / Math.max(1, ...hours)) * 75 + 2}%` }} />
            <span>{h % 6 === 0 ? `${h}h` : ''}</span>
          </div>
        ))}
      </div>
      <details>
        <summary>Time-of-day data table</summary>
        <table>
          <caption>Recorded incident starts; not historical city coverage</caption>
          <tbody>
            {hours.map((n, h) => (
              <tr key={h}>
                <th>{h}:00 IST</th>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <h3>Recurring directional corridors</h3>
      {byRoad.length ? (
        <table>
          <caption>Retained incidents and observed durations</caption>
          <thead>
            <tr>
              <th>Road / direction</th>
              <th>Cases</th>
              <th>Recorded duration</th>
            </tr>
          </thead>
          <tbody>
            {byRoad.map(({ road, count }) => (
              <tr key={road.id}>
                <td>
                  {road.roadName}
                  <small>{road.direction}</small>
                </td>
                <td>{count}</td>
                <td>
                  {Math.round(
                    state.incidents
                      .filter((i) => i.segmentIds.includes(road.id))
                      .reduce(
                        (sum, i) =>
                          sum +
                          Math.max(
                            0,
                            Date.parse(i.status === 'ACTIVE' ? state.clock : i.updatedAt) -
                              Date.parse(i.firstDetectedAt),
                          ),
                        0,
                      ) / 60000,
                  )}{' '}
                  min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No recurring area established by these records.</p>
      )}
      <h3>Reviewed cause distribution</h3>
      {distribution.length ? (
        distribution.map((d) => (
          <p key={d.cause}>
            {readable(d.cause)} <b>{d.count}</b>
          </p>
        ))
      ) : (
        <p>No verified causes yet. Unknown causes are excluded.</p>
      )}
      <p className="traffic-subtle">
        Resolution trend: {m.resolved} resolved, {m.active} unresolved, {m.expired} expired.
        Recurrence overlay counts retained incident locations. Evidence freshness uses the workspace
        clock.
      </p>
    </section>
  );
}

function PublicPreview({ state }: { state: View }) {
  const [wallClock, setWallClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setWallClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [alternate, setAlternate] = useState(false),
    [feed, setFeed] = useState<MobileTrafficIncident[]>([]),
    [status, setStatus] = useState('Awaiting approved publications'),
    [voice, setVoice] = useState(false);
  const routeIds = useMemo(
    () =>
      alternate
        ? state.segments.slice(2, 4).map((r) => r.id)
        : state.segments.slice(0, 1).map((r) => r.id),
    [alternate, state.segments],
  );
  const network =
    state.source === 'DEMO' ? 'nexus-gurugram-sketch-v1' : state.segments[0]?.networkVersion;
  useEffect(() => {
    const controller = new AbortController();
    if (state.source === 'DEMO') {
      if (!routeIds.length) return;
      void fetch(
        `/api/response/traffic/public?source=DEMO&segments=${encodeURIComponent(routeIds.join(','))}&networkVersion=${network}`,
        { cache: 'no-store', signal: controller.signal },
      )
        .then(async (r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setFeed(data.incidents.map((v: unknown) => mobileTrafficIncidentSchema.parse(v)));
          setStatus('Demo route feed synchronized · native app not connected');
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus('Feed unavailable · expired records hidden');
        });
      return () => controller.abort();
    }
    const client = getFirebaseClient();
    if (!client || !network) return;
    const stop = onSnapshot(
      firestoreQuery(
        collection(client.firestore, 'trafficIncidents'),
        where('publicApproved', '==', true),
        where('schemaVersion', '==', 1),
        where('source', '==', 'AUTHORIZED'),
        limit(200),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        const now = Date.now();
        const records = snapshot.docs.flatMap((doc) => {
          const result = mobileTrafficIncidentSchema.safeParse(doc.data());
          return result.success ? [result.data] : [];
        });
        setFeed(selectPublicTraffic(records, routeIds, network || null, 'AUTHORIZED', now));
        setStatus(
          snapshot.metadata.fromCache
            ? 'Offline / cached public feed · check expiry'
            : 'Firestore public listener synchronized',
        );
      },
      () => {
        setFeed([]);
        setStatus('Public listener unavailable · check authorized project/rules');
      },
    );
    return () => {
      controller.abort();
      stop();
    };
  }, [state.revision, state.source, routeIds, network]);
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );
  const now =
    state.source === 'DEMO'
      ? Date.parse(state.clock)
      : Math.max(wallClock, Date.parse(state.clock));
  const fresh = selectPublicTraffic(
    feed,
    routeIds,
    network || null,
    state.source === 'DEMO' ? 'DEMO' : 'AUTHORIZED',
    now,
  );
  return (
    <section className="traffic-panel traffic-mobile-preview">
      <p className="traffic-kicker">AETHER MAP / PUBLIC CONTRACT PREVIEW</p>
      <h2>Only what matters ahead.</h2>
      <p className="traffic-sync">
        <Radio size={14} />
        {status}
      </p>
      <div className="traffic-phone">
        <div className="traffic-phone-header">
          <Route size={20} />
          <b>AETHER MAP</b>
          <span>{state.source === 'DEMO' ? 'DEMO ROUTE' : 'REGISTRY ROUTE'}</span>
        </div>
        <h3>{alternate ? 'Illustrative alternate corridor' : 'Selected directional corridor'}</h3>
        <p>
          {alternate
            ? 'Demo alternate route selected.'
            : state.segments[0]?.roadName || 'No road registry available.'}
        </p>
        <small>
          ETA unavailable · no routing provider connected. These sketches cannot guide road
          navigation.
        </small>
        <div className="traffic-route-diagram" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {fresh.length ? (
          fresh.map((i) => (
            <article key={i.incidentId}>
              <b>
                {i.status === 'RESOLVED'
                  ? 'Traffic recovery'
                  : `${readable(i.severity)} traffic ahead`}
              </b>
              <p>
                {i.roadName} · {readable(i.cause)}
              </p>
              <span>
                {i.verificationStatus} · {i.source} · {readable(i.causeStatus)}
              </span>
              <small>
                Updated {time(new Date(i.updatedAt).toISOString())} IST · expires{' '}
                {time(new Date(i.expiresAt).toISOString())} IST
              </small>
            </article>
          ))
        ) : (
          <p className="traffic-route-empty">
            No fresh approved update intersects this route. This does not establish clear traffic.
          </p>
        )}
        <div className="traffic-inline">
          <button
            disabled={state.source !== 'DEMO'}
            aria-pressed={alternate}
            onClick={() => setAlternate(!alternate)}
          >
            {alternate ? 'Return to original route' : 'Switch to demo alternative'}
          </button>
          <button onClick={() => setStatus('Current route kept ? route relevance unchanged')}>
            Keep current route
          </button>
        </div>
        <label className="traffic-check">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
          Enable browser voice for approved updates
        </label>
        <button
          disabled={!voice || !fresh.length}
          onClick={() => {
            if (!('speechSynthesis' in window)) {
              setStatus('Browser speech synthesis unavailable');
              return;
            }
            window.speechSynthesis.cancel();
            const incident = fresh[0];
            const utterance = new SpeechSynthesisUtterance(
              `${incident.source === 'DEMO' ? 'Demonstration. ' : ''}${incident.status === 'RESOLVED' ? 'Traffic recovery reported' : `${readable(incident.severity)} traffic ahead`} on ${incident.roadName}. ${incident.cause === 'UNKNOWN' ? 'Cause remains unknown.' : `Reviewed cause: ${readable(incident.cause)}.`}`,
            );
            utterance.lang = 'en-IN';
            window.speechSynthesis.speak(utterance);
          }}
        >
          Listen to approved alert
        </button>
      </div>
      <p className="traffic-subtle">
        Matches directed segment IDs and network version. DEMO records never enter the app’s
        AUTHORIZED subscription. Native receipt, voice and rerouting require a separately tested app
        integration.
      </p>
    </section>
  );
}
