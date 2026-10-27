---
name: aether-geospatial
description: Geographic data rules for AETHER — coordinate order, Gurugram vs. demo geography, GeoJSON contracts, Google Maps/MapLibre layers, routing geometry and validation. Use when touching maps, coordinates, incidents, traffic segments, routes, or spatial features.
---

# AETHER geospatial

## Coordinate conventions

- Storage/contracts: WGS84 **`[longitude, latitude]`** (`MapCoordinate` in `src/lib/operational-map.ts`, `geoCoordinate` in `src/lib/geo-contracts.ts`, traffic + mobile DTO). Google Maps wants `{lat, lng}` — convert only via `latLng()`.
- Validate with existing helpers (`validCoordinate`, `validSpatialGeometry`, Zod schemas) — never hand-roll range checks.
- Operational center: Gurugram `28.4595 N, 77.0266 E` (`gurugram` in `operational-map.ts`).

## Real vs. demo geography (do not mix)

- Bundled city observations use **Bengaluru reference coordinates** in a conceptual city. They are DEMO and must not be relocated onto Gurugram roads.
- Gurugram traffic corridors in `src/lib/traffic/demo.ts` (`nexus-gurugram-sketch-v1`) are **approximate sketches**: hidden by default, labeled DEMO/TEST, dashed lines.
- RESPONSE incidents with location text but no coordinates are **not geocoded or guessed**; they stay in the list without a pin.
- Never invent an incident location, drone sighting, road segment, or route. If geometry is missing, show "no location" rather than a plausible point.

## Map stacks

- `/command` operational views (COMMAND, TWIN, FLOW, RESPONSE): Google Maps JS via `src/lib/google-maps.ts` (single loader promise, auth-failure event) and `google-operational-map.tsx` (OverlayView HTML markers, no Map ID). Without `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` the explicit missing-config state is shown — tests expect it.
- Cinematic/illustrative maps: MapLibre 6 with bundled GeoJSON (`src/lib/map.ts`, `geo-map.tsx`); worker copied by `scripts/copy-maplibre-worker.mjs` (`predev`/`prebuild`).
- Google traffic layer is visual only — not a data source for speeds, causes or incidents.
- AETHER MAP (mobile) uses MapLibre Native + OpenFreeMap, Photon geocoding, OSRM routing — different stack; see that repo.

## Docs lookup

Use the `google-maps-code-assist` MCP (`retrieve-google-maps-platform-docs`) for Maps JS API questions instead of memory. It only retrieves docs; real Maps calls bill the user's key — don't add new paid APIs (Routes, Places, 3D tiles) without approval.

## Checks

- Unit: `tests/geo.test.ts`, `tests/traffic.test.ts`; browser: `tests/geo.spec.ts`, `tests/traffic.spec.ts` (Google Maps is stubbed by `tests/map-setup.ts` + `tests/fixtures/google-maps-api.js`).
- Real geography (labels, satellite, referrer errors) can only be checked with the user's key in a real browser; say so instead of claiming it.
