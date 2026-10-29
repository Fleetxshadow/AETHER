# Beyond the Visible: asset manifest

The five public Scrolltide template pages were individually inspected in Chrome: Macaw, Toucan, Selene, Valmora and Earshot. Their preview videos were running, with public descriptions and rendered frames inspected. Premium prompts, source downloads and media are not owned or reused. DevTools' configured file roots prevented saving reference screenshots into this workspace; visual inspection itself succeeded.

| Asset | Existing source / V9 owner | Format and decision |
| --- | --- | --- |
| Opening shots | `city-scene.tsx`, `cinematic-environment.tsx`, `awakening-effects.tsx` | Original realtime geometry and atmospheric shader. A continuous camera approach, road investigation and pullback use the same renderer as the hero. No video decoding or frame cache needed. |
| Hero final frame | `cinematic-hero.tsx`, `city-scene.tsx` | Same canvas dimensions, camera endpoint, lens, environment and lighting as the ending shot. HTML remains interactive. |
| Parallax layers | City geometry, distant skyline, road surface, street lamps, vegetation, sky | Actual depth under a shared camera, not a stack of still-image cards. |
| Brand | `public/brand/aether-original.jpeg` and existing approved wordmarks | Retain original artwork and condensed type; no replacement logo. |
| Quad X | `drone-scene.tsx`, `drone.ts` | Existing original procedural X1 concept. No manufacturer CAD/validated hardware asset exists. Keep that limitation visible; do not invent specifications. |
| Product scroll sequence | Existing Quad X model and its camera | Realtime reversible camera orbit and component focus. Keeps orbit and assembly inspection controls. |
| Mobile / failed WebGL | Original `public/cinematic/city-poster.webp` (175,798 bytes), simplified city and quadcopter SVG views | Clean city render without interface labels, accessible controls and manual chapters. Retains navigation when WebGL is unavailable. |
| Sound | `sound.ts` | Existing original Web Audio tones, muted until explicit consent. |
| Geography | Existing official Google Maps integration | Independent real Gurugram geography. No illustrative geometry transferred to real coordinates. |

Reference principles: Macaw/Toucan → final-pose continuity; Selene → depth and trajectory; Valmora → scroll-driven hardware inspection; Earshot → one coherent route through environmental changes. All AETHER assets are original or already approved. Proof renders and final browser recordings are the acceptance evidence, not this manifest alone.

Final implementation, recordings and validation: [V9-EXPERIENCE.md](V9-EXPERIENCE.md).
