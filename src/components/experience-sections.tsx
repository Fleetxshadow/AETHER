'use client';
import dynamic from 'next/dynamic';
import { TransitionLink as Link } from './route-transition';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Cpu, Layers3 } from 'lucide-react';
import { modules, moduleHref, type Layer } from '@/lib/modules';
import { useNexus } from '@/lib/store';
import { formatObservedAt, severityColor, visibleObservations } from '@/lib/data';
import { spring, transition, useReducedMotion } from '@/lib/motion';
import { ModuleVisual } from './module-visual';
import { CityControls } from './city-controls';
import { EvidenceFrame } from './replay';
import { Reveal, MagneticLink, Spotlight } from './motion-ui';
import { CityFallback } from './scenes/scene-boundary';
import { SectionLabel, LoadingPanel } from './ui';
import { useTheme } from './theme-provider';
import { themeColor } from '@/lib/themes';
import { cityWorlds } from '@/lib/awakening';
const CityScene = dynamic(() => import('./scenes/city-scene'), {
  ssr: false,
  loading: () => <CityFallback />,
});
const EngineeringExplorer = dynamic(
  () => import('./engineering').then((m) => m.EngineeringExplorer),
  {
    ssr: false,
    loading: () => <LoadingPanel label="Preparing the engineering explorer" />,
  },
);
const chapters: { name: string; layer: Layer; title: string; detail: string; note: string }[] = [
  {
    name: 'OBSERVE',
    layer: 'network',
    title: 'EVERY CITY LEAVES A SIGNAL.',
    detail:
      'From aerial observations to ground-level infrastructure, AETHER connects the signals that reveal what is happening across monitored urban environments.',
    note: 'SKY / FROM OBSERVATION TO CONTEXT',
  },
  {
    name: 'UNDERSTAND',
    layer: 'traffic',
    title: 'DETECTION IS ONLY THE BEGINNING.',
    detail:
      'AETHER connects traffic patterns, observations and available evidence to help identify the possible causes behind urban problems.',
    note: 'FLOW → SKY → CORE / EVIDENCE BEFORE CONCLUSION',
  },
  {
    name: 'ANTICIPATE',
    layer: 'water',
    title: 'FROM INFORMATION TO INTELLIGENT ACTION.',
    detail:
      'Transforming available urban information into actionable insights for navigation, infrastructure monitoring and municipal decision-making.',
    note: 'GEO → COMMAND / A HUMAN DECISION',
  },
];
// Match the stacked CSS composition: it needs document flow, not a viewport pin.
const manualStoryQuery = '(max-width: 1000px), (max-height: 660px)';
const manualStorySnapshot = () => window.matchMedia(manualStoryQuery).matches;
const subscribeManualStory = (callback: () => void) => {
  const media = window.matchMedia(manualStoryQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
export function LivingCity({ paused }: { paused: boolean }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const current = useRef(0);
  const [chapter, setChapter] = useState(0);
  const [world, setWorld] = useState(0);
  const currentWorld = useRef(0);
  const reduced = useReducedMotion();
  const compact = useSyncExternalStore(subscribeManualStory, manualStorySnapshot, () => true);
  const manual = reduced || compact;
  const loaded = useInView(stage, { once: true, amount: 0.01 });
  const setLayer = useNexus((s) => s.setLayer);
  useEffect(() => {
    if (manual) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          ScrollTrigger.create({
            trigger: root.current,
            start: 'top 80px',
            end: 'bottom bottom',
            onUpdate: (self) => {
              progress.current = self.progress;
              const worldIndex = Math.min(4, Math.floor(self.progress * 5));
              const next = cityWorlds[worldIndex].chapter;
              if (self.isActive && worldIndex !== currentWorld.current) {
                currentWorld.current = worldIndex;
                setWorld(worldIndex);
                current.current = next;
                setChapter(next);
                setLayer(cityWorlds[worldIndex].layer);
              }
            },
          });
          gsap.to('.story-meter-fill', {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: root.current,
              start: 'top 80px',
              end: 'bottom bottom',
              scrub: 0.4,
            },
          });
        }, root);
        cleanup = () => context.revert();
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [manual, setLayer]);
  const chooseWorld = (index: number) => {
    setWorld(index);
    currentWorld.current = index;
    const next = cityWorlds[index];
    setChapter(next.chapter);
    current.current = next.chapter;
    progress.current = index / 4;
    setLayer(next.layer);
    if (!manual && root.current) {
      const top = root.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({
        top:
          top +
          (root.current.offsetHeight - window.innerHeight + 80) *
            Math.min(0.99, (index + 0.15) / 5),
        behavior: 'smooth',
      });
    }
  };
  const info = chapters[chapter];
  return (
    <section
      id="city"
      ref={root}
      className={`living-story ${manual ? 'static-story' : ''}`}
      data-story-step={chapter}
      data-environment={world}
    >
      <div className="story-sticky">
        <div className="story-copy">
          <SectionLabel number="01">THE CITY IS SPEAKING</SectionLabel>
          <span className="story-giant" aria-hidden="true">
            0{chapter + 1}
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              className="story-narrative"
              key={chapter}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -18 }}
              transition={{ ...transition, duration: reduced ? 0 : 0.35 }}
            >
              <h2>{info.title}</h2>
              <p>{info.detail}</p>
              <span className="mono">{info.note}</span>
            </motion.div>
          </AnimatePresence>
          <div className="story-chapters" aria-label="City story chapters">
            {chapters.map((c, i) => (
              <button
                key={c.layer}
                aria-pressed={i === chapter}
                onClick={() => {
                  chooseWorld([0, 1, 4][i]);
                }}
              >
                <span className="mono">0{i + 1}</span>
                {c.name}
                {i === chapter && (
                  <motion.i
                    layoutId="story-selection"
                    transition={reduced ? { duration: 0 } : spring}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="story-worlds" role="group" aria-label="Illustrative road environments">
            <span className="mono">ONE ROUTE / FIVE CONTEXTS</span>
            {cityWorlds.map((w, i) => (
              <button key={w.name} aria-pressed={world === i} onClick={() => chooseWorld(i)}>
                <span className="mono">0{i + 1}</span>
                {w.name}
              </button>
            ))}
          </div>
          <Link
            href={chapter === 2 ? '/command' : chapter === 1 ? '/command/core' : '/command/sky'}
            className="text-button amber"
          >
            {chapter === 2
              ? 'Enter AETHER command'
              : chapter === 1
                ? 'Inspect AETHER CORE'
                : 'Explore AETHER SKY'}
            <ArrowUpRight size={16} />
          </Link>
          <p className="story-disclosure">
            ILLUSTRATIVE CITY / SIMULATED STORY
            <br />
            <span>No real incident or cause is verified in this sequence.</span>
          </p>
        </div>
        <div className="story-stage" ref={stage}>
          <div className="story-meter" aria-hidden="true">
            <span className="story-meter-fill" />
          </div>
          {loaded ? (
            <CityScene
              paused={paused}
              storyProgress={manual ? undefined : progress}
              storyChapter={world}
            />
          ) : (
            <CityFallback />
          )}
          <div className="story-topline mono">
            <span>
              0{chapter + 1} / {info.name}
            </span>
            <span>ILLUSTRATIVE GEOMETRY / NOT GURUGRAM</span>
          </div>
          <div className="world-caption" aria-live="polite">
            <span className="mono">{cityWorlds[world].module} / SIMULATED</span>
            <strong>{cityWorlds[world].name}</strong>
            <p>{cityWorlds[world].detail}</p>
          </div>
          <motion.details
            open={!compact}
            className="story-intelligence"
            layout="position"
            transition={reduced ? { duration: 0 } : spring}
          >
            <summary>
              Review simulated evidence <span aria-hidden="true">+</span>
            </summary>
            <span className="eyebrow">
              {chapter === 0
                ? 'A SIGNAL IN CONTEXT'
                : chapter === 1
                  ? 'THE INCIDENT EFFECT / DEMO'
                  : 'INFORMATION → REVIEW'}
            </span>
            <strong>
              {chapter === 0
                ? 'One observation. A shared perspective.'
                : chapter === 1
                  ? world === 2
                    ? 'Water is visible. Its cause needs evidence.'
                    : world === 3
                      ? 'An obstruction. A closer investigation.'
                      : 'A slowdown is an event. Its cause is a question.'
                  : 'A wider view. A better-informed decision.'}
            </strong>
            {chapter === 1 ? (
              <dl>
                <div>
                  <dt>OBSERVED EVENT</dt>
                  <dd>
                    {world === 2
                      ? 'Illustrative surface water'
                      : world === 3
                        ? 'Illustrative road obstruction'
                        : 'Illustrative road slowdown'}
                  </dd>
                </div>
                <div>
                  <dt>AI-SUGGESTED CAUSE</dt>
                  <dd>
                    {world === 2
                      ? 'Cause and water depth not established'
                      : world === 3
                        ? 'Infrastructure review required'
                        : 'Demo obstruction hypothesis · review required'}
                  </dd>
                </div>
                <div>
                  <dt>HUMAN-VERIFIED FINDING</dt>
                  <dd>No real finding verified</dd>
                </div>
              </dl>
            ) : (
              <p>
                {chapter === 0
                  ? 'Select an observation point to inspect its source, timestamp and available evidence.'
                  : 'The shaded region is a fictional demonstration. Actual boundaries require supporting geographic evidence.'}
              </p>
            )}
          </motion.details>
          <CityControls />
          <span className="story-stage-caption mono">DRAG TO ORBIT / USE CAMERA PRESETS</span>
        </div>
      </div>
    </section>
  );
}
export function IntelligenceNetwork() {
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { amount: 0.2 });
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState('core');
  const active = modules.find((m) => m.id === selected)!;
  return (
    <section
      id="network"
      className="network-chapter section-pad"
      ref={root}
      style={{ '--flow-play': inView && !reduced ? 'running' : 'paused' } as CSSProperties}
    >
      <div className="network-heading">
        <SectionLabel number="03">THE INTELLIGENCE NETWORK</SectionLabel>
        <Reveal>
          <h2>
            CONNECTED BY DESIGN.
            <br />
            <span>UNDERSTOOD IN CONTEXT.</span>
          </h2>
        </Reveal>
        <p>
          Different lenses. The same evidence.
          <br />
          One shared understanding of the city.
        </p>
      </div>
      <div className="network-system">
        <div className="network-sources">
          <span className="eyebrow">DEMO SOURCES + DOMAIN LENSES</span>
          {modules.slice(0, 7).map((m, i) => {
            const Icon = m.icon;
            return (
              <button key={m.id} aria-pressed={selected === m.id} onClick={() => setSelected(m.id)}>
                <span className="mono">0{i + 1}</span>
                <Icon size={17} style={{ color: themeColor(m.color, theme) }} />
                <strong>{m.name}</strong>
                <small>{m.label}</small>
                <ArrowUpRight size={14} />
              </button>
            );
          })}
        </div>
        <div className="network-conduit" aria-hidden="true">
          <svg viewBox="0 0 300 420" preserveAspectRatio="none">
            {[30, 90, 150, 210, 270, 330, 390].map((y) => (
              <path key={y} d={`M0 ${y} C150 ${y} 110 210 300 210`} />
            ))}
          </svg>
        </div>
        <div className="network-hub">
          <span className="eyebrow">SHARED SPATIAL RECORDS</span>
          <div className="hub-visual">
            <div className="hub-ring" />
            <Layers3 size={45} strokeWidth={1} />
            <strong>
              DEMO
              <br />
              DATA
            </strong>
            <span className="mono">LOCATION / TIME / EVIDENCE</span>
          </div>
          <span className="data-note">Bundled observations + sensor samples</span>
        </div>
        <div className="network-destinations">
          {modules.slice(7).map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} aria-pressed={selected === m.id} onClick={() => setSelected(m.id)}>
                <Icon size={22} />
                <strong>{m.name}</strong>
                <small>
                  {m.id === 'core'
                    ? 'Deterministic, source-linked analysis'
                    : m.id === 'twin'
                      ? 'Spatial visualization'
                      : 'Operational review'}
                </small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="network-detail" aria-live="polite">
        <Cpu size={19} />
        <span className="eyebrow">AETHER {active.name}</span>
        <p>{active.description}</p>
        <Link href={moduleHref(active.id)} className="text-button amber">
          Inspect workspace <ArrowUpRight size={16} />
        </Link>
      </div>
      <p className="data-note">
        Demonstration architecture. Available device feeds are identified separately; no automated
        inference runs in this browser.
      </p>
    </section>
  );
}
export function ModuleExplorer() {
  const { theme } = useTheme();
  const [selected, setSelected] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduced = useReducedMotion();
  const source = modules[selected];
  const m = { ...source, color: themeColor(source.color, theme) };
  const select = (index: number) => {
    setDirection(index >= selected ? 1 : -1);
    setSelected((index + modules.length) % modules.length);
  };
  return (
    <section id="modules" className="module-chapter section-pad spatial-modules" data-module={m.id}>
      <div className="module-explorer-heading">
        <SectionLabel number="03">TEN PERSPECTIVES / ONE INTELLIGENCE</SectionLabel>
        <Reveal>
          <h2>
            FIND YOUR
            <br />
            <span>PERSPECTIVE.</span>
          </h2>
        </Reveal>
        <p>
          Explore the systems around a shared spatial core.
          <br />
          Each lens opens a different understanding.
        </p>
      </div>
      <Spotlight
        className="spatial-module-system"
        style={{ '--module-color': m.color } as CSSProperties}
      >
        <div className="module-universe">
          <div className="module-orbits" aria-hidden="true">
            <i />
            <i />
            <i />
            <svg viewBox="0 0 600 600">
              <path d="M300 0V600M0 300H600" />
              <circle cx="300" cy="300" r="230" />
              <circle cx="300" cy="300" r="165" />
            </svg>
          </div>
          <div className="module-select-index" aria-hidden="true">
            {String(selected + 1).padStart(2, '0')}
          </div>
          <div className="module-preview">
            <div className={`preview-aura preview-${m.id}`} aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.div
                className="module-visual-transition"
                key={m.id}
                initial={
                  reduced
                    ? false
                    : { opacity: 0, scale: 0.72, rotateY: direction * 28, x: direction * 70 }
                }
                animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
                exit={
                  reduced
                    ? undefined
                    : { opacity: 0, scale: 0.9, rotateY: -direction * 18, x: -direction * 40 }
                }
                transition={reduced ? { duration: 0 } : { ...spring, stiffness: 210, damping: 25 }}
              >
                <ModuleVisual id={m.id} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div
            className="module-rail constellation"
            role="group"
            aria-label="Choose intelligence module"
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? 9
                    : (selected + (e.key === 'ArrowRight' ? 1 : 9)) % 10;
              select(next);
              e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}
          >
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.button
                  key={mod.id}
                  className={i === selected ? 'active' : ''}
                  style={
                    {
                      '--node-x': `${50 + Math.cos(angle) * 38}%`,
                      '--node-y': `${50 + Math.sin(angle) * 40}%`,
                    } as CSSProperties
                  }
                  aria-label={`Explore AETHER ${mod.name}`}
                  aria-pressed={i === selected}
                  onClick={() => select(i)}
                  whileHover={reduced ? undefined : { scale: 1.08 }}
                  whileTap={reduced ? undefined : { scale: 0.96 }}
                >
                  <Icon size={17} />
                  <span>
                    <small className="mono">{String(i + 1).padStart(2, '0')}</small>
                    {mod.name}
                  </span>
                  {i === selected && (
                    <motion.i
                      className="constellation-selection"
                      layoutId="module-rail-indicator"
                      transition={reduced ? { duration: 0 } : spring}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
        <div className="module-editorial">
          <span className="mono module-live-label">
            <i />
            LENS {String(selected + 1).padStart(2, '0')} / CONNECTED TO SHARED DEMO RECORDS
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              className="orbit-module-copy"
              key={m.id}
              initial={reduced ? false : { opacity: 0, y: direction * 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -direction * 24 }}
              transition={reduced ? { duration: 0 } : transition}
            >
              <span className="eyebrow">{m.label}</span>
              <h3>
                AETHER <br />
                <span>{m.name}</span>
              </h3>
              <p>{m.description}</p>
              <MagneticLink href={moduleHref(m.id)} className="button outline">
                Open workspace
              </MagneticLink>
              <span className="module-specification mono">
                {m.metric.toUpperCase()} / {m.unit || 'SPATIAL CONTEXT'}
              </span>
            </motion.div>
          </AnimatePresence>
          <div className="module-direction">
            <button
              className="icon-button"
              aria-label="Previous module"
              onClick={() => select(selected - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="mono">{String(selected + 1).padStart(2, '0')} / 10</span>
            <button
              className="icon-button"
              aria-label="Next module"
              onClick={() => select(selected + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </Spotlight>
      <p className="data-note">Use arrow keys, Home / End, or the direction controls to explore.</p>
    </section>
  );
}
export function SkyChapter() {
  const root = useRef<HTMLDivElement>(null);
  const loaded = useInView(root, { once: true, margin: '150px' });
  return (
    <section id="engineering" className="sky-chapter section-pad">
      <div className="sky-heading">
        <SectionLabel number="02">AETHER SKY / THE ENGINEERING STUDIO</SectionLabel>
        <Reveal>
          <h2>
            A HIGHER
            <br />
            <span>PERSPECTIVE.</span>
          </h2>
        </Reveal>
        <p>
          Precision in every assembly.
          <br />
          Explore the conceptual aerial platform.
        </p>
      </div>
      <div ref={root}>
        {loaded ? <EngineeringExplorer cinematic /> : <LoadingPanel label="Engineering explorer" />}
      </div>
    </section>
  );
}
export function IntelligenceAction() {
  const all = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  const records = visibleObservations(all, step).filter((o) => o.severity !== 'normal');
  const [index, setIndex] = useState(0);
  const record =
    records.find((o) => o.id === selected) || records[index % Math.max(1, records.length)];
  if (!record) return null;
  return (
    <section className="action-chapter section-pad">
      <div className="action-heading">
        <SectionLabel number="05">INTELLIGENCE IN ACTION</SectionLabel>
        <Reveal>
          <h2>
            A SIGNAL.
            <br />
            <span>A PLACE. A REASON.</span>
          </h2>
        </Reveal>
        <p>
          Inspect the observation.
          <br />
          Trace it to its recorded context.
        </p>
      </div>
      <div className="action-composition">
        <div className="action-evidence">
          <EvidenceFrame observation={record} />
          <div className="action-coordinates">
            <span className="mono">
              {record.location[1].toFixed(4)}° N / {record.location[0].toFixed(4)}° E
            </span>
            <span className="tag">
              {record.dataSource === 'LIVE' ? 'REPORTED METADATA' : 'SYNTHETIC EVIDENCE'}
            </span>
          </div>
          <div className="action-location">
            <svg viewBox="0 0 460 130" aria-hidden="true">
              <path d="M0 28H460M0 85H460M80 0V130M200 0V130M340 0V130M0 0L460 130" />
              <circle
                cx={230 + record.position[0] * 6}
                cy={65 + record.position[1] * 2}
                r="8"
                fill={severityColor[record.severity]}
              />
            </svg>
            <span className="mono">
              {record.district} /{' '}
              {record.dataSource === 'LIVE' ? 'REPORTED LOCATION' : 'CONCEPTUAL LOCATION'}
            </span>
          </div>
        </div>
        <div className="action-record">
          <div className="action-record-top">
            <span className="mono">{record.id}</span>
            <span className={`severity ${record.severity}`}>{record.severity}</span>
          </div>
          <h3>{record.title}</h3>
          <p>{record.description}</p>
          <div className="action-measure">
            <strong>{record.metric}</strong>
            <span>{record.unit}</span>
          </div>
          <div className="mono action-source">
            {formatObservedAt(record.observedAt)} IST /{' '}
            {record.dataSource === 'LIVE'
              ? `${record.source} / ${record.deviceId}`
              : 'DEMO AERIAL DATASET'}
          </div>
          <button
            className="button primary"
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              select(record.id);
            }}
          >
            Inspect observation
            <ArrowUpRight size={17} />
          </button>
          <div className="action-record-selector" aria-label="Preview recorded observations">
            {records.map((o, i) => (
              <button
                key={o.id}
                aria-pressed={o.id === record.id}
                onClick={() => {
                  setIndex(i);
                  select(null);
                }}
                aria-label={`Preview ${o.title}`}
              >
                <span style={{ background: severityColor[o.severity] }} />
                {o.id.replace('NX-', '')}
              </button>
            ))}
          </div>
          <p className="data-note">
            {record.dataSource === 'LIVE'
              ? 'Device-reported observation; requires human verification.'
              : 'Simulated observations. No real incidents verified.'}
          </p>
        </div>
      </div>
    </section>
  );
}
