# Validation — 12 October 2026

## Final proof

| Check                         | Result                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript             | Passed                                                                                                                      |
| ESLint                        | Passed, no application warnings                                                                                             |
| Source formatting             | Passed; generated `next-env.d.ts` intentionally excluded                                                                    |
| Production build              | Passed; all experience and module routes generated                                                                          |
| Domain tests                  | 8 passed                                                                                                                    |
| Browser journeys              | Eight distinct journeys validated in isolated Chrome production sessions                                                    |
| Final changed-area regression | 3 passed: cinematic entry/presentation, desktop/mobile accessibility, reduced motion/focus                                  |
| Accessibility                 | Zero reported WCAG A/AA violations on landing, command, SKY, CORE, and mobile SKY scans                                     |
| Runtime                       | No unhandled page errors in final journeys; final production DevTools console contained no warnings/errors                  |
| Navigation                    | All ten modules, reports, settings, command entry, palette, and presentation exercised; no broken landing section anchors   |
| Layout                        | 1440 × 900 desktop and 390 × 844 mobile; no horizontal document overflow                                                    |
| Fallback/retry                | Disabled WebGL retained city plan and observation selection; simulated HTTP 503 recovered on retry                          |
| Exports/preferences           | DEMO JSON source/count verified; full-day report included all nine observations; audio/graphics preferences survived reload |

The final full eight-journey run passed seven checks and exposed a presentation timeout under software-rendered Chrome. Investigation found simultaneous background/presentation rendering. Background canvases now pause while the presentation is open. The changed entry/presentation, mobile accessibility, and reduced-motion journeys then passed together (39.8 s, 34.4 s, and 4.2 s). Remaining journeys passed and their behavior was unchanged by that fix. Earlier hydration, nested-HTML cleanup, contrast, and ARIA-role failures were corrected and retested.

## Local performance sample

Chrome DevTools traced the production landing page at http://localhost:3001/, with a 1440 × 900 viewport, CPU 1×, and no network throttling.

- Largest Contentful Paint: **1,325 ms**.
- Cumulative Layout Shift: **0.00**.
- Time to first byte: **12 ms**.
- Visible requestAnimationFrame sample: approximately **30 Hz**, median frame interval **33.3 ms**, over two seconds on this host.
- Broken section links: **0**. Unnamed buttons: **0**. Active initial canvases: **1**.

This is a local lab/reload sample, not field-user data or a guarantee for every device. INP and a physical mobile-device benchmark were not measured. Browser mobile validation uses Chromium emulation. The app exposes lower rendering presets and a complete simplified view. Trace findings are retained in `performance.json`.

## Artifacts

- `landing-desktop.png` — rendered city hero.
- `landing-mobile.png` — complete mobile experience.
- `command-desktop.png` — operating workspace and timeline.
- `twin-desktop.png` — interactive conceptual twin.
- `drone-exploded.png` — engineering assembly and hotspots.
- `playwright-report/` and `test-results/` at project root — most recent browser report and retained failure traces.

Live hardware, an external generative AI service, real camera recordings, and surveyed/validated models remain outside this demo implementation. Every relevant interface labels its simulated or illustrative source.

## Visual Rebirth validation — 12 October 2026

This section supersedes the earlier visual design evidence above. The earlier performance sample belongs to the previous UI and is not presented as a benchmark for this overhaul.

| Proof                           | Final outcome                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                | Passed on the final source; all 16 routes generated                                                                                                                                                                       |
| TypeScript / lint / formatting  | Passed                                                                                                                                                                                                                    |
| Domain regressions              | 8 / 8 passed; snapshots, selection clearing, schema and conceptual geometry retained                                                                                                                                      |
| Existing browser journeys       | Map/replay/history/focus modes, all ten modules, palette/settings/exports, retry, WebGL fallback and reduced-motion presentation passed in the full run                                                                   |
| Corrected browser journeys      | Desktop/mobile WCAG checks, keyboard map labels/focus restoration and motion-preference recreation, and scroll/manual narrative passed together; entrance/replay/keyboard skip/guided presentation then passed separately |
| Viewport matrix                 | All eight combinations of four requested viewports and normal/reduced motion passed                                                                                                                                       |
| Hydration / runtime / network   | No console errors, unhandled page errors or failed requests in the completed matrix or final recording                                                                                                                    |
| Motion execution                | Normal headline produced 6–10 measured transform states; reduced motion stayed at one fully visible, stationary state                                                                                                     |
| Scroll / signal / pointer proof | Narrative changed from chapter 2 to 3; flowing-line dash offset changed; magnetic control moved to a measured 4.94px × 1.44px transform                                                                                   |
| Drone                           | Selected battery, full explosion, three projected labels inside viewport bounds, and reset verified at all four sizes in both motion modes                                                                                |
| Evidence                        | Fresh before/after screenshots, distinct section captures, and a recorded production walkthrough saved in `docs/rebirth/`                                                                                                 |

The first full browser run passed six journeys and exposed one contrast violation plus timing/selector issues in three tests. The selected module index was brightened, the decorative drone index was hidden from assistive reading, selectors were made exact, and the two-second intro is tested using keyboard activation without an expiring pointer locator. All ten distinct journeys have now passed across the full and focused runs. This statement does not claim a single final all-green aggregate run.

An initial cold software-rendered mobile animation capture missed enough intermediate samples to fail its timing assertion. The subsequent complete production matrix captured intermediate states and passed all eight cases. No field performance or physical mobile-device benchmark is claimed. The tests use isolated installed Chrome with software WebGL; actual GPU/device timing varies.

Review `rebirth/index.html`, `rebirth/after/matrix-results.json`, `rebirth/after/motion-proof.json` and `rebirth/after/recordings/motion-tour.webm`. The recording exercises hero, scroll, network, module, engineering, observation and analytics interactions with audio off.
