'use client';
import { useMemo, useState } from 'react';
import { severityColor, visibleObservations } from '@/lib/data';
import { observationPoints, validCoordinate, type MapPoint } from '@/lib/operational-map';
import type { Incident } from '@/lib/response';
import { useNexus } from '@/lib/store';
import GoogleOperationalMap from './google-operational-map';

export function ResponseMap({
  incidents,
  selected,
  onSelect,
}: {
  incidents: Incident[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [demo, setDemo] = useState(false);
  const [overlay, setOverlay] = useState('incident');
  const records = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const test = useNexus((s) => s.integration.test);
  const selectedObservation = useNexus((s) => s.selectedId);
  const points = useMemo(() => {
    const reports: MapPoint[] = incidents.flatMap((i) =>
      i.coordinates && validCoordinate(i.coordinates)
        ? [
            {
              id: i.id,
              coordinate: i.coordinates,
              title: `Simulated report · ${i.location || i.category}`,
              detail: `${i.status} · ${i.locationVerified ? 'operator-reviewed location' : 'location unverified'} · ${i.reportedAt}`,
              source: 'DEMO',
              color: i.urgency === 'urgent' ? severityColor.critical : severityColor.elevated,
              overlays: ['command'],
            },
          ]
        : [],
    );
    const observations = observationPoints(
      visibleObservations(records, step),
      step,
      severityColor,
      test,
    ).filter(
      (p) => overlay !== 'incident' && p.overlays.includes(overlay as 'flow' | 'aqua' | 'road'),
    );
    return (overlay === 'incident' ? reports : observations).filter(
      (p) => demo || p.source === 'AUTHORIZED',
    );
  }, [incidents, records, step, overlay, demo, test]);
  return (
    <section className="response-geography" aria-label="Incident geography">
      <GoogleOperationalMap
        points={points}
        selected={overlay === 'incident' ? selected : selectedObservation}
        onSelect={(id) => {
          if (incidents.some((i) => i.id === id)) onSelect(id);
          else useNexus.getState().select(id);
        }}
        note={
          <p>
            Caller locations are voluntary and unverified until reviewed. Reports without
            coordinates remain unplaced in the report list; no address is geocoded automatically.
            All local RESPONSE reports are simulated.
          </p>
        }
      >
        <label className="aether-map-filter">
          Overlay
          <select
            aria-label="Incident map overlay"
            value={overlay}
            onChange={(e) => setOverlay(e.target.value)}
          >
            <option value="incident">Reports</option>
            <option value="flow">FLOW observations</option>
            <option value="aqua">AQUA observations</option>
            <option value="road">ROAD observations</option>
          </select>
        </label>
        <label className="aether-map-demo">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Show simulated reports
        </label>
      </GoogleOperationalMap>
    </section>
  );
}
