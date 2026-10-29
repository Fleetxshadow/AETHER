'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Crosshair, LocateFixed, MapPin, Minus, Plus, RotateCcw } from 'lucide-react';
import { googleMapsConfigured, loadGoogleMaps, mapsAuthEvent } from '@/lib/google-maps';
import { fitCamera, gurugram, latLng, type MapLine, type MapPoint } from '@/lib/operational-map';
import { useReducedMotion } from '@/lib/motion';
import { useNexus } from '@/lib/store';
import { useTheme } from './theme-provider';
import { themes } from '@/lib/themes';
import { severityColor } from '@/lib/data';
import type { SpatialFeature } from '@/lib/geo-contracts';
import { geometryCoordinates } from '@/lib/geo-contracts';
import { clusterPixels, type PixelPoint } from '@/lib/geo-review';
import { useGoogleSpatialLayer, emptyFeatures } from './google-spatial-layer';

const noLines: MapLine[] = [];
type MapState = 'missing' | 'loading' | 'ready' | 'network' | 'authorization';
export default function GoogleOperationalMap({
  points,
  lines = noLines,
  selected,
  onSelect,
  children,
  note,
  initialSatellite = false,
  recurrence = false,
  legend,
  features = emptyFeatures,
  clusterPoints = false,
  onClusterSelect,
}: {
  points: MapPoint[];
  lines?: MapLine[];
  selected: string | null;
  onSelect: (id: string) => void;
  children?: ReactNode;
  note?: ReactNode;
  initialSatellite?: boolean;
  recurrence?: boolean;
  legend?: { label: string; color: string }[];
  features?: SpatialFeature[];
  clusterPoints?: boolean;
  onClusterSelect?: (ids: string[]) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [state, setState] = useState<MapState>(googleMapsConfigured ? 'loading' : 'missing');
  const [satellite, setSatellite] = useState(initialSatellite);
  const [traffic, setTraffic] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const locationCircle = useRef<google.maps.Circle | null>(null);
  const alive = useRef(false);
  const selectedRef = useRef(selected);
  const selectRef = useRef(onSelect);
  const clusterSelectRef = useRef(onClusterSelect);
  const markerButtons = useRef(new Map<string, HTMLButtonElement>());
  const pointLayer = useRef<{ update: (next: MapPoint[]) => void } | null>(null);
  const reduced = useReducedMotion();
  const motion = useNexus((s) => s.motion);
  const { theme } = useTheme();
  const selectedPoint = points.find((p) => (p.selectionId ?? p.id) === selected);
  const shapeSelected = features.some((f) => f.id === selected);
  const sources = [
    ...new Map([
      ...points.map((p) => [p.selectionId ?? p.id, p.source] as const),
      ...features.map((f) => [f.id, f.properties.source] as const),
    ]).values(),
  ];
  const selectedLng = shapeSelected ? undefined : selectedPoint?.coordinate[0],
    selectedLat = shapeSelected ? undefined : selectedPoint?.coordinate[1];
  useGoogleSpatialLayer(map, features, selected, onSelect, reduced || !motion);
  useEffect(() => {
    selectRef.current = onSelect;
    clusterSelectRef.current = onClusterSelect;
  }, [onSelect, onClusterSelect]);

  useEffect(() => {
    if (!root.current || !googleMapsConfigured) return;
    let disposed = false;
    let instance: google.maps.Map | undefined;
    let resize: ResizeObserver | undefined;
    let tileListener: google.maps.MapsEventListener | undefined;
    alive.current = true;
    const authorization = () => {
      if (!disposed) setState('authorization');
    };
    window.addEventListener(mapsAuthEvent, authorization);
    const timeout = setTimeout(() => {
      if (!disposed) setState((s) => (s === 'loading' ? 'network' : s));
    }, 20000);
    void loadGoogleMaps()
      .then(({ Map }) => {
        if (disposed || !root.current) return;
        instance = new Map(root.current, {
          center: gurugram,
          zoom: 12,
          minZoom: 2,
          maxZoom: 20,
          disableDefaultUI: true,
          keyboardShortcuts: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeId: 'roadmap',
          backgroundColor: '#132124',
        });
        const current = instance;
        tileListener = google.maps.event.addListenerOnce(current, 'tilesloaded', () => {
          if (!disposed) {
            clearTimeout(timeout);
            setState((s) => (s === 'authorization' ? s : 'ready'));
          }
        });
        resize = new ResizeObserver(() => google.maps.event.trigger(current, 'resize'));
        resize.observe(root.current);
        setMap(current);
      })
      .catch((error: unknown) => {
        if (!disposed)
          setState((s) =>
            s === 'authorization' ||
            (error instanceof Error && error.message === 'Map authorization failed')
              ? 'authorization'
              : 'network',
          );
      });
    return () => {
      disposed = true;
      alive.current = false;
      clearTimeout(timeout);
      window.removeEventListener(mapsAuthEvent, authorization);
      resize?.disconnect();
      tileListener?.remove();
      locationCircle.current?.setMap(null);
      locationCircle.current = null;
      if (instance) google.maps.event.clearInstanceListeners(instance);
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const p = themes[theme];
    const light = theme === 'aqua' || theme === 'sage';
    map.setOptions({
      styles: light
        ? null
        : [
            { elementType: 'geometry', stylers: [{ color: p.scene.surface }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#cbd8d5' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: p.scene.surface }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#485954' }] },
            {
              featureType: 'road.highway',
              elementType: 'geometry',
              stylers: [{ color: '#687265' }],
            },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#133c43' }] },
            { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          ],
    });
  }, [map, theme]);
  useEffect(() => {
    map?.setMapTypeId(satellite ? 'satellite' : 'roadmap');
  }, [map, satellite]);
  useEffect(() => {
    if (!map || !traffic) return;
    const layer = new google.maps.TrafficLayer({ autoRefresh: true });
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map, traffic]);

  // OverlayView preserves native 44px HTML buttons without requiring a cloud map ID.
  // Pins stay at their supplied coordinates; detail text lives outside the road surface.
  useEffect(() => {
    if (!map) return;
    const buttons = markerButtons.current;
    class PointLayer extends google.maps.OverlayView {
      element = document.createElement('div');
      points: MapPoint[] = [];
      clusters = new Map<string, HTMLButtonElement>();
      added = false;
      onAdd() {
        this.element.className = 'aether-map-markers';
        this.getPanes()?.overlayMouseTarget.append(this.element);
        this.added = true;
        this.update(this.points);
      }
      update(next: MapPoint[]) {
        this.points = next;
        if (!this.added) return;
        const ids = new Set(next.map((p) => p.id));
        buttons.forEach((button, id) => {
          if (!ids.has(id)) {
            button.remove();
            buttons.delete(id);
          }
        });
        next.forEach((point) => {
          let button = buttons.get(point.id);
          if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'aether-map-pin';
            const dot = document.createElement('span');
            dot.className = 'aether-map-pin-dot';
            dot.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'aether-map-pin-label';
            button.append(dot, label);
            const target = button;
            button.addEventListener('click', () => selectRef.current(target.dataset.selection!));
            button.addEventListener('focus', () => {
              if (!target.matches(':focus-visible')) return;
              const current = this.points.find((p) => p.id === point.id);
              if (!current) return;
              const pixel = this.getProjection()?.fromLatLngToContainerPixel(
                new google.maps.LatLng(latLng(current.coordinate)),
              );
              const bounds = map!.getDiv();
              if (
                !pixel ||
                pixel.x < 22 ||
                pixel.y < 22 ||
                pixel.x > bounds.clientWidth - 22 ||
                pixel.y > bounds.clientHeight - 44
              )
                map!.moveCamera({ center: latLng(current.coordinate) });
            });
            google.maps.OverlayView.preventMapHitsAndGesturesFrom(button);
            buttons.set(point.id, button);
            this.element.append(button);
          }
          button.style.setProperty('--pin-color', point.color);
          button.dataset.source = point.source;
          button.dataset.selection = point.selectionId ?? point.id;
          button.dataset.kind = point.markerKind || 'observation';
          button.classList.toggle('is-recent', !!point.recent);
          button.setAttribute(
            'aria-label',
            `Select ${point.title}, ${point.source === 'AUTHORIZED' ? 'authorized record' : point.source === 'LOCAL' ? 'local import, unverified' : 'simulated ' + point.source.toLowerCase()} · ${point.detail}`,
          );
          button.setAttribute(
            'aria-pressed',
            String((point.selectionId ?? point.id) === selectedRef.current),
          );
          const label = button.lastElementChild!;
          label.textContent = `${point.source === 'AUTHORIZED' ? '' : point.source + ' · '}${point.title}`;
        });
        this.draw();
      }
      draw() {
        const projection = this.getProjection();
        if (!projection) return;
        const projected: PixelPoint[] = [];
        this.points.forEach((point) => {
          const position = new google.maps.LatLng(latLng(point.coordinate));
          const pixel = projection.fromLatLngToDivPixel(position);
          const viewport = projection.fromLatLngToContainerPixel(position);
          const button = buttons.get(point.id);
          if (!pixel || !button) return;
          const div = map!.getDiv();
          // A zoom can briefly move the selected pin outside the frame before panTo completes.
          // Keep its DOM focus target available throughout that camera transition.
          button.hidden =
            (point.selectionId ?? point.id) !== selectedRef.current &&
            (!viewport ||
              viewport.x < 22 ||
              viewport.y < 22 ||
              viewport.x > div.clientWidth - 22 ||
              viewport.y > div.clientHeight - 44);
          button.style.left = `${pixel.x}px`;
          button.style.top = `${pixel.y}px`;
          if (!button.hidden && viewport)
            projected.push({
              id: point.id,
              x: viewport.x,
              y: viewport.y,
              coordinate: point.coordinate,
              selected: (point.selectionId ?? point.id) === selectedRef.current,
              endpoint: !!point.markerKind,
            });
        });
        const groups = clusterPoints ? clusterPixels(projected) : [];
        const clusterIds = new Set<string>();
        for (const group of groups) {
          if (group.members.length < 2) continue;
          clusterIds.add(group.id);
          let button = this.clusters.get(group.id);
          if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'aether-map-cluster';
            const target = button;
            button.addEventListener('click', () => {
              const ids = JSON.parse(target.dataset.members || '[]') as string[];
              const members = this.points.filter((p) => ids.includes(p.id));
              clusterSelectRef.current?.([...new Set(members.map((p) => p.selectionId ?? p.id))]);
              map!.moveCamera({
                center: latLng(members[0].coordinate),
                zoom: Math.min(20, (map!.getZoom() ?? 12) + 2),
              });
            });
            google.maps.OverlayView.preventMapHitsAndGesturesFrom(button);
            this.element.append(button);
            this.clusters.set(group.id, button);
          }
          const members = this.points.filter((p) => group.members.some((m) => m.id === p.id));
          button.dataset.members = JSON.stringify(group.members.map((p) => p.id));
          button.textContent = String(group.members.length);
          button.setAttribute(
            'aria-label',
            `Review cluster of ${group.members.length} observations${members.some((p) => p.source !== 'AUTHORIZED') ? ', includes demo or local records' : ''}`,
          );
          const pixel = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(latLng(group.members[0].coordinate)),
          );
          button.style.left = `${pixel?.x ?? 0}px`;
          button.style.top = `${pixel?.y ?? 0}px`;
          group.members.forEach((p) => {
            const target = buttons.get(p.id);
            if (target) target.hidden = true;
          });
        }
        this.clusters.forEach((button, id) => {
          if (!clusterIds.has(id)) {
            button.remove();
            this.clusters.delete(id);
          }
        });
      }
      onRemove() {
        this.element.remove();
        buttons.clear();
        this.clusters.clear();
      }
    }
    const layer = new PointLayer();
    pointLayer.current = layer;
    layer.setMap(map);
    return () => {
      pointLayer.current = null;
      layer.setMap(null);
    };
  }, [map, clusterPoints]);
  useEffect(() => {
    pointLayer.current?.update(points);
  }, [map, points]);
  useEffect(() => {
    selectedRef.current = selected;
    markerButtons.current.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.selection === selected)),
    );
  }, [selected, map, points]);
  useEffect(() => {
    if (!map || selectedLng === undefined || selectedLat === undefined) return;
    const center = { lng: selectedLng, lat: selectedLat };
    if (reduced || !motion) map.moveCamera({ center, zoom: Math.max(15, map.getZoom() ?? 12) });
    else {
      map.setZoom(Math.max(15, map.getZoom() ?? 12));
      map.panTo(center);
    }
  }, [map, selectedLng, selectedLat, reduced, motion]);
  useEffect(() => {
    if (!map) return;
    const rendered = lines.map((line) => {
      const path = new google.maps.Polyline({
        map,
        path: line.coordinate.map(latLng),
        strokeColor: line.color,
        strokeWeight: line.id === selected ? 7 : 4,
        strokeOpacity: line.source === 'AUTHORIZED' ? 0.9 : 0,
        ...(line.source !== 'AUTHORIZED'
          ? {
              icons: [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 },
                  offset: '0',
                  repeat: '14px',
                },
              ],
            }
          : {}),
        zIndex: line.id === selected ? 2 : 1,
      });
      const listener = path.addListener('click', () => selectRef.current(line.id));
      return { path, listener };
    });
    return () =>
      rendered.forEach(({ path, listener }) => {
        listener.remove();
        path.setMap(null);
      });
  }, [map, lines, selected]);
  useEffect(() => {
    if (!map || !recurrence) return;
    const halos = points
      .filter((p) => p.caseCount && p.caseCount > 0)
      .map(
        (p) =>
          new google.maps.Circle({
            map,
            center: latLng(p.coordinate),
            radius: 180,
            strokeWeight: 1,
            strokeColor: p.color,
            fillColor: p.color,
            fillOpacity: 0.13,
            clickable: false,
          }),
      );
    return () => halos.forEach((circle) => circle.setMap(null));
  }, [map, points, recurrence]);

  const locate = () => {
    if (!map || locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationMessage(
        'Location requires HTTPS or localhost and browser permission. LAN HTTP can still use the map.',
      );
      return;
    }
    setLocating(true);
    setLocationMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!alive.current) return;
        const center = { lat: coords.latitude, lng: coords.longitude };
        map.moveCamera({ center, zoom: 15 });
        locationCircle.current?.setMap(null);
        locationCircle.current = new google.maps.Circle({
          map,
          center,
          radius: Math.max(10, coords.accuracy),
          strokeColor: '#2879dc',
          strokeWeight: 2,
          fillColor: '#2879dc',
          fillOpacity: 0.15,
          clickable: false,
        });
        setLocating(false);
        setLocationMessage(
          `Your approximate location · accuracy ±${Math.round(coords.accuracy)} m. Not saved to AETHER.`,
        );
      },
      (error) => {
        if (!alive.current) return;
        setLocating(false);
        setLocationMessage(
          error.code === 1
            ? 'Location permission denied. Pan or search the map manually.'
            : 'Location unavailable or timed out. You can still pan the map.',
        );
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  };
  const ready = state === 'ready';
  return (
    <section
      className="aether-operational-map"
      aria-label="AETHER operational geography"
      data-map-state={state}
    >
      <header className="aether-map-heading">
        <div>
          <span className="eyebrow">AETHER GEO</span>
          <strong>Gurugram, Haryana</strong>
        </div>
        <span className="mono">{ready ? 'GOOGLE MAPS' : 'GEOGRAPHIC WORKSPACE'}</span>
      </header>
      <div className="aether-map-toolbar" role="group" aria-label="Operational map controls">
        {children}
        <div className="aether-map-modes" role="group" aria-label="Basemap mode">
          <button disabled={!ready} aria-pressed={!satellite} onClick={() => setSatellite(false)}>
            Roadmap
          </button>
          <button disabled={!ready} aria-pressed={satellite} onClick={() => setSatellite(true)}>
            Satellite
          </button>
        </div>
        <button disabled={!ready} aria-pressed={traffic} onClick={() => setTraffic(!traffic)}>
          Google traffic
        </button>
        <button disabled={!ready || locating} onClick={locate}>
          <LocateFixed size={16} />
          {locating ? 'Locating…' : 'My location'}
        </button>
        <div className="aether-map-camera" role="group" aria-label="Map camera controls">
          <button
            disabled={!ready}
            aria-label="Zoom map in"
            onClick={() => map?.setZoom((map.getZoom() ?? 12) + 1)}
          >
            <Plus size={17} />
          </button>
          <button
            disabled={!ready}
            aria-label="Zoom map out"
            onClick={() => map?.setZoom((map.getZoom() ?? 12) - 1)}
          >
            <Minus size={17} />
          </button>
          <button
            disabled={!ready}
            aria-label="Reset map camera to Gurugram"
            onClick={() => map?.moveCamera({ center: gurugram, zoom: 12, tilt: 0, heading: 0 })}
          >
            <RotateCcw size={16} />
          </button>
          <button
            disabled={!ready || (!points.length && !lines.length && !features.length)}
            aria-label="Fit visible records"
            onClick={() =>
              map?.moveCamera(
                fitCamera(
                  [
                    ...points.map((p) => p.coordinate),
                    ...lines.flatMap((l) => l.coordinate),
                    ...features.flatMap((f) => geometryCoordinates(f.geometry)),
                  ],
                  root.current?.clientWidth ?? 500,
                  root.current?.clientHeight ?? 400,
                ),
              )
            }
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>
      <div className="aether-map-surface">
        <div
          className="aether-google-canvas"
          ref={root}
          role="region"
          aria-label="Google map of Gurugram. Use arrow keys to pan and plus or minus to zoom. Record list provides equivalent selection."
        />
        {!ready && (
          <div className="aether-map-state" role="status">
            <MapPin size={28} />
            <h3>
              {state === 'missing'
                ? 'Google Maps awaits your key.'
                : state === 'authorization'
                  ? 'Google Maps authorization failed.'
                  : state === 'network'
                    ? 'Google Maps could not load.'
                    : 'Opening Gurugram…'}
            </h3>
            <p>
              {state === 'missing'
                ? 'Real streets and satellite imagery appear after the web map configuration is added.'
                : state === 'authorization'
                  ? 'Check the web key’s allowed referrers, Maps JavaScript API access, and billing in Google Cloud.'
                  : state === 'network'
                    ? 'Check your connection, content blocker and Google Maps configuration, then reload.'
                    : 'Loading Google’s geographic data. No simulated basemap is used.'}
            </p>
            <p>Observation details and module controls remain available.</p>
            {state !== 'loading' && state !== 'missing' && (
              <button className="button subtle" onClick={() => window.location.reload()}>
                Reload map
              </button>
            )}
          </div>
        )}
      </div>
      <footer className="aether-map-info">
        <div className="aether-map-legend" aria-label="Severity legend">
          {(
            legend ?? Object.entries(severityColor).map(([label, color]) => ({ label, color }))
          ).map(({ label, color }) => (
            <span key={label}>
              <i style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="aether-demo-key">
            DEMO = simulated · Dashed = demo, proposed or uncertain
          </span>
        </div>
        <p>
          {sources.filter((source) => source === 'AUTHORIZED').length} authorized records ·{' '}
          {sources.filter((source) => source === 'DEMO' || source === 'TEST').length} simulated
          records {ready ? 'mapped' : 'with coordinates'}. Basemap availability does not indicate an
          AETHER data feed.
        </p>
        {points.some((p) => p.source === 'LOCAL') && (
          <p>LOCAL imports are unverified and remain in this browser review only.</p>
        )}
        {note && <div className="aether-map-note">{note}</div>}
        {traffic && (
          <p>
            Google traffic visualization, where available. AETHER does not extract raw speeds,
            detect incidents, or verify causes from this layer.
          </p>
        )}
        {recurrence && (
          <p>
            Stored-case context halos have an illustrative 180 m radius; they do not represent a
            measured hazard boundary.
          </p>
        )}
        {locationMessage && <p role="status">{locationMessage}</p>}
        {selectedPoint && (
          <div className="aether-map-selection" aria-live="polite">
            <b>
              {selectedPoint.source} · {selectedPoint.title}
            </b>
            <span>{selectedPoint.detail}</span>
          </div>
        )}
      </footer>
    </section>
  );
}
