'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { ArrowUpRight, Droplets, Radar, Route } from 'lucide-react';
import { TransitionLink } from './route-transition';
import { useReducedMotion } from '@/lib/motion';
import { useNexus } from '@/lib/store';
import { SceneBoundary, WebGLGate } from './scenes/scene-boundary';

const FlightScene = dynamic(() => import('./scenes/flight-scene'), { ssr: false });

// Earshot-style opening: the drone never stops flying while the world morphs beneath it.
const worlds = [
  {
    key: 'mirage',
    tag: 'WORLD 01 · AETHER SKY',
    title: ['ABOVE', 'THE CITY'],
    copy: 'One drone, every district, a perspective that never lands. Illustrative flight — no aircraft is launched or controlled.',
    cta: 'Enter command',
    href: '/command',
    label: 'Sky',
    Icon: Radar,
  },
  {
    key: 'grid',
    tag: 'WORLD 02 · AETHER FLOW',
    title: ['READ THE', 'NEON GRID'],
    copy: 'Traffic, heat and water signals stitched into one shared picture of the city — every record labeled by its source.',
    cta: 'Open FLOW',
    href: '/command/flow',
    label: 'Flow',
    Icon: Route,
  },
  {
    key: 'coast',
    tag: 'WORLD 03 · AETHER AQUA',
    title: ['BEAT THE', 'MONSOON'],
    copy: 'Rainfall, channel level and drainage load — located, reviewed and responded to by people, not guessed.',
    cta: 'Open AQUA',
    href: '/command/aqua',
    label: 'Aqua',
    Icon: Droplets,
  },
] as const;

function Headline({ lines, reduced }: { lines: readonly string[]; reduced: boolean }) {
  let n = 0;
  return (
    <h2 className="flight-title" aria-label={lines.join(' ')}>
      {lines.map((line, l) => (
        <span className="flight-line" key={l} aria-hidden="true">
          {[...line].map((ch) => {
            const i = n++;
            return (
              <motion.span
                key={i}
                className="flight-char"
                initial={
                  reduced ? false : { y: '105%', rotateX: -70, opacity: 0, filter: 'blur(10px)' }
                }
                animate={{ y: '0%', rotateX: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={reduced ? undefined : { y: '-60%', opacity: 0, filter: 'blur(8px)' }}
                transition={{
                  duration: reduced ? 0 : 0.6,
                  delay: reduced ? 0 : i * 0.025,
                  ease: [0.2, 0.9, 0.2, 1],
                }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h2>
  );
}

export function FlightHero({ paused = false }: { paused?: boolean }) {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(section, { margin: '0px 0px -10% 0px' });
  const records = useNexus((s) => s.records);
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const raw = useTransform(scrollYProgress, [0, 1], [0, 2]);
  const world = useSpring(raw, { stiffness: 70, damping: 22, mass: 0.6 });
  const speed = useMotionValue(reduced ? 0 : 26);
  const [index, setIndex] = useState(0);
  useEffect(() => speed.set(reduced ? 0 : 26), [reduced, speed]);
  useMotionValueEvent(world, 'change', (v) => setIndex(Math.max(0, Math.min(2, Math.round(v)))));
  const progress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const go = (i: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (travel * i) / 2 + 2, behavior: reduced ? 'instant' : 'smooth' });
  };
  const current = worlds[index];
  return (
    <section
      ref={section}
      className="flight"
      data-world={current.key}
      aria-labelledby="flight-heading"
    >
      <div className="flight-stage">
        <SceneBoundary fallback={<div className="flight-poster" aria-hidden="true" />}>
          <WebGLGate fallback={<div className="flight-poster" aria-hidden="true" />}>
            <FlightScene world={world} speed={speed} active={inView && !paused} reduced={reduced} />
          </WebGLGate>
        </SceneBoundary>
        <div className="flight-shade" aria-hidden="true" />
        <div className="flight-copy">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
            >
              <p className="flight-tag mono" id="flight-heading">
                <i aria-hidden="true" /> {current.tag}
              </p>
              <Headline lines={current.title} reduced={reduced} />
              <p className="flight-body">{current.copy}</p>
              <TransitionLink href={current.href} className="flight-cta" data-tilt>
                {current.cta}
                <span aria-hidden="true">
                  <ArrowUpRight size={17} />
                </span>
              </TransitionLink>
            </motion.div>
          </AnimatePresence>
        </div>
        <nav className="flight-worlds" aria-label="Flight worlds">
          {worlds.map((w, i) => (
            <button
              key={w.key}
              className={`flight-world${i === index ? ' active' : ''}`}
              data-world={w.key}
              data-tilt
              aria-pressed={i === index}
              aria-label={`World ${i + 1}: ${w.label}`}
              onClick={() => go(i)}
            >
              <w.Icon size={20} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="flight-stat" data-tilt>
          <strong>{String(records.length).padStart(2, '0')}</strong>
          <span>
            shared observations
            <small className="mono">RECORDED DEMO DATA</small>
          </span>
        </div>
        <div className="flight-scroll mono" aria-hidden="true">
          <span>SCROLL TO FLY</span>
          <i>
            <motion.b style={{ height: progress }} />
          </i>
        </div>
        <p className="flight-disclosure mono">Illustrative 3D flight · not Gurugram geography</p>
      </div>
    </section>
  );
}
