'use client';
import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useScroll,
  useMotionValueEvent,
  useMotionValue,
} from 'motion/react';
import { TransitionLink as Link } from './route-transition';
import { ArrowUpRight, ChevronDown, Crosshair, Rotate3D, RotateCcw, ScanLine } from 'lucide-react';
import { droneParts, type DronePart } from '@/lib/drone';
import { spring, transition, useReducedMotion } from '@/lib/motion';
import { LoadingPanel } from './ui';
import { Spotlight } from './motion-ui';
const DroneScene = dynamic(() => import('./scenes/drone-scene'), {
  ssr: false,
  loading: () => <LoadingPanel label="Preparing engineering model" />,
});
const reelSteps = [
  {
    title: 'Form follows observation.',
    part: 'airframe',
    detail:
      'The project’s original Quad X concept. Four arms, one integrated observation platform.',
  },
  {
    title: 'A closer look at the assembly.',
    part: 'propulsion',
    detail:
      'Orbit the model and inspect each illustrated component. Hardware specifications remain conceptual.',
  },
  {
    title: 'From perspective to evidence.',
    part: 'camera',
    detail:
      'An illustrative sensor payload. No aircraft is launched or controlled from this website.',
  },
  {
    title: 'The observation belongs somewhere.',
    part: 'camera',
    detail:
      'Review authorized evidence on real geography. A genuine GPS trail is not currently connected.',
  },
] as const;
export function EngineeringExplorer({
  compact = false,
  cinematic = false,
}: {
  compact?: boolean;
  cinematic?: boolean;
}) {
  const [exploded, setExploded] = useState(false);
  const [part, setPart] = useState<DronePart>(cinematic ? 'airframe' : 'camera');
  const [reset, setReset] = useState(0);
  const [details, setDetails] = useState(true);
  const reduced = useReducedMotion();
  const reel = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const [automatic, setAutomatic] = useState(true);
  const [reelStep, setReelStep] = useState(0);
  const lastStep = useRef(0);
  const { scrollYProgress } = useScroll({ target: reel, offset: ['start 100px', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (!cinematic || reduced || !automatic) return;
    progress.set(value);
    const next = Math.min(3, Math.floor(value * 4));
    if (next !== lastStep.current) {
      lastStep.current = next;
      setReelStep(next);
      setPart(reelSteps[next].part);
    }
  });
  const manual = () => setAutomatic(false);
  const selectPart = (next: DronePart) => {
    manual();
    setPart(next);
  };
  const detailId = useId();
  const selectedPart = droneParts[part];
  const Heading = compact ? 'h2' : 'h3';
  return (
    <div ref={reel} className={cinematic ? `sky-reel ${reduced ? 'manual-reel' : ''}` : undefined}>
      <div className={cinematic ? 'sky-reel-content' : undefined}>
        {cinematic && (
          <div className="sky-reel-caption" data-reel-step={reelStep}>
            <div>
              <span className="mono">QUAD X / ORIGINAL PROJECT MODEL · ILLUSTRATIVE</span>
              <h3>{reelSteps[reelStep].title}</h3>
              <p>{reelSteps[reelStep].detail}</p>
            </div>
            <div className="reel-actions">
              <div role="group" aria-label="Drone showcase views">
                {reelSteps.map((s, i) => (
                  <button
                    key={s.title}
                    aria-label={`Drone view ${i + 1}: ${s.title}`}
                    aria-pressed={reelStep === i}
                    onClick={() => {
                      manual();
                      setReelStep(i);
                      lastStep.current = i;
                      setPart(s.part);
                      progress.set(i / 3);
                      setReset((v) => v + 1);
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </button>
                ))}
              </div>
              {!reduced && (
                <button
                  className="text-button"
                  aria-pressed={automatic}
                  onClick={() => {
                    progress.set(scrollYProgress.get());
                    setAutomatic(!automatic);
                    setExploded(false);
                  }}
                >
                  {' '}
                  {automatic ? 'Take manual control' : 'Resume scroll tour'}
                </button>
              )}
              <Link href="/command/geo" className="text-button">
                Open observation review <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        )}
        <div
          className={`engineering-explorer engineering-configurator ${compact ? 'compact' : ''}`}
          data-inspection={selectedPart.number}
        >
          <header className="configurator-header">
            <div>
              <span className="mono">AETHER / AERIAL SYSTEMS DIVISION</span>
              <Heading>
                X1<span>ENGINEERING CONCEPT</span>
              </Heading>
            </div>
            <div className="configurator-actions">
              <div className="assembly-switch segmented">
                {[false, true].map((value) => (
                  <motion.button
                    key={String(value)}
                    className={exploded === value ? 'active' : ''}
                    aria-pressed={exploded === value}
                    onClick={() => {
                      manual();
                      setExploded(value);
                    }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                  >
                    {value ? <ScanLine size={15} /> : <Rotate3D size={15} />}{' '}
                    {value ? 'Exploded view' : 'Assembled'}
                    {exploded === value && (
                      <motion.i
                        className="selection-surface"
                        layoutId={`assembly-${compact}`}
                        transition={reduced ? { duration: 0 } : spring}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
              <button
                className="icon-button studio-reset"
                aria-label="Reset engineering view"
                onClick={() => {
                  manual();
                  setExploded(false);
                  setPart('camera');
                  setReset((v) => v + 1);
                }}
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </header>
          <Spotlight className="engineering-stage">
            <div className="studio-word" aria-hidden="true">
              X1
            </div>
            <div className="inspection-field" aria-hidden="true">
              <svg viewBox="0 0 500 500">
                <circle cx="250" cy="250" r="206" />
                <circle cx="250" cy="250" r="170" strokeDasharray="2 12" />
                <path d="M250 0V500M0 250H500" />
              </svg>
              <motion.div
                className="inspection-orbit"
                initial={false}
                animate={{ rotate: (Number(selectedPart.number) - 1) * 72 }}
                transition={reduced ? { duration: 0 } : { ...spring, stiffness: 160, damping: 26 }}
              >
                <i />
                <i />
              </motion.div>
            </div>
            <div className="stage-topline">
              <span className="mono">
                <Crosshair size={13} />
                PRECISION / SPATIAL INSPECTION
              </span>
              <span className="tag">ILLUSTRATIVE MODEL</span>
            </div>
            <DroneScene
              exploded={exploded}
              selected={part}
              onPart={selectPart}
              reset={reset}
              sequence={cinematic && automatic && !reduced ? progress : undefined}
              onManual={manual}
            />
            <div className="studio-status mono">
              <span>INSPECTION / {selectedPart.number}</span>
              <strong>{part.toUpperCase()}</strong>
              <span>{exploded ? 'ASSEMBLIES SEPARATED' : 'ASSEMBLED PLATFORM'}</span>
            </div>
            <div className="studio-scale" aria-hidden="true">
              <span>01</span>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <span>05</span>
            </div>
            <p className="scene-instructions mono">DRAG TO ROTATE / SCROLL TO ZOOM</p>
          </Spotlight>
          <aside className="engineering-info">
            <div className="studio-info-header">
              <p className="eyebrow">ASSEMBLY INDEX</p>
              <span className="mono">05 SYSTEMS</span>
            </div>
            <h3 className="configurator-title">
              Every part.
              <br />
              <span>A purpose.</span>
            </h3>
            <div className="part-list">
              {Object.entries(droneParts).map(([id, info]) => (
                <motion.button
                  key={id}
                  className={part === id ? 'active' : ''}
                  onClick={() => selectPart(id as DronePart)}
                  aria-pressed={part === id}
                  aria-controls={detailId}
                  whileHover={reduced ? undefined : { x: 3 }}
                  whileTap={reduced ? undefined : { scale: 0.98 }}
                >
                  <span className="part-number mono">{info.number}</span>
                  <span className="part-name">{info.label}</span>
                  <ArrowUpRight size={15} />
                  {part === id && (
                    <motion.i
                      className="part-selection-field"
                      layoutId={`part-selection-${compact}`}
                      transition={reduced ? { duration: 0 } : spring}
                    />
                  )}
                </motion.button>
              ))}
            </div>
            <button
              className="specification-toggle"
              aria-expanded={details}
              aria-controls={detailId}
              onClick={() => setDetails(!details)}
            >
              <span className="mono">ASSEMBLY SPECIFICATION</span>
              <ChevronDown size={16} className={details ? 'turned' : ''} />
            </button>
            <AnimatePresence initial={false}>
              {details && (
                <motion.div
                  id={detailId}
                  className="specification-panel"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : transition}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      className="part-detail"
                      key={part}
                      aria-live="polite"
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: reduced ? 0 : 0.2 }}
                    >
                      <span className="part-detail-index" aria-hidden="true">
                        {selectedPart.number}
                      </span>
                      <p className="eyebrow">{selectedPart.specification}</p>
                      <p>{selectedPart.detail}</p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="configurator-disclosure mono">
              <span />
              VISUAL ASSEMBLY ONLY
              <br />
              NO FLIGHT CONTROL OR HARDWARE CONNECTION
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
