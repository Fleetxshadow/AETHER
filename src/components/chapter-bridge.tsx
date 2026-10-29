'use client';
import { useEffect, useRef } from 'react';
import { useInView } from 'motion/react';
import { useReducedMotion } from '@/lib/motion';
export function ChapterBridge({ number, title }: { number: string; title: string }) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useInView(root, { once: true, margin: '150px' });
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !entered) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: root.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.65,
            },
          });
          timeline.fromTo(
            '.bridge-title',
            { x: -60, rotate: -2 },
            { x: 60, rotate: 2, ease: 'none' },
            0,
          );
          timeline.fromTo('.bridge-line', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);
        }, root);
        cleanup = () => context.revert();
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reduced, entered]);
  return (
    <div className="chapter-bridge" ref={root}>
      <span className="bridge-number mono">ATH / {number}</span>
      <p className="bridge-title">{title}</p>
      <span className="bridge-line" aria-hidden="true" />
      <span className="mono bridge-note">NEW PERSPECTIVE / SAME CITY</span>
    </div>
  );
}
