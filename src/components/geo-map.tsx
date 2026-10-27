'use client';
import { useMemo, useState } from 'react';
import { visibleObservations, severityColor } from '@/lib/data';
import { useNexus } from '@/lib/store';
import { observationPoints } from '@/lib/operational-map';
import { type ModuleId } from '@/lib/modules';
import GoogleOperationalMap from './google-operational-map';

const overlays = [
  'command',
  'flow',
  'aqua',
  'road',
  'fire',
  'sky',
  'core',
  'thermal',
  'rescue',
] as const;
export default function GeoMap({
  module = 'command',
  severity = 'all',
  query = '',
  initialSatellite = false,
}: {
  module?: ModuleId;
  severity?: string;
  query?: string;
  initialSatellite?: boolean;
}) {
  const records = useNexus((s) => s.records);
  const selected = useNexus((s) => s.selectedId);
  const select = useNexus((s) => s.select);
  const step = useNexus((s) => s.timeStep);
  const integration = useNexus((s) => s.integration);
  const [overlay, setOverlay] = useState<ModuleId>(module === 'twin' ? 'command' : module);
  const [demo, setDemo] = useState(false);
  const { points, hidden } = useMemo(() => {
    const coreSources = new Set(integration.fresh.aiDetections.flatMap((a) => a.observationIds));
    const visible = visibleObservations(records, step, module, query).filter(
      (o) => severity === 'all' || o.severity === severity,
    );
    const projected = observationPoints(
      visible,
      step,
      severityColor,
      integration.test,
      coreSources,
    ).filter((p) => overlay === 'command' || p.overlays.includes(overlay));
    return {
      points: projected.filter((p) => demo || p.source === 'AUTHORIZED'),
      hidden: projected.filter((p) => p.source !== 'AUTHORIZED').length,
    };
  }, [records, step, module, query, severity, integration, overlay, demo]);
  const selectedUnplotted = selected && !points.some((p) => p.id === selected);
  return (
    <GoogleOperationalMap
      points={points}
      selected={selected}
      onSelect={select}
      initialSatellite={initialSatellite}
      note={
        <>
          <p>
            The time machine filters AETHER’s recorded demo observations. It does not rewind Google
            imagery or the Google traffic layer.
          </p>
          {!demo && hidden > 0 && (
            <p>
              {hidden} simulated observations hidden. Enable demo pins to inspect their original
              coordinates; bundled city samples are outside Gurugram.
            </p>
          )}
          {demo && (
            <p>
              SIMULATED pins only demonstrate workflows. Original sample coordinates are preserved,
              including Bengaluru samples; use Fit visible records to inspect them.
            </p>
          )}
          {overlay === 'core' && (
            <p>
              CORE places only findings with a linked geographic observation. Findings without
              coordinates stay in the evidence workspace.
            </p>
          )}
          {selectedUnplotted && (
            <p>
              Selected record is not plotted under the current source, module or severity filter.
              Its details remain available.
            </p>
          )}
          {!points.length && (
            <p>
              No authorized geographic observations in this filter. Google’s streets are geographic
              context, not an incident feed.
            </p>
          )}
        </>
      }
    >
      <label className="aether-map-filter">
        AETHER overlay
        <select
          aria-label="AETHER map overlay"
          value={overlay}
          onChange={(e) => setOverlay(e.target.value as ModuleId)}
        >
          {overlays
            .filter((id) => ['command', 'twin', 'core'].includes(module) || id === module)
            .map((id) => (
              <option key={id} value={id}>
                {id === 'command' ? 'COMMAND · all observations' : id.toUpperCase()}
              </option>
            ))}
        </select>
      </label>
      <label className="aether-map-demo">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        Show simulated pins
      </label>
    </GoogleOperationalMap>
  );
}
