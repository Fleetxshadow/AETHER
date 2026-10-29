'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { conversationConclusion, demoConversation } from '@/lib/demo-conversation';
import { useReducedMotion } from '@/lib/motion';
export function DemoConversation({
  active,
  saved,
  failed,
}: {
  active: boolean;
  saved: boolean;
  failed: boolean;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(4);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !active || shown >= 4) return;
    const timer = setTimeout(() => setShown((value) => value + 1), 1200);
    return () => clearTimeout(timer);
  }, [playing, active, shown]);
  const complete = shown === 4;
  const lines = [
    ...demoConversation,
    { speaker: 'AETHER AI', text: conversationConclusion(saved, failed) },
  ];
  const togglePlayback = () => {
    if (playing && !complete) setPlaying(false);
    else {
      if (complete) setShown(0);
      setPlaying(true);
    }
  };
  return (
    <section className="demo-conversation" aria-label="Simulated example conversation">
      <header>
        <strong>SIMULATED EXAMPLE TRANSCRIPT</strong>
        <span>Text playback only · no received audio</span>
      </header>
      <ol aria-live="polite" aria-relevant="additions text">
        {lines.slice(0, shown).map((line, index) => (
          <motion.li
            key={index}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <strong>{line.speaker}</strong>
            <span>{line.text}</span>
          </motion.li>
        ))}
      </ol>
      <div className="response-inline-actions">
        <button className="button outline" disabled={!active} onClick={togglePlayback}>
          {playing && !complete ? <Pause size={15} /> : <Play size={15} />}{' '}
          {playing && !complete ? 'Pause sample conversation' : 'Play sample conversation'}
        </button>
        <button
          className="button outline"
          disabled={!active}
          onClick={() => {
            setShown(0);
            setPlaying(true);
          }}
        >
          <RotateCcw size={15} />
          Restart sample conversation
        </button>
      </div>
      <p>
        {!active
          ? 'Demo call ended. Playback stopped.'
          : complete
            ? 'Example complete. You can restart or end the demo call.'
            : 'Example playback in progress. No microphone or phone network involved.'}
      </p>
    </section>
  );
}
