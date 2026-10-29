'use client';
import { useEffect, useState, useId } from 'react';
import { Pause, Play, RotateCcw, ScanLine } from 'lucide-react';
import type { Observation } from '@/lib/data';
import { moduleById } from '@/lib/modules';

export function EvidenceFrame({
  observation,
  progress = 40,
  comparison = false,
}: {
  observation: Observation;
  progress?: number;
  comparison?: boolean;
}) {
  const id = useId();
  if (observation.dataSource === 'LIVE')
    return (
      <div className="evidence-frame live-evidence-placeholder">
        <p>LIVE RECORD · {observation.deviceId}</p>
        <strong>No captured image supplied.</strong>
        <p>
          {observation.evidence ||
            'Inspect the reported metadata. No synthetic image is presented as device evidence.'}
        </p>
      </div>
    );
  const thermal = observation.module === 'thermal' || observation.module === 'fire';
  const road = observation.module === 'road';
  return (
    <div className={`evidence-frame ${thermal ? 'thermal-frame' : ''}`}>
      <svg
        viewBox="0 0 640 360"
        role="img"
        aria-label={`Synthetic ${moduleById[observation.module].name} evidence illustration. Not a real camera recording.`}
      >
        <defs>
          <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#8f9a82" strokeOpacity="0.12" />
          </pattern>
          <linearGradient id={`${id}-road`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#4e584b" />
            <stop offset="1" stopColor="#232c28" />
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill={thermal ? '#62543a' : '#303d33'} />
        <rect width="640" height="360" fill={`url(#${id}-grid)`} />
        <path d="M-50 310L640 40L690 145L0 410Z" fill={`url(#${id}-road)`} />
        <path d="M0 354L665 90" stroke="#b0a484" strokeWidth="2" strokeDasharray="18 20" />
        {Array.from({ length: 15 }, (_, i) => (
          <g
            key={i}
            transform={`translate(${40 + (i % 5) * 133} ${22 + Math.floor(i / 5) * 120}) rotate(-20)`}
          >
            <rect
              width={45 + (i % 3) * 10}
              height={35 + (i % 4) * 8}
              fill={
                thermal
                  ? ['#a57748', '#c48f4e', '#d6a454'][i % 3]
                  : ['#647364', '#798574', '#536250'][i % 3]
              }
              stroke="#a8ac8a"
              strokeOpacity="0.4"
            />
            <path d="M8 4V28M18 4V28M28 4V28" stroke="#424b40" opacity="0.3" />
          </g>
        ))}
        {road && (
          <path
            d={
              comparison
                ? 'M255 210L365 177'
                : 'M255 225L280 203L305 213L331 184L360 188L378 173M305 213L311 230M331 184L320 166'
            }
            stroke={comparison ? '#78816d' : '#1c211c'}
            strokeWidth={comparison ? 3 : 7}
            fill="none"
          />
        )}
        {observation.module === 'aqua' && (
          <path
            d="M-10 360Q120 130 180 170T300 20"
            fill="none"
            stroke="#7aa3a1"
            strokeOpacity="0.7"
            strokeWidth="65"
          />
        )}
        {observation.module === 'fire' && (
          <g opacity={Math.min(1, progress / 60)}>
            <ellipse
              cx="385"
              cy={160 - progress * 0.4}
              rx="48"
              ry="58"
              fill="#bbc0a9"
              opacity="0.5"
            />
            <ellipse cx="390" cy="176" rx="27" ry="24" fill="#e7a952" opacity="0.8" />
          </g>
        )}
        {progress > 18 && !comparison && (
          <g>
            <rect
              x={road ? 245 : 310}
              y={road ? 165 : 105}
              width="130"
              height="115"
              fill="none"
              stroke="#d8ed86"
              strokeWidth="1.5"
              strokeDasharray="5 2"
            />
            <rect x={road ? 245 : 310} y={road ? 143 : 83} width="130" height="22" fill="#d8ed86" />
            <text
              x={road ? 252 : 317}
              y={road ? 158 : 98}
              fill="#192017"
              fontSize="10"
              fontFamily="monospace"
            >
              DEMO / {observation.confidence}%
            </text>
          </g>
        )}
        <path d="M305 180h30M320 165v30" stroke="#e0e3d3" strokeWidth="1" opacity="0.6" />
      </svg>
      <div className="evidence-top mono">
        <span>
          <ScanLine size={12} />
          SYNTHETIC EVIDENCE
        </span>
        <span>{observation.id}</span>
      </div>
      <div className="evidence-bottom mono">
        <span>RGB / {observation.sensor}</span>
        <span>ILLUSTRATION · NOT A REAL RECORDING</span>
      </div>
    </div>
  );
}
export function DetectionReplay({ observation }: { observation: Observation }) {
  const replayId = useId();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const finished = progress >= 100;
  useEffect(() => {
    if (!playing || finished) return;
    const timer = setInterval(() => setProgress((p) => Math.min(100, p + 1)), 120);
    return () => clearInterval(timer);
  }, [playing, finished]);
  if (observation.dataSource === 'LIVE')
    return (
      <div className="detection-replay">
        <EvidenceFrame observation={observation} />
        <p className="data-note">
          No recording attached to this live observation. Replay is available for bundled demo
          records only.
        </p>
      </div>
    );
  return (
    <div className="detection-replay">
      <EvidenceFrame observation={observation} progress={progress} />
      <div className="replay-controls">
        <button
          className="icon-button"
          aria-label={playing && !finished ? 'Pause detection replay' : 'Play detection replay'}
          onClick={() => {
            if (finished) setProgress(0);
            setPlaying(!playing || finished);
          }}
        >
          {playing && !finished ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <label className="sr-only" htmlFor={`replay-${replayId}`}>
          Recorded detection progress
        </label>
        <input
          id={`replay-${replayId}`}
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => {
            setProgress(Number(e.target.value));
            setPlaying(false);
          }}
        />
        <span className="mono">{(progress * 0.12).toFixed(1)} / 12.0s</span>
        <button
          className="icon-button"
          aria-label="Reset detection replay"
          onClick={() => {
            setProgress(0);
            setPlaying(false);
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="replay-stages">
        <span className={progress < 20 ? 'active' : ''}>01 / Capture</span>
        <span className={progress >= 20 && progress < 65 ? 'active' : ''}>02 / Detect</span>
        <span className={progress >= 65 ? 'active' : ''}>03 / Review evidence</span>
      </div>
    </div>
  );
}
