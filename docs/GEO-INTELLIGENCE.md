# AETHER spatial intelligence

GEO is available at `/command/geo`. COMMAND's City view and TWIN use the same review workspace. SKY retains its engineering explorer, camera tools and evidence replay, with a direct link to geographic review. The illustrative homepage city is unchanged and does not represent Gurugram geography.

## Repository audit

- Next.js 16.4, React 19, TypeScript, Zustand, Motion/GSAP, React Three Fiber and Three.js. The existing official `@googlemaps/js-api-loader` 2.0.2 is reused. No second map engine or new dependency was added.
- Google Maps is configured locally and real Gurugram roads/satellite imagery work. The initial center remains 28.4595 N, 77.0266 E. Google attribution and cooperative pan/zoom are preserved. Photorealistic 3D/tilt is not enabled: compatible vector-map configuration, coverage, overlay support and cost were not established.
- The existing Firebase bridge validates site-scoped observations, telemetry, devices, camera health and AI detections; operator claims additionally allow incident and response-report feeds. Firebase public configuration, Admin access and live traffic remain unconfigured/disabled locally.
- Existing observations have point coordinates. Incidents/response reports have location text but no geographic-coordinate field. They are not geocoded or assigned guessed locations.
- Existing protected traffic registry/case records contain road geometry, investigation candidates, review state and public projections. They are reused through the existing `/api/response/traffic` endpoint. `requestTraffic` was moved into a shared client helper without changing the endpoint, authentication or workflow.
- No existing subscribed feed or supplied record contains GPS trails, sampled flight positions or surveyed affected-area boundaries. No new Firebase collection/path was invented. The spatial contract/importer below supplies a review interface until an authorized historical feed is provided.

## Workspace and rendering

The left panel has independent SKY, FLOW, AQUA, ROAD, FIRE, GEO, CORE and COMMAND layers, severity/search filters, verified/under-review visibility and a separate DEMO toggle. Phone/tablet layers collapse into native disclosures rather than shrinking the desktop controls. Controls and record buttons retain 44px targets and visible keyboard focus.

The center keeps a stable Google map during filtering and timeline playback. Native Google Data layers render GeoJSON LineString, Polygon and MultiPolygon geometry, including holes. Uncertain/estimated and simulated boundaries use dashed native polyline edges. Recorded trails are teal; proposals are gray/dashed and explicitly labeled. Start/end markers retain individual targets. A first GPS sample alone does not create a LineString; at least two supplied samples are needed.

Feature IDs and geometry fingerprints keep unrelated shapes from being removed/re-added. DOM marker buttons are culled outside the viewport and clustered in 64px cells. Selecting a cluster opens its equivalent record list; co-located observations remain independently selectable. Selected points and trail endpoints stay separate. Camera framing uses original longitude/latitude coordinates and respects reduced motion. Only genuinely recent authorized points receive a bounded pulse.

The right panel shows the feature/incident ID, module/category, supplied location, severity, timestamps, review state, valid confidence, associated aerial session and evidence references. It separates the observed event, CORE finding, AI-suggested cause and human-verified cause. A general AI description is not promoted to a causal conclusion. FLOW preserves its six traffic classifications, including gray UNKNOWN, and incident resolution state. The spatial view does not perform verification writes; existing traffic review still enforces its own roles.

Evidence references expand on demand. Existing observation evidence opens through the established detail drawer. No actual photos/private aerial images were available to attach, and imported URLs are rejected rather than fetched. Existing camera/evidence tools remain in SKY.

The timeline uses supplied observation timestamps and GPS sample times. It reveals only the available prefix of a trail, with no interpolated flight. Proposals remain proposals throughout playback. Later verification/analysis is withheld when no earlier snapshot exists. Severity is explicitly the latest source classification; past incident classifications are not reconstructed. Proposed-path timestamps denote the proposal's creation/update, not a completed observation.

## GeoJSON contract and access

COMMAND and TWIN retain their original point-dataset snapshot controls, now labeled LEGACY DEMO SNAPSHOT. Those controls filter their existing observation records only. Standalone GEO reviews source timestamps through its own observation timeline; neither timeline rewinds Google imagery or Google traffic.

`src/lib/geo-contracts.ts` owns the strict review contract and geometry validation. `src/lib/geo-review.ts` projects existing validated point/road/AI records and produces temporal map views. `public/demo/aether-spatial-review.geojson` is the downloadable example containing 13 fictional Gurugram-relative features. It is loaded only after DEMO is enabled. Old illustrative-city samples keep their original Bengaluru coordinates.

Use a standard `FeatureCollection` with a unique string `Feature.id`, a Point/LineString/Polygon/MultiPolygon geometry and versioned `properties`. The example enumerates the required metadata:

- `schemaVersion`, `siteId`, `module`, `kind`, `source`, `audience`, `title`, `location`, `description`, `severity`.
- `observedAt`, `updatedAt`, `verification`, `verifiedAt`, `verifiedBy`, `confidence`.
- `pathStatus`, `sampleTimes`, `sessionId`, `evidenceIds`, `geometryBasis`, `estimated`.
- `analysis.finding`, `analysis.suggestedCause`, `analysis.verifiedCause`, `analysis.method`.
- Optional `trafficLevel`, `incidentStatus` and `incidentId` retain existing FLOW classifications and the original linked incident identifier.

Coordinates remain **[longitude, latitude]** with their original precision. Conversion to `{lat, lng}` occurs only at the Google API boundary. Timestamps retain their supplied ISO strings. Recorded/sample trails require one strictly ordered timestamp per coordinate; proposals cannot include completed GPS samples. Affected areas/road geometry require supporting references and an explicit geographic basis. A single incident point is never buffered into a disaster polygon.

The importer accepts up to 2 MB, 200 features and 5,000 coordinate positions. Individual lines are limited to 1,000 positions and rings to 128 positions. Invalid ranges/non-finite positions, degenerate/open/self-intersecting rings, invalid holes, overlapping MultiPolygon interiors, duplicate IDs, wrong sites, broken session links, chronology conflicts and unknown fields are rejected. Antimeridian-crossing segments and touching polygon boundaries are deliberately rejected by this bounded local-review validator. This is not a general GIS repair engine.

Access context is supplied by the application, never by the file:

| Origin / source | Access and meaning |
| --- | --- |
| Bundled DEMO | Explicitly simulated; never LIVE or an actual completed flight |
| Imported DEMO | Browser review only; simulation remains visible everywhere |
| Imported LOCAL | Existing Firebase `nexusRole: operator` required; always under review, cannot self-verify |
| AUTHORIZED | Accepted only by the backend-adapter boundary after established role/site access; files cannot assert this provenance |
| OPERATOR audience / operational trail | Hidden from viewers and anonymous users |

Files are parsed in browser memory. There is no upload, persistence, publication or incident-creation request. A later authorized record wins ID collisions; an import cannot replace a protected record. Private reviews and pending reads clear/abort on role changes, sign-out and unmount. No raw trail collection is exposed through a public endpoint.

`readSpatialCollection(value, { origin: 'BACKEND', role, siteId })` is the validated consumption boundary for a future **already authorized** historical-data adapter. It is not a new feed, a substitute for server authorization, or a reason to grant browser access to a private collection. Integrators must bind that adapter to an actual established provider and its permissions before describing GPS or area feeds as connected.

## Existing permissions and mobile compatibility

Firestore/Realtime rules are unchanged. General feeds still use `nexusSite` plus `nexusRole` viewer/operator claims. Traffic reads and writes still enforce `nexusTrafficRole` ANALYST/REVIEWER/INGESTOR on the server; a generic operator role does not grant traffic verification. Optional FLOW reading fails independently of map rendering and clears unavailable private snapshots.

The public mobile `trafficIncidents` DTO, approval filters, freshness checks and publication path are unchanged. No aerial trails, evidence objects, unverified local files or municipal boundaries are automatically exported. The separate mobile-app project was not edited. No flight command, aircraft launch, autonomous route execution, emergency-service call or deployment was performed.

## Validation

`npm.cmd run check` runs source checks and domain/backend tests, including GeoJSON topology, sample chronology, provenance/role restrictions, temporal clipping, no invented causes, UNKNOWN traffic semantics and marker clustering.

`node scripts/geo-intelligence-qa.mjs --mock` exercises the actual UI against a clearly labeled Maps API test double at port 3002. It covers all four requested sizes and both motion preferences, stable map/shape updates, timeline play/pause, area selection, layers, clusters, GeoJSON import, role loss, Firebase error state, no-write behavior, theme accessibility and optional map failures. Test doubles are not proof of Google geography.

`NEXUS_QA_URL` selects a local QA server. Running the script without `--mock` validates the real Google API; this requires a configured key in the production build and network access. Screenshots and sanitized results are saved under `docs/geo-intelligence/`. Browser performance reports contain timing/count metrics only, not key-bearing URLs.

The standard production browser regressions use `tests/map-setup.ts` to intercept the Google SDK when configured, so their success is independent of external Google requests. Real-map proof is recorded separately. Older `scripts/google-maps-qa.mjs` COMMAND/TWIN selectors describe the pre-GEO interface; the new spatial suite supersedes those selectors. Real Firebase/GPS ingestion, a second physical LAN device and Android testing require external configuration/hardware and are not claimed here.

### Final verified results

- `npm.cmd run build`: passed; production pages and APIs generated. Existing warnings remain for the home-directory lockfile and unset `metadataBase`.
- `npm.cmd run check`: passed TypeScript, ESLint and all 52 domain/backend tests, including 10 spatial-contract tests.
- Standard production browser run: 20 of 21 cases passed initially. The remaining assertion incorrectly expected the existing observation aside to have a dialog role. After correcting the selector, `npm.cmd run test:e2e -- --grep 'map, details|GEO reuses' --timeout=180000 --output=test-results-recheck --reporter=list` passed both the original regression and the added FLOW-to-GEO integration case. All 21 existing cases plus the new integration case have passed across these runs.
- The additional case reads the same private DEMO FLOW session in GEO and verifies original incident IDs, geometry provenance, CORE findings and explicit simulation labels, with no GEO verification/publication writes.
- `NEXUS_QA_URL=http://localhost:3001 node scripts/geo-intelligence-qa.mjs`: all eight **actual Google Maps** cases passed at 390×844, 768×1024, 1280×720 and 1440×900, each in normal and reduced motion. Fresh console errors and network failures were empty in every case. Real street labels, Google attribution and spatial overlays were visually inspected in the saved screenshots.
- The API-double suite passed eight viewport/motion cases and seven additional checks covering themes, import/access cleanup, Firebase feed errors, map authorization/network failures and independent record review. These checks do not establish live Firebase access or real geographic feeds.
- Final changed browser-test files passed TypeScript and targeted ESLint checks. No production source changed after the verified build.

Evidence is stored in `docs/geo-intelligence/screenshots/`, `mock-validation.json` and `real-validation.json`. `before-map.png` is the previous operational-map baseline; `real-*.png` show the implemented review workspace. The real-map run recorded DOM-ready times of 603–2,314 ms and maximum long tasks of 290–3,192 ms while other browser/source checks were also running. These are local timing observations, not a controlled performance improvement claim; Google SDK/tile initialization still has a material startup cost.

The final production preview listens on `0.0.0.0:3000`. At validation time its Wi-Fi address was `http://192.168.31.225:3000` (DHCP addresses can change). `/command/geo` returned HTTP 200 there, loaded actual Google Maps 3.65.14a, and passed real Google traffic-layer toggle, zoom/reset, and fresh console/network checks. See `lan-validation.json` and `screenshots/real-lan-gurugram.png`. This is a check from the host through its LAN address; another physical computer was not used.

Launch locally with `npm.cmd run build` followed by `npm.cmd run start -- --port 3000`. The existing start script binds all interfaces. Nothing was deployed. Awakening was paused when this GEO stage was completed; the subsequent revised Awakening implementation and its validation are documented in [AWAKENING.md](AWAKENING.md).
