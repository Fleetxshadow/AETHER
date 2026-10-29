# NEXUS V2 — Cinematic transformation

This is a structural redesign of the homepage, engineering configurator, and command workspace. The original procedural city and drone geometry, MapLibre integration, observation model, guided presentation, and simulated-data disclosures remain.

## Three signature experiences

1. **Urban observatory hero.** A masked letter sequence and editorial heading unfold around a curved city stage. The camera approaches from a wider aerial position while the city rises into view. Glass instruments expose the recorded signal list and four shared city layers. A full-screen chapter menu supports keyboard focus, Escape, and native anchor navigation.
2. **Spatial module explorer.** Ten native module buttons form a navigable constellation around a source-backed preview. Selection moves a shared-layout light, transitions preview depth and position, updates editorial details, and opens the corresponding workspace. Phone controls become a readable grid. Arrow keys, Home, End, and direction controls remain functional.
3. **Operational handoff.** Three coordinated shutters cover navigation and reveal the requested command workspace. Next.js native link semantics remain in use; reduced motion bypasses the animated handoff. The shared data context persists across navigation.

## Engineering and operations

- The X1 configurator separates its command strip, model stage, inspection reticle, assembly rail, and expandable specification sheet. Part identity remains owned by `droneParts`: **01 airframe, 02 propulsion, 03 battery, 04 camera, 05 controller**.
- The command workspace has a floating navigation shell, framed geospatial field, recorded telemetry instruments, shared active states, and animated mode changes. Telemetry plots use the existing five recording snapshots.
- Charts retain data tables and keyboard snapshot controls. Spring-driven cursor and halo movement provide contextual feedback.
- Observation drawers add a synthetic evidence preview while retaining location, time, confidence, source, evidence, workspace links, replay, Escape dismissal, and focus restoration.
- Tablet navigation uses a centered icon rail with native tooltips and retained accessible link names. Mobile uses the existing drawer. Hero completion follows actual animation playback rather than a fixed timer.
- Motion timings and springs live in the existing motion module. Motion owns local entrance, selection, press, expansion, chart, and navigation feedback. GSAP owns scrubbed chapter bridges and the living-city scroll progression. The scene camera follows a four-segment tour and layer-sensitive rim lighting.

## Resource exploration and implementation

All ten requested resources were examined in the browser before implementation. Motion, GSAP, and Next.js documentation were also queried through Context7; the installed Next.js link guide was read before adding navigation interception.

| Resource                               | Technique carried into the implementation                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| transitions.dev                        | Deliberate entrance/exit sequences and contextual panel feedback                         |
| motion.dev                             | Spring gestures, shared-layout selection, scoped animation sequences, SVG animation      |
| scrolltide.co                          | Large scene framing, depth in module selection, scroll-linked chapter transitions        |
| reactbits.dev                          | Masked text and technical orbit/radar treatments, implemented with existing dependencies |
| beui.dev                               | Expandable instruments and keyboard-linked chart feedback                                |
| kokonutui.com                          | Translucent instruments, subtle border lighting, restrained press feedback               |
| ui.bklit.com (redirected to bklit.com) | Recorded data plots, chart cursor hierarchy, explicit sample context                     |
| gsap.com                               | Scoped scrubbed timelines with cleanup and reduced-motion alternatives                   |
| awwwards.com                           | Editorial type, framed spatial compositions, strong scene hierarchy                      |
| godly.design                           | Distinctive module presentation and balanced foreground/background depth                 |

No paid components, external templates, new animation packages, or replacement model assets were added. These are original compositions using the installed stack.

## Evidence

The [comparison gallery](cinematic/index.html) links the before/after screenshots and motion evidence. Before screenshots cover all four target sizes. Stage-specific results are in `cinematic/stage-home` and `cinematic/stage-engineering`; final production results belong in `cinematic/after`.

The final local preview runs at `http://localhost:3001`. Reproduce the production matrix with `node scripts/cinematic-qa.mjs full 3001` after `npm.cmd run build` and `npm.cmd run start -- --port 3001`.

TypeScript, lint, formatting, and the production build pass. Eight domain tests passed. Ten existing browser journeys were verified, including all module controls, settings persistence, exports, offline retry, WebGL fallback, guided presentation, historical snapshots, keyboard focus restoration, and scroll storytelling. The two focused reruns use `npm.cmd run test:e2e -- --grep "ten modules|core accessibility"`.

Automated Axe A/AA scans pass on the settled desktop homepage, command, SKY, and CORE screens, and mobile SKY. The homepage audit waits for actual entrance completion; the FIRE status assertion is scoped to the main workspace so route announcements remain independent.

## Final production validation

| Viewport   | Normal motion | Reduced motion | Errors / warnings / failed requests |
| ---------- | ------------- | -------------- | ----------------------------------- |
| 390 x 844  | Pass          | Pass           | 0 / 0 / 0                           |
| 768 x 1024 | Pass          | Pass           | 0 / 0 / 0                           |
| 1280 x 720 | Pass          | Pass           | 0 / 0 / 0                           |
| 1440 x 900 | Pass          | Pass           | 0 / 0 / 0                           |

The matrix samples actual rendered changes: normal headings show 4-5 transform states, module selection 9-14, route shutters 5-10, chart cursors 2-3, and drone projections 4-20. Reduced headings, city entrance frames, and module selection remain static. Explicit data and inspection selections still update immediately.

The functional matrix uses software WebGL. Gallery references use fresh native Chrome captures to avoid software-renderer gradient artifacts. Full-element captures temporarily hide fixed navigation overlays in screenshots only. Command references start from the default recording snapshot. Before images remain from the original production build.

Reproduce the references with `node scripts/cinematic-capture.mjs after 3001`. Record visible motion separately with `node scripts/cinematic-record.mjs 3001`; its fixed viewport prevents screenshot export from resizing the recording. The video includes hero replay, navigation, signal expansion, module selection, operational handoff, chart feedback, and assembly inspection.

## Limits

Chrome emulation and software WebGL are used for the browser matrix. Physical devices, Safari/Firefox, and hardware frame rates require separate assessment. Projected labels retain camera-dependent clipping and have no general collision-avoidance system. Geography, observations, and hardware remain conceptual/demo material.

No deployment is performed.
