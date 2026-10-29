'use client';
import { useSyncExternalStore } from 'react';
import { useNexus } from './store';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
// Conservative, identical server and hydration snapshots. Resolve the device only after hydration.
export function useReducedMotion() {
  const preference = useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const enabled = useNexus((s) => s.motion);
  return preference || !enabled;
}
export const transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };
export const spring = { type: 'spring' as const, stiffness: 340, damping: 32 };

export const motionTiming = {
  micro: 0.18,
  standard: 0.35,
  spatial: 0.9,
  genesis: 8,
  entrance: 0.9,
  stagger: 0.075,
  scene: 1.6,
  reveal: 0.55,
  routeCover: 0.38,
  routeReveal: 0.55,
};
