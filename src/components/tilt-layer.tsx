'use client';
import { useEffect } from 'react';
import { useReducedMotion } from '@/lib/motion';

// One delegated listener gives every tilt surface a 3D hover with a moving glare.
// Surfaces opt in with [data-tilt] or one of the shared card classes below.
const selector =
  '[data-tilt], .ops-pipeline li, .telemetry-instrument, .os-app .insight-summary, .rebirth .metric-tile';
export function TiltLayer() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let active: HTMLElement | null = null;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
      el.removeAttribute('data-tilting');
    };
    const move = (event: PointerEvent) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(selector) ?? null;
      if (active && active !== el) reset(active);
      active = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width,
        y = (event.clientY - r.top) / r.height;
      const strength = Math.min(10, 2600 / Math.max(r.width, 220));
      el.dataset.tilting = '';
      el.style.setProperty('--tilt-x', `${((0.5 - y) * strength).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${((x - 0.5) * strength).toFixed(2)}deg`);
      el.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
    };
    const leave = () => {
      if (active) reset(active);
      active = null;
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      leave();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, [reduced]);
  return null;
}
