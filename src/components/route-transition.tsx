'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useAnimate } from 'motion/react';
import { motionTiming, useReducedMotion, transition } from '@/lib/motion';

const NavigationContext = createContext<(href: string) => void>(() => {});
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();
  const [active, setActive] = useState(false);
  const [destination, setDestination] = useState('COMMAND');
  const [navigationScope, setNavigationScope] = useState('experience');
  const pending = useRef<string | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = async (href: string) => {
    if (pending.current || href === pathname) return;
    pending.current = href;
    const operational = pathname !== '/' && href !== '/';
    setNavigationScope(operational ? 'workspace' : 'experience');
    setDestination(
      href === '/' ? 'OBSERVATORY' : href.split('/').at(-1)?.toUpperCase() || 'COMMAND',
    );
    setActive(true);
    fallback.current = setTimeout(() => {
      pending.current = null;
      setActive(false);
      void animate('.route-shutter', { scaleY: 0 }, { duration: 0 });
    }, 8000);
    if (operational) {
      router.push(href);
      return;
    }
    await animate(
      '.route-shutter',
      { scaleY: 1 },
      { ...transition, duration: motionTiming.routeCover, delay: (i) => i * 0.045 },
    );
    if (pending.current === href) router.push(href);
  };
  useEffect(() => {
    if (!pending.current || pending.current.split('?')[0] !== pathname) return;
    pending.current = null;
    if (fallback.current) clearTimeout(fallback.current);
    let cancelled = false;
    void animate(
      '.route-shutter',
      { scaleY: 0 },
      { ...transition, duration: reduced ? 0 : motionTiming.routeReveal, delay: (i) => i * 0.035 },
    ).then(() => {
      if (cancelled) return;
      setActive(false);
      const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1')).find(
        (element) => element.getClientRects().length > 0 && !element.closest('[inert]'),
      );
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, reduced, animate]);
  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );
  return (
    <NavigationContext.Provider value={navigate}>
      {children}
      <div
        ref={scope}
        className={`route-transition ${active ? 'active' : ''}`}
        aria-hidden={!active}
        data-transition={active ? 'travelling' : 'idle'}
        data-navigation-scope={navigationScope}
      >
        <div className="route-shutter" />
        <svg className="route-spatial-motif" viewBox="0 0 600 400" aria-hidden="true">
          <path d="M20 300H190L300 200L410 100H580M20 100H190L300 200L410 300H580M300 20V380" />
          <circle cx="300" cy="200" r="60" />
          <circle cx="300" cy="200" r="8" />
        </svg>
        <div className="route-shutter" />
        <div className="route-shutter" />
        <div className="route-ident" role="status">
          <span className="mono">AETHER / SHARED SPATIAL CONTEXT</span>
          <strong>{destination}</strong>
          <span className="mono">GEOGRAPHY / EVIDENCE / HUMAN REVIEW</span>
        </div>
      </div>
    </NavigationContext.Provider>
  );
}
export function TransitionLink({ href, onNavigate, ...props }: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationContext);
  const reduced = useReducedMotion();
  const pathname = usePathname();
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (
          reduced ||
          typeof href !== 'string' ||
          !href.startsWith('/') ||
          href === pathname ||
          href.includes('#') ||
          href.includes('?')
        )
          return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}
