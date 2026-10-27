# NEXUS V2 focused polish

The existing visual direction, procedural geometry, observation data, and motion architecture are retained. No deployment was performed.

## Changes

- Assembly metadata now owns stable numbers: **01 airframe, 02 propulsion, 03 battery, 04 camera, 05 controller**. The assembly list, inspection status, detail index, assembled callout, and exploded callouts read the same number.
- Phone layer controls use readable **2×2 grids** across the living-city chapters, command map, and digital twin. Hero shortcuts retain their 2×2 grid. Labels use 11 px text; buttons retain minimum 44 px dimensions. The narrative panel accommodates the second row, and the severity legend sits above the map layer grid.
- Tablet hero framing moves the city to the right and lower; a stronger directional scrim separates the supporting text and actions from buildings.
- Spatial observation IDs, landmark names, district labels, map focus labels, and drone callouts use 11 px text. Map popup text contrast and wrapping were improved.
- Desktop viewports up to 800 px tall use compact hero typography and spacing. At 1280×720 the hero fits 720 px, with a **27 px** gap between the copy/actions and telemetry; at 1440×900 the gap is **16 px**. Phone replay controls sit beside the layer panel, and the city field starts below the guided-experience action.

## Validation

A rebuilt production server on `http://localhost:3001` was used. The dedicated check is `node scripts/polish-qa.mjs`; passing a viewport width reruns its two motion modes and updates the same results file.

Each case checks overflow, layer grid geometry and target sizes, all five assembly selections and three projected callouts, keyboard activation, module arrow navigation, observation metadata and replay, severity legend, accessible native map markers, Escape/focus restoration, camera presets, and historical record counts. Reduced-motion cases also verify a static heading, disabled intro replay, and the static city story.


| Viewport | Normal motion | Reduced motion | Console errors / warnings | Failed requests |
| --- | --- | --- | --- | --- |
| 390?844 | Passed | Passed | 0 / 0 | 0 |
| 768?1024 | Passed | Passed | 0 / 0 | 0 |
| 1280?720 | Passed | Passed | 0 / 0 | 0 |
| 1440?900 | Passed | Passed | 0 / 0 | 0 |

Production build (including TypeScript), ESLint, formatting checks, and all eight existing domain tests passed. A separate fresh Chrome DevTools console check on the rebuilt homepage also found no errors or warnings.

Screenshots for each viewport and motion mode cover the hero, living-city stage, engineering inspection, and selected map marker.

Results and screenshots are in [polish/results.json](polish/results.json). Existing Rebirth evidence was retained.

## Remaining limitations

- Viewports were emulated in installed Chrome using software WebGL. Physical devices, Safari/Firefox, and hardware frame rates were not assessed.
- The phone hero retains its taller composition and requires scrolling to reach bottom telemetry. Desktop heights below 720 px also require scrolling.
- Projected labels retain the existing camera projection and clipping behavior; no collision-avoidance system was added for arbitrary orbit/zoom positions.
- Geography, observations, and drone hardware remain conceptual/demo content.
