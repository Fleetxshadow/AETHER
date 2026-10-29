'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate, useSpring } from 'motion/react';
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  Compass,
  Crosshair,
  Menu,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { useNexus } from '@/lib/store';
import { metricsAt, severityColor, timeLabel, visibleObservations } from '@/lib/data';
import { layerLabels, type Layer } from '@/lib/modules';
import { motionTiming, spring, transition, useReducedMotion } from '@/lib/motion';
import { useDialogFocus } from '@/lib/hooks';
import { buildings } from '@/lib/city';
import { DemoBadge, Logo, SoundButton, CommandLink } from './ui';
import { MagneticLink } from './motion-ui';
import { CityFallback } from './scenes/scene-boundary';
import { ThemeButton, useTheme } from './theme-provider';
import { cityBackground } from '@/lib/themes';
import { brand } from '@/lib/brand';
import type { GenesisController } from './genesis';
const CityScene = dynamic(() => import('./scenes/city-scene'), {
  ssr: false,
  loading: () => <CityFallback poster label="Preparing the living city" />,
});
const navigation = [
  ['#city', 'Observe. Understand. Anticipate.', '01'],
  ['#engineering', 'The Quad X observation platform', '02'],
  ['#geography', 'The real geographic workspace', '03'],
  ['#network', 'Connected intelligence', '04'],
  ['#modules', 'Ten perspectives', '05'],
  ['#response', 'AETHER RESPONSE', '06'],
];
export function ExperienceNavigation() {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(open, root, close);
  return (
    <>
      <header className="experience-nav cinema-nav">
        <Logo />
        <div className="nav-center mono">
          <i />
          URBAN OBSERVATORY<span>ILLUSTRATIVE CITY / DEMO</span>
        </div>
        <div className="nav-actions">
          <ThemeButton />
          <SoundButton />
          <CommandLink className="nav-command">Enter command</CommandLink>
          <motion.button
            className="cinema-menu-button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            whileTap={reduced ? undefined : { scale: 0.94 }}
          >
            <span className="mono">EXPLORE</span>
            {open ? <X size={18} /> : <Menu size={18} />}
          </motion.button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="cinema-navigation"
            ref={root}
            role="dialog"
            aria-modal="true"
            aria-label="Explore AETHER"
            initial={reduced ? false : { clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={reduced ? undefined : { clipPath: 'inset(0 0 100% 0)' }}
            transition={reduced ? { duration: 0 } : transition}
          >
            <div className="cinema-menu-top">
              <Logo />
              <button className="icon-button" aria-label="Close navigation" onClick={close}>
                <X size={22} />
              </button>
            </div>
            <div className="menu-orbit" aria-hidden="true">
              <i />
              <i />
              <i />
              <Compass size={84} strokeWidth={0.5} />
            </div>
            <nav aria-label="Experience navigation">
              {navigation.map(([href, title, number], i) => (
                <motion.a
                  key={href}
                  href={href}
                  onClick={close}
                  initial={reduced ? false : { opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...transition,
                    duration: reduced ? 0 : motionTiming.reveal,
                    delay: reduced ? 0 : i * motionTiming.stagger + 0.12,
                  }}
                  whileHover={reduced ? undefined : { x: 14 }}
                >
                  <span className="mono">{number}</span>
                  <strong>{title}</strong>
                  <ArrowUpRight size={28} />
                </motion.a>
              ))}
            </nav>
            <div className="cinema-menu-bottom">
              <span className="mono">ONE CITY. TEN PERSPECTIVES.</span>
              <DemoBadge />
              <CommandLink>Launch the command center</CommandLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
export function CinematicHero({
  genesis,
  paused,
  onPresentation,
  onEntrance,
}: {
  genesis: GenesisController;
  paused: boolean;
  onPresentation: () => void;
  onEntrance: (phase: 'static' | 'playing' | 'complete') => void;
}) {
  const [scope, animate] = useAnimate();
  const intro = genesis.mode === 'playing' || genesis.mode === 'preparing';
  const revealHero = genesis.mode !== 'pending' && (!genesis.active || genesis.handoff);
  const tiltX = useSpring(0, spring);
  const tiltY = useSpring(0, spring);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const { theme } = useTheme();
  const day = useNexus((s) => s.day);
  const reduced = useReducedMotion();
  const records = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const layer = useNexus((s) => s.layer);
  const setLayer = useNexus((s) => s.setLayer);
  const select = useNexus((s) => s.select);
  const available = visibleObservations(records, step);
  const metrics = metricsAt(step, records);
  useEffect(() => {
    if (!revealHero) {
      onEntrance('playing');
      const playback = animate(
        '.cinema-wordmark > span, .cinema-title-line > span, .cinema-enter',
        { opacity: 0, y: 25 },
        { duration: 0 },
      );
      return () => playback.stop();
    }
    if (reduced) {
      onEntrance('static');
      const playback = animate(
        '.cinema-wordmark > span, .cinema-title-line > span, .cinema-enter',
        { y: 0, opacity: 1, scale: 1 },
        { duration: 0 },
      );
      return () => playback.stop();
    }
    const frame = requestAnimationFrame(() => {
      onEntrance('playing');
    });
    const playback = animate([
      [
        '.cinema-wordmark > span',
        { y: ['110%', '0%'], opacity: [0, 1] },
        { duration: motionTiming.entrance, delay: (i) => i * 0.06, ease: transition.ease },
      ],
      [
        '.cinema-title-line > span',
        { y: ['110%', '0%'], opacity: [0, 1] },
        {
          at: 0.24,
          duration: motionTiming.entrance,
          delay: (i) => i * 0.11,
          ease: transition.ease,
        },
      ],
      [
        '.cinema-enter',
        { opacity: [0, 1], y: [26, 0] },
        { at: 0.65, duration: 0.65, delay: (i) => i * 0.085, ease: transition.ease },
      ],
    ]);
    let current = true;
    void playback.then(() => {
      if (!current) return;
      onEntrance('complete');
    });
    return () => {
      current = false;
      cancelAnimationFrame(frame);
      playback.stop();
    };
  }, [animate, reduced, revealHero, onEntrance]);
  return (
    <section
      className="hero cinematic-hero beyond-visible-hero"
      ref={scope}
      data-layer={layer}
      data-cinematic-renderer={
        genesis.fallback ? 'poster' : genesis.preparing3D ? 'preparing' : 'realtime'
      }
      data-entrance={reduced ? 'static' : intro ? 'playing' : 'complete'}
    >
      <div className="cinema-atmosphere" aria-hidden="true" />
      <div className="cinema-edition cinema-enter">
        <span className="mono">AETHER CITY / URBAN INTELLIGENCE</span>
        <DemoBadge />
      </div>
      <div className="cinema-wordmark" aria-hidden="true">
        {'AETHER'.split('').map((letter, i) => (
          <span key={i}>{letter}</span>
        ))}
      </div>
      <motion.div
        layout={false}
        className={`city-portal ${intro && !genesis.handoff ? 'genesis-portal' : ''}`}
        style={{ backgroundColor: cityBackground(theme, day) }}
        transition={{ layout: { ...transition, duration: reduced ? 0 : motionTiming.spatial } }}
        onPointerMove={(event) => {
          if (intro || reduced || event.pointerType !== 'mouse') return;
          const box = event.currentTarget.getBoundingClientRect();
          tiltX.set((-(event.clientY - box.top - box.height / 2) / box.height) * 1.8);
          tiltY.set(((event.clientX - box.left - box.width / 2) / box.width) * 2.4);
        }}
        onPointerLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
        }}
      >
        <div className="portal-orbit" aria-hidden="true">
          <i />
          <i />
        </div>
        <motion.div
          className="portal-scene-clip"
          style={{
            rotateX: reduced || intro ? 0 : tiltX,
            rotateY: reduced || intro ? 0 : tiltY,
            transformPerspective: 1000,
          }}
        >
          <div className="hero-city">
            <CityScene
              hero
              intro={intro && !reduced}
              awakening={genesis.progress}
              paused={paused}
              onReady={genesis.ready}
            />
            {genesis.active && genesis.fallback && (
              <div className="cinematic-poster-cover">
                <CityFallback poster label="Rendered city poster · realtime opening unavailable" />
              </div>
            )}
          </div>
        </motion.div>
        <div className="portal-vignette" aria-hidden="true" />
        <div className="portal-heading mono">
          <Crosshair size={15} />
          <span>SPATIAL FIELD 01</span>
          <span>ILLUSTRATIVE CITY · NOT GURUGRAM</span>
        </div>
        <div className="portal-coordinates mono">
          SYNTHETIC GEOMETRY <i /> DEMONSTRATION
        </div>
        <span className="portal-corner a" aria-hidden="true" />
        <span className="portal-corner b" aria-hidden="true" />
      </motion.div>
      <div className="cinema-copy">
        <p className="cinema-enter mono cinema-kicker">
          <span /> {brand.tagline}
        </p>
        <h1 aria-label={brand.platform}>
          <span className="cinema-title-line">
            <span>AETHER</span>
          </span>
          <span className="cinema-title-line">
            <span className="amber">CITY</span>
          </span>
        </h1>
        <p className="cinema-enter aether-supporting-headline">{brand.supportingHeadline}</p>
        <p className="cinema-enter cinema-description">{brand.heroDescription}</p>
        <p className="cinema-enter hero-data-disclosure">
          Inspect each observation’s source. Unconnected panels retain recorded demonstration data.
        </p>
        <div className="cinema-enter cinema-actions">
          <MagneticLink href="/command">Enter AETHER command</MagneticLink>
          <a href="#city" className="cinema-scroll" aria-label="Explore the city">
            <ArrowDown size={20} />
          </a>
        </div>
        <button className="cinema-enter text-button hero-presentation" onClick={onPresentation}>
          <Play size={14} />
          Watch the guided experience<span className="mono">05 CHAPTERS</span>
        </button>
      </div>
      <div
        className="observatory-dock cinema-enter"
        role="group"
        aria-label="City intelligence dock"
      >
        <motion.aside
          className="hero-intelligence"
          layout
          transition={reduced ? { duration: 0 } : spring}
        >
          <button
            className="intelligence-trigger"
            aria-expanded={signalsOpen}
            aria-controls="hero-signal-list"
            aria-label="Show recorded city observations"
            onClick={() => setSignalsOpen(!signalsOpen)}
          >
            <span className="mono">
              <i className="tiny-status" />
              RECORDED INTELLIGENCE
            </span>
            <span className="intelligence-count">
              <strong>{String(metrics.observations).padStart(2, '0')}</strong>
              <span>
                shared observations
                <br />
                <b>{timeLabel(step)} / DEMO</b>
              </span>
              <ChevronDown size={18} className={signalsOpen ? 'turned' : ''} />
            </span>
            <svg viewBox="0 0 220 28" aria-hidden="true">
              <path d="M0 24L50 18L100 12L150 6L220 3" />
              <circle cx="150" cy="6" r="3" />
            </svg>
          </button>
          <AnimatePresence>
            {signalsOpen && (
              <motion.div
                id="hero-signal-list"
                className="hero-signal-list"
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduced ? undefined : { height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0 } : transition}
              >
                {available.map((o) => (
                  <button
                    key={o.id}
                    aria-label={`Inspect ${o.title}`}
                    onClick={(e) => {
                      e.currentTarget.focus({ preventScroll: true });
                      select(o.id);
                    }}
                  >
                    <i style={{ background: severityColor[o.severity] }} />
                    <span>
                      {o.title}
                      <small className="mono">
                        {o.id} / {o.district}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
        <div className="hero-layer-dock" aria-label="Hero intelligence layers">
          <div className="dock-label mono">
            <span>ILLUMINATE THE CITY</span>
            <span>04 LAYERS</span>
          </div>
          <div className="hero-layer-shortcuts">
            {(['network', 'traffic', 'thermal', 'water'] as Layer[]).map((id, i) => (
              <motion.button
                key={id}
                aria-pressed={layer === id}
                onClick={() => setLayer(id)}
                whileTap={reduced ? undefined : { scale: 0.97 }}
              >
                <span className="mono">0{i + 1}</span>
                {layerLabels[id]}
                {layer === id && (
                  <motion.i
                    layoutId="hero-layer-light"
                    transition={reduced ? { duration: 0 } : spring}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      <div className="cinema-footer cinema-enter">
        <div>
          <span className="mono">PERSPECTIVES</span>
          <strong>
            10<small>CONNECTED</small>
          </strong>
        </div>
        <div>
          <span className="mono">BUILT ENVIRONMENT</span>
          <strong>
            {buildings.length}
            <small>CONCEPTUAL STRUCTURES</small>
          </strong>
        </div>
        <div>
          <span className="mono">OBSERVATIONS</span>
          <strong>
            {String(metrics.observations).padStart(2, '0')}
            <small>SIMULATED DATA</small>
          </strong>
        </div>
        <div className="cinema-replay">
          <button
            className="icon-button"
            aria-label="Replay introduction"
            title={reduced ? 'Read the opening story' : 'Replay experience'}
            onClick={genesis.replay}
          >
            {intro ? <X size={16} /> : <RotateCcw size={16} />}
          </button>
          <span className="mono">
            SCROLL TO CONNECT <ArrowDown size={13} />
          </span>
        </div>
      </div>
    </section>
  );
}
