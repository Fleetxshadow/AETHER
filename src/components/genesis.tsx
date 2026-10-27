'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { genesisScenes, genesisSceneAt } from '@/lib/awakening';
import { motionTiming, transition, useReducedMotion } from '@/lib/motion';
import { useDialogFocus } from '@/lib/hooks';
import { useNexus } from '@/lib/store';
import { playCue } from '@/lib/sound';
import { BrandMark } from './brand-mark';
import Link from 'next/link';
import { IntroIgnition } from './intro-ignition';

const seenKey = 'aether-genesis-v1';
export function useGenesis() {
  const [mode, setMode] = useState<'pending' | 'idle' | 'preparing' | 'playing' | 'reading'>(
    'pending',
  );
  const [rendererAvailable, setRendererAvailable] = useState<boolean | null>(null);
  const [fallback, setFallback] = useState(false);
  const preparationStarted = useRef(0);
  const autoDecided = useRef(false);
  const [scene, setScene] = useState(0);
  const clock = useMotionValue(0);
  const progress = useRef(-1);
  const reduced = useReducedMotion();
  const ready = useCallback((available: boolean) => setRendererAvailable(available), []);
  const finish = useCallback(() => {
    autoDecided.current = true;
    try {
      localStorage.setItem(seenKey, 'seen');
    } catch {
      /* Private browsing still works. */
    }
    progress.current = -1;
    setMode('idle');
  }, []);
  const replay = useCallback(() => {
    autoDecided.current = true;
    useNexus.getState().select(null);
    // Land on the city hero (it follows the flight opening), so Genesis hands off in place.
    const hero = document.querySelector<HTMLElement>('.hero');
    window.scrollTo({
      top: hero ? hero.getBoundingClientRect().top + window.scrollY : 0,
      behavior: 'instant',
    });
    clock.set(0);
    progress.current = reduced ? -1 : 0;
    preparationStarted.current = performance.now();
    setFallback(false);
    setScene(0);
    setMode(reduced ? 'reading' : 'preparing');
  }, [clock, reduced]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (autoDecided.current) return;
      autoDecided.current = true;
      // The flight hero is now the opening; Genesis plays only on request (Replay introduction).
      setMode('idle');
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (mode !== 'preparing') return;
    if (reduced) {
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    // The first signal doubles as genuine renderer preparation. Once ready, the
    // remaining seven seconds play without shader startup skipping a scene.
    const delay = Math.max(
      0,
      (rendererAvailable === null ? 4000 : 1800) - (performance.now() - preparationStarted.current),
    );
    const timer = setTimeout(() => {
      setFallback(rendererAvailable !== true);
      progress.current = 1;
      clock.set(1);
      setScene(1);
      setMode('playing');
    }, delay);
    return () => clearTimeout(timer);
  }, [mode, rendererAvailable, reduced, finish, clock]);
  useEffect(() => {
    if (mode !== 'playing') return;
    if (reduced) {
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    let previous = -1;
    const playback = animate(1, motionTiming.genesis, {
      duration: motionTiming.genesis - 1,
      ease: 'linear',
      onUpdate: (seconds) => {
        clock.set(seconds);
        progress.current = seconds;
        const next = genesisSceneAt(seconds);
        if (next !== previous) {
          previous = next;
          setScene(next);
        }
      },
      onComplete: finish,
    });
    const visibility = () => (document.hidden ? playback.pause() : playback.play());
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      playback.stop();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mode, reduced, clock, finish]);
  const readScene = (next: number) =>
    setScene(Math.max(0, Math.min(genesisScenes.length - 1, next)));
  return {
    mode,
    scene,
    clock,
    progress,
    ready,
    fallback,
    preparing3D: mode === 'preparing' && rendererAvailable === null,
    reduced,
    finish,
    replay,
    readScene,
    active: mode === 'preparing' || mode === 'playing' || mode === 'reading',
    handoff: mode === 'playing' && scene === 6,
  };
}
export type GenesisController = ReturnType<typeof useGenesis>;

const roads = [
  'M90 200L350 200L470 340L600 340',
  'M110 550L300 550L440 340L600 340',
  'M300 90L440 90L520 240L600 340',
  'M600 60L600 190L600 260L600 340',
  'M1080 220L870 220L760 340L600 340',
  'M1100 540L900 540L760 340L600 340',
  'M800 680L800 540L680 430L600 340',
];
const emblem = [
  'M600 210L540 320L480 430L600 365',
  'M600 210L660 320L720 430L600 365',
  'M540 320L600 285L660 320L600 365',
  'M480 430L540 400L600 365L600 285',
  'M720 430L660 400L600 365L600 285',
  'M540 400L600 435L660 400L600 365',
  'M600 210L600 285L600 365L600 435',
];
function GenesisNetwork({ scene, reduced }: { scene: number; reduced: boolean }) {
  return (
    <svg className="genesis-network" viewBox="0 0 1200 800" aria-hidden="true">
      <defs>
        <radialGradient id="genesis-glow">
          <stop style={{ stopColor: 'var(--accent-ink)' }} stopOpacity=".28" />
          <stop offset="1" style={{ stopColor: 'var(--accent-ink)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="600"
        cy="340"
        r="220"
        fill="url(#genesis-glow)"
        initial={false}
        animate={{ scale: scene === 0 ? 0.12 : scene >= 5 ? 0.7 : 1, opacity: scene === 6 ? 0 : 1 }}
        transition={{ ...transition, duration: reduced ? 0 : motionTiming.spatial }}
        style={{ transformOrigin: '600px 340px' }}
      />
      {roads.map((path, i) => (
        <motion.path
          key={i}
          d={path}
          fill="none"
          style={{ stroke: scene === 3 && i === 4 ? 'var(--critical-ink)' : 'var(--accent-ink)' }}
          strokeWidth={scene >= 5 ? 2 : 1}
          initial={false}
          animate={{
            d: scene >= 5 ? emblem[i] : path,
            pathLength: scene === 0 ? 0 : 1,
            opacity: scene === 6 ? 0 : scene === 2 || scene === 3 || scene === 4 ? 0.25 : 0.75,
          }}
          transition={{
            ...transition,
            duration: reduced ? 0 : motionTiming.spatial,
            delay: reduced ? 0 : i * 0.035,
          }}
        />
      ))}
      <motion.circle
        cx="600"
        cy="340"
        r="8"
        style={{ fill: 'var(--accent-ink)', transformOrigin: '600px 340px' }}
        initial={false}
        animate={{ scale: scene === 0 ? [0, 1.3, 1] : scene >= 5 ? 0 : 0.65 }}
        transition={{ duration: reduced ? 0 : 0.8 }}
      />
      {[85, 140].map((radius, i) => (
        <motion.circle
          key={radius}
          cx="600"
          cy="340"
          r={radius}
          fill="none"
          style={{ stroke: 'var(--accent-ink)', transformOrigin: '600px 340px' }}
          strokeWidth=".7"
          initial={false}
          animate={{
            scale: scene === 0 ? 0.15 : scene === 1 ? 1 + i * 0.3 : 1.6,
            opacity: scene > 1 ? 0 : 0.5,
          }}
          transition={{ ...transition, duration: reduced ? 0 : 1 }}
        />
      ))}
    </svg>
  );
}
function KineticTitle({ text, reduced, hero }: { text: string; reduced: boolean; hero: boolean }) {
  let index = 0;
  return (
    <h2 aria-label={text} className={hero ? 'kinetic-title is-hero' : 'kinetic-title'}>
      {text.split(' ').map((word, w) => (
        <span className="kt-word" aria-hidden="true" key={w}>
          {[...word].map((char) => {
            const i = index++;
            return (
              <motion.span
                key={i}
                className="kt-char"
                initial={reduced ? false : { opacity: 0, y: '70%', filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: '0%', filter: 'blur(0px)' }}
                transition={{
                  duration: reduced ? 0 : hero ? 0.9 : 0.55,
                  delay: reduced ? 0 : i * (hero ? 0.07 : 0.022),
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              >
                {char}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h2>
  );
}
export function GenesisOverlay({ controller }: { controller: GenesisController }) {
  const { mode, scene, active, clock, reduced, finish, readScene } = controller;
  const root = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const sound = useNexus((s) => s.sound);
  useDialogFocus(active, root, finish);
  const shade = useTransform(
    clock,
    [0, 1, 2.2, 3.7, 6.1, 7, 8],
    [0.12, 0.08, 0.05, 0.08, 0.12, 0.08, 0],
  );
  const opacity = useTransform(clock, [0, 7, 8], [1, 1, 0]);
  const timecode = useTransform(clock, (v) => `T+00:0${Math.min(9.99, v).toFixed(2)}`);
  const cinematic = mode === 'preparing' || mode === 'playing';
  useEffect(() => {
    if (!active || mode !== 'playing' || !armed || !sound) return;
    void playCue(scene === 3 ? 'anomaly' : scene >= 5 ? 'reveal' : 'signal');
  }, [scene, active, mode, armed, sound]);
  const info = genesisScenes[scene];
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="genesis"
          ref={root}
          role="dialog"
          aria-modal="true"
          aria-label="AETHER Genesis experience"
          aria-describedby="genesis-disclosure"
          data-genesis-scene={scene}
          data-playback={mode}
          style={mode === 'reading' ? undefined : { opacity }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : motionTiming.micro }}
        >
          <motion.div
            className="genesis-shade"
            style={{ opacity: mode === 'reading' ? 1 : shade }}
          />
          {cinematic && scene <= 1 && <IntroIgnition exiting={mode === 'playing'} />}
          {cinematic && (
            <>
              <i className="genesis-letterbox top" aria-hidden="true" />
              <i className="genesis-letterbox bottom" aria-hidden="true" />
              <i className="genesis-grain" aria-hidden="true" />
              <i className="genesis-scanline" aria-hidden="true" />
              <div className="genesis-hud mono" aria-hidden="true">
                <span>
                  <b>REC</b> AETHER CORE / IGNITION
                </span>
                <motion.span>{timecode}</motion.span>
                <span>ILLUSTRATIVE CITY · 24 FPS</span>
              </div>
            </>
          )}
          <div className="genesis-top">
            <div className="genesis-edition">
              <BrandMark />
              <span className="mono">
                AETHER CITY
                <br />
                <b>BEYOND THE VISIBLE / V9</b>
              </span>
            </div>
            <div className="genesis-actions">
              <button className="genesis-skip" onClick={finish}>
                Skip Intro <X size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={armed && sound ? 'Mute cinematic sound' : 'Enable cinematic sound'}
                aria-pressed={armed && sound}
                onClick={() => {
                  const next = !(armed && sound);
                  setArmed(next);
                  useNexus.getState().setSound(next);
                  if (next) void playCue('signal');
                }}
              >
                {armed && sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <Link href="/command" onClick={finish}>
                Enter command <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          {mode === 'reading' && <GenesisNetwork scene={scene} reduced={reduced} />}
          {scene === 5 && (
            <motion.div
              className="genesis-official-mark"
              initial={reduced ? false : { clipPath: 'inset(100% 0 0 0)' }}
              animate={{ clipPath: 'inset(0% 0 0 0)' }}
              transition={{ ...transition, duration: reduced ? 0 : 0.7 }}
            >
              <BrandMark />
            </motion.div>
          )}
          <div className="genesis-story">
            <AnimatePresence mode="wait">
              <motion.div
                key={scene}
                initial={reduced ? false : { y: 22, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: -16, opacity: 0 }}
                transition={{ ...transition, duration: reduced ? 0 : 0.2 }}
              >
                <span className="eyebrow">
                  0{scene + 1} / {info.name}
                </span>
                <KineticTitle text={info.title} reduced={reduced} hero={scene === 5} />
                <p>{info.detail}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <aside className="genesis-context">
            <span className="mono">{info.module}</span>
            <div className="genesis-context-line" />
            {controller.preparing3D ? (
              <>
                <strong>ESTABLISHING CITY RENDERER</strong>
                <p role="status">
                  Preparing the 3D scene.
                  <br />
                  Skip or enter COMMAND at any time.
                </p>
              </>
            ) : scene === 3 ? (
              <>
                <strong>ANOMALY DETECTED</strong>
                <p>
                  Illustrative traffic disruption.
                  <br />
                  Cause not established.
                </p>
              </>
            ) : scene === 4 ? (
              <>
                <strong>EVIDENCE REVIEW REQUIRED</strong>
                <p>Observation, hypothesis and human verification remain distinct.</p>
              </>
            ) : (
              <>
                <strong>OBSERVE. UNDERSTAND. ANTICIPATE.</strong>
                <p>
                  A connected perspective.
                  <br />A human decision.
                </p>
              </>
            )}
          </aside>
          <div className="genesis-bottom">
            <p id="genesis-disclosure">
              ILLUSTRATIVE CITY · SIMULATED INCIDENT
              <br />
              <span>Not Gurugram geography. No aircraft is launched or controlled.</span>
            </p>
            {mode === 'reading' ? (
              <div className="genesis-read-controls">
                <button
                  aria-label="Previous opening scene"
                  disabled={scene === 0}
                  onClick={() => readScene(scene - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>{scene + 1} / 7</span>
                <button
                  aria-label={scene === 6 ? 'Finish opening story' : 'Next opening scene'}
                  onClick={() => (scene === 6 ? finish() : readScene(scene + 1))}
                >
                  {scene === 6 ? <ArrowRight size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>
            ) : (
              <div className="genesis-scene-track" aria-label="Opening story scenes">
                {genesisScenes.map((s, i) => (
                  <span key={s.name} className={i <= scene ? 'is-active' : ''} />
                ))}
                <span className="mono">0{scene + 1} / 07</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
