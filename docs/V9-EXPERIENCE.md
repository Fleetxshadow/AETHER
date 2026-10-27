# AETHER — Beyond the Visible (V9)

Implemented and reviewed locally on 23 October 2026. No deployment, backend/schema changes, credentials changes, package installation or mobile-app edits.

## What changed

The first visit now approaches an original 3D city, investigates a simulated road signal, reveals AETHER and settles into the interactive hero. Seven presentation scenes share an approximately eight-second clock, one canvas, one continuous Catmull–Rom camera path and a matching final lens/pose. A full-viewport city composition replaces the earlier expanding-and-contracting hero frame. Renderer preparation can extend the wall time on a cold device. Skip, direct COMMAND access, replay, focus trapping and explicit sound consent remain available.

The opening uses the existing real-time renderer rather than adding a video decoder or image-sequence cache. Original geometry, a sky shader, distant instanced buildings, street lighting and existing city assets render the shots. The hero uses local light-on-dark text tokens so Aqua and sage retain readable headings and guided-tour links over the dark picture. The clean WebP fallback is captured from AETHER's own renderer. Unsupported or late WebGL retains accessible HTML and the poster; a readiness timeout no longer unmounts the renderer and prevents recovery. No paid film footage or template assets were copied.

Observe, Understand and Anticipate follow one spatial road anchor through ordinary road, congestion, waterlogging, infrastructure obstruction and connected-review contexts. Camera composition, queued vehicles, water geometry, obstruction geometry and route emphasis change together. Scroll reversal remains natural on larger screens. Stacked tablet layouts, phones, short viewports and reduced motion use manual chapter/environment controls in document flow. The evidence panel initially collapses on compact layouts. Its position animation preserves the 44 px summary target instead of scaling it during content changes.

The Quad X showcase now has four scroll-controlled camera/component stages, reversible orbit, studio reflections, assembly inspection and manual override. Component labels retain the existing 01–05 numbering. Selecting a component, orbiting or changing assembly takes control; Resume Scroll Tour explicitly restores choreography. Reflections use Three's local RoomEnvironment and PMREM with cleanup, avoiding another external asset request. The existing procedural X1 model is a conceptual design, not validated manufacturer CAD or a source of hardware specifications.

The showcase leads into the existing real Gurugram map and `/command/geo`. Fictional city geometry is never mapped onto real roads. Existing Google attribution, roadmap, satellite, traffic, geolocation controls, authorized-record contracts, severity legend, layers and operational routes remain intact. Route focus now selects the rendered heading when Next.js retains hidden Activity content. No changes were made to authentication, Firebase collections/rules, telephony, private evidence access or mobile-app source.

## Reference study and assets

Each requested public Scrolltide page was individually inspected:

| Reference | Principle applied in original AETHER work |
| --- | --- |
| [Macaw](https://www.scrolltide.co/templates/macaw) | Ending subject/camera composition continues into the interactive hero. |
| [Toucan](https://www.scrolltide.co/templates/toucan) | One-time camera approach, retained final scene, explicit replay. |
| [Selene](https://www.scrolltide.co/templates/selene) | Foreground, road, buildings, skyline and atmosphere under a moving spatial camera. |
| [Valmora](https://www.scrolltide.co/templates/valmora) | Reversible product orbit, component focus and technical inspection. |
| [Earshot](https://www.scrolltide.co/templates/earshot) | One coherent road through five meaningful environmental changes. |

The asset-first decisions are recorded in [V9-ASSETS.md](V9-ASSETS.md). Earlier Motion/GSAP/UI research remains in [AWAKENING.md](AWAKENING.md). Current library documentation was checked through Context7, including Motion's position-only layout behavior. Existing dependencies were reused.

## Validation

| Check | Actual result |
| --- | --- |
| TypeScript, full ESLint and backend/domain tests | Passed; all 52 tests passed. The test process reports expected unavailable-browser-storage messages. |
| Production build | Passed with exit 0 after the documented immediate security-reminder retry; all 26 pages generated. |
| Existing browser regressions | All 25 distinct existing cases passed across the full run and focused rechecks. Hidden Next Activity content required visibility-aware selectors. |
| New V9 regressions | All three passed in one final run: reversible drone camera/manual override, final-frame canvas/camera continuity, and animated 44 px target/keyboard expansion. |
| Actual-Google responsive matrix | All 10 viewport/motion cases passed across the full run and targeted final tablet/landscape rechecks. Each recorded zero console errors and zero failed network requests. |
| Alternate themes | Original, Aqua, spectrum and sage passed accessibility/layout checks and explicit hero text-color assertions after the final contrast correction. |

All 28 distinct browser regression cases passed across the runs above; this is not a claim that a single final run executed all 28. Matrix results are retained in [results.json](v9/validation/results.json).

The matrix covers 390×844, 768×1024, 1280×720 and 1440×900 in normal/reduced motion, plus 844×390 landscape and 1280×600 short desktop in normal motion. Eclipse is the main run; original, Aqua, spectrum and sage have additional accessibility/layout checks. Automated accessibility excludes Google's internally managed map UI; AETHER controls and content remain included. Standard browser regressions use a Google SDK double; the separate responsive matrix uses the actual configured Google service.

The final opening/hero test compares canvas identity, viewport bounds and the last rendered film-frame projection against the settled hero. It keeps the 3 px projection tolerance; it does not sample a fixed delay after a DOM scene update on slow software WebGL. A separate test verifies actual reversible drone camera projections and manual override. The evidence-target regression samples the control throughout a scene change and checks keyboard collapse/expansion. An earlier failure measured a 44 px layout target rendered at about 34 px because of scale animation; position-only layout fixed the cause.

Real Gurugram street labels and attribution were visually reviewed. Roadmap/satellite/traffic controls and homepage-to-GEO navigation work, with one Google SDK load across retained routes. The map correctly shows zero authorized AETHER records when no feed supplies them. Basemap availability is not a live incident feed. Existing backend/domain tests cover geometry, timestamps, roles and human-verification boundaries; this UI work does not establish a live Firebase connection.

## Visual and motion evidence

- Before: [V8 desktop hero](awakening/validation/screenshots/1440x900-no-preference-hero.png).
- After: [desktop hero](v9/validation/screenshots/1440x900-no-preference-hero.png), [phone hero](v9/validation/screenshots/390x844-no-preference-hero.png), [tablet scene](v9/validation/screenshots/768x1024-no-preference-water.png), [water context](v9/validation/screenshots/1440x900-no-preference-world-2.png), [Quad X](v9/validation/screenshots/1440x900-no-preference-drone.png) and [real Gurugram map](v9/validation/screenshots/1440x900-no-preference-map.png).
- Recordings: [desktop opening, environments, drone and GEO transition](v9/validation/motion/1440x900-no-preference.webm) and [phone walkthrough](v9/validation/motion/390x844-no-preference.webm).
- Reviewed timed playback frames: [desktop opening](v9/validation/motion/1440-opening-contact.png), [desktop walkthrough](v9/validation/motion/1440-walkthrough-contact.png), [reversible Quad X orbit](v9/validation/motion/quad-scroll-contact.png) and [phone opening](v9/validation/motion/390-opening-contact.png).
- Machine-readable matrix: [results.json](v9/validation/results.json). Intermediate `proof/` and failed earlier runs document development defects; they are not final success evidence.

The six normal-motion matrix cases recorded all seven scene indices, actual real-time rendering during scenes 1–6 and 76–77 distinct projected-camera states. No duplicate hero canvas was introduced. These are browser observations of visible motion, not frame-rate measurements. Local DOM-ready times ranged approximately 156–465 ms; per-case maximum long tasks ranged 277–1261 ms. Startup stalls therefore remain material. These localhost runs have no controlled hardware/network baseline and do not establish a performance speedup.

## Remaining limits

- Firebase/live GPS trails, surveyed impact boundaries and live incident feeds are not configured. Existing adapters/contracts remain available; cinematic observations are explicitly simulated.
- The city and drone are procedural original illustrations. No authentic validated CAD model or encoded production film was supplied. Real-time rendering was chosen; no claim of photoreal film footage or manufacturer accuracy is made.
- Cold renderer startup can exceed the designed eight-second presentation. The poster/manual alternatives preserve access, but startup long tasks remain. Local observations are not a controlled FPS, GPU-memory or before/after benchmark.
- No physical-device or second-computer test was performed. Browser/backend testing follows the user's earlier authorization after ARTEMIS was unavailable.
- Installed Next.js 16.4.0 reports a known security vulnerability. Upgrade is recommended before external exposure; the preview remains bound to localhost. The documented immediate build retry succeeded without disabling the warning or changing security controls. Existing root-lockfile and unset `metadataBase` warnings remain.
- Optional `npm audit` did not run: automatic approval review rejected sending dependency metadata to npm. Local diagnostics and public documentation were used; no workaround request was made.

## Main implementation owners

| Files | Responsibility |
| --- | --- |
| `src/lib/awakening.ts`, `src/components/genesis.tsx` | Seven scenes, first-visit playback, readiness, fallback, skip/replay and reduced-motion reading. |
| `src/components/cinematic-hero.tsx`, `src/app/beyond-visible.css` | Shared full-viewport scene, coordinated HTML entrance and responsive composition. |
| `src/components/scenes/city-scene.tsx`, `cinematic-environment.tsx`, `awakening-effects.tsx` | Camera journey, original environment, incident-story geometry and lighting. |
| `src/components/experience.tsx`, `experience-sections.tsx` | Scene order, scroll/manual environments and compact evidence panel. |
| `src/components/engineering.tsx`, `src/components/scenes/drone-scene.tsx` | Scroll product orbit, component focus, studio environment and manual override. |
| `src/components/scenes/scene-boundary.tsx`, `public/cinematic/city-poster.webp` | Accessible visual fallback. |
| `src/components/route-transition.tsx` | Existing route choreography and rendered-heading focus ownership. |
| `tests/v9.spec.ts`, `tests/app.spec.ts`, `tests/awakening.spec.ts`, `scripts/v9-qa.mjs` | Browser regressions, Activity-aware selectors and actual-map matrix/recordings. |

Local production preview: **http://127.0.0.1:3001**. Nothing was deployed.
