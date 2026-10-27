# AETHER operational geography

COMMAND, TWIN, FLOW and RESPONSE now use one Google Maps JavaScript API component, initially centered on **28.4595° N, 77.0266° E, Gurugram, Haryana**. The cinematic homepage and guided presentation retain their explicitly illustrative city. TWIN uses the geographic map and satellite mode; it does not claim Google photorealistic 3D coverage.

The repository audit confirmed Next.js 16.4, React 19, TypeScript, Motion/GSAP, React Three Fiber/Three.js and Firebase. The former operational MapLibre view used synthetic geography; the traffic workspace used approximate demo corridor sketches. Firebase configuration and the Google Maps key were absent, and live traffic/Admin access was disabled. Existing data subscriptions, authentication and backend contracts were reused rather than assumed to be connected.

## Add the key after implementation

1. In your own Google Cloud project, enable **Maps JavaScript API** and its billing account. Review Google's current prices and set appropriate quotas/budget alerts. This implementation does not activate a project or billing.
2. Create a **browser** API key. Restrict its APIs to Maps JavaScript API and its application access to the websites you use. Example development referrers: `http://localhost:3000/*`, `http://127.0.0.1:3001/*`, and `http://YOUR-LAN-IP:3000/*`. Use your actual LAN address, and remove development referrers from a separate production key. Test exact referrer patterns in your Google Cloud project.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-web-key` in the existing ignored `.env.local`. Keep existing Firebase/backend entries. Never add server credentials to a `NEXT_PUBLIC_` variable.
4. Stop the local server, run `npm.cmd run build`, then `npm.cmd run start -- --port 3000`. Public Next.js variables are embedded during build. A production-server restart alone does not update a previously built key.
5. Check real Gurugram road labels, satellite imagery, Google attribution, traffic availability, and the browser console from localhost **and** a second LAN device. A `RefererNotAllowedMapError`, `ApiNotActivatedMapError` or billing error needs correction in your Google project; AETHER cannot override Google authorization.

Geolocation is requested only through **My location**, stays in the browser, and is not saved to AETHER. Browsers usually require HTTPS or localhost. Ordinary LAN HTTP can show the map but generally cannot provide geolocation.

## Data and permissions

- General module overlays consume the existing validated `useNexus` observations from `DataBridge` and the protected Firebase subscriptions. Existing site/role claims, freshness checks and sign-out cleanup remain responsible for access. The map adds no Firebase writes, collections or schema changes.
- FLOW's geographic view uses the same protected traffic registry/cases already supplied to `TrafficDashboard`. Its road/case selection, investigation status, human verification and public mobile projection stay intact. Case details are reviewed in the existing FLOW workspace.
- FLOW, AQUA, ROAD, FIRE and SKY filter the actual observation module. COMMAND includes available observations. CORE includes geographic source references from the existing AI-detection feed, or CORE observations with linked evidence. An observation is not automatically a verified incident.
- Existing live RESPONSE incident records have location text but no geographic-coordinate field. They are **not geocoded or guessed**. Local RESPONSE demo reports can be placed only when callers supplied coordinates; missing coordinates remain in the report list.
- Public mobile `trafficIncidents` remains the existing strict approved DTO. Private traffic cases/evidence are not exported through the map. The separate mobile-app project was not changed.
- Bundled city observations retain their original Bengaluru reference coordinates. Gurugram corridor sketches retain their original approximate coordinates. They are hidden by default and require the explicit simulated-data control. Their pins carry DEMO/TEST labels; simulated road lines are dashed. None is reclassified as live or relocated onto a different road.
- Google traffic is an optional **visual** layer. It does not supply AETHER with raw traffic speeds, incident detection, causes, verification or historical observations. The time machine affects AETHER demo records, not Google's imagery/traffic.

## Implementation

- `src/lib/google-maps.ts`: official `@googlemaps/js-api-loader` 2.0.2, `setOptions`/`importLibrary`, one browser-wide loading promise, quarterly channel, auth-failure callback. No inline script duplication and no key logging.
- `src/components/google-operational-map.tsx`: native Google map, roadmap/satellite, traffic toggle, zoom/reset/fit, user geolocation, loading/network/auth failures and external toolbar/legend/detail context. Native OverlayView keeps real 44px HTML marker buttons without a cloud map ID. Marker nodes update by record ID so incoming snapshots retain keyboard focus.
- `src/lib/operational-map.ts`: coordinate/source projections, evidence linkage and instant camera fit. Backend records stay unchanged.
- `src/app/operational-map.css`: responsive controls outside the map surface, semantic theme colors and preserved Google attribution. No fabricated fallback streets.

Native Google camera/tiles, coverage, referrer authorization, satellite imagery, traffic availability and billing require the user's real key. Google 3D Maps was not enabled: local coverage, cost, overlay support and device performance have not been established. At dense zoom levels pins may overlap; equivalent searchable record/road lists remain available.

## Validation and evidence

Run `npm.cmd run check` and `npm.cmd run build`. Existing browser regressions run with `npm.cmd run test:e2e` against the production server at port 3001. The no-key tests expect the explicit missing-configuration state rather than a fictitious map.

`node scripts/google-maps-qa.mjs` covers the production missing-key UI at 390×844, 768×1024, 1280×720 and 1440×900, five themes and normal/reduced motion. It checks layout, 44px controls, keyboard source controls, accessibility, screenshots and console/network failures.

`node scripts/google-maps-qa.mjs --mock` targets an isolated development server at port 3002, started with a non-secret test-placeholder key. Playwright intercepts the Google bootstrap script and supplies `tests/fixtures/google-maps-api.js`. Screenshots visibly say **API TEST DOUBLE / NO REAL GEOGRAPHY**. These checks exercise source selection, marker identity/focus, camera requests, satellite/traffic controls, geolocation, script deduplication, RESPONSE observation selection and coordinate-free reports, and intentional authorization/network/timeout failures. They do **not** verify Google's real map data or replace a later authorized-key check.

Results and screenshots are saved under `docs/google-maps/`. The real Google SDK's auth-failure callback was also exercised with an invalid placeholder key and correctly produced the authorization fallback. No valid Maps key or Firebase configuration was available during this implementation; no genuine street/satellite rendering or live backend feed is claimed as verified.

Verified on 22 October 2026 using Chrome on Windows:

| Check | Result |
| --- | --- |
| TypeScript, ESLint, domain/backend tests | Passed; 42 tests |
| Production build | Passed |
| Production browser regressions | 21 passed, including homepage motion, ten modules, observation details, settings/exports, WebGL fallback and traffic workflows |
| Production missing-key map matrix | 40 passed: four requested sizes × five themes × normal/reduced motion; 20 accessibility scans |
| Maps API test double | Eight viewport/motion cases, RESPONSE selection/unplaced-report check, three intentional error states; four accessibility scans |
| Development startup/preferences regression | One targeted test passed from the optional integration suite |
| RESPONSE manual browser verification | Eight size/motion cases; simulated-call accept, play/pause, restart and end; no clipped footer or controls below 44px |
| Local network startup | Listening on `0.0.0.0:3000`; localhost and `192.168.3.72:3000/command` returned HTTP 200 from this computer |

The production and API-double matrix reports contain no unexpected console/network failures. Visual inspection covered mobile Aqua/RESPONSE, tablet Sage, Spectrum at 1280×720 and the desktop API-double surface. Validation fixed a missing semantic role, Spectrum legend contrast, marker focus across snapshots/camera changes, and RESPONSE observation selection. Browser regressions now expect geographic TWIN rather than the retired synthetic operational scene.

At the initial no-key validation, real API/referrer/billing authorization and Gurugram imagery/traffic remained unverified. The key activation below supersedes that limitation for the tested origins. Live Firebase subscriptions, a second physical LAN computer and Android-device behavior remain unverified. The optional camera integration suite was not rerun in full. LAN HTTP geolocation still requires a secure context; native Google 3D and dense-marker clustering are not implemented.

### Key activation follow-up — 22 October 2026

The supplied Maps key had been placed in `.env.example`, which Next.js does not load. It was moved into the existing ignored `.env.local`, preserving all other entries, and the example placeholder was restored. A production rebuild and LAN-server restart then succeeded. No key value was printed or added to this report.

Actual Google road labels and Gurugram satellite imagery were visually verified at 1440×900. Roadmap/satellite selection and the Google traffic control worked; one Google bootstrap script loaded, with no Maps errors, runtime exceptions, unexpected console errors or network failures. Real-map checks also passed at 390×844 through `http://192.168.3.72:3000/command` and 768×1024 through localhost, without horizontal overflow. These were browser requests from this computer, not a second physical device. Evidence is in `actual-key-validation.json`, `actual-key-origin-validation.json` and `screenshots/actual-key-*.png`.

The web key is accepted for the two tested origins. Google Cloud restriction settings, budgets, quotas and the complete allowed-referrer list were not inspected. Google traffic visualization does not establish an AETHER live incident feed. The earlier missing-key regression suite requires a build with the Maps key unset; its report remains evidence of that fallback state rather than the now-configured build.

The dependency audit reports five high-severity findings in the existing ESLint/Next lint-tool chain (`braces` → `micromatch` → `fast-glob`), not the Maps loader. npm proposes a breaking Next ESLint downgrade; no unrelated forced upgrade/downgrade was applied. Existing build warnings also remain for the home-directory lockfile and unset production metadata base URL.

No deployment, real incident publication, telephone call or drone operation was performed.
