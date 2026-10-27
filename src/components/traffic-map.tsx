'use client';
import { useMemo, useState } from 'react';
import type { RoadSegment, TrafficIncident } from '@/lib/traffic/contract';
import { trafficColors, trafficMapData } from '@/lib/operational-map';
import GoogleOperationalMap from './google-operational-map';

export default function TrafficMap({
  roads,
  incidents,
  selected,
  onSelect,
  heat,
}: {
  roads: RoadSegment[];
  incidents: TrafficIncident[];
  selected: string;
  onSelect: (id: string) => void;
  heat: boolean;
}) {
  const [demo, setDemo] = useState(false);
  const { points, lines } = useMemo(() => {
    const data = trafficMapData(roads, incidents);
    return {
      points: data.points.filter((p) => demo || p.source === 'AUTHORIZED'),
      lines: data.lines.filter((l) => demo || l.source === 'AUTHORIZED'),
    };
  }, [roads, incidents, demo]);
  return (
    <div className="traffic-map-wrap">
      <GoogleOperationalMap
        points={points}
        lines={lines}
        selected={selected}
        onSelect={onSelect}
        recurrence={heat}
        legend={Object.entries(trafficColors).map(([label, color]) => ({
          label: label.toLowerCase(),
          color,
        }))}
        note={
          <p>
            {demo
              ? 'SIMULATED corridor sketches are approximate, not road-survey geometry. Speeds, cases and causes belong to the demo backend.'
              : 'Only authorized backend road segments are shown. Simulated corridor sketches remain available through the demo control and equivalent road list.'}{' '}
            Google traffic is a separate visual layer.
          </p>
        }
      >
        <label className="aether-map-demo">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Show simulated corridors
        </label>
      </GoogleOperationalMap>
    </div>
  );
}
