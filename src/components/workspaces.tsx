'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  Compass,
  Download,
  Radio,
  ShieldCheck,
  Thermometer,
} from 'lucide-react';
import { useNexus, type Quality } from '@/lib/store';
import { observations, observationStatus, timeLabel, type Observation } from '@/lib/data';
import { moduleById, type ModuleId } from '@/lib/modules';
import { Chart } from './chart';
import { telemetry } from '@/lib/telemetry';
import { EngineeringExplorer } from './engineering';
import { DetectionReplay, EvidenceFrame } from './replay';
import { LoadingPanel } from './ui';
import { readingTime } from '@/lib/data/hooks';
const GeoMap = dynamic(() => import('./geo-map'), { ssr: false, loading: () => <LoadingPanel /> });

const series = telemetry;
function ModuleEmpty({ module }: { module: ModuleId }) {
  return (
    <div className="module-empty">
      <Radio size={28} />
      <h2>No matching {moduleById[module].name} observations.</h2>
      <p>Clear the search or choose another snapshot to explore the recorded demonstration.</p>
    </div>
  );
}
function SensorStrip({ items }: { items: { label: string; value: string; note: string }[] }) {
  return (
    <div className="sensor-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span className="eyebrow">{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </div>
      ))}
    </div>
  );
}
function FlowWorkspace({ records }: { records: Observation[] }) {
  const [junction, setJunction] = useState('east');
  const [compare, setCompare] = useState(false);
  const step = useNexus((s) => s.timeStep);
  const select = useNexus((s) => s.select);
  const offset = junction === 'east' ? 0 : junction === 'north' ? 7.2 : 4.5;
  return (
    <div className="module-workspace flow-workspace">
      <div className="module-controlbar">
        <div>
          <label htmlFor="junction">INTERSECTION</label>
          <select id="junction" value={junction} onChange={(e) => setJunction(e.target.value)}>
            <option value="east">East interchange</option>
            <option value="north">North corridor</option>
            <option value="south">South boulevard</option>
          </select>
        </div>
        <button
          className="button outline"
          onClick={() => setCompare(!compare)}
          aria-pressed={compare}
        >
          {compare ? 'Hide baseline' : 'Compare baseline'}
          <ArrowRight size={15} />
        </button>
      </div>
      <SensorStrip
        items={[
          {
            label: 'MEAN VEHICLE SPEED',
            value: `${(series.speed[step] + offset).toFixed(1)} km/h`,
            note: 'Simulated mobility sample',
          },
          {
            label: 'MODELED QUEUE',
            value: `${Math.round(220 - (series.speed[step] + offset) * 3)} m`,
            note: 'Conceptual approach length',
          },
          {
            label: 'NETWORK LOAD',
            value: `${Math.round(95 - (series.speed[step] + offset))}%`,
            note: 'Illustrative capacity index',
          },
        ]}
      />
      <div className="module-two-columns">
        <div className="module-map">
          <GeoMap module="flow" />
        </div>
        <div>
          <Chart
            channel="speed"
            module="flow"
            label={`${junction} junction speed`}
            unit="km/h"
            values={series.speed.map((v) => v + offset)}
            baseline={compare ? [40, 38, 37, 38, 40] : undefined}
            color="#d8ed86"
          />
          <div className="junction-approaches">
            <h3>Approach analysis</h3>
            {['Northbound', 'Eastbound', 'Southbound', 'Westbound'].map((name, i) => (
              <div key={name}>
                <span>{name}</span>
                <div>
                  <i
                    style={{ width: `${Math.max(10, 92 - series.speed[step] - offset + i * 5)}%` }}
                  />
                </div>
                <span className="mono">
                  {Math.max(10, Math.round(92 - series.speed[step] - offset + i * 5))}%
                </span>
              </div>
            ))}
          </div>
          <button className="text-button amber" onClick={() => select(records[0]?.id || null)}>
            Inspect mobility observation <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
function RescueWorkspace({ records }: { records: Observation[] }) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [maverickPlan, setMaverickPlan] = useState<{
    status: string;
    steps: number;
    duration_ms: number;
    interventions: number;
  } | null>(null);
  const [planning, setPlanning] = useState(false);
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  const step = useNexus((s) => s.timeStep);
  const record = records.find((o) => o.id === selected) || records[0];
  if (!record) return <ModuleEmpty module="rescue" />;
  const resolved = observationStatus(record, step) === 'resolved';
  const ack = acknowledged.includes(record.id);

  const calculateMaverickRoute = async () => {
    setPlanning(true);
    try {
      const res = await fetch('/api/nexus/maverick/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [0, 0],
          goal: [8, 8],
          enable_supervisor: true,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setMaverickPlan({
          status: data.status,
          steps: data.steps,
          duration_ms: data.duration_ms,
          interventions: data.supervisor_interventions || 0,
        });
      }
    } catch {}
    setPlanning(false);
  };
  return (
    <div className="module-workspace rescue-workspace">
      <div className="module-two-columns">
        <div className="rescue-case">
          <p className="eyebrow">
            {record.dataSource === 'LIVE'
              ? 'REPORTED OBSERVATION / LOCAL REVIEW'
              : 'SIMULATED RESPONSE WORKFLOW'}
          </p>
          <h2>{record.title}</h2>
          <span className="severity critical">
            {resolved ? 'Reported resolved' : ack ? 'Acknowledged locally' : 'Review required'}
          </span>
          <div className="response-timeline">
            <div className="complete">
              <i />
              <span>
                <strong>Observation captured</strong>
                <small>
                  {readingTime(record.observedAt)} ·{' '}
                  {record.dataSource === 'LIVE' ? record.source : 'demo aerial sample'}
                </small>
              </span>
            </div>
            <div className={ack || resolved ? 'complete' : ''}>
              <i />
              <span>
                <strong>Evidence review</strong>
                <small>
                  {ack
                    ? 'Marked reviewed in this browser'
                    : resolved
                      ? 'Resolution recorded by source; review not independently verified'
                      : 'Awaiting operator review'}
                </small>
              </span>
            </div>
            <div className={resolved ? 'complete' : ''}>
              <i />
              <span>
                <strong>Scenario resolution</strong>
                <small>
                  {resolved && record.resolvedAt
                    ? `${readingTime(record.resolvedAt)} · ${record.dataSource === 'LIVE' ? 'reported outcome' : 'prerecorded outcome'}`
                    : 'No real response dispatched'}
                </small>
              </span>
            </div>
          </div>
          <button
            className="button primary"
            disabled={ack || resolved}
            onClick={() => {
              setAcknowledged([...acknowledged, record.id]);
              select(record.id);
            }}
          >
            <Check size={15} />
            {resolved
              ? 'Scenario resolved'
              : ack
                ? 'Reviewed locally'
                : record.dataSource === 'LIVE'
                  ? 'Mark observation reviewed locally'
                  : 'Mark demo observation reviewed'}
          </button>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="button outline"
              disabled={planning}
              onClick={calculateMaverickRoute}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Compass size={15} />
              {planning ? 'Planning route...' : 'Calculate MAVERICK Dispatch Route'}
            </button>
            {maverickPlan && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'rgba(8, 18, 21, 0.5)',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono" style={{ color: 'var(--color-nexus-lime)' }}>
                    MAVERICK / {maverickPlan.status.toUpperCase()}
                  </span>
                  <span className="mono">{maverickPlan.duration_ms}ms</span>
                </div>
                <div>Optimal Path: {maverickPlan.steps} waypoints · Supervisor Interventions: {maverickPlan.interventions}</div>
              </div>
            )}
          </div>
          <p className="data-note">
            Local review only. This action does not contact emergency services.
          </p>
        </div>
        <DetectionReplay key={record.id} observation={record} />
      </div>
    </div>
  );
}
function ThermalWorkspace({ records }: { records: Observation[] }) {
  const [target, setTarget] = useState('surface');
  const step = useNexus((s) => s.timeStep);
  const setLayer = useNexus((s) => s.setLayer);
  const select = useNexus((s) => s.select);
  const values =
    target === 'surface'
      ? series.temperature
      : series.temperature.map((v) => Number((v - 6.4).toFixed(1)));
  return (
    <div className="module-workspace thermal-workspace">
      <div className="module-controlbar">
        <div className="segmented">
          <button
            className={target === 'surface' ? 'active' : ''}
            aria-pressed={target === 'surface'}
            onClick={() => setTarget('surface')}
          >
            Rooftop surface
          </button>
          <button
            className={target === 'canopy' ? 'active' : ''}
            aria-pressed={target === 'canopy'}
            onClick={() => setTarget('canopy')}
          >
            Green corridor
          </button>
        </div>
        <button className="text-button amber" onClick={() => setLayer('thermal')}>
          <Thermometer size={16} />
          Activate heat layer
        </button>
      </div>
      <div className="module-two-columns">
        <div className="module-map">
          <GeoMap module="thermal" />
          <div className="heat-scale">
            <span>22°C</span>
            <i />
            <span>48°C</span>
            <small>ILLUSTRATIVE SURFACE HEAT</small>
          </div>
        </div>
        <div>
          <div className="thermal-reading">
            <Thermometer size={25} />
            <span className="eyebrow">
              {target === 'surface' ? 'CENTRAL DISTRICT' : 'WEST PARKLAND'}
            </span>
            <strong>
              {values[step]}
              <small>°C</small>
            </strong>
            <p>
              {target === 'surface' ? 'Modeled surface reading' : 'Modeled canopy reading'}
              <br />
              Synthetic LWIR sensor sample
            </p>
          </div>
          <Chart
            channel="temperature"
            module="thermal"
            label={`${target} temperature`}
            unit="°C"
            values={values}
          />
          <button
            className="text-button amber"
            onClick={() =>
              select(
                records.find((o) =>
                  target === 'surface' ? o.id === 'NX-2401' : o.id === 'NX-2408',
                )?.id || null,
              )
            }
          >
            Inspect thermal evidence <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
function AquaWorkspace({ records }: { records: Observation[] }) {
  const step = useNexus((s) => s.timeStep);
  const select = useNexus((s) => s.select);
  const level = series.water[step];
  return (
    <div className="module-workspace aqua-workspace">
      <SensorStrip
        items={[
          {
            label: 'RAINFALL SAMPLE',
            value: `${series.rainfall[step]} mm`,
            note: 'Recorded interval · demo',
          },
          { label: 'WATER LEVEL', value: `${level} cm`, note: 'Illustrative riverfront channel' },
          {
            label: 'DRAINAGE LOAD',
            value: `${Math.round((level / 35) * 100)}%`,
            note: 'Assumed capacity · conceptual',
          },
        ]}
      />
      <div className="module-two-columns">
        <div className="water-monitor">
          <div>
            <p className="eyebrow">RIVERFRONT LEVEL MONITOR</p>
            <h3>{level >= 25 ? 'Elevated water pressure.' : 'Below modeled threshold.'}</h3>
            <p>Threshold: 25 cm · illustrative channel model</p>
          </div>
          <div className="water-tank">
            <div className="water-fill" style={{ height: `${(level / 35) * 100}%` }} />
            <div className="water-threshold" />
            <strong>
              {level}
              <small>cm</small>
            </strong>
            <span className="mono">SIMULATED</span>
          </div>
          <button
            className="text-button amber"
            disabled={!records.length}
            onClick={() => select(records[0]?.id || null)}
          >
            Inspect drainage observation <ArrowUpRight size={15} />
          </button>
        </div>
        <div>
          <Chart
            channel="rainfall"
            module="aqua"
            label="Rainfall history"
            unit="mm"
            values={series.rainfall}
            color="#9fcfd3"
          />
          <Chart
            channel="water"
            module="aqua"
            label="Channel water level"
            unit="cm"
            values={series.water}
            color="#9fcfd3"
          />
        </div>
      </div>
    </div>
  );
}
function RoadWorkspace({ records }: { records: Observation[] }) {
  const [comparison, setComparison] = useState(50);
  const step = useNexus((s) => s.timeStep);
  const select = useNexus((s) => s.select);
  const record = records[0];
  if (!record) return <ModuleEmpty module="road" />;
  return (
    <div className="module-workspace road-workspace">
      <div className="module-two-columns">
        <div>
          <div className="road-comparison">
            <EvidenceFrame observation={record} comparison />
            <div className="road-before" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}>
              <EvidenceFrame observation={record} />
            </div>
            <div className="comparison-divider" style={{ left: `${comparison}%` }} />
            <span className="comparison-label before">
              {record.dataSource === 'LIVE' ? 'REPORTED METADATA' : 'DETECTION FRAME'}
            </span>
            <span className="comparison-label after">
              {record.dataSource === 'LIVE' ? 'NO CAPTURE SUPPLIED' : 'ILLUSTRATIVE REPAIR'}
            </span>
          </div>
          {record.dataSource !== 'LIVE' && (
            <label className="comparison-control">
              Compare synthetic evidence
              <input
                type="range"
                min="0"
                max="100"
                value={comparison}
                onChange={(e) => setComparison(Number(e.target.value))}
                aria-label="Road evidence comparison"
              />
            </label>
          )}
          <p className="data-note">
            {record.dataSource === 'LIVE'
              ? 'Metadata only. No captured image or completed repair is evidenced.'
              : 'Both frames are generated illustrations. The repair comparison does not represent completed work.'}
          </p>
        </div>
        <div className="road-assessment">
          <p className="eyebrow">SURFACE CONDITION REVIEW</p>
          <h2>
            Small fractures.
            <br />A bigger responsibility.
          </h2>
          <SensorStrip
            items={[
              {
                label: 'OBSERVED LENGTH',
                value: `${record.metric} ${record.unit}`,
                note:
                  record.dataSource === 'LIVE'
                    ? `Reported · ${readingTime(record.observedAt)}`
                    : 'Synthetic surface defect',
              },
              {
                label: 'MODEL CONFIDENCE',
                value: `${record.confidence}%`,
                note:
                  record.dataSource === 'LIVE'
                    ? 'Reported confidence; unverified'
                    : 'Unverified demo detection',
              },
            ]}
          />
          <Chart
            channel="health"
            module="road"
            label="Road health index"
            unit="%"
            values={series.health}
            color="#d7c3a4"
          />
          <button className="button outline" onClick={() => select(record.id)}>
            Inspect {record.id}
            <ArrowUpRight size={15} />
          </button>
          <p className="data-note">
            Snapshot {timeLabel(step)} · physical inspection required for real defects.
          </p>
        </div>
      </div>
    </div>
  );
}
function FireWorkspace({ records }: { records: Observation[] }) {
  const [threshold, setThreshold] = useState(85);
  const [reviewed, setReviewed] = useState(false);
  const record = records[0];
  const visible = records.filter((o) => o.confidence >= threshold);
  if (!record) return <ModuleEmpty module="fire" />;
  return (
    <div className="module-workspace fire-workspace">
      <div className="module-two-columns">
        <DetectionReplay key={record.id} observation={record} />
        <div className="fire-review">
          <p className="eyebrow">SIGNAL FUSION / RGB + THERMAL</p>
          <h2>
            Look closer.
            <br />
            Verify first.
          </h2>
          <p>{record.description}</p>
          <label className="threshold-control">
            Detection confidence threshold <strong>{threshold}%</strong>
            <input
              type="range"
              min="50"
              max="99"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <div className="threshold-result" role="status">
            <span className="tiny-status" />
            {visible.length
              ? `${visible.length} ${visible.some((r) => r.dataSource === 'LIVE') ? 'reported' : 'demo'} detection above threshold`
              : `No ${records.some((r) => r.dataSource === 'LIVE') ? 'reported' : 'demo'} detection above threshold`}
          </div>
          <dl className="detail-metadata">
            <div>
              <dt>Thermal peak</dt>
              <dd>
                {record.metric} {record.unit}
              </dd>
            </div>
            <div>
              <dt>Sample confidence</dt>
              <dd>{record.confidence}%</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{record.evidence}</dd>
            </div>
          </dl>
          <button
            className="button outline"
            onClick={() => setReviewed(!reviewed)}
            aria-pressed={reviewed}
          >
            <ShieldCheck size={16} />
            {reviewed ? 'Evidence marked reviewed' : 'Mark evidence reviewed locally'}
          </button>
          <p className="data-note">No alert sent. Review state stays in this workspace.</p>
        </div>
      </div>
    </div>
  );
}
function CoreWorkspace({ records }: { records: Observation[] }) {
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('Give me the city overview');
  const [coreEval, setCoreEval] = useState<{
    raw_class: string;
    recommendation: string;
    safety_reason: string;
    guard_intervened: boolean;
    duration_ms: number;
  } | null>(null);
  const select = useNexus((s) => s.select);
  const step = useNexus((s) => s.timeStep);
  const rules: [string[], ModuleId][] = [
    [['traffic', 'mobility', 'speed', 'congestion'], 'flow'],
    [['water', 'rain', 'drainage', 'flood'], 'aqua'],
    [['heat', 'temperature', 'thermal'], 'thermal'],
    [['fire', 'smoke'], 'fire'],
    [['road', 'pothole', 'fracture'], 'road'],
    [['rescue', 'emergency', 'assistance'], 'rescue'],
    [['drone', 'aerial', 'survey'], 'sky'],
  ];
  const matched = rules
    .filter(([keywords]) => keywords.some((k) => submitted.toLowerCase().includes(k)))
    .map(([, id]) => id);
  const sources = matched.length
    ? records.filter((o) => matched.includes(o.module))
    : /overview|city|summary|observations/i.test(submitted)
      ? records
      : [];
  const active = sources.filter(
    (o) => o.severity !== 'normal' && observationStatus(o, step) !== 'resolved',
  ).length;

  useEffect(() => {
    let activeReq = true;
    void fetch('/api/nexus/core/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text_description: submitted,
        incident_type: matched[0] || 'CITY_OVERVIEW',
        confidence: 0.89,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activeReq && data?.success) {
          setCoreEval({
            raw_class: data.raw_class,
            recommendation: data.recommendation,
            safety_reason: data.safety_reason,
            guard_intervened: data.guard_intervened,
            duration_ms: data.duration_ms,
          });
        }
      })
      .catch(() => {});
    return () => {
      activeReq = false;
    };
  }, [submitted, matched.length]);
  return (
    <div className="core-workspace">
      <div className="core-intro">
        <div className="core-emblem">
          <BrainCircuit size={43} strokeWidth={1} />
        </div>
        <p className="eyebrow">SOURCE-AWARE / DETERMINISTIC RECORD ANALYSIS</p>
        <h2>
          Ask the city.
          <br />
          Inspect the evidence.
        </h2>
        <p>
          Welcome to AETHER CORE, the intelligence layer of AETHER CITY. Explore structured findings
          from the recorded dataset. Every answer keeps its sources in view.
        </p>
      </div>
      <div className="core-prompt-chips">
        {[
          'Give me the city overview',
          'What is happening with traffic?',
          'Show water and rainfall observations',
          'Review surface heat',
        ].map((q) => (
          <button
            key={q}
            onClick={() => {
              setSubmitted(q);
              setQuestion('');
            }}
          >
            {q}
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <form
        className="core-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) {
            setSubmitted(question.trim());
            setQuestion('');
          }
        }}
      >
        <label className="sr-only" htmlFor="core-question">
          Ask about available observations
        </label>
        <input
          id="core-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask about traffic, heat, water, roads…"
        />
        <button
          className="button primary"
          type="submit"
          aria-label="Analyze available observations"
        >
          <ArrowRight size={19} />
        </button>
      </form>
      <div className="core-answer" aria-live="polite">
        <div className="core-answer-heading">
          <BrainCircuit size={18} />
          <span className="eyebrow">
            SOURCE-LINKED FINDING /{' '}
            {sources.some((r) => r.dataSource === 'LIVE')
              ? 'REPORTED RECORDS + DEMO FALLBACK'
              : `${timeLabel(step)} DEMO REPLAY`}
          </span>
          <span className="tag">{sources.length} SOURCES</span>
        </div>
        <h3>{submitted}</h3>
        {sources.length ? (
          <>
            <p>
              The current view contains <strong>{sources.length} matching observations</strong>.{' '}
              <strong>{active}</strong> remain flagged for review. Inspect each source and
              timestamp. This template summary does not confirm real-world conditions.
            </p>
            <div className="core-sources">
              {sources.map((o) => (
                <button key={o.id} onClick={() => select(o.id)}>
                  <span className="mono">{o.id}</span>
                  <strong>{o.title}</strong>
                  <span>{o.district}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <p>
            No matching source is available in this snapshot. Try a supported topic or move the time
            machine forward. The demo does not generate unsupported findings.
          </p>
        )}
        {coreEval && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              borderRadius: '8px',
              border: `1px solid ${coreEval.guard_intervened ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              background: 'rgba(8, 18, 21, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={16} color={coreEval.guard_intervened ? '#f59e0b' : '#10b981'} />
                <span className="mono" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  NEXUS CORE DETERMINISTIC SAFETY GUARD
                </span>
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  background: coreEval.guard_intervened ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: coreEval.guard_intervened ? '#f59e0b' : '#10b981',
                }}
              >
                {coreEval.guard_intervened ? 'GUARD INTERVENED' : 'SAFETY PROTOCOL VERIFIED'}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 0.25rem 0' }}>
                <strong>Recommendation:</strong> {coreEval.recommendation}
              </p>
              <p style={{ margin: 0, opacity: 0.8, fontSize: '0.8rem' }}>
                <strong>Constraint Reason:</strong> {coreEval.safety_reason}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.6 }} className="mono">
              <span>RAW: {coreEval.raw_class}</span>
              <span>EVAL: {coreEval.duration_ms}ms</span>
              <span>ENGINE: ONNX</span>
            </div>
          </div>
        )}
        <p className="data-note">Template-based analysis · no automatic inference or dispatch.</p>
      </div>
    </div>
  );
}
export function ModuleWorkspace({ module, records }: { module: ModuleId; records: Observation[] }) {
  if (module === 'sky')
    return (
      <div className="sky-workspace">
        <SensorStrip
          items={[
            { label: 'RECORDED ALTITUDE', value: '120 m', note: 'Survey log SK-001 · demo' },
            { label: 'SURVEY AREA', value: '2.4 km²', note: 'Conceptual coverage' },
            {
              label: 'SENSOR PAYLOAD',
              value: 'RGB + LWIR',
              note: 'Illustrative sensor configuration',
            },
          ]}
        />
        <EngineeringExplorer compact />
        <Link className="button outline" href="/command/geo">
          Review SKY paths & geographic evidence <ArrowUpRight size={17} />
        </Link>
        {records[0] && (
          <div className="sky-recording">
            <div>
              <p className="eyebrow">RECORDED OBSERVATION</p>
              <h3>{records[0].title}</h3>
              <p>{records[0].description}</p>
            </div>
            <DetectionReplay observation={records[0]} />
          </div>
        )}
      </div>
    );
  if (module === 'flow') return <FlowWorkspace records={records} />;
  if (module === 'rescue') return <RescueWorkspace records={records} />;
  if (module === 'thermal') return <ThermalWorkspace records={records} />;
  if (module === 'aqua') return <AquaWorkspace records={records} />;
  if (module === 'road') return <RoadWorkspace records={records} />;
  if (module === 'fire') return <FireWorkspace records={records} />;
  if (module === 'core') return <CoreWorkspace records={records} />;
  return null;
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function ReportsWorkspace({ records }: { records: Observation[] }) {
  const [scope, setScope] = useState('snapshot');
  const [generated, setGenerated] = useState(false);
  const step = useNexus((s) => s.timeStep);
  const selectedRecords = scope === 'day' ? observations : records;
  const hasLive = selectedRecords.some((r) => r.dataSource === 'LIVE');
  const exportData = (format: 'json' | 'csv') => {
    const data =
      format === 'json'
        ? JSON.stringify(
            {
              source: selectedRecords.some((r) => r.dataSource === 'LIVE') ? 'MIXED' : 'DEMO',
              recordingDate: '2026-10-12',
              scope,
              snapshot: scope === 'day' ? 'Full recording day' : timeLabel(step),
              disclaimer:
                'Inspect each record source and timestamp. Demo records are simulated; device records require human verification.',
              observations: selectedRecords,
            },
            null,
            2,
          )
        : [
            [
              'ID',
              'Module',
              'Title',
              'District',
              'Severity',
              'Observed at UTC',
              'Confidence percent',
              'Source',
            ],
            ...selectedRecords.map((o) => [
              o.id,
              o.module,
              o.title,
              o.district,
              o.severity,
              o.observedAt,
              o.confidence,
              o.dataSource || 'DEMO',
            ]),
          ]
            .map((row) => row.map(csvCell).join(','))
            .join('\r\n');
    download(
      data,
      `aether-records-${scope}-${step}.${format}`,
      format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
    );
  };
  return (
    <div className="reports-workspace">
      <div className="report-hero">
        <FileReport />
        <div>
          <p className="eyebrow">EVIDENCE, READY TO SHARE</p>
          <h2>A record of the bigger picture.</h2>
          <p>
            Export typed observations or create an on-screen summary. Every record retains its
            source and timestamp. The recording-day scope contains demo records only.
          </p>
        </div>
      </div>
      <div className="module-controlbar">
        <div>
          <label htmlFor="report-scope">REPORT SCOPE</label>
          <select
            id="report-scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setGenerated(false);
            }}
          >
            <option value="snapshot">Current snapshot · {timeLabel(step)}</option>
            <option value="day">Entire recorded demo day</option>
          </select>
        </div>
        <div className="report-actions">
          <button className="button outline" onClick={() => exportData('csv')}>
            <Download size={15} />
            Export CSV
          </button>
          <button className="button outline" onClick={() => exportData('json')}>
            <Download size={15} />
            Export JSON
          </button>
          <button className="button primary" onClick={() => setGenerated(true)}>
            Generate summary <ArrowRight size={15} />
          </button>
        </div>
      </div>
      {generated && (
        <div className="generated-report" role="status">
          <p className="eyebrow">
            AETHER INTELLIGENCE REPORT / {hasLive ? 'MIXED SOURCES' : 'DEMO / 12 OCT 2026'}
          </p>
          <h3>
            {selectedRecords.length} observations across{' '}
            {new Set(selectedRecords.map((o) => o.module)).size} modules.
          </h3>
          <p>
            {selectedRecords.filter((o) => o.severity === 'critical').length} observations carry a
            critical severity label in the selected records.{' '}
            {selectedRecords.filter((o) => o.severity === 'elevated').length} carry an elevated
            label. Scope: {scope === 'day' ? 'entire recorded demo day' : timeLabel(step)}.
          </p>
          <p className="data-note">
            Demo records are simulated. Device reports require verification. No incident is
            independently confirmed here.
          </p>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table report-table">
          <caption>
            {hasLive ? 'Mixed-source observations' : 'Demo observations'} ·{' '}
            {scope === 'day' ? 'full recording' : timeLabel(step)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Observation</th>
              <th scope="col">Module</th>
              <th scope="col">District</th>
              <th scope="col">Severity</th>
              <th scope="col">Time IST</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {selectedRecords.map((o) => (
              <tr key={o.id}>
                <th scope="row">
                  {o.title}
                  <small>{o.id}</small>
                </th>
                <td>{moduleById[o.module].name}</td>
                <td>{o.district}</td>
                <td>
                  <span className={`severity ${o.severity}`}>{o.severity}</span>
                </td>
                <td>{readingTime(o.observedAt)}</td>
                <td>
                  {o.dataSource || 'DEMO'}
                  {o.deviceId ? ` / ${o.deviceId}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function FileReport() {
  return (
    <div className="report-symbol">
      <ShieldCheck size={49} strokeWidth={1} />
      <span className="mono">SOURCE / PER RECORD</span>
    </div>
  );
}
export function SettingsWorkspace() {
  const integration = useNexus((s) => s.integration);
  const quality = useNexus((s) => s.quality);
  const setQuality = useNexus((s) => s.setQuality);
  const motion = useNexus((s) => s.motion);
  const setMotion = useNexus((s) => s.setMotion);
  const sound = useNexus((s) => s.sound);
  const setSound = useNexus((s) => s.setSound);
  const volume = useNexus((s) => s.volume);
  const setVolume = useNexus((s) => s.setVolume);
  const [reset, setReset] = useState(false);
  return (
    <div className="settings-workspace">
      <section>
        <p className="eyebrow">01 / RENDERING</p>
        <h2>The right amount of atmosphere.</h2>
        <p>
          Choose a rendering budget for your device. Simplified mode keeps every data workspace
          usable without a 3D renderer.
        </p>
        <div className="quality-options">
          {(['high', 'balanced', 'low', 'off'] as Quality[]).map((id) => (
            <button
              key={id}
              className={quality === id ? 'active' : ''}
              aria-pressed={quality === id}
              onClick={() => setQuality(id)}
            >
              <span>{id === 'off' ? 'Simplified' : id[0].toUpperCase() + id.slice(1)}</span>
              <small>
                {id === 'high'
                  ? 'Sharper rendering · up to 1.7× DPR'
                  : id === 'balanced'
                    ? 'Recommended · native 1× DPR'
                    : id === 'low'
                      ? 'On-demand frames · no antialiasing'
                      : 'Accessible plan · 3D disabled'}
              </small>
              {quality === id && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="eyebrow">02 / MOTION & SOUND</p>
        <div className="setting-row">
          <div>
            <h3>Cinematic motion</h3>
            <p>
              Enable scene movement and transitions. Your system’s reduced-motion setting always
              takes priority.
            </p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={motion}
              onChange={(e) => setMotion(e.target.checked)}
              aria-label="Enable cinematic motion"
            />
            <span />
          </label>
        </div>
        <div className="setting-row">
          <div>
            <h3>Optional audio</h3>
            <p>
              Subtle synthesized tones for major interactions. Audio starts off until you choose to
              enable it.
            </p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
              aria-label="Enable optional audio"
            />
            <span />
          </label>
        </div>
        <label className="volume-setting">
          Audio volume <span className="mono">{Math.round(volume * 100)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
          />
        </label>
      </section>
      <section>
        <p className="eyebrow">03 / DATA & PRIVACY</p>
        <div className="source-settings">
          <span className="demo-badge">
            <i />
            {integration.mode === 'LIVE' ? 'LIVE + DEMO' : `${integration.mode} / DEMO`}
          </span>
          <h3>{integration.message}</h3>
          <p>
            Unconnected panels use bundled observations. Device feeds require scoped access. CORE
            uses deterministic summaries; questions stay in this browser. Inspect Sources for
            reported values and timestamps.
          </p>
        </div>
        <div className="setting-row">
          <div>
            <h3>Local preferences</h3>
            <p>
              Rendering, motion, audio, and volume preferences are stored on this device when
              browser storage is available.
            </p>
          </div>
          <button
            className="button outline"
            onClick={() => {
              setQuality('balanced');
              setMotion(true);
              setSound(false);
              setVolume(0.25);
              setReset(true);
            }}
          >
            Reset preferences
          </button>
        </div>
        {reset && (
          <p role="status" className="lime">
            Default preferences restored.
          </p>
        )}
      </section>
    </div>
  );
}
