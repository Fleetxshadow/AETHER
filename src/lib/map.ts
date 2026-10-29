import type { FeatureCollection, Feature, Polygon, LineString, Point } from 'geojson';
import { buildings, worldToLngLat } from './city';
import { severityColor, type Observation } from './data';
import type { StyleSpecification } from 'maplibre-gl';
import { themes, type ThemeId } from './themes';
export const buildingFeatures: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: buildings.map((b) => ({
    type: 'Feature',
    properties: { id: b.id, name: b.name, height: b.h * 5, heat: Math.round(26 + b.h * 1.3) },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          worldToLngLat(b.x - b.w / 2, b.z - b.d / 2),
          worldToLngLat(b.x + b.w / 2, b.z - b.d / 2),
          worldToLngLat(b.x + b.w / 2, b.z + b.d / 2),
          worldToLngLat(b.x - b.w / 2, b.z + b.d / 2),
          worldToLngLat(b.x - b.w / 2, b.z - b.d / 2),
        ],
      ],
    },
  })),
};
export const roadFeatures: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [-9.6, 3.2, 16].flatMap((v, i) => [
    {
      type: 'Feature' as const,
      properties: { weight: i + 1 },
      geometry: {
        type: 'LineString' as const,
        coordinates: [worldToLngLat(v, -23), worldToLngLat(v, 23)],
      },
    },
    {
      type: 'Feature' as const,
      properties: { weight: i + 1 },
      geometry: {
        type: 'LineString' as const,
        coordinates: [worldToLngLat(-23, v), worldToLngLat(23, v)],
      },
    },
  ]),
};

export function observationFeatures(records: readonly Observation[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: records.map((o) => ({
      type: 'Feature',
      properties: {
        id: o.id,
        title: o.title,
        severity: o.severity,
        color: severityColor[o.severity],
        module: o.module,
      },
      geometry: { type: 'Point', coordinates: o.location },
    })),
  };
}
const park: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        worldToLngLat(-23, -10),
        worldToLngLat(-11, -10),
        worldToLngLat(-11, 10),
        worldToLngLat(-23, 10),
        worldToLngLat(-23, -10),
      ],
    ],
  },
};
export function mapStyle(theme: ThemeId = 'original'): StyleSpecification {
  const palette = themes[theme];
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  return {
    version: 8,
    name: 'AETHER conceptual city',
    sources: {
      ...(tileUrl
        ? {
            basemap: {
              type: 'raster' as const,
              tiles: [tileUrl],
              tileSize: 256,
              attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || 'Configured tile provider',
            },
          }
        : {}),
      buildings: {
        type: 'geojson',
        data: buildingFeatures,
        attribution: 'AETHER original conceptual geometry · demo geography',
      },
      heat: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: buildings.map((b) => ({
            type: 'Feature',
            properties: { heat: Math.round(26 + b.h * 1.3) },
            geometry: { type: 'Point', coordinates: worldToLngLat(b.x, b.z) },
          })),
        },
      },
      roads: { type: 'geojson', data: roadFeatures },
      parks: { type: 'geojson', data: { type: 'FeatureCollection', features: [park] } },
      observations: {
        type: 'geojson',
        data: observationFeatures([]),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 42,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': theme === 'original' ? '#171e1b' : palette.scene.background },
      },
      ...(tileUrl
        ? [
            {
              id: 'basemap',
              type: 'raster' as const,
              source: 'basemap',
              paint: { 'raster-opacity': 0.6 },
            },
          ]
        : []),
      {
        id: 'park',
        type: 'fill',
        source: 'parks',
        paint: {
          'fill-color': theme === 'original' ? '#334936' : palette.secondary,
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'road-case',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': theme === 'original' ? '#323b32' : palette.scene.surface,
          'line-width': 13,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'roads',
        paint: { 'line-color': '#65735f', 'line-width': 2, 'line-opacity': 0.75 },
      },
      {
        id: 'structures',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
          'fill-extrusion-color': '#7c8879',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.7,
        },
      },
      {
        id: 'heat',
        type: 'heatmap',
        source: 'heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'heat'], 25, 0, 45, 1],
          'heatmap-intensity': 1,
          'heatmap-radius': 35,
          'heatmap-opacity': 0.65,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(255,179,71,0)',
            0.3,
            '#637f53',
            0.6,
            '#e1b363',
            1,
            '#e2744b',
          ],
        },
      },
      {
        id: 'clusters',
        type: 'circle',
        source: 'observations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': palette.primary,
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22],
          'circle-stroke-color': '#1c231e',
          'circle-stroke-width': 4,
        },
      },
      {
        id: 'observation-halo',
        type: 'circle',
        source: 'observations',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': 15, 'circle-opacity': 0.12 },
      },
      {
        id: 'observations',
        type: 'circle',
        source: 'observations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5,
          'circle-stroke-color': '#101714',
          'circle-stroke-width': 2,
        },
      },
    ],
  };
}
