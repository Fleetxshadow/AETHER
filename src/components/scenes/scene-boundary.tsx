'use client';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { Box, ArrowUpRight } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { buildings } from '@/lib/city';

export function CityFallback({
  label = 'Conceptual city · simplified view',
  poster = false,
}: {
  label?: string;
  poster?: boolean;
}) {
  const selectBuilding = useNexus((s) => s.selectBuilding);
  return (
    <div className={`city-fallback ${poster ? 'cinematic-fallback' : ''}`}>
      <svg viewBox="0 0 650 480" role="img" aria-label="Simplified conceptual city plan">
        <defs>
          <pattern id="plan-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#30332f" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="650" height="480" fill="url(#plan-grid)" />
        <g transform="translate(320 245) rotate(-25) scale(0.83 0.55)">
          {buildings.map((b) => (
            <rect
              key={b.id}
              x={b.x * 11}
              y={b.z * 11}
              width={b.w * 10}
              height={b.d * 10}
              fill={b.h > 9 ? '#bc9764' : '#444a46'}
              stroke="#9ca49b"
              strokeWidth="0.7"
            />
          ))}
          <path d="M-230 -210 Q-90 0 -240 210" stroke="#7f9292" strokeWidth="25" fill="none" />
          <circle r="160" fill="none" stroke="#ffb347" strokeDasharray="5 8" />
        </g>
      </svg>
      <div className="fallback-note">
        <Box size={16} />
        <span>{label}</span>
        <button className="text-button" onClick={() => selectBuilding('Central Exchange 86')}>
          Inspect landmark <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
export class SceneBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? this.props.fallback || <CityFallback label="3D unavailable · accessible city plan" />
      : this.props.children;
  }
}
export function WebGLGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const quality = useNexus((s) => s.quality);
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let available = false;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      available = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      available = false;
    }
    const frame = requestAnimationFrame(() => setSupported(available));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (quality === 'off' || supported === false)
    return (
      fallback || (
        <CityFallback
          label={
            quality === 'off'
              ? '3D disabled · simplified city plan'
              : 'WebGL unavailable · simplified city plan'
          }
        />
      )
    );
  if (supported === null) return <CityFallback label="Establishing city renderer" />;
  return <SceneBoundary fallback={fallback}>{children}</SceneBoundary>;
}
