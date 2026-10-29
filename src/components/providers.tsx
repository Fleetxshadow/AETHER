'use client';
import { useEffect, useLayoutEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useReducedMotion } from '@/lib/motion';
import { useNexus } from '@/lib/store';
import { RouteTransition } from './route-transition';
import { ThemeProvider } from './theme-provider';
import type { ThemeId } from '@/lib/themes';
import { DataBridge } from './data-bridge';
import { TiltLayer } from './tilt-layer';
export function Providers({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeId;
}) {
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    // Synchronous localStorage hydration must precede passive data/workspace effects,
    // whose store updates would otherwise persist defaults over saved preferences.
    void useNexus.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'off' : 'on';
  }, [reduced]);
  // Components own reduced-motion choices. Motion's environment-dependent SSR styles are disabled.
  return (
    <MotionConfig reducedMotion="never" transition={{ duration: reduced ? 0 : 0.35 }}>
      <ThemeProvider initialTheme={initialTheme}>
        <DataBridge />
        <TiltLayer />
        <RouteTransition>{children}</RouteTransition>
      </ThemeProvider>
    </MotionConfig>
  );
}
