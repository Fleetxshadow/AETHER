'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Volume2, VolumeX, X } from 'lucide-react';
import timeline from '@/lib/intro-timeline.json';
import { brand } from '@/lib/brand';
import { useNexus } from '@/lib/store';
import { useDialogFocus } from '@/lib/hooks';
import { introDecision, introSeenKey, introSoundKey } from '@/lib/intro-gate';
import {
  introAudioTime,
  loadIntroAudio,
  setIntroAudioAudible,
  startIntroAudio,
  stopIntroAudio,
  suspendIntroAudio,
} from '@/lib/intro-audio';
import { audioContext } from '@/lib/sound';
import { BrandMark, BrandWordmark } from './brand-mark';
import { loadIntroModels, releaseIntroModels, type IntroModels } from './scenes/intro-assets';
import type { IntroLabels } from './scenes/intro-scene';

const IntroScene = dynamic(() => import('./scenes/intro-scene'), { ssr: false });

// AETHER intro film: a Blender-built 3D city and drone, played in real time with an original
// soundtrack. Shown once per visitor (replayable), always skippable, never blocks the site.
const cue = timeline.cues;
const chapters = [
  { at: 0, label: 'System awakening' },
  { at: cue.crane, label: 'The city' },
  { at: cue.liftoff - 0.8, label: 'Launch' },
  { at: cue.scan - 0.5, label: 'Urban intelligence' },
  { at: cue.logo - 0.5, label: 'AETHER' },
];
const chapterAt = (t: number) => Math.max(0, chapters.filter((c) => t >= c.at).length - 1);
const preparationTimeout = 12000;

type Phase = 'gate' | 'playing' | 'leaving' | 'off';

export function useAetherIntro() {
  // Server and first client render agree on 'gate'; CSS keyed on html[data-intro] decides
  // visibility until the effect below settles the phase.
  const [phase, setPhase] = useState<Phase>('gate');
  const [decided, setDecided] = useState(false);
  useEffect(() => {
    try {
      localStorage.removeItem(introSeenKey);
    } catch {
      /* Storage unavailable */
    }
    const decision = introDecision();
    document.documentElement.dataset.intro = decision;
    const frame = requestAnimationFrame(() => {
      setPhase(decision === 'fresh' ? 'gate' : 'off');
      setDecided(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const finish = useCallback(() => {
    try {
      localStorage.removeItem(introSeenKey);
    } catch {
      /* Storage unavailable */
    }
    document.documentElement.dataset.intro = 'seen';
    setPhase('off');
  }, []);
  const replay = useCallback(() => {
    document.documentElement.dataset.intro = 'fresh';
    window.scrollTo({ top: 0, behavior: 'instant' });
    setPhase('gate');
  }, []);
  return { phase, setPhase, decided, finish, replay, active: decided && phase !== 'off' };
}
export type AetherIntroController = ReturnType<typeof useAetherIntro>;

function readSoundPreference() {
  try {
    return localStorage.getItem(introSoundKey) !== 'off';
  } catch {
    return true;
  }
}

export function AetherIntro({ controller }: { controller: AetherIntroController }) {
  if (controller.phase === 'off') return null;
  return <IntroFilm controller={controller} />;
}

function IntroFilm({ controller }: { controller: AetherIntroController }) {
  const { phase, setPhase, decided, finish, active } = controller;
  const quality = useNexus((s) => s.quality);
  const motionSetting = useNexus((s) => s.motion);
  const root = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const labels = useRef<IntroLabels>({ incident: null, route: null });
  const progressBar = useRef<HTMLElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<'3d' | 'poster' | null>(null);
  const [models, setModels] = useState<IntroModels | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [audio, setAudio] = useState<AudioBuffer | null | 'failed'>(null);
  const [loaded, setLoaded] = useState({ models: 0, audio: 0 });
  const [waiting, setWaiting] = useState(false);
  const [sound, setSound] = useState(true);
  const [chapter, setChapter] = useState(0);
  const [beat, setBeat] = useState({ wordmark: false, reveal: false, tagline: false });
  const [reducedAtStart, setReducedAtStart] = useState(false);
  const still = reducedAtStart || !motionSetting;

  const leave = useCallback(
    (fade: number) => {
      stopIntroAudio(fade);
      setPhase('leaving');
      window.setTimeout(finish, fade * 1000);
    },
    [finish, setPhase],
  );
  const skip = useCallback(() => leave(0.45), [leave]);
  useDialogFocus(active, root, skip);
  useEffect(() => {
    // Runs after the dialog's own focus: start on the primary action, not on Skip.
    if (active && phase === 'gate') enterButton.current?.focus({ preventScroll: true });
  }, [active, phase]);

  // Decide 3D vs poster, then preload models + soundtrack with real byte progress.
  useEffect(() => {
    if (!decided) return;
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || !useNexus.getState().motion;
    let webgl = false;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      webgl = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webgl = false;
    }
    const posterOnly = !webgl || reduced || useNexus.getState().quality === 'off';
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      setSound(readSoundPreference());
      setReducedAtStart(reduced);
      setMode(posterOnly ? 'poster' : '3d');
    });
    if (!posterOnly)
      loadIntroModels((f) => setLoaded((l) => ({ ...l, models: f })))
        .then((m) => !cancelled && setModels(m))
        .catch(() => !cancelled && setMode('poster'));
    loadIntroAudio((f) => setLoaded((l) => ({ ...l, audio: f })))
      .then((buffer) => !cancelled && setAudio(buffer))
      .catch(() => !cancelled && setAudio('failed'));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [decided]);
  useEffect(
    () => () => {
      stopIntroAudio(0.3);
      releaseIntroModels();
    },
    [],
  );

  const audioSettled = audio !== null;
  const ready = audioSettled && (mode === 'poster' || (mode === '3d' && sceneReady));
  const percent = Math.round(
    100 * (mode === 'poster' ? loaded.audio : loaded.models * 0.72 + loaded.audio * 0.28),
  );

  const begin = useCallback(() => {
    setWaiting(false);
    clock.current = 0;
    if (audio && audio !== 'failed') void startIntroAudio(audio, 0, sound);
    setPhase('playing');
  }, [audio, sound, setPhase]);

  const enter = () => {
    // The click is the user gesture that unlocks audio, even if loading is still finishing.
    try {
      void audioContext().resume();
    } catch {
      /* Audio unsupported: the film plays silently. */
    }
    if (ready) begin();
    else setWaiting(true);
  };
  useEffect(() => {
    if (!waiting || !ready) return;
    const frame = requestAnimationFrame(begin);
    return () => cancelAnimationFrame(frame);
  }, [waiting, ready, begin]);
  useEffect(() => {
    if (!waiting) return;
    // Never trap a visitor behind a slow connection or GPU: fall back to the Blender still.
    const timer = window.setTimeout(() => {
      setMode('poster');
      setAudio((a) => a ?? 'failed');
    }, preparationTimeout);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  // Master clock: the soundtrack when it plays (keeps picture and sound locked), else wall time.
  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    let last = performance.now();
    let wall = clock.current;
    let hidden = document.hidden;
    const tick = (now: number) => {
      if (!hidden) wall += (now - last) / 1000;
      last = now;
      const heard = introAudioTime();
      const t = heard ?? wall;
      clock.current = Math.max(0, t);
      if (progressBar.current)
        progressBar.current.style.transform = `scaleX(${Math.min(1, t / timeline.duration)})`;
      setChapter(chapterAt(t));
      setBeat((b) => {
        const next = {
          wordmark: t > 0.5 && t < cue.crane - 0.2,
          reveal: t >= cue.logo,
          tagline: t >= cue.tagline,
        };
        return b.wordmark === next.wordmark &&
          b.reveal === next.reveal &&
          b.tagline === next.tagline
          ? b
          : next;
      });
      if (t >= cue.handoff) {
        leave(1.1);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      hidden = document.hidden;
      suspendIntroAudio(hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [phase, leave]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setIntroAudioAudible(next);
    try {
      localStorage.setItem(introSoundKey, next ? 'on' : 'off');
    } catch {
      /* Preference simply isn't remembered. */
    }
  };
  const soundUnavailable = audio === 'failed';
  const playing = phase === 'playing' || phase === 'leaving';

  return (
    <div
      ref={root}
      className="aether-intro"
      role="dialog"
      aria-modal="true"
      aria-label="AETHER introduction film"
      aria-describedby="aether-intro-disclosure"
      data-phase={phase}
      data-mode={mode ?? 'pending'}
      data-still={still}
      data-chapter={chapter}
    >
      <div className="aether-intro-stage" aria-hidden="true">
        <div className="aether-intro-poster" />
        {mode === '3d' && models && (
          <IntroScene
            models={models}
            clock={clock}
            labels={labels}
            playing={phase === 'playing'}
            quality={quality === 'off' ? 'low' : quality}
            onReady={() => setSceneReady(true)}
            onFailure={() => setMode('poster')}
          />
        )}
        <div className="aether-intro-vignette" />
        <i className="aether-intro-letterbox top" />
        <i className="aether-intro-letterbox bottom" />
        <span
          className="aether-intro-tag incident"
          ref={(el) => void (labels.current.incident = el)}
        >
          <b>Simulated disruption</b>
          <small>Illustrative · not a live incident</small>
        </span>
        <span className="aether-intro-tag route" ref={(el) => void (labels.current.route = el)}>
          <b>Alternative route</b>
          <small>Illustrative</small>
        </span>
      </div>

      <header className="aether-intro-top">
        <span className="aether-intro-edition mono">
          <BrandMark />
          AETHER CITY
          {playing && (
            <em>
              0{chapter + 1} / {chapters[chapter].label}
            </em>
          )}
        </span>
        <div className="aether-intro-actions">
          {playing && (
            <button
              className="aether-intro-icon"
              aria-label={sound ? 'Mute intro sound' : 'Unmute intro sound'}
              aria-pressed={sound}
              disabled={soundUnavailable}
              title={soundUnavailable ? 'Sound unavailable' : undefined}
              onClick={toggleSound}
            >
              {sound && !soundUnavailable ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
          <button className="aether-intro-skip" onClick={skip}>
            Skip intro <X size={16} />
          </button>
        </div>
      </header>

      {phase === 'gate' && (
        <section className="aether-intro-gate">
          <span className="mono">AETHER · Aerial urban intelligence</span>
          <h1 aria-label={brand.name}>
            <BrandWordmark />
          </h1>
          <p>{brand.fullForm}</p>
          <div className="aether-intro-launch">
            <button
              ref={enterButton}
              className="aether-intro-enter"
              onClick={enter}
              aria-busy={waiting}
            >
              {waiting ? 'Preparing the city…' : 'Enter AETHER'}
              <ArrowRight size={18} />
            </button>
            <button
              className="aether-intro-sound"
              aria-pressed={sound}
              disabled={soundUnavailable}
              onClick={() => {
                const next = !sound;
                setSound(next);
                try {
                  localStorage.setItem(introSoundKey, next ? 'on' : 'off');
                } catch {
                  /* not remembered */
                }
              }}
            >
              {sound && !soundUnavailable ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundUnavailable ? 'Sound unavailable' : sound ? 'Sound on' : 'Sound off'}
            </button>
          </div>
          <div className="aether-intro-loading mono" role="status">
            <i>
              <b style={{ width: `${ready ? 100 : percent}%` }} />
            </i>
            <span>
              {mode === null
                ? 'Checking your device'
                : ready
                  ? mode === '3d'
                    ? 'Real-time 3D city ready · 17 s film'
                    : still
                      ? 'Reduced motion · still-frame film'
                      : '3D unavailable · still-frame film'
                  : mode === '3d' && percent >= 100
                    ? 'Compiling the 3D city'
                    : `Loading ${percent}%`}
            </span>
          </div>
        </section>
      )}

      {playing && (
        <>
          <div className="aether-intro-wordmark" data-visible={beat.wordmark} aria-hidden="true">
            <BrandWordmark />
            <span className="mono">System online</span>
          </div>
          <div className="aether-intro-reveal" data-visible={beat.reveal}>
            <BrandWordmark />
            <p data-visible={beat.tagline}>See the city beyond the traffic.</p>
          </div>
          <span className="sr-only" aria-live="polite">
            {chapters[chapter].label}
          </span>
        </>
      )}

      <footer className="aether-intro-bottom">
        <p id="aether-intro-disclosure" className="mono">
          Illustrative 3D film · city inspired by Gurugram, not a geographic model · simulated
          incident · conceptual drone design
        </p>
        {playing && (
          <i className="aether-intro-progress" aria-hidden="true">
            <b ref={progressBar} />
          </i>
        )}
      </footer>
    </div>
  );
}
