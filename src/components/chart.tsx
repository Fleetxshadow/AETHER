'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimate, useInView } from 'motion/react';
import { useNexus } from '@/lib/store';
import { timeLabel } from '@/lib/data';
import { motionTiming, spring, useReducedMotion } from '@/lib/motion';
import { useTheme } from './theme-provider';
import { themeColor } from '@/lib/themes';
import { readingTime, useMetric } from '@/lib/data/hooks';
import type { SensorChannel } from '@/lib/telemetry';
import type { ModuleId } from '@/lib/modules';

export function Chart(
  props: Parameters<typeof RecordedChart>[0] & { channel?: SensorChannel; module?: ModuleId },
) {
  const metric = useMetric(props.channel ?? null, props.module);
  const [table, setTable] = useState(false);
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  if (!metric.live) return <RecordedChart {...props} />;
  const color = themeColor(props.color || '#ffb347', theme);
  const min = Math.min(0, ...metric.values),
    max = Math.max(...metric.values),
    range = max - min || 1;
  const first = Date.parse(metric.samples[0].observedAt),
    last = Date.parse(metric.samples.at(-1)!.observedAt);
  const x = (i: number) =>
    first === last
      ? 200
      : 25 + ((Date.parse(metric.samples[i].observedAt) - first) / (last - first)) * 350;
  const y = (v: number) => 135 - ((v - min) / range) * 100;
  const label = `Reported ${props.channel} / ${metric.deviceId}`;
  return (
    <div className="chart reported-chart" style={{ '--chart-color': color } as React.CSSProperties}>
      <div className="chart-head">
        <span>{label}</span>
        <strong>
          {metric.value.toFixed(1)}
          <small>{metric.unit}</small>
        </strong>
        <button className="text-button" aria-expanded={table} onClick={() => setTable(!table)}>
          {table ? 'Chart' : 'Data table'}
        </button>
      </div>
      <div className="chart-legend mono">
        <span>LIVE DATA · received samples only</span>
        <span>
          {readingTime(metric.samples[0].observedAt)} —{' '}
          {readingTime(metric.samples.at(-1)!.observedAt)}
        </span>
        <span>Current {metric.labels.at(-1)}</span>
      </div>
      {table ? (
        <div className="reported-table">
          <table className="data-table">
            <caption>{label} · actual received samples</caption>
            <thead>
              <tr>
                <th scope="col">Received timestamp</th>
                <th scope="col">Value ({metric.unit})</th>
              </tr>
            </thead>
            <tbody>
              {metric.samples.map((r) => (
                <tr key={r.observedAt}>
                  <th scope="row">{readingTime(r.observedAt)}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox="0 0 400 170"
          role="img"
          aria-label={`${label} (${metric.unit}). ${metric.values.map((value, i) => `${metric.labels[i]}: ${value}`).join('; ')}. No historical samples have been invented.`}
        >
          <line x1="25" y1="135" x2="375" y2="135" stroke="var(--line)" />
          <motion.path
            d={metric.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2.3"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.4 }}
          />
          {metric.values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={i === metric.current ? 5 : 2} fill={color} />
          ))}
          <text x="25" y="159" fill="var(--muted)" fontSize="11">
            {min.toFixed(1)}–{max.toFixed(1)} {metric.unit} · {metric.samples.length} received
            samples
          </text>
        </svg>
      )}
    </div>
  );
}
function RecordedChart({
  values,
  label,
  unit = '',
  color: sourceColor = '#ffb347',
  baseline,
}: {
  values: readonly number[];
  label: string;
  unit?: string;
  color?: string;
  baseline?: readonly number[];
}) {
  const { theme } = useTheme();
  const color = themeColor(sourceColor, theme);
  const step = useNexus((s) => s.timeStep);
  const setTime = useNexus((s) => s.setTime);
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, { once: true });
  const reduced = useReducedMotion();
  const id = useId();
  const all = baseline ? [...values, ...baseline] : values;
  const max = Math.max(...all) * 1.2 || 1;
  const x = (i: number) => 25 + i * 87.5;
  const y = (v: number) => 135 - (v / max) * 100;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const active = hover ?? step;
  useEffect(() => {
    if (!inView || reduced || table) return;
    const playback = animate(
      '.chart-trace',
      { pathLength: [0, 1] },
      { duration: motionTiming.entrance },
    );
    return () => playback.stop();
  }, [animate, inView, reduced, table]);
  return (
    <motion.div
      layout
      transition={reduced ? { duration: 0 } : spring}
      className="chart"
      ref={scope}
      style={{ '--chart-color': color } as React.CSSProperties}
    >
      <div className="chart-head">
        <span>{label}</span>
        <strong>
          {values[step]?.toFixed(1)}
          <small>{unit}</small>
        </strong>
        <button className="text-button" onClick={() => setTable(!table)} aria-expanded={table}>
          {table ? 'Chart' : 'Data table'}
        </button>
      </div>
      <div className="chart-legend mono">
        <span>
          <i style={{ background: color }} />
          Recorded demo
        </span>
        {baseline && (
          <span>
            <i className="baseline-key" />
            Simulated baseline
          </span>
        )}
        <span>12 OCT 2026 / IST</span>
        <span>
          {timeLabel(0)}–{timeLabel(values.length - 1)} / current {timeLabel(step)}
        </span>
      </div>
      {table ? (
        <table className="data-table">
          <caption className="sr-only">{label} demo history</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">{label}</th>
              {baseline && <th scope="col">Baseline</th>}
            </tr>
          </thead>
          <tbody>
            {values.map((v, i) => (
              <tr key={i}>
                <th scope="row">{timeLabel(i)}</th>
                <td>
                  {v} {unit}
                </td>
                {baseline && (
                  <td>
                    {baseline[i]} {unit}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-plot">
          <svg
            viewBox="0 0 400 170"
            role="img"
            aria-label={`${label}: ${values.map((v, i) => `${timeLabel(i)} ${v}${unit}`).join(', ')}. Current snapshot ${timeLabel(step)}.`}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setHover(
                Math.max(
                  0,
                  Math.min(4, Math.round((((e.clientX - box.left) / box.width) * 400 - 25) / 87.5)),
                ),
              );
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[35, 68.3333, 101.6667, 135].map((line, i) => (
              <g key={line}>
                <line
                  x1="25"
                  y1={line}
                  x2="375"
                  y2={line}
                  stroke="var(--line)"
                  strokeDasharray="2 6"
                />
                <text x="3" y={line + 3} fill="var(--muted)" fontSize="11">
                  {Math.round(max * (1 - i / 3))}
                </text>
              </g>
            ))}
            <path d={`${path} L375,145 L25,145 Z`} fill={`url(#${id})`} />
            {baseline && (
              <path
                d={baseline.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke="#929d7e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )}
            <motion.path
              className="chart-trace"
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.3"
              strokeLinejoin="round"
              initial={false}
            />
            <motion.circle
              className="chart-point-halo"
              initial={false}
              animate={{ cx: x(active), cy: y(values[active]) }}
              r="12"
              fill={color}
              fillOpacity=".12"
              transition={reduced ? { duration: 0 } : spring}
            />
            <motion.line
              initial={false}
              animate={{ x1: x(active), x2: x(active) }}
              y1="17"
              y2="145"
              stroke={color}
              strokeOpacity="0.4"
              strokeDasharray="3 4"
              transition={reduced ? { duration: 0 } : spring}
            />
            <motion.circle
              className="chart-current-point"
              initial={false}
              animate={{ cx: x(active), cy: y(values[active]) }}
              r="5"
              fill={color}
              stroke="#141a12"
              strokeWidth="3"
              transition={{ duration: reduced ? 0 : 0.18 }}
            />
          </svg>
          {hover !== null && (
            <div
              className="chart-tooltip mono"
              role="status"
              style={{ left: `${12 + active * 18}%` }}
            >
              <span>{timeLabel(active)}</span>
              <strong>
                {values[active]} {unit}
              </strong>
              {baseline && (
                <span>
                  Baseline: {baseline[active]} {unit}
                </span>
              )}
            </div>
          )}
          <div className="chart-times">
            {values.map((_, i) => (
              <button
                key={i}
                aria-label={`View ${timeLabel(i)} snapshot`}
                aria-pressed={step === i}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setTime(i)}
              >
                {timeLabel(i).replace(' IST', '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
export function RadialGauge({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  return (
    <svg
      ref={ref}
      className="radial-gauge"
      viewBox="0 0 80 80"
      role="img"
      aria-label={`${label}: ${value}% simulated`}
    >
      <circle cx="40" cy="40" r="31" fill="none" stroke="#414b33" strokeWidth="4" />
      <motion.circle
        initial={false}
        cx="40"
        cy="40"
        r="31"
        fill="none"
        stroke="#d8ed86"
        strokeWidth="4"
        strokeDasharray="194.78"
        animate={{ strokeDashoffset: 194.78 * (1 - value / 100) }}
        transform="rotate(-90 40 40)"
        transition={{ duration: reduced ? 0 : 0.6 }}
      />
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill="#d8ed86"
        fontSize="19"
        fontFamily="Barlow Condensed"
      >
        {value}%
      </text>
    </svg>
  );
}
