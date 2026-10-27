'use client';
import { useEffect, useRef } from 'react';
import { type SpatialFeature, geometryCoordinates } from '@/lib/geo-contracts';
import { spatialColor } from '@/lib/geo-review';
import { fitCamera, latLng } from '@/lib/operational-map';

const emptyFeatures: SpatialFeature[] = [];
export { emptyFeatures };
export function useGoogleSpatialLayer(
  map: google.maps.Map | null,
  features: SpatialFeature[],
  selected: string | null,
  onSelect: (id: string) => void,
  reduced: boolean,
) {
  const select = useRef(onSelect),
    current = useRef(features);
  const renderer = useRef<{
    update: (features: SpatialFeature[], selected: string | null) => void;
  } | null>(null);
  const hasFeatures = features.length > 0;
  useEffect(() => {
    select.current = onSelect;
    current.current = features;
  }, [onSelect, features]);
  useEffect(() => {
    if (!map || !hasFeatures) return;
    const data = new google.maps.Data({ map });
    const cache = new Map<
      string,
      {
        key: string;
        feature: google.maps.Data.Feature;
        edges: google.maps.Polyline[];
        selected: boolean;
      }
    >();
    data.setStyle((f) => ({
      strokeColor: String(f.getProperty('color')),
      fillColor: String(f.getProperty('color')),
      strokeOpacity: f.getProperty('dashed') ? 0 : 0.95,
      strokeWeight: f.getProperty('selected')
        ? 6
        : f.getGeometry()?.getType() === 'LineString'
          ? 4
          : 2,
      fillOpacity:
        f.getProperty('kind') === 'GEOFENCE' ? 0.025 : f.getProperty('selected') ? 0.24 : 0.11,
      zIndex: f.getProperty('selected') ? 8 : f.getProperty('kind') === 'GEOFENCE' ? 1 : 2,
      clickable: true,
    }));
    const click = data.addListener('click', (event: google.maps.Data.MouseEvent) =>
      select.current(String(event.feature.getId())),
    );
    const remove = (entry: {
      feature: google.maps.Data.Feature;
      edges: google.maps.Polyline[];
    }) => {
      data.remove(entry.feature);
      entry.edges.forEach((edge) => {
        google.maps.event.clearInstanceListeners(edge);
        edge.setMap(null);
      });
    };
    renderer.current = {
      update(next, active) {
        const ids = new Set(next.map((f) => f.id));
        cache.forEach((entry, id) => {
          if (!ids.has(id)) {
            remove(entry);
            cache.delete(id);
          }
        });
        for (const f of next) {
          if (f.geometry.type === 'Point') continue;
          const p = f.properties;
          const dashed =
            p.kind === 'TRAIL'
              ? p.pathStatus !== 'RECORDED'
              : p.estimated || p.verification !== 'VERIFIED' || p.source === 'DEMO';
          const color = p.pathStatus === 'PROPOSED' ? '#b1bac7' : spatialColor(f);
          const key = JSON.stringify([f.geometry, dashed, color]);
          let entry = cache.get(f.id);
          if (entry?.key !== key) {
            if (entry) remove(entry);
            const feature = data.addGeoJson({
              type: 'Feature',
              id: f.id,
              geometry: f.geometry,
              properties: { color, dashed, selected: active === f.id, kind: p.kind },
            })[0];
            const paths =
              f.geometry.type === 'LineString'
                ? [f.geometry.coordinates]
                : f.geometry.type === 'Polygon'
                  ? f.geometry.coordinates
                  : f.geometry.coordinates.flat();
            const edges = dashed
              ? paths.map((path) => {
                  const edge = new google.maps.Polyline({
                    map,
                    path: path.map(latLng),
                    strokeColor: color,
                    strokeOpacity: 0,
                    strokeWeight: 2,
                    icons: [
                      {
                        icon: {
                          path: 'M 0,-1 0,1',
                          strokeColor: color,
                          strokeOpacity: 0.95,
                          scale: p.pathStatus === 'PROPOSED' ? 4 : 2,
                        },
                        offset: '0',
                        repeat: p.pathStatus === 'PROPOSED' ? '22px' : '12px',
                      },
                    ],
                    zIndex: active === f.id ? 9 : 3,
                  });
                  edge.addListener('click', () => select.current(f.id));
                  return edge;
                })
              : [];
            entry = { key, feature, edges, selected: active === f.id };
            cache.set(f.id, entry);
          } else if (entry.selected !== (active === f.id)) {
            entry.selected = active === f.id;
            entry.feature.setProperty('selected', entry.selected);
            entry.edges.forEach((edge) =>
              edge.setOptions({
                strokeWeight: entry!.selected ? 5 : 2,
                zIndex: entry!.selected ? 9 : 3,
              }),
            );
          }
        }
      },
    };
    return () => {
      click.remove();
      cache.forEach(remove);
      cache.clear();
      data.setMap(null);
      renderer.current = null;
    };
  }, [map, hasFeatures]);
  useEffect(() => {
    renderer.current?.update(features, selected);
  }, [map, features, selected]);
  useEffect(() => {
    if (!map || !selected) return;
    const feature = current.current.find((f) => f.id === selected && f.geometry.type !== 'Point');
    if (!feature) return;
    const div = map.getDiv(),
      camera = fitCamera(geometryCoordinates(feature.geometry), div.clientWidth, div.clientHeight);
    if (reduced) map.moveCamera(camera);
    else {
      map.setZoom(camera.zoom);
      map.panTo(camera.center);
    }
  }, [map, selected, reduced]);
}
