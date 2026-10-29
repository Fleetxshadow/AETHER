'use client';
import { TransitionLink as Link } from './route-transition';
import { ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { playCue } from '@/lib/sound';
import { BrandMark, BrandWordmark } from './brand-mark';
import { brand } from '@/lib/brand';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={`brand${compact ? ' brand-compact' : ''}`}
      href="/"
      aria-label={`${brand.platform} home`}
    >
      <BrandMark />
      {!compact && (
        <span>
          <BrandWordmark />
          <span className="brand-version">CITY</span>
        </span>
      )}
    </Link>
  );
}
export function DemoBadge({ offline = false }: { offline?: boolean }) {
  const source = useNexus((s) => s.integration);
  const label =
    source.mode === 'LIVE'
      ? 'LIVE + DEMO'
      : source.mode === 'STALE'
        ? 'STALE / DEMO'
        : source.mode === 'OFFLINE'
          ? 'OFFLINE / DEMO'
          : offline
            ? 'DEMO SERVICE OFFLINE'
            : 'DEMO SYSTEM';
  return (
    <span
      className={`demo-badge ${source.mode === 'OFFLINE' || offline ? 'offline' : ''}`}
      data-source={source.mode}
    >
      <i />
      {source.test ? 'TEST · ' : ''}
      {label}
    </span>
  );
}
export function SoundButton() {
  const sound = useNexus((s) => s.sound);
  const setSound = useNexus((s) => s.setSound);
  return (
    <button
      className="icon-button sound-button"
      aria-label={sound ? 'Mute audio' : 'Enable audio'}
      aria-pressed={sound}
      onClick={() => {
        setSound(!sound);
        if (!sound) void playCue('enter');
      }}
    >
      {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
export function CommandLink({
  className = 'button primary',
  children = 'Enter command',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href="/command" className={className} onClick={() => void playCue('enter')}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <p className="eyebrow section-label">
      <span>{number}</span>
      {children}
    </p>
  );
}
export function LoadingPanel({ label = 'Preparing workspace' }: { label?: string }) {
  return (
    <div className="panel-loading" role="status">
      <span className="loading-orbit" />
      <span className="mono">{label}</span>
    </div>
  );
}
