'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useReducedMotion } from '@/lib/motion';
import { useNexus, type CameraPreset } from '@/lib/store';
import type { Layer } from '@/lib/modules';
import { useDialogFocus } from '@/lib/hooks';
import { Logo, LoadingPanel } from './ui';
const CityScene = dynamic(() => import('./scenes/city-scene'), {
  ssr: false,
  loading: () => <LoadingPanel />,
});
const chapters: { title: string; detail: string; camera: CameraPreset; layer: Layer }[] = [
  {
    title: 'The city is alive.',
    detail:
      'A conceptual urban environment. Connected streets, structures, and green spaces form one living system.',
    camera: 'overview',
    layer: 'network',
  },
  {
    title: 'Movement becomes meaning.',
    detail:
      'AETHER FLOW reveals the rhythm of mobility. Recorded demonstration data gives every observation a place and a time.',
    camera: 'central',
    layer: 'traffic',
  },
  {
    title: 'See beneath the surface.',
    detail:
      'THERMAL and AQUA reveal the environmental pressures that shape urban life. Illuminate heat and water systems.',
    camera: 'riverfront',
    layer: 'water',
  },
  {
    title: 'Ten perspectives. One city.',
    detail:
      'From SKY to CORE, each module brings a different lens. Shared selection keeps evidence, geography, and analysis connected.',
    camera: 'park',
    layer: 'thermal',
  },
  {
    title: 'Intelligence beyond infrastructure.',
    detail:
      'Enter COMMAND to explore the time machine, source-linked insights, and engineering model. All data in this experience is simulated.',
    camera: 'overview',
    layer: 'network',
  },
];
export function Presentation({ onClose }: { onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const reduced = useReducedMotion();
  const motionEnabled = useNexus((s) => s.motion);
  const [playing, setPlaying] = useState(false);
  const close = useCallback(() => {
    useNexus.getState().setCamera('overview');
    onClose();
  }, [onClose]);
  useDialogFocus(true, root, close);
  useEffect(() => {
    const state = useNexus.getState();
    state.setCamera(chapters[chapter].camera);
    state.setLayer(chapters[chapter].layer);
  }, [chapter]);
  useEffect(() => {
    if (!playing || chapter === chapters.length - 1 || reduced || !motionEnabled) return;
    const timer = setInterval(() => {
      setChapter((c) => Math.min(c + 1, chapters.length - 1));
    }, 7000);
    return () => clearInterval(timer);
  }, [playing, chapter, reduced, motionEnabled]);
  const isPlaying = playing && chapter < chapters.length - 1;
  return (
    <div
      className="presentation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presentation-title"
      ref={root}
    >
      <div className="presentation-top">
        <Logo />
        <span className="mono">GUIDED EXPERIENCE / DEMO</span>
        <button className="icon-button" onClick={close} aria-label="Exit presentation">
          <X size={20} />
        </button>
      </div>
      <CityScene />
      <div className="presentation-copy">
        <p className="eyebrow">CHAPTER 0{chapter + 1} / 05</p>
        <h2 id="presentation-title">{chapters[chapter].title}</h2>
        <p>{chapters[chapter].detail}</p>
      </div>
      <div className="presentation-controls">
        <button
          className="icon-button"
          disabled={chapter === 0}
          onClick={() => setChapter((c) => c - 1)}
          aria-label="Previous chapter"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="button subtle"
          onClick={() => {
            if (chapter === chapters.length - 1) setChapter(0);
            setPlaying(chapter === chapters.length - 1 ? true : !playing);
          }}
          disabled={!!reduced || !motionEnabled}
          aria-label={isPlaying ? 'Pause presentation' : 'Play presentation'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="chapter-dots">
          {chapters.map((_, i) => (
            <button
              key={i}
              className={i === chapter ? 'active' : ''}
              onClick={() => setChapter(i)}
              aria-label={`Go to chapter ${i + 1}`}
              aria-pressed={chapter === i}
            />
          ))}
        </div>
        <button
          className="icon-button"
          disabled={chapter === chapters.length - 1}
          onClick={() => setChapter((c) => c + 1)}
          aria-label="Next chapter"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
