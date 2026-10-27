# AETHER: The Awakening

## Audit and approach

The application uses Next.js 16.4 App Router, React 19, TypeScript, Zustand, Motion 12, GSAP 3.14, React Three Fiber 9 and Three.js 0.182. Existing routes, ten module workspaces, RESPONSE, traffic review and GEO remain in place. Five themes use the established palette tokens. The approved user-supplied JPEG remains the brand artwork; the city and drone models are procedural.

The previous homepage already had a short masked heading entrance, interactive city labels, magnetic links, shared-layout module selection, a four-layer scroll demonstration and a guided presentation. Its city was explicitly illustrative. The new implementation extends those owners rather than adding another map/animation engine.

GEO/COMMAND/TWIN already use the official Google Maps loader, native Data geometry, HTML marker buttons, clustering, layer filters and observation timelines. The protected FLOW endpoint and validated Firebase bridge remain unchanged. Google Maps is configured locally. Firebase/live traffic, genuine GPS trails and surveyed area feeds are not configured; see `GEO-INTELLIGENCE.md`. Simulated storytelling does not create incident records or establish a real-world cause.

## Reference exploration

An isolated browser inspected the requested Motion, Transitions.dev, React Bits, Scrolltide, beUI, Kokonut UI, Bklit UI, GSAP and Awwwards pages. Status, visible excerpts, animation observations and screenshots are saved in `awakening/references/`. The requested `www.godly.design` hostname did not resolve.

Applied principles include Motion's transform-based layout handoff and springs; Transitions.dev's coordinated state changes; React Bits' controlled path/typography effects; Scrolltide/GSAP's synchronized scroll chapters; and the restrained hierarchy/microinteractions visible across the UI references. No paid source, template, artwork or proprietary asset was copied. Current Motion and R3F APIs were checked through Context7; the installed Next.js client-boundary guide was read.

## Motion architecture and storyboard

- `src/lib/motion.ts` retains shared easing/springs and adds micro, standard, spatial and eight-second cinematic timing categories.
- `src/lib/awakening.ts` owns seven presentation scenes and their boundaries: signal (0), core (1), city (2.2), incident (3.7), aerial intelligence (5), brand reveal (6.1), hero handoff (7–8 seconds).
- `src/components/genesis.tsx` owns first-visit preference, playback, visibility pause, skip/replay, focus handling, manual reduced-motion reading and original SVG network construction. It advances React state only at scene boundaries; a shared ref supplies frame-level time to R3F.
- The existing hero city canvas expands for Genesis and returns to its curved frame through Motion layout animation. No second cinematic canvas is created. `city-scene.tsx` owns camera keyframes, city emergence and lighting. `awakening-effects.tsx` supplies explicitly fictional route, anomaly ripple, observation cone and review-area geometry.
- The actual approved mark is revealed after the geometric network constructs/converges. No generated logo replacement or prerecorded cinematic video is used.
- The existing city scroll chapter now tells Observe, Understand and Anticipate, with synchronized camera/layer changes, manual chapter buttons and an explicit event/hypothesis/verification explanation. Phones (up to 700px wide), short viewports (up to 660px high) and reduced motion use manual chapters in normal document flow. Larger normal-motion screens retain scroll choreography. Existing camera presets, layer controls, observation inspection and guided presentation remain available.
- `map-handoff.tsx` makes a camera handoff into independently accurate Google geography. Its information remains fully opaque for contrast. It does not morph fictional streets into Gurugram roads or transfer presentation geometry into operational records. Only authorized existing observation points enter its map; the full spatial-review route remains `/command/geo`.
- Experience navigation retains a spatial cover/reveal. Workspace-to-workspace links navigate immediately with a small progress indicator, preserving efficient operational use, deep links and browser history.

## Resource and access boundaries

The city has existing instanced buildings/vegetation, capped DPR, a performance budget and offscreen frame suspension. The engineering UI is now dynamically imported when its chapter is approached, and the scroll city waits until it enters view. The real map is also deferred until its section enters view. Renderers, GSAP contexts, Motion playback and listeners retain their cleanup owners.

Compact chapter captions reserve their reading space during transitions; operational map text stays opaque. New evidence-state labels and simulation disclosures use larger text. This keeps animated state changes readable rather than relying on a dimmed text reveal.

The first-visit flag is `aether-genesis-v1` in localStorage; blocked storage does not prevent access. Returning visits use the short existing hero entrance. Reduced motion skips automatic Genesis and exposes its seven scenes through manual reading controls. Skip and a direct COMMAND link are always available during the opening. The initial signal includes genuine renderer warm-up: after two rendered frames, the remaining seven seconds play. A four-second readiness deadline selects the simplified cinematic plan if needed; unsupported WebGL uses that fallback immediately after the first signal. Presentation wall time can therefore exceed eight seconds on a cold or slow device. No loading percentage is invented. A WebGL failure retains the simplified city plan, SVG story and functional navigation.

Cinematic sound uses original Web Audio tones. It starts only after enabling the visible cinematic sound control in that presentation, respects the stored global sound/volume controls, and does not run during ordinary dashboard use. No external audio asset, telephone connection or aircraft command is involved.

## Validation

Validation finished against the production build on 23 October 2026. Homepage, story chapters and real-map handoff were inspected in stages before the final responsive run.

| Check | Actual result |
| --- | --- |
| `npm.cmd run build` | Passed compilation, TypeScript and generation of all 26 pages. Existing root-lockfile and `metadataBase` warnings remain. |
| `npm.cmd run check` | Passed in the earlier implementation run. Final rerun passed TypeScript and ESLint; the sandbox then prevented `tsx` from reading Windows user information (`uv_os_get_passwd`). Running the unchanged test step with `npm.cmd test` outside the sandbox passed all 52 domain/backend tests. |
| `npm.cmd run test:e2e` and focused rechecks | All 25 distinct browser cases passed across the full run and subsequent rechecks. The initial full run passed 23 cases; it exposed a map-text contrast issue and a WebGL-startup scene omission. Both were fixed and rechecked. The final focused motion test independently passed all seven scenes, more than five changing projected-camera states, one hero renderer, restored heading opacity, background accessibility cleanup and no runtime errors. |
| `$env:NEXUS_QA_URL='http://localhost:3001'; node scripts/awakening-qa.mjs` | Final actual-Google-Maps run passed all 10 viewport/motion cases and seven additional checks, with an empty failures array. Each viewport case recorded no console errors or network failures. |

The responsive matrix covered **390×844, 768×1024, 1280×720 and 1440×900 in normal and reduced motion**, plus **844×390 landscape and 1280×600 short desktop in normal motion**. All six normal-motion cases used WebGL and recorded the seven scene indices in order. The default midnight theme was exercised throughout; original, Aqua, spectrum and sage passed additional accessibility checks.

Additional checks confirmed explicit sound consent, mute and Escape; RESPONSE's simulated transcript and End Demo Call; and Aqua's normal-motion curved frame with a homepage-to-COMMAND transition. The two maps shared exactly one Google SDK script load. Keyboard skip, replay, returning visits, manual reduced-motion reading, observation selection, map fallbacks, preferences, CORE, ten module workspaces and the human-reviewed FLOW/GEO workflow are covered by the browser regressions. Google SDK test doubles in standard browser tests are distinct from the final real-Google responsive run.

Real Gurugram street labels and Google attribution were visually inspected. The homepage map truthfully displayed zero authorized observations because no authorized feed supplied any; the illustrative city story did not generate mapped incidents. Existing spatial-contract validation, recorded-path chronology, role restrictions and human verification semantics remain covered by the 52 domain/backend tests and earlier GEO validation in [GEO-INTELLIGENCE.md](GEO-INTELLIGENCE.md).

### Evidence

- Before: [desktop hero](awakening/before/hero-1440.png) and [phone hero](awakening/before/hero-390.png).
- After: [desktop hero](awakening/validation/screenshots/1440x900-no-preference-hero.png), [phone hero](awakening/validation/screenshots/390x844-no-preference-hero.png), [Understand chapter](awakening/validation/screenshots/1440x900-no-preference-chapter-1.png), [tablet chapter](awakening/validation/screenshots/768x1024-no-preference-chapter-2.png), [real Gurugram map](awakening/validation/screenshots/1440x900-no-preference-map.png) and [Aqua frame](awakening/validation/screenshots/theme-aqua-normal.png).
- Motion: [opening and walkthrough recording](awakening/validation/motion/awakening-walkthrough.webm), [reviewed contact sheet](awakening/validation/motion/contact-sheet.png) and [Aqua-to-COMMAND recording](awakening/validation/motion/aqua-command-transition.webm).
- Machine-readable final results: [real.json](awakening/validation/real.json). Remaining viewport, chapter, reduced-motion and theme captures are in [validation/screenshots](awakening/validation/screenshots/).
- Focused automated motion evidence is retained in `test-results-motion-proof/`; successful regression rechecks are in `test-results-recheck/`. The original `test-results/` retains the initial failures and is not a final success report.

### Performance observations

The final local browser matrix recorded DOM-ready times of **386–1,755 ms**, **13–59 long tasks per case**, and a maximum long task of **1,168 ms** across the complete automated walkthroughs. These measurements include browser audits and interaction work. They are not frame-rate measurements or a controlled before/after benchmark. WebGL/shader and Google SDK initialization still have a material startup cost; smooth performance on physical low-end hardware has not been established.

Implemented resource changes defer engineering, the scroll city and the map until their sections are approached, and reuse the hero renderer for Genesis. The first signal covers real renderer readiness instead of silently skipping later scenes. Existing resolution caps and offscreen suspension remain. No measured speedup or universal 60 fps claim is made.

## Changed files and assets

| Files | Responsibility |
| --- | --- |
| `src/lib/awakening.ts` | Seven scenes and shared narrative boundaries. |
| `src/lib/motion.ts`, `src/lib/sound.ts` | Motion timing categories and opt-in original cinematic tones. |
| `src/lib/brand.ts`, `src/lib/hooks.ts` | Supporting brand line and focus restoration without unwanted scrolling. |
| `src/components/genesis.tsx` | Presentation state, readiness, SVG network, controls, consent and reduced-motion reading. |
| `src/components/cinematic-hero.tsx` | Shared canvas handoff, subtle parallax, replay and hero navigation. |
| `src/components/scenes/city-scene.tsx`, `src/components/scenes/awakening-effects.tsx` | Camera choreography, emergence, lighting, renderer readiness and simulated incident/evidence geometry. |
| `src/components/experience.tsx`, `src/components/experience-sections.tsx` | Page orchestration, background inert state, story chapters and deferred engineering. |
| `src/components/map-handoff.tsx` | Deferred real geographic map and explicit data/source disclosures. |
| `src/components/route-transition.tsx` | Public spatial transitions and immediate operational navigation. |
| `src/app/awakening.css`, `src/app/globals.css` | Genesis, story, responsive and theme styling. |
| `tests/awakening.spec.ts`, `tests/app.spec.ts`, `scripts/awakening-qa.mjs` | New cinematic proofs, adjusted existing regressions and real-map responsive validation. |
| `docs/AWAKENING.md`, `docs/GEO-INTELLIGENCE.md`, `docs/awakening/` | Implementation report, historical handoff note, references, before/after captures and generated validation media. |

No dependencies, credentials, environment configuration, backend schemas, Firebase rules or mobile-app files were changed for Awakening. There is no new prerecorded production video or downloaded 3D asset. Runtime visuals are procedural R3F/SVG and the existing approved logo; the WebM files above are browser evidence recordings.

## Remaining limitations

- Firebase/live traffic, genuine GPS trails, surveyed boundaries and authorized incident evidence remain unconfigured. Google geography works independently. Google traffic is an optional visual layer and does not establish an AETHER detection feed.
- The city, anomaly and suggested cause in the presentation are explicitly simulated. No real incident, human verification, aircraft command or telephone connection is created.
- The designed eight-second presentation can hold the initial signal while the renderer prepares. A four-second readiness deadline selects the simplified presentation; skip and direct COMMAND access remain available.
- No Google photorealistic 3D/tilt or licensed cinematic video was added. Map geometry remains geographically real and separate from the fictional presentation.
- Physical Android/mobile, low-end GPU and second-computer LAN testing were unavailable. Browser emulation and a host request through its LAN address are the verified scope.
- Startup long tasks remain as measured above. No controlled performance comparison was performed. Existing build warnings for root lockfile detection and unset `metadataBase` remain.

## Local preview

The final production preview is running on `0.0.0.0:3000`. Both [localhost](http://localhost:3000) and [the current Wi-Fi address](http://192.168.31.225:3000) returned HTTP 200 after validation; `/command/geo` also returned HTTP 200 through the LAN address. The temporary QA server on port 3001 was stopped. Another device must be on the same reachable LAN; the address can change with DHCP. A second physical computer was not tested.

For development, run `npm.cmd run dev -- --port 3000` after stopping an existing server on that port. For the production preview, run `npm.cmd run build`, then `npm.cmd run start -- --port 3000`. These existing scripts bind all interfaces. Nothing was deployed.
