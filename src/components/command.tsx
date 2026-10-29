'use client';
import dynamic from 'next/dynamic';
import { TransitionLink as Link } from './route-transition';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import {
  ArrowUpRight,
  Box,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  Gauge,
  Layers3,
  Search,
} from 'lucide-react';
import { moduleById, type ModuleId, type Workspace } from '@/lib/modules';
import {
  visibleObservations,
  metricsAt,
  timeLabel,
  formatObservedAt,
  observationStatus,
  severityColor,
  type Observation,
} from '@/lib/data';
import { useNexus, type FocusMode } from '@/lib/store';
import { motionTiming, spring, transition, useReducedMotion } from '@/lib/motion';
import { CommandTelemetry } from './command-telemetry';
import { ObservationDetail } from './observation-detail';
import { playCue } from '@/lib/sound';
import { LoadingPanel } from './ui';
import { Chart } from './chart';
import { telemetry } from '@/lib/telemetry';
import { DetectionReplay } from './replay';
import { ModuleWorkspace, ReportsWorkspace, SettingsWorkspace } from './workspaces';
import { Presentation } from './presentation';
import { DataSourcePanel, LiveModuleData, FirebaseAccess } from './data-source';
import { CameraPanel } from './camera-panel';
import { ResponseWorkspace, LinkedResponseEvidence } from './response-workspace';
import { AppShell, routeGroup } from './app-shell';
import { OpsPipeline } from './ops-pipeline';
const GeoIntelligence = dynamic(() => import('./geo-intelligence'), {
  ssr: false,
  loading: () => <LoadingPanel label="Preparing geospatial view" />,
});

export function TimeMachine() {
  const step = useNexus((s) => s.timeStep);
  const setTime = useNexus((s) => s.setTime);
  const reduced = useReducedMotion();
  return (
    <div className="time-machine">
      <div className="time-title">
        <span className="eyebrow">LEGACY DEMO SNAPSHOT</span>
        <span className="mono">12 OCT 2026 / ORIGINAL POINT DATASET</span>
      </div>
      <div className="time-track">
        <button
          className="icon-button"
          disabled={step === 0}
          onClick={() => setTime(step - 1)}
          aria-label="Earlier snapshot"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="time-range">
          <label className="sr-only" htmlFor="time-machine">
            Historical city snapshot
          </label>
          <input
            id="time-machine"
            type="range"
            min="0"
            max="4"
            step="1"
            value={step}
            aria-valuetext={timeLabel(step)}
            onChange={(e) => setTime(Number(e.target.value))}
          />
          <div className="time-ticks">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.button
                whileTap={reduced ? undefined : { scale: 0.95 }}
                key={i}
                className={i === step ? 'active' : ''}
                aria-pressed={i === step}
                onClick={() => setTime(i)}
              >
                {timeLabel(i)}
                {i === step && (
                  <motion.i
                    layoutId="time-snapshot-selector"
                    transition={reduced ? { duration: 0 } : spring}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
        <button
          className="icon-button"
          disabled={step === 4}
          onClick={() => setTime(step + 1)}
          aria-label="Later snapshot"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function ObservationList({
  records,
  title = 'Observation timeline',
  severity,
  onSeverity,
}: {
  records: Observation[];
  title?: string;
  severity?: string;
  onSeverity?: (value: string) => void;
}) {
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  const step = useNexus((s) => s.timeStep);
  return (
    <section className="observation-list" aria-label={title}>
      <div className="panel-heading">
        <h3>
          {title}
          <span className="count">{records.length}</span>
        </h3>
        {onSeverity && (
          <>
            <label className="sr-only" htmlFor="severity-filter">
              Filter severity
            </label>
            <select
              id="severity-filter"
              value={severity}
              onChange={(e) => onSeverity(e.target.value)}
            >
              <option value="all">All levels</option>
              <option value="critical">Critical</option>
              <option value="elevated">Elevated</option>
              <option value="normal">Normal</option>
            </select>
          </>
        )}
      </div>
      {records.length ? (
        <div className="observation-rows">
          {[...records]
            .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
            .map((o) => {
              const Icon = moduleById[o.module].icon;
              return (
                <button
                  key={o.id}
                  className={`observation-row ${selected === o.id ? 'selected' : ''}`}
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    select(o.id);
                    void playCue('select');
                  }}
                  aria-pressed={selected === o.id}
                >
                  <span className="observation-icon" style={{ color: severityColor[o.severity] }}>
                    <Icon size={17} />
                  </span>
                  <span>
                    <strong>{o.title}</strong>
                    <small>
                      {o.district}
                      <span> / {moduleById[o.module].name}</span>
                    </small>
                  </span>
                  <span className="observation-time mono">
                    {formatObservedAt(o.observedAt)}
                    <small
                      className={observationStatus(o, step) === 'resolved' ? 'lime' : o.severity}
                    >
                      {observationStatus(o, step) === 'resolved'
                        ? 'RESOLVED'
                        : o.severity.toUpperCase()}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              );
            })}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={24} />
          <p>No observations in this snapshot.</p>
          <span>Try another time or remove the filter.</span>
        </div>
      )}
    </section>
  );
}
const focusModes: { id: FocusMode; name: string; icon: typeof Box }[] = [
  { id: 'city', name: 'City', icon: Layers3 },
  { id: 'twin', name: 'Twin', icon: Box },
  { id: 'analytics', name: 'Analytics', icon: Gauge },
  { id: 'mission', name: 'Mission', icon: CommandIcon },
];
const headings: Partial<Record<Workspace, { eyebrow: string; title: string; text: string }>> = {
  response: {
    eyebrow: 'Respond / AI-assisted intake · human-reviewed demo',
    title: 'AETHER RESPONSE',
    text: 'Every voice deserves a human response. Hindi, English and Hinglish incident intake.',
  },
  geo: {
    eyebrow: 'Locate / spatial observation review',
    title: 'AETHER GEO',
    text: 'Real Gurugram geography. Source-labeled aerial trails, affected areas and evidence in one review workspace.',
  },
  command: {
    eyebrow: 'Operate / Gurugram operations picture',
    title: 'AETHER COMMAND',
    text: 'Observe, understand, locate, validate and respond — one shared picture of the city, every record labeled by source.',
  },
  reports: {
    eyebrow: 'Recorded intelligence',
    title: 'Intelligence reports',
    text: 'Source-labeled summaries and exports of the records currently available.',
  },
  settings: {
    eyebrow: 'Your environment',
    title: 'System settings',
    text: 'Rendering, motion, audio and data-access preferences for this browser.',
  },
};
function WorkspaceHeading({
  workspace,
  spatialView,
  step,
}: {
  workspace: Workspace;
  spatialView: boolean;
  step: number;
}) {
  const config = workspace in moduleById ? moduleById[workspace as ModuleId] : null;
  const copy = headings[workspace] ?? {
    eyebrow: `${routeGroup(workspace)} / ${config?.label}`,
    title: `AETHER ${config?.name}`,
    text: config?.description ?? '',
  };
  const Icon = config?.icon;
  return (
    <div
      className="workspace-heading os-heading"
      style={config ? ({ '--module-accent': config.color } as CSSProperties) : undefined}
    >
      <div className="os-heading-copy">
        <p className="eyebrow">
          {Icon && <Icon size={13} aria-hidden="true" />}
          {copy.eyebrow}
        </p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
      </div>
      {workspace !== 'response' && workspace !== 'settings' && (
        <dl className="os-heading-context">
          <div>
            <dt>Area</dt>
            <dd>Gurugram, Haryana</dd>
          </div>
          <div>
            <dt>{spatialView ? 'Time basis' : 'Demo snapshot'}</dt>
            <dd className="mono">{spatialView ? 'Source timestamps' : timeLabel(step)}</dd>
          </div>
          <div>
            <dt>Control</dt>
            <dd>Review only · no aircraft control</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
function InsightSummary({ records, step }: { records: Observation[]; step: number }) {
  const metrics = metricsAt(step, records);
  const mixed = records.some((r) => r.dataSource === 'LIVE');
  const critical = records.filter(
    (r) => r.severity === 'critical' && observationStatus(r, step) !== 'resolved',
  );
  return (
    <aside className="insight-summary">
      <div className="panel-heading">
        <h3>
          <BrainCircuit size={17} />
          AETHER insight
        </h3>
        <span className="tag">{mixed ? 'MIXED SOURCES' : 'DEMO'}</span>
      </div>
      <p className="eyebrow">EVIDENCE-LED OVERVIEW</p>
      <h3>
        {metrics.active > 0
          ? `${metrics.active} observations need a closer look.`
          : 'A quieter city snapshot.'}
      </h3>
      <p>
        {metrics.observations} observations are available in the current view
        {critical.length ? `, ${critical.length} of them critical and unresolved` : ''}. The demo
        snapshot is {timeLabel(step)}; device records retain their own timestamps. Severity is a
        recorded label, not an AI verdict — review evidence before acting.
      </p>
      <div className="insight-mini">
        <span>Data source</span>
        <strong>{mixed ? 'Device records + labeled demo fallback' : 'Bundled demo dataset'}</strong>
        <span>Analysis method</span>
        <strong>Deterministic summary · no LLM</strong>
      </div>
      <Link href="/command/core" className="text-button amber">
        Explore intelligence <ArrowUpRight size={16} />
      </Link>
    </aside>
  );
}
export function Command({ workspace, incidentId }: { workspace: Workspace; incidentId?: string }) {
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  const [presentation, setPresentation] = useState(false);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const status = useNexus((s) => s.demoStatus);
  const records = useNexus((s) => s.records);
  const retryData = useNexus((s) => s.retryData);
  const mode = useNexus((s) => s.mode);
  const setMode = useNexus((s) => s.setMode);
  const step = useNexus((s) => s.timeStep);
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  useEffect(() => {
    const state = useNexus.getState();
    if (workspace === 'twin') state.setMode('twin');
    else if (workspace === 'command') state.setMode('city');
    const layers = { flow: 'traffic', thermal: 'thermal', aqua: 'water' } as const;
    if (workspace in layers) state.setLayer(layers[workspace as keyof typeof layers]);
    const active = state.records.find((o) => o.id === state.selectedId);
    if (active && !['command', 'twin', 'core'].includes(workspace) && active.module !== workspace)
      state.select(null);
  }, [workspace]);
  const closePresentation = useCallback(() => setPresentation(false), []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !presentation && !document.querySelector('.command-palette'))
        select(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [select, presentation]);
  useEffect(() => {
    if (status !== 'ready' || reduced) return;
    const playback = animate(
      '.workspace-heading, .ops-pipeline, .focus-bar',
      { opacity: [0, 1], y: [16, 0] },
      { ...transition, duration: motionTiming.reveal, delay: (i) => i * motionTiming.stagger },
    );
    return () => playback.stop();
  }, [animate, status, workspace, reduced]);
  const isModule =
    workspace !== 'reports' &&
    workspace !== 'settings' &&
    workspace !== 'response' &&
    workspace !== 'geo';
  const config = isModule ? moduleById[workspace] : null;
  const available = visibleObservations(records, step, isModule ? workspace : undefined, query);
  const filtered = available.filter((o) => severity === 'all' || o.severity === severity);
  const selectedRecord = visibleObservations(records, step).find((o) => o.id === selected);
  const globalRecords = visibleObservations(records, step);
  const moduleSpecific = isModule && !['command', 'twin', 'core'].includes(workspace);
  const spatialView =
    workspace === 'geo' ||
    (['command', 'twin'].includes(workspace) && ['city', 'twin'].includes(mode));
  const showAlerts = () => {
    setMode('city');
    document.getElementById('observations')?.scrollIntoView({
      behavior:
        useNexus.getState().motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
    });
  };
  const onSeverity = (value: string) => {
    setSeverity(value);
    if (selectedRecord && value !== 'all' && selectedRecord.severity !== value) select(null);
  };
  const surface = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="workspace-surface"
        key={workspace + '-' + mode}
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -8 }}
        transition={reduced ? { duration: 0 } : transition}
      >
        {workspace === 'geo' ? (
          <GeoIntelligence query={query} severity={severity} masthead={false} />
        ) : moduleSpecific || workspace === 'core' ? (
          <ModuleWorkspace module={workspace as ModuleId} records={available} />
        ) : mode === 'twin' ? (
          <div className="command-twin">
            <GeoIntelligence
              pointRecords={globalRecords}
              severity={severity}
              query={query}
              initialSatellite
              masthead={false}
            />
          </div>
        ) : mode === 'analytics' ? (
          <div className="analytics-grid">
            <Chart
              channel="temperature"
              label="Surface temperature"
              unit="°C"
              values={telemetry.temperature}
            />
            <Chart
              channel="speed"
              label="Average traffic speed"
              unit="km/h"
              values={telemetry.speed}
              color="#d8ed86"
            />
            <Chart
              channel="rainfall"
              label="Rainfall"
              unit="mm"
              values={telemetry.rainfall}
              color="#9fcfd3"
            />
            <Chart
              channel="water"
              label="Water level"
              unit="cm"
              values={telemetry.water}
              color="#9fcfd3"
            />
          </div>
        ) : mode === 'mission' ? (
          <div className="mission-workspace">
            <div>
              <p className="eyebrow">RECORDED OBSERVATION MISSION</p>
              <h2>A city, frame by frame.</h2>
              <p>
                Explore synthetic evidence, revisit a detection, or launch the guided city
                presentation.
              </p>
              <button className="button primary" onClick={() => setPresentation(true)}>
                Start guided presentation <ArrowUpRight size={17} />
              </button>
            </div>
            {globalRecords[0] && (
              <DetectionReplay
                key={selectedRecord?.id || globalRecords[0].id}
                observation={selectedRecord || globalRecords[0]}
              />
            )}
          </div>
        ) : (
          <div className="command-map-field">
            <div className="command-map-stage">
              <GeoIntelligence
                pointRecords={globalRecords}
                severity={severity}
                query={query}
                masthead={false}
              />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
  return (
    <AppShell
      active={workspace}
      title={config?.name ?? headings[workspace]?.title.replace('AETHER ', '') ?? workspace}
      search={{ value: query, onChange: setQuery }}
      onAlerts={workspace === 'geo' ? undefined : showAlerts}
      data-workspace={workspace}
      data-mode={mode}
      data-spatial={spatialView}
      overlay={
        <>
          <AnimatePresence>
            {selectedRecord &&
              workspace !== 'settings' &&
              workspace !== 'reports' &&
              workspace !== 'response' && (
                <ObservationDetail key={selectedRecord.id} observation={selectedRecord} />
              )}
          </AnimatePresence>
          {presentation && <Presentation onClose={closePresentation} />}
        </>
      }
    >
      <main id="main" className="command-main os-main" ref={scope}>
        <WorkspaceHeading workspace={workspace} spatialView={spatialView} step={step} />
        <DataSourcePanel module={workspace} />
        <LiveModuleData module={workspace} />
        {status === 'error' && (
          <div className="service-error" role="status">
            <h2>Demo service is offline.</h2>
            <p>Bundled demonstrations remain available.</p>
            <button className="button outline" onClick={retryData}>
              Retry data connection
            </button>
          </div>
        )}
        {workspace === 'response' ? (
          <ResponseWorkspace key={incidentId} incidentId={incidentId} />
        ) : workspace === 'settings' ? (
          <>
            <SettingsWorkspace />
            <FirebaseAccess />
          </>
        ) : workspace === 'reports' ? (
          <ReportsWorkspace records={globalRecords} />
        ) : (
          <>
            {workspace === 'sky' && (
              <>
                <CameraPanel />
                <LinkedResponseEvidence key={incidentId} incidentId={incidentId} />
              </>
            )}
            {workspace === 'command' && <OpsPipeline records={globalRecords} step={step} />}
            {!moduleSpecific && workspace !== 'core' && workspace !== 'geo' && (
              <div className="focus-bar">
                <div className="segmented" role="group" aria-label="Command view">
                  {focusModes.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        className={mode === m.id ? 'active' : ''}
                        aria-pressed={mode === m.id}
                        onClick={() => setMode(m.id)}
                      >
                        <Icon size={15} />
                        {m.name}
                        <span className="mode-word"> mode</span>
                        {mode === m.id && (
                          <motion.i
                            className="selection-surface"
                            layoutId="command-focus-indicator"
                            transition={reduced ? { duration: 0 } : spring}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <span className="mono snapshot-label">
                  {spatialView
                    ? 'SPATIAL REVIEW / SOURCE TIMESTAMPS'
                    : `DEMO SNAPSHOT / ${timeLabel(step)}`}
                  {' · '}
                  {filtered.some((r) => r.dataSource === 'LIVE')
                    ? 'MIXED SOURCES'
                    : 'RECORDED DEMO'}
                </span>
              </div>
            )}
            {surface}
            {workspace !== 'geo' && <TimeMachine />}
            {workspace !== 'geo' && (
              <div className="command-lower" id="observations">
                <ObservationList
                  title={workspace === 'command' ? 'Review queue' : undefined}
                  records={filtered}
                  severity={severity}
                  onSeverity={onSeverity}
                />
                <InsightSummary records={moduleSpecific ? available : globalRecords} step={step} />
              </div>
            )}
            {workspace === 'command' && (
              <section className="os-telemetry" aria-labelledby="os-telemetry-title">
                <div className="os-section-title">
                  <h2 id="os-telemetry-title">City instruments</h2>
                  <span className="mono">SIMULATED SENSOR TRACES UNLESS MARKED LIVE</span>
                </div>
                <CommandTelemetry records={records} />
              </section>
            )}
          </>
        )}
        <footer className="command-footer">
          <span className="mono">
            <i />
            AETHER CITY / INSPECT EACH RECORD’S DATA SOURCE
          </span>
          <span className="mono">OBSERVE · UNDERSTAND · LOCATE · VALIDATE · RESPOND</span>
        </footer>
      </main>
    </AppShell>
  );
}
