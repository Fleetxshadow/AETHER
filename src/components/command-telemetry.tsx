'use client';
import { useId, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Activity, Gauge, Route, Thermometer } from 'lucide-react';
import { metricsAt, timeLabel, type Observation } from '@/lib/data';
import { useNexus } from '@/lib/store';
import { spring, useReducedMotion } from '@/lib/motion';
import { Counter } from './motion-ui';
import { useTheme } from './theme-provider';
import { themeColor } from '@/lib/themes';
import { useMetric, readingTime } from '@/lib/data/hooks';
function TelemetryTrace({
  values,
  color: sourceColor,
  label,
  unit,
  labels,
  current,
  live = false,
}: {
  values: readonly number[];
  color: string;
  label: string;
  unit: string;
  labels?: string[];
  current?: number;
  live?: boolean;
}) {
  const { theme } = useTheme();
  const color = themeColor(sourceColor, theme);
  const id = useId();
  const step = useNexus((s) => s.timeStep);
  const reduced = useReducedMotion();
  const selected = current ?? step;
  const min = Math.min(0, ...values);
  const range = (Math.max(...values) - min) * 1.15 || 1;
  const point = (i: number) => [
    values.length === 1 ? 114 : 8 + (i * 212) / (values.length - 1),
    46 - ((values[i] - min) / range) * 35,
  ];
  const path = values.map((_, i) => `${i ? 'L' : 'M'}${point(i).join(',')}`).join(' ');
  return (
    <svg
      className="telemetry-trace"
      viewBox="0 0 228 55"
      role="img"
      aria-label={
        live
          ? `${label} (${unit}), reported samples: ${values.map((v, i) => `${labels?.[i]} ${v}`).join(', ')}. Current ${values[selected]} ${unit}.`
          : `${label} (${unit}), simulated samples on 12 October 2026 from ${timeLabel(0)} to ${timeLabel(values.length - 1)}: ${values.join(', ')}. Current ${values[selected]} ${unit} at ${timeLabel(step)}.`
      }
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}L220,55H8Z`} fill={`url(#${id})`} />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduced ? 0 : 0.7 }}
      />
      <motion.circle
        initial={false}
        animate={{ cx: point(selected)[0], cy: point(selected)[1] }}
        r="3"
        fill={color}
        stroke="#172218"
        strokeWidth="2"
        transition={reduced ? { duration: 0 } : spring}
      />
    </svg>
  );
}
export function CommandTelemetry({ records }: { records: Observation[] }) {
  const { theme } = useTheme();
  const step = useNexus((s) => s.timeStep);
  const metrics = metricsAt(step, records);
  const temperature = useMetric('temperature'),
    speed = useMetric('speed'),
    health = useMetric('health');
  const liveRecords = records.filter((r) => r.dataSource === 'LIVE');
  const liveCount = useNexus((s) => s.integration.activeObservations);
  const items = [
    {
      label: 'Active observations',
      value: liveRecords.length ? liveCount : metrics.active,
      unit: 'count',
      decimals: 0,
      note: liveRecords.length
        ? `${liveRecords.length} live records · demo markers remain separately labeled`
        : `${metrics.observations} recorded signals in snapshot`,
      values: liveRecords.length
        ? [liveCount]
        : [0, 1, 2, 3, 4].map((i) => metricsAt(i, records).active),
      reading: liveRecords.length
        ? {
            live: true,
            labels: [
              readingTime(
                liveRecords
                  .map((r) => r.observedAt)
                  .sort()
                  .at(-1)!,
              ),
            ],
            current: 0,
          }
        : undefined,
      color: '#ffb347',
      Icon: Activity,
    },
    {
      label: 'Surface temperature',
      value: temperature.value,
      unit: '°C',
      decimals: 1,
      note: temperature.live
        ? `Latest device: ${temperature.deviceId}`
        : 'Central district / simulated sensor',
      values: temperature.values,
      reading: temperature,
      color: '#ffbc76',
      Icon: Thermometer,
    },
    {
      label: speed.live ? 'Latest traffic speed' : 'Average traffic speed',
      value: speed.value,
      unit: 'km/h',
      decimals: 1,
      note: speed.live ? `Latest device: ${speed.deviceId}` : 'Mobility sample / recorded demo',
      values: speed.values,
      reading: speed,
      color: '#d8ed86',
      Icon: Route,
    },
    {
      label: 'Infrastructure health',
      value: health.value,
      unit: '%',
      decimals: 1,
      note: health.live ? `Latest device: ${health.deviceId}` : 'Illustrative assessment index',
      values: health.values,
      reading: health,
      color: '#b8ca96',
      Icon: Gauge,
    },
  ];
  return (
    <div className="metric-strip command-telemetry">
      {items.map(({ label, value, unit, decimals, note, values, color, Icon, reading }, i) => (
        <section
          key={label}
          className="telemetry-instrument"
          style={{ '--metric-color': themeColor(color, theme) } as CSSProperties}
        >
          <div className="instrument-title">
            <Icon size={14} />
            <span>{label}</span>
            <small className="mono">0{i + 1}</small>
          </div>
          <strong>
            <Counter value={value} decimals={decimals} />
            <small>{unit}</small>
            {i === 0 && (
              <span className="review-indicator mono">
                REVIEW
                <br />
                REQUIRED
              </span>
            )}
          </strong>
          <TelemetryTrace
            values={values}
            color={color}
            label={label}
            unit={unit}
            labels={reading?.labels}
            current={reading?.live ? reading.current : undefined}
            live={reading?.live}
          />
          <div className="kpi-context">
            <span>
              {reading?.live
                ? `${reading.labels[0]} — ${reading.labels.at(-1)}`
                : '12 Oct · 06:00–18:00 IST'}
            </span>
            <span>Current {reading?.live ? reading.labels.at(-1) : timeLabel(step)}</span>
            <span className="kpi-source">{reading?.live ? 'LIVE DATA' : 'SIMULATED DEMO'}</span>
          </div>
          <p>{note}</p>
        </section>
      ))}
    </div>
  );
}
