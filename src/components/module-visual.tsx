'use client';
import { motion } from 'motion/react';
import { modules, type ModuleId } from '@/lib/modules';
import { useNexus } from '@/lib/store';
import { telemetry } from '@/lib/telemetry';
import { buildings } from '@/lib/city';
import { metricsAt, visibleObservations, timeLabel } from '@/lib/data';
import { useReducedMotion } from '@/lib/motion';
import { EvidenceFrame } from './replay';
import { useTheme } from './theme-provider';
import { themeColor } from '@/lib/themes';
export function ModuleVisual({ id }: { id: ModuleId }) {
  const records = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  const source = modules.find((item) => item.id === id)!;
  const m = {
    ...source,
    color: theme === 'original' ? source.color : themeColor(source.color, theme),
  };
  const available = visibleObservations(records, step);
  const record = available.find((o) => o.module === id);
  const metrics = metricsAt(step, records);
  if (!record && ['road', 'fire', 'rescue'].includes(id)) {
    const Icon = m.icon;
    return (
      <div className="module-specimen empty-specimen">
        <span className="mono">{m.name} / RECORDED DEMO</span>
        <Icon size={65} strokeWidth={1} />
        <strong>No observation in this snapshot.</strong>
        <span className="specimen-caption mono">{timeLabel(step)} / HISTORICAL CONTEXT</span>
      </div>
    );
  }
  if (record && ['road', 'fire', 'rescue'].includes(id))
    return (
      <div className="module-specimen">
        <span className="mono">{record.id} / SYNTHETIC EVIDENCE</span>
        <EvidenceFrame observation={record} />
        <span className="specimen-caption mono">
          {record.district} / {record.metric} {record.unit}
        </span>
      </div>
    );
  if (id === 'flow' || id === 'thermal' || id === 'aqua') {
    const values =
      id === 'flow' ? telemetry.speed : id === 'thermal' ? telemetry.temperature : telemetry.water;
    const max = Math.max(...values) * 1.15;
    const path = values
      .map((v, i) => `${i ? 'L' : 'M'}${20 + i * 70},${145 - (v / max) * 115}`)
      .join(' ');
    return (
      <div className="module-specimen module-signal">
        <span className="mono">{m.metric.toUpperCase()} / RECORDED DEMO</span>
        <strong style={{ color: m.color }}>
          {values[step]}
          <small>{m.unit}</small>
        </strong>
        <svg
          viewBox="0 0 320 160"
          role="img"
          aria-label={`${m.metric}, five simulated samples: ${values.join(', ')} ${m.unit}`}
        >
          <path d="M20 145H300M20 95H300M20 45H300" stroke="#5e704540" strokeDasharray="3 5" />
          <motion.path
            key={id}
            d={path}
            stroke={m.color}
            strokeWidth="2"
            fill="none"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.65 }}
          />
          <circle cx={20 + step * 70} cy={145 - (values[step] / max) * 115} r="5" fill={m.color} />
        </svg>
        <span className="specimen-caption mono">06:00 → 18:00 IST / 12 OCT 2026</span>
      </div>
    );
  }
  if (id === 'sky')
    return (
      <div className="module-specimen">
        <span className="mono">AETHER X1 / CONCEPTUAL PLATFORM</span>
        <svg
          className="sky-specimen"
          viewBox="0 0 340 250"
          role="img"
          aria-label="Illustrative four-motor airframe plan"
        >
          <g transform="translate(170 125)" stroke="#d7bd84" fill="none">
            {[45, 135, 225, 315].map((angle) => (
              <g key={angle} transform={`rotate(${angle})`}>
                <path d="M0 0H92" strokeWidth="5" />
                <ellipse cx="104" rx="38" ry="6" />
                <circle cx="104" r="17" />
                <path d="M104 -40V40" strokeDasharray="2 5" strokeOpacity=".3" />
              </g>
            ))}
            <rect x="-24" y="-34" width="48" height="68" strokeWidth="2" />
            <circle cy="47" r="9" />
            <path d="M-160 0H160M0 -110V110" strokeDasharray="2 8" strokeOpacity=".25" />
          </g>
        </svg>
        <span className="specimen-caption mono">04 PROPULSION ASSEMBLIES / ILLUSTRATIVE</span>
      </div>
    );
  if (id === 'twin')
    return (
      <div className="module-specimen">
        <span className="mono">SPATIAL GEOMETRY / ORIGINAL CITY</span>
        <svg
          viewBox="0 0 340 250"
          role="img"
          aria-label="Preview of original conceptual building footprints"
        >
          <g
            transform="translate(175 120) scale(3.1) rotate(-25)"
            fill="#71846244"
            stroke="#a4b680"
            strokeWidth=".2"
          >
            {buildings.map((b) => (
              <rect key={b.id} x={b.x} y={b.z} width={b.w} height={b.d} />
            ))}
          </g>
        </svg>
        <span className="specimen-caption mono">
          {buildings.length} STRUCTURES / CONCEPTUAL GEOGRAPHY
        </span>
      </div>
    );
  if (id === 'command')
    return (
      <div className="module-specimen command-specimen">
        <span className="mono">UNIFIED OPERATIONS / DEMO SNAPSHOT</span>
        <div>
          <strong>
            {metrics.active}
            <small>ACTIVE</small>
          </strong>
          <strong>
            {metrics.temperature}°<small>SURFACE / °C</small>
          </strong>
          <strong>
            {metrics.speed}
            <small>SPEED / KM/H</small>
          </strong>
        </div>
        <svg viewBox="0 0 340 130" aria-hidden="true">
          <path
            d="M10 30H330M10 65H330M10 100H330M70 10V120M165 10V120M260 10V120"
            fill="none"
            stroke="#647e4b66"
          />
          <circle cx="165" cy="65" r="12" fill="none" stroke="#ffb347" />
          <circle cx="165" cy="65" r="4" fill="#ffb347" />
        </svg>
        <span className="specimen-caption mono">
          {metrics.observations} SOURCE-LINKED OBSERVATIONS
        </span>
      </div>
    );
  const Icon = m.icon;
  return (
    <div className="module-specimen core-specimen">
      <span className="mono">EVIDENCE / CONTEXT / UNDERSTANDING</span>
      <svg viewBox="0 0 340 190" aria-hidden="true">
        <path
          d="M30 40C150 40 140 95 220 95M30 95H220M30 150C150 150 140 95 220 95"
          fill="none"
          stroke="#a3b46b"
          strokeWidth="1"
        />
        {[40, 95, 150].map((y) => (
          <circle key={y} cx="30" cy={y} r="7" fill="#6f8644" />
        ))}
        <circle cx="255" cy="95" r="34" fill="#29351b" stroke="#a3b46b" />
      </svg>
      <Icon size={27} strokeWidth={1} />
      <span className="specimen-caption mono">DETERMINISTIC ANALYSIS / SIMULATED SOURCES</span>
    </div>
  );
}
