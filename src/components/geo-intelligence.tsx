'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Layers3,
  Pause,
  Play,
  ScanLine,
  X,
} from 'lucide-react';
import GoogleOperationalMap from './google-operational-map';
import { useNexus } from '@/lib/store';
import { useReducedMotion } from '@/lib/motion';
import type { Observation } from '@/lib/data';
import { firebaseConfigured, siteId } from '@/lib/firebase/config';
import {
  canViewSpatial,
  geoModules,
  readSpatialCollection,
  type SpatialFeature,
} from '@/lib/geo-contracts';
import {
  observationSpatialFeatures,
  reviewSpatialFeatures,
  spatialColor,
  spatialMapPoints,
  spatialTimes,
  spatialSeverityColors,
  trafficSpatialFeatures,
} from '@/lib/geo-review';
import { requestTraffic, type TrafficView } from '@/lib/traffic/client';

type GeoModule = (typeof geoModules)[number];
const initialLayers = Object.fromEntries(geoModules.map((m) => [m, true])) as Record<
  GeoModule,
  boolean
>;
const empty: SpatialFeature[] = [];
const stamp = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' IST';
const readable = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const compactSnapshot = () => window.matchMedia('(max-width: 900px)').matches;
const compactSubscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 900px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
export default function GeoIntelligence({
  initialSatellite = false,
  query = '',
  severity = 'all',
  pointRecords,
  masthead = true,
}: {
  initialSatellite?: boolean;
  query?: string;
  severity?: string;
  pointRecords?: Observation[];
  masthead?: boolean;
}) {
  const records = useNexus((s) => s.records),
    integration = useNexus((s) => s.integration);
  const selectedId = useNexus((s) => s.spatialSelection ?? s.selectedId),
    choose = useNexus((s) => s.selectSpatial);
  const sourcePoints = pointRecords ?? records;
  const reduced = useReducedMotion();
  const compact = useSyncExternalStore(compactSubscribe, compactSnapshot, () => true);
  const [layers, setLayers] = useState(initialLayers),
    [demo, setDemo] = useState(false);
  const [verified, setVerified] = useState(true),
    [underReview, setUnderReview] = useState(true);
  const [search, setSearch] = useState(''),
    [level, setLevel] = useState('all');
  const [scenario, setScenario] = useState<SpatialFeature[]>(empty),
    [imported, setImported] = useState<SpatialFeature[]>(empty);
  const [fileMessage, setFileMessage] = useState(''),
    [demoError, setDemoError] = useState('');
  const [flowSource, setFlowSource] = useState<'LIVE' | 'DEMO' | null>(null),
    [flow, setFlow] = useState<TrafficView | null>(null);
  const [flowMessage, setFlowMessage] = useState('FLOW road feed is optional and not connected.');
  const [session, setSession] = useState('all'),
    [cursor, setCursor] = useState<string | null>(null),
    [playing, setPlaying] = useState(false);
  const [clusterIds, setClusterIds] = useState<string[]>([]);
  const clusterHeading = useRef<HTMLHeadingElement>(null);
  const fileVersion = useRef(0);
  const flowAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!demo || scenario.length) return;
    const controller = new AbortController();
    void fetch('/demo/aether-spatial-review.geojson', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Demo geometry unavailable.');
        return r.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setScenario(
            readSpatialCollection(value, { origin: 'DEMO', role: null, siteId: 'main' }).features,
          );
          setDemoError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDemoError(
            'Demo geometry could not load. Real geography and authorized observations remain available.',
          );
      });
    return () => controller.abort();
  }, [demo, scenario.length]);
  useEffect(() => {
    const clear = () => {
      flowAbort.current?.abort();
      fileVersion.current++;
      setImported([]);
      setFileMessage('Private spatial review cleared after access changed.');
      setFlow(null);
      setFlowSource(null);
      choose(null);
    };
    const stop = useNexus.subscribe((next, previous) => {
      if (next.integration.role !== previous.integration.role) clear();
    });
    window.addEventListener('nexus:camera-signout', clear);
    return () => {
      // This counter cancels pending file reads, rather than referencing a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fileVersion.current++;
      stop();
      window.removeEventListener('nexus:camera-signout', clear);
    };
  }, [choose]);
  useEffect(() => {
    if (!flowSource || (flowSource === 'LIVE' && !integration.role)) return;
    const controller = new AbortController();
    flowAbort.current = controller;
    const read = async () => {
      try {
        const result = await requestTraffic(flowSource, undefined, controller.signal);
        if (controller.signal.aborted) return;
        setFlow(result.state);
        setFlowMessage(
          result.state
            ? `${flowSource === 'DEMO' ? 'Private DEMO' : 'Authorized FLOW'} snapshot · ${stamp(result.state.clock)}`
            : 'No private FLOW snapshot. Start a session in the existing traffic workspace.',
        );
      } catch {
        if (!controller.signal.aborted) {
          setFlow(null);
          setFlowMessage(
            'FLOW unavailable or permission denied. The map remains usable; no previous private snapshot is retained.',
          );
        }
      }
    };
    const initial = setTimeout(() => void read(), 0);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, 15000);
    return () => {
      controller.abort();
      clearTimeout(initial);
      if (flowAbort.current === controller) flowAbort.current = null;
      clearInterval(interval);
    };
  }, [flowSource, integration.role]);
  const all = useMemo(() => {
    const observations = observationSpatialFeatures(
      sourcePoints,
      integration.fresh.aiDetections,
      integration.test,
    );
    const traffic =
      flow && (flow.source === 'DEMO' || integration.role)
        ? trafficSpatialFeatures(flow.segments, flow.incidents, flow.investigations)
        : empty;
    // Existing authorized records win collisions. Imports cannot replace a backend record.
    return [
      ...new Map(
        [...scenario, ...imported, ...observations, ...traffic].map((f) => [f.id, f]),
      ).values(),
    ].filter((f) => canViewSpatial(f, integration.role));
  }, [sourcePoints, integration, flow, scenario, imported]);
  const matching = useMemo(
    () =>
      all.filter((f) => {
        const p = f.properties;
        const haystack =
          `${f.id} ${p.title} ${p.location} ${p.module} ${readable(p.kind)}`.toLowerCase();
        return (
          layers[p.module] &&
          (demo || p.source !== 'DEMO') &&
          (p.verification === 'VERIFIED'
            ? verified
            : p.verification === 'UNDER_REVIEW' && underReview) &&
          (severity === 'all' || p.severity === severity) &&
          (level === 'all' || p.severity === level) &&
          [query, search].every(
            (term) => !term.trim() || haystack.includes(term.trim().toLowerCase()),
          ) &&
          (session === 'all' || f.id === session || p.sessionId === session)
        );
      }),
    [all, layers, demo, verified, underReview, query, search, severity, level, session],
  );
  const times = useMemo(() => spatialTimes(matching), [matching]);
  const activeCursor = cursor && times.includes(cursor) ? cursor : null;
  const slice = useMemo(
    () => reviewSpatialFeatures(matching, activeCursor),
    [matching, activeCursor],
  );
  const points = useMemo(() => spatialMapPoints(slice), [slice]);
  const shapes = useMemo(() => slice.filter((f) => f.geometry.type !== 'Point'), [slice]);
  const selected = slice.find((f) => f.id === selectedId);
  const cursorIndex = activeCursor ? times.indexOf(activeCursor) : Math.max(0, times.length - 1);
  useEffect(() => {
    if (!playing || times.length < 2) return;
    const timer = setTimeout(
      () => {
        if (cursorIndex >= times.length - 1) setPlaying(false);
        else setCursor(times[cursorIndex + 1]);
      },
      reduced ? 1500 : 1100,
    );
    return () => clearTimeout(timer);
  }, [playing, cursorIndex, times, reduced]);
  useEffect(() => {
    if (clusterIds.length) clusterHeading.current?.focus();
  }, [clusterIds]);
  const select = (id: string) => {
    choose(id);
    setClusterIds([]);
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const version = ++fileVersion.current;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Maximum GeoJSON file size is 2 MB.');
      const value = JSON.parse(await file.text());
      if (version !== fileVersion.current) return;
      const batch = readSpatialCollection(value, {
        origin: 'IMPORT',
        role: useNexus.getState().integration.role,
        siteId,
      });
      const backendIds = new Set(
        all.filter((f) => f.properties.source === 'AUTHORIZED').map((f) => f.id),
      );
      if (batch.features.some((f) => backendIds.has(f.id)))
        throw new Error('Imported IDs collide with authorized records. No import accepted.');
      setImported(batch.features);
      setCursor(null);
      setPlaying(false);
      if (batch.features.some((f) => f.properties.source === 'DEMO')) setDemo(true);
      setFileMessage(
        `${batch.features.length} features imported for this browser review. No upload, publication or verification occurred.`,
      );
    } catch (e) {
      setFileMessage(
        e instanceof SyntaxError
          ? 'Invalid JSON. No import accepted.'
          : e instanceof Error
            ? e.message
            : 'GeoJSON import rejected.',
      );
    }
  };
  const sessions = all.filter(
    (f) => f.properties.kind === 'TRAIL' && (demo || f.properties.source !== 'DEMO'),
  );
  const group = clusterIds.length ? slice.filter((f) => clusterIds.includes(f.id)) : slice;
  const focusRecords = group
    .slice()
    .sort((a, b) => b.properties.observedAt.localeCompare(a.properties.observedAt));
  const moduleCount = (module: GeoModule) =>
    all.filter((f) => f.properties.module === module && (demo || f.properties.source !== 'DEMO'))
      .length;
  return (
    <section
      className="geo-workspace"
      aria-label="AETHER spatial intelligence"
      data-reduced={reduced}
    >
      <header className={`geo-masthead${masthead ? '' : ' geo-masthead-slim'}`}>
        {masthead && (
          <div>
            <span className="eyebrow">GEO / SPATIAL INTELLIGENCE</span>
            <h2>The city. In context.</h2>
          </div>
        )}
        <div className="geo-source-state">
          <i />
          <span>
            {all.some((f) => f.properties.source === 'AUTHORIZED')
              ? 'AUTHORIZED RECORDS AVAILABLE'
              : 'GEOGRAPHY READY · NO AUTHORIZED SPATIAL FEED'}
            <small>Observation review only · no aircraft controls</small>
          </span>
        </div>
      </header>
      <div className="geo-workbench-grid">
        <aside className="geo-controls" aria-label="Spatial layers and filters">
          <details open={!compact}>
            <summary>
              <Layers3 size={16} />
              Layers & filters
            </summary>
            <div className="geo-control-body">
              <label>
                Search records
                <input
                  type="search"
                  aria-label="Filter spatial records"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPlaying(false);
                  }}
                  placeholder="ID, location, category"
                />
              </label>
              <fieldset>
                <legend>Independent AETHER layers</legend>
                {geoModules.map((m) => (
                  <label className="geo-layer-option" key={m}>
                    <input
                      type="checkbox"
                      aria-label={`AETHER ${m.toUpperCase()} layer`}
                      checked={layers[m]}
                      onChange={(e) => {
                        setLayers({ ...layers, [m]: e.target.checked });
                        setPlaying(false);
                      }}
                    />
                    <span>{m.toUpperCase()}</span>
                    <small>{moduleCount(m)}</small>
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Verification</legend>
                <label className="geo-layer-option">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  Verified incidents
                </label>
                <label className="geo-layer-option">
                  <input
                    type="checkbox"
                    checked={underReview}
                    onChange={(e) => setUnderReview(e.target.checked)}
                  />
                  Under-review reports
                </label>
              </fieldset>
              <label>
                Severity
                <select
                  aria-label="Spatial severity"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="all">All severity levels</option>
                  <option value="critical">Critical</option>
                  <option value="elevated">Elevated</option>
                  <option value="normal">Normal</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="geo-demo-switch">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => {
                    setDemo(e.target.checked);
                    setPlaying(false);
                    setCursor(null);
                  }}
                />
                DEMO observations<span>Fictional paths & areas · never LIVE</span>
              </label>
              {demoError && <p role="status">{demoError}</p>}
              {demo && (
                <p className="geo-small">
                  All DEMO sketches are fictional, including when placed over real streets. Original
                  Bengaluru point samples are not relocated to Gurugram.
                </p>
              )}
              <button
                onClick={() => {
                  setLayers(initialLayers);
                  setLevel('all');
                  setSearch('');
                  setVerified(true);
                  setUnderReview(true);
                  setSession('all');
                  setCursor(null);
                  setPlaying(false);
                  setClusterIds([]);
                }}
              >
                Reset spatial filters
              </button>
            </div>
          </details>
          <details className="geo-import">
            <summary>
              <FileUp size={16} />
              Data & GeoJSON
            </summary>
            <div className="geo-control-body">
              <p className="geo-small">
                No GPS trail or boundary feed is configured. Existing site-scoped observations
                remain connected through the current data bridge.
              </p>
              <label className="geo-file-button">
                Import review GeoJSON
                <input
                  type="file"
                  accept=".geojson,.json,application/geo+json,application/json"
                  onChange={(e) => void importFile(e)}
                />
              </label>
              <a href="/demo/aether-spatial-review.geojson" download>
                Download DEMO example <ArrowUpRight size={14} />
              </a>
              <p className="geo-small">
                2 MB / 200 features / 5,000 positions. [longitude, latitude]. DEMO files work
                without sign-in. LOCAL private recordings require the existing Firebase operator
                role and stay under review.
              </p>
              {fileMessage && (
                <p role="status" className="geo-import-status">
                  {fileMessage}
                </p>
              )}
              {!!imported.length && (
                <button
                  onClick={() => {
                    fileVersion.current++;
                    setImported([]);
                    setFileMessage('Imported review cleared.');
                    choose(null);
                  }}
                >
                  Clear imported review
                </button>
              )}
              <button
                disabled={!firebaseConfigured || !integration.role}
                onClick={() => setFlowSource('LIVE')}
              >
                Read authorized FLOW
              </button>
              {demo && (
                <button onClick={() => setFlowSource('DEMO')}>Read private DEMO FLOW</button>
              )}
              <p role="status" className="geo-small">
                {flowMessage}
              </p>
              <Link href="/traffic">
                Open traffic review <ArrowUpRight size={14} />
              </Link>
            </div>
          </details>
        </aside>
        <div className="geo-map-column">
          <GoogleOperationalMap
            legend={Object.entries(spatialSeverityColors).map(([label, color]) => ({
              label,
              color,
            }))}
            points={points}
            features={shapes}
            selected={selected?.id ?? null}
            onSelect={select}
            clusterPoints
            onClusterSelect={setClusterIds}
            initialSatellite={initialSatellite}
            note={
              <p>
                {slice.length} matching spatial features · S = start, E = latest available trail
                sample. Out-of-view points are culled and clustered. Google imagery/traffic is not
                historical AETHER evidence.
              </p>
            }
          />
          <details className="geo-timeline" open>
            <summary>
              Observation timeline <span>{times.length} event timestamps</span>
            </summary>
            <div className="geo-timeline-body">
              <div className="geo-timeline-top">
                <label>
                  Review session
                  <select
                    aria-label="Observation review session"
                    value={session}
                    onChange={(e) => {
                      setSession(e.target.value);
                      setCursor(null);
                      setPlaying(false);
                    }}
                  >
                    <option value="all">All matching observations</option>
                    {sessions.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.properties.source} · {s.properties.pathStatus} · {s.properties.title}
                      </option>
                    ))}
                  </select>
                </label>
                <output aria-live="off">
                  {times.length ? stamp(times[cursorIndex]) : 'No observation timestamps'}
                </output>
              </div>
              <div className="geo-playback">
                <button
                  aria-label="Previous observation event"
                  disabled={!times.length || cursorIndex === 0}
                  onClick={() => {
                    setPlaying(false);
                    setCursor(times[cursorIndex - 1]);
                  }}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  aria-label={playing ? 'Pause observation timeline' : 'Play observation timeline'}
                  disabled={times.length < 2}
                  onClick={() => {
                    if (!playing && cursorIndex === times.length - 1) setCursor(times[0]);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={17} /> : <Play size={17} />}
                </button>
                <input
                  type="range"
                  aria-label="Observation event time"
                  min={0}
                  max={Math.max(0, times.length - 1)}
                  value={cursorIndex}
                  disabled={times.length < 2}
                  aria-valuetext={times.length ? stamp(times[cursorIndex]) : 'No events'}
                  onChange={(e) => {
                    setCursor(times[Number(e.target.value)]);
                    setPlaying(false);
                  }}
                />
                <button
                  aria-label="Next observation event"
                  disabled={!times.length || cursorIndex === times.length - 1}
                  onClick={() => {
                    setPlaying(false);
                    setCursor(times[cursorIndex + 1]);
                  }}
                >
                  <ChevronRight size={17} />
                </button>
                <button
                  onClick={() => {
                    setCursor(null);
                    setPlaying(false);
                  }}
                  disabled={!activeCursor}
                >
                  Latest
                </button>
              </div>
              <p className="geo-small">
                Only supplied GPS samples and observation timestamps are replayed. Proposals remain
                proposals. No interpolated flight or past incident classifications are invented.
              </p>
            </div>
          </details>
        </div>
        <aside className="geo-intelligence-panel" aria-label="Spatial intelligence panel">
          {selected ? (
            <article className="geo-record-detail" data-feature-id={selected.id}>
              <div className="geo-panel-heading">
                <span className="eyebrow">INTELLIGENCE RECORD</span>
                <button aria-label="Clear spatial selection" onClick={() => choose(null)}>
                  <X size={16} />
                </button>
              </div>
              <span
                className={`geo-provenance geo-provenance-${selected.properties.source.toLowerCase()}`}
              >
                {selected.properties.source === 'DEMO'
                  ? 'SIMULATED / DEMO'
                  : selected.properties.source === 'LOCAL'
                    ? 'LOCAL FILE / UNVERIFIED'
                    : 'AUTHORIZED RECORD'}
              </span>
              <h3>{selected.properties.title}</h3>
              <p className="geo-location">{selected.properties.location}</p>
              <div className="geo-record-tags">
                <span style={{ color: spatialSeverityColors[selected.properties.severity] }}>
                  {selected.properties.severity}
                </span>
                <span>
                  {readable(selected.properties.pathStatus || selected.properties.verification)}
                </span>
              </div>
              <dl className="geo-facts">
                <dt>Feature ID</dt>
                <dd>{selected.id}</dd>
                {selected.properties.incidentId && (
                  <>
                    <dt>Incident ID</dt>
                    <dd>{selected.properties.incidentId}</dd>
                  </>
                )}
                <dt>Category / source</dt>
                <dd>
                  {readable(selected.properties.kind)} / AETHER{' '}
                  {selected.properties.module.toUpperCase()}
                </dd>
                <dt>
                  {selected.properties.pathStatus === 'PROPOSED'
                    ? 'Proposal created (source timestamp)'
                    : 'Detected / first sample'}
                </dt>
                <dd>{stamp(selected.properties.observedAt)}</dd>
                <dt>
                  {selected.properties.sampleTimes.length
                    ? 'Latest available GPS sample'
                    : 'Record updated (source)'}
                </dt>
                <dd>
                  {stamp(selected.properties.sampleTimes.at(-1) || selected.properties.updatedAt)}
                </dd>
                <dt>Verification</dt>
                <dd>
                  {readable(selected.properties.verification)}
                  {selected.properties.verifiedAt && ` · ${stamp(selected.properties.verifiedAt)}`}
                </dd>
                <dt>Confidence</dt>
                <dd>
                  {selected.properties.confidence === null
                    ? 'Not supplied'
                    : `${selected.properties.confidence}% · ${selected.properties.source === 'DEMO' ? 'simulated' : 'source-supplied'}`}
                </dd>
                {selected.properties.trafficLevel && (
                  <>
                    <dt>FLOW classification / incident state</dt>
                    <dd>
                      {selected.properties.trafficLevel} ·{' '}
                      {selected.properties.incidentStatus || 'No linked incident'}
                    </dd>
                  </>
                )}
                <dt>Aerial session</dt>
                <dd>
                  {selected.properties.sessionId ||
                    (selected.properties.kind === 'TRAIL'
                      ? selected.id
                      : 'No linked aerial recording')}
                </dd>
              </dl>
              <section className="geo-analysis">
                <h4>Observed event</h4>
                <p>{selected.properties.description}</p>
                <h4>CORE finding</h4>
                <p>{selected.properties.analysis.finding}</p>
                <h4>AI-suggested cause</h4>
                <p>
                  {selected.properties.analysis.suggestedCause ||
                    'Not established from available evidence.'}
                </p>
                <h4>Human-verified cause</h4>
                <p>{selected.properties.analysis.verifiedCause || 'No verified cause supplied.'}</p>
                <small>
                  {readable(selected.properties.analysis.method)} · severity metadata is the latest
                  supplied classification.
                </small>
              </section>
              <details className="geo-evidence">
                <summary>
                  Evidence & geometry provenance ({selected.properties.evidenceIds.length})
                </summary>
                <p>
                  {selected.properties.geometryBasis ||
                    'Original point only; no disaster boundary inferred.'}
                </p>
                {selected.properties.evidenceIds.map((id) => (
                  <div key={id}>
                    <code>{id}</code>
                    {sourcePoints.some((o) => o.id === id) ? (
                      <button onClick={() => useNexus.getState().select(id)}>
                        Open observation evidence
                      </button>
                    ) : (
                      <span>Reference only · no authorized image attached</span>
                    )}
                  </div>
                ))}
              </details>
              {selected.properties.estimated && (
                <p className="geo-estimate">
                  Estimated / under review. Boundary is not a confirmed hazard perimeter.
                </p>
              )}
              <Link href="/traffic" className="geo-review-link">
                Permission-controlled traffic review <ArrowUpRight size={14} />
              </Link>
              <p className="geo-small">
                This review cannot verify a cause, publish an incident or operate an aircraft. Those
                permissions are enforced by the existing workflows.
              </p>
            </article>
          ) : (
            <div className="geo-empty-detail">
              <ScanLine size={28} />
              <span className="eyebrow">EVIDENCE / BEFORE ASSUMPTION</span>
              <h3>Select a spatial record.</h3>
              <p>
                Trace the observation, examine supplied evidence, and distinguish a suggestion from
                a verified cause.
              </p>
              <div className="geo-source-key">
                <span>
                  <i style={{ background: '#35d3bc' }} />
                  Recorded trail / source-labeled
                </span>
                <span>
                  <i className="is-dashed" />
                  Proposed or uncertain extent
                </span>
                <span>
                  <i style={{ background: '#43cbe5' }} />
                  Supplied affected-area geometry
                </span>
              </div>
              {!demo && (
                <button onClick={() => setDemo(true)}>Explore labeled DEMO scenario</button>
              )}
              <p className="geo-small">
                No authorized GPS trail feed is available. The map works independently of optional
                feeds.
              </p>
            </div>
          )}
          <div className="geo-record-browser">
            <div className="geo-panel-heading">
              <h3 ref={clusterHeading} tabIndex={-1}>
                {clusterIds.length ? 'Cluster selection' : 'Spatial records'}
              </h3>
              <span>{focusRecords.length}</span>
            </div>
            {clusterIds.length > 0 && (
              <button onClick={() => setClusterIds([])}>Show all matching records</button>
            )}
            <div className="geo-record-list">
              {focusRecords.map((f) => (
                <button
                  key={f.id}
                  className="geo-record-row"
                  aria-pressed={selected?.id === f.id}
                  onClick={() => select(f.id)}
                >
                  <i style={{ background: spatialColor(f) }} />
                  <span>
                    <strong>{f.properties.title}</strong>
                    <small>
                      {f.properties.source} · {f.properties.module.toUpperCase()} ·{' '}
                      {readable(f.properties.pathStatus || f.properties.verification)}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!focusRecords.length && (
                <p className="geo-small">
                  No matching records. Adjust layers or enable explicit demo observations.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
