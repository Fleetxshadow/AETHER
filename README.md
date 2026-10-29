# AETHER CITY — Intelligence Above. Safety Below.

An original, local urban-intelligence demonstration built with Next.js, React, strict TypeScript, React Three Fiber, Three.js, MapLibre, Motion, GSAP, and Zustand.

## Run

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. No account, paid service, API key, or downloaded model is required. Fonts, geometry, sensor samples, and evidence illustrations are local.

```powershell
npm.cmd run build
npm.cmd run start
```

## Explore

- `/` — cinematic introduction, interactive city, scroll-linked living city, intelligence network, spatial module previews, engineering studio, linked evidence, mission, and guided presentation.
- `/command` — city map, observation selection, four focus modes, historical snapshots, insight summary, and incident details.
- `/command/sky` — orbitable drone, assembled/exploded components, technical hotspots, sample telemetry, and replay.
- `/command/flow` — intersection selection, congestion layers, approach loads, and baseline comparisons.
- `/command/rescue` — recorded incident stages, local evidence review, and resolution history.
- `/command/thermal` — heat layer, surface/canopy samples, and temperature history.
- `/command/aqua` — rainfall, channel level, drainage load, and threshold visualization.
- `/command/road` — synthetic detection/repair comparison and surface assessment.
- `/command/fire` — smoke/thermal evidence, replay, confidence filtering, and local review.
- `/command/twin` — conceptual city, building selection, camera presets, orbit/zoom, layers, and day/night lighting.
- `/command/core` — deterministic, source-linked answers about the available demonstration observations.
- `/command/reports` — current/full-day summaries and source-labeled CSV/JSON downloads.
- `/command/settings` — graphics quality, reduced motion, optional audio, volume, and local preferences.

## Data and behavior

All observations and readings are **DEMO**. The recording day is **12 October 2026**, with five snapshots from 06:00 to 18:00 IST. Historical filtering excludes future observations and calculates resolution at the selected time. One shared selection drives map popups, observation panels, and the city camera. Invalid or unavailable selections clear when time changes.

The city is a conceptual model using Bengaluru reference coordinates and original synthetic geometry. It is not a surveyed city. The drone is an illustrative engineering model, not validated flight hardware. Evidence frames are original SVG illustrations, not real photographs or videos. CORE is a deterministic demonstration analysis engine; no external LLM, live sensor, emergency dispatch, or flight control is connected.

Sound starts off. Users can opt in and adjust volume. Rendering and motion preferences persist where local storage is supported. System reduced-motion settings take priority. Lower quality uses on-demand rendering; simplified mode retains an accessible city plan and data controls. WebGL failure has an explicit fallback. Scenes release their geometry/material resources and stop rendering when outside the viewport.

## Project structure

```text
src/app/                 Routes, API, metadata, loading/errors, styles
src/components/          Experience, command shell, module instruments, charts, replay
src/components/scenes/   City, drone, rendering boundary, projected DOM labels
src/lib/                 Typed schemas, demo adapter, telemetry, maps, state, sound
public/models/           Procedural-asset provenance
scripts/                 Public-reference and skill research
tests/                  Domain invariants and production browser journeys
 docs/                   Research, implementation record, validation, screenshots
```

HTML labels remain owned by the application DOM root. A small projection bridge updates screen coordinates from the 3D camera, avoiding nested React roots and cleanup races. The city uses instanced buildings, rooftop details, trees, traffic, streetlights, and network packets. Geometry is deterministic across server and browser.

## Maps and future integration

The default MapLibre style uses bundled GeoJSON. It runs without external tiles and supports clustering, heat, building extrusion, filters, popups, zoom, and animated navigation. Optional raster tiles can be configured through `.env.local` using the variables documented in `.env.example`. Supply an appropriately licensed provider and its required attribution. Public environment variables must not contain secrets.

`ObservationAdapter` in `src/lib/data.ts` is the data boundary. The demo adapter reads `/api/observations`; Zod validates source labels, geographic coordinates, confidence, timestamps, observations, and sensor readings. Replace or extend that boundary to connect an authorized backend. Current UI records are shared with the map and twin. Telemetry channels live in `src/lib/telemetry.ts`. Add real provenance and service handling before introducing a LIVE source state.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
```

Browser tests use installed Google Chrome in an isolated headless context, against a production server on port 3001. They cover navigation, 3D controls, historical selection, map layers, replay, export, local preferences, service retry, WebGL failure, mobile layout, and WCAG A/AA scans. Results and traces appear in `playwright-report/` and `test-results/`. Screenshots are saved under `docs/`.

Local browser results are recorded in `docs/VALIDATION.md`. Automated accessibility scans complement manual keyboard review; they are not a universal accessibility certification.

## Visual Rebirth evidence

The complete showcase, command shell, domain workspaces, charts and drone studio have been rebuilt. See [the implementation and reference study](docs/VISUAL-REBIRTH.md), [before/after review gallery](docs/rebirth/index.html), and [interaction recording](docs/rebirth/after/recordings/motion-tour.webm).

Production visual checks cover 390×844, 768×1024, 1280×720 and 1440×900, with normal and reduced motion. The eight scenarios verify heading motion, module keyboard selection, map/list selection, focus restoration, historical filtering, drone selection/explosion/reset, label framing, overflow, console and failed requests. Results are in `docs/rebirth/after/matrix-results.json`.

To reproduce screenshots and the recording with the production server on port 3001:

```powershell
npm.cmd run build
npm.cmd run start -- --port 3001
# In another terminal:
node scripts/rebirth-qa.mjs
npx.cmd playwright install ffmpeg
node scripts/rebirth-tour.mjs
```
