'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { transition, useReducedMotion } from '@/lib/motion';
import { moduleById, moduleHref } from '@/lib/modules';
import { observationStatus, formatObservedAt, type Observation } from '@/lib/data';
import { DetectionReplay, EvidenceFrame } from './replay';
import { readingTime } from '@/lib/data/hooks';
export function ObservationDetail({ observation }: { observation: Observation }) {
  const select = useNexus((s) => s.select);
  const step = useNexus((s) => s.timeStep);
  const [replay, setReplay] = useState(false);
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal=true]')) select(null);
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [select]);
  return (
    <motion.aside
      className="observation-detail cinematic-detail"
      ref={root}
      initial={reduced ? false : { opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? undefined : { opacity: 0, x: 32 }}
      transition={{ ...transition, duration: reduced ? 0 : 0.45 }}
      aria-labelledby="observation-title"
    >
      <div className="detail-top">
        <span className="eyebrow">OBSERVATION / {observation.id}</span>
        <button
          className="icon-button"
          onClick={() => select(null)}
          aria-label="Close observation details"
        >
          <X size={17} />
        </button>
      </div>
      <span className={`severity ${observation.severity}`}>
        {observation.severity} · {observationStatus(observation, step)}
      </span>
      <h3 id="observation-title">{observation.title}</h3>
      <p className="detail-location">
        {observation.district}
        <span className="mono">
          {observation.location[1].toFixed(4)}° N / {observation.location[0].toFixed(4)}° E
        </span>
      </p>
      <div className="detail-evidence-preview">
        <EvidenceFrame observation={observation} />
        <span className="mono">
          {observation.dataSource === 'LIVE'
            ? 'REPORTED METADATA / NO CAPTURE ATTACHED'
            : 'RECORDED CONTEXT / SYNTHETIC EVIDENCE'}
        </span>
      </div>
      <div className="observation-measure">
        <strong>{observation.metric}</strong>
        <span>{observation.unit}</span>
        <small>{moduleById[observation.module].metric}</small>
      </div>
      <p className="detail-description">{observation.description}</p>
      <dl className="detail-metadata">
        <div>
          <dt>Confidence</dt>
          <dd>
            {observation.confidence}%{' '}
            <span>{observation.dataSource === 'LIVE' ? 'reported, unverified' : 'simulated'}</span>
          </dd>
        </div>
        <div>
          <dt>Observed at</dt>
          <dd>
            {observation.dataSource === 'LIVE'
              ? readingTime(observation.observedAt)
              : `${formatObservedAt(observation.observedAt)} IST`}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {observation.dataSource === 'LIVE'
              ? `LIVE · ${observation.source} · ${observation.deviceId}`
              : 'Demo aerial dataset'}
          </dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{observation.evidence}</dd>
        </div>
      </dl>
      <button className="button outline" onClick={() => setReplay(!replay)} aria-expanded={replay}>
        {replay ? 'Close recording' : 'Review detection replay'}
        <ArrowRight size={16} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: replay ? 'auto' : 0, opacity: replay ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : transition}
        className="detail-replay-expansion"
      >
        {replay && <DetectionReplay key={observation.id} observation={observation} />}
      </motion.div>
      <Link href={moduleHref(observation.module)} className="text-button amber">
        Open AETHER {moduleById[observation.module].name}
        <ArrowUpRight size={15} />
      </Link>
      <p className="data-note">
        {observation.dataSource === 'LIVE'
          ? 'Device-reported observation. Human verification required.'
          : 'Simulated observation. No real incident verified.'}
      </p>
    </motion.aside>
  );
}
