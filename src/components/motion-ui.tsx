'use client';
import { TransitionLink as Link } from './route-transition';
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { animate, motion, useInView, useMotionValue, useSpring } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { spring, transition, useReducedMotion } from '@/lib/motion';
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entered = useInView(ref, { once: true, amount: 0.15 });
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  useEffect(() => {
    if (reduced) {
      y.set(0);
      opacity.set(1);
      return;
    }
    if (!entered) {
      y.set(32);
      opacity.set(0);
      return;
    }
    const a = animate(y, 0, { ...transition, delay });
    const b = animate(opacity, 1, { ...transition, delay });
    return () => {
      a.stop();
      b.stop();
    };
  }, [entered, reduced, delay, y, opacity]);
  return (
    <motion.div ref={ref} className={className} style={{ y, opacity }}>
      {children}
    </motion.div>
  );
}
export function MagneticLink({
  href,
  children,
  className = 'button primary',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const x = useSpring(0, spring);
  const y = useSpring(0, spring);
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="magnetic-wrap"
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== 'mouse' || !window.matchMedia('(pointer: fine)').matches)
          return;
        const bounds = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - bounds.left - bounds.width / 2) * 0.13);
        y.set((e.clientY - bounds.top - bounds.height / 2) * 0.16);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
    >
      <Link href={href} className={className}>
        {children}
        <ArrowUpRight size={18} />
      </Link>
    </motion.span>
  );
}
export function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const entered = useInView(ref, { once: true });
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (!entered || reduced || !ref.current) return;
    const playback = animate(from, value, {
      duration: 0.6,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals);
      },
    });
    return () => playback.stop();
  }, [value, decimals, reduced, entered]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}
export function Spotlight({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={`spotlight ${className}`}
      style={style}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== 'mouse') return;
        const box = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--pointer-x', `${e.clientX - box.left}px`);
        e.currentTarget.style.setProperty('--pointer-y', `${e.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}
