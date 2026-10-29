# AETHER OS — operational redesign (24 Oct 2026)

Local implementation record. Nothing was deployed; no data source, rule, or integration changed.

## What changed

- **AETHER Obsidian theme (new default).** Graphite surfaces, amber signal (`#F2A93B`), chartreuse confirmation (`#C6F05C`), restrained teal/coral. Added as a sixth theme; the five existing themes are unchanged and still selectable. Defined in `src/lib/theme-palettes.json`, `src/lib/themes.ts` (`defaultTheme`), `src/app/theme-colors.css`.
- **Design system** `src/app/aether-os.css` (imported last): `--ae-*` tokens for surfaces, severity (critical/elevated/normal), data state (LIVE/STALE/OFFLINE/failure), radii, spacing, motion; global `:focus-visible` ring.
- **Shared application shell** `src/components/app-shell.tsx`: grouped sidebar (Operate / Observe / Assess / Understand), collapsible rail with accessible names, sticky contextual top bar, Ctrl K workspace palette covering every route, mobile drawer and bottom dock. `/command/*` and `/traffic` now use the same shell (previously `/traffic` had separate navigation).
- **Command center** (`src/components/command.tsx`): compact headings with area / time basis / control context; the operational loop strip `src/components/ops-pipeline.tsx` (Observe → Understand → Locate → Validate → Respond); map workbench as the primary surface; review queue + insight; city instruments shown instead of hidden in a disclosure.
- Module pages share the compact heading; insight summaries on module pages are scoped to that module's records.
- Opening sequence and cinematic environment use theme tokens (Obsidian: warm graphite dusk instead of teal haze). Genesis timing, skip, returning-visitor and reduced-motion behavior unchanged.

## Data honesty rules applied

Every pipeline number is derived from records already in the store. RESPOND shows "—  feed not connected" unless an operator Firebase feed exists. LOCATE counts only records inside an approximate Gurugram extent; bundled demo points use Bengaluru reference coordinates, are not relocated, and the stage says so. UNDERSTAND states "Deterministic CORE summary · no AI feed" unless AI detection results are received.

## Verification (production build, port 3001)

- `npm run check`: typecheck, lint, 52/52 node tests pass. Prettier: the same 10 files that failed before this work still fail; no new failures.
- `npm run build` passes.
- Playwright: 26/28 in full-suite runs; the two failures varied between runs (intro/camera timing and a 60 s timeout during a full-page screenshot) and each passed when rerun in isolation. One selector in `tests/app.spec.ts` changed from `.command-app` to `.os-app` (shell class renamed; collapse behavior unchanged).
- Route audit at 1440×900 and 390×844: all 16 routes render, no horizontal overflow, no console errors (headless SwiftShader WebGL emits GPU-stall warnings on `/`).
- Chrome DevTools MCP: palette, mobile drawer open/Escape/focus return verified; console empty.

## Nova + cinematic opening (24 Oct 2026, second pass)

- **AETHER Nova** is now the default theme: deep-space ink `#05060D`, ion cyan `#46E8FF`, violet aurora `#9B7BFF`; amber/coral kept only for elevated/critical severity. Obsidian and the five earlier themes remain selectable.
- **Opening ignition** (`src/components/intro-ignition.tsx`): a 2D-canvas particle accretion into an ion core with rings, warp streaks, and a shockwave hand-off into the 3D city. It runs during the existing renderer-preparation window (minimum 1.8 s, previously 1 s). Overlay adds letterbox bars, film grain, scanline, REC/timecode HUD and per-letter kinetic titles with chromatic edges; scene 6 is a centered glowing AETHER title card. The scene clock, skip, "Enter command", returning-visitor skip and reduced-motion reading mode are unchanged.
- **3D city:** theme-aware hemisphere/key light (cool ion light in Nova), Nova sky/ground palette, drei `Sparkles` ion motes over the hero city (static under reduced motion).
- **Homepage:** the flat accent "Human possibility" band became an aurora gradient; engineering-studio caption no longer overlaps its label (moved without changing layout height; an in-flow fix shifted the scroll-driven camera reel by ~63 px and broke `v9.spec.ts`).
- Verification: `npm run check` 52/52; build passes; Playwright 27/28 on the final build (the remaining failure is the 60 s timeout on the accessibility test's final full-page screenshot; all its axe scans passed).

## Flight opening, Prism theme, capsule dock (24 Oct 2026, third pass)

- **Flight hero** (`src/components/flight-hero.tsx`, `src/components/scenes/flight-scene.tsx`): Earshot-style scroll-driven opening. The illustrative drone flies continuously (chase camera) while three worlds morph beneath it — Sunset Mirage (mirror floor via drei `MeshReflectorMaterial`), Neon Grid, Monsoon Coast — each with a kinetic headline, CTA and round world switcher. Renders only while in view and not covered by Genesis/presentation; software rasterizers get a lighter floor; WebGL failure or 3D-off shows a gradient poster. Genesis no longer auto-plays; "Replay introduction" starts it and lands on the city hero.
- **AETHER Prism** default theme (violet ink, hot magenta, aqua, sunset orange). Nova/Obsidian and the earlier themes remain selectable.
- **3D tilt hover** (`src/components/tilt-layer.tsx`): one delegated pointer listener; off for touch and reduced motion.
- **Capsule sidebar**: floating rounded shell with gradient border, icon tiles, gradient active tile; collapsed mode is a magnifying icon dock.
- Tests updated for intended behavior: Genesis started via "Replay introduction" (3 tests), mobile check scrolls to the city hero, Prism subtitle avoids matching the Aqua theme selector.
- Verification on the final build: app + awakening 12/13, geo + traffic + v9 13/15 in split runs. `app.spec:247` and `v9.spec:23` pass when run alone; `v9.spec:144` passes every assertion but exceeds the timeout while closing its video recording under software WebGL.

## Responsive QA pass (24 Oct 2026)

Tested at 360×800, 390×844 and 430×932 on the production build, all 16 routes.

- COMMAND pipeline: stacked single column on ≤900px (was a sideways scroller that clipped the second card); stage links ≥40px tall.
- Dock clearance: `--ae-dock-clearance` (96px + `env(safe-area-inset-bottom)`) on all shell pages and /traffic; observation detail panel sits above the dock.
- Legibility floor: legacy mobile rules that set 6–10px text are raised to 11px (labels) / 12.5px (buttons) using their own selectors, generated from the CSS.
- "A HIGHER PERSPECTIVE." no longer widens 360px phones (it had a 90px minimum font size).
- Mode buttons keep their full accessible name ("City mode") on mobile.
- Flight camera pulls back and frames the drone above the headline on portrait screens.
- Verified: no layout-viewport widening on any route at any of the three widths; drawer, dock "All", palette, search, detail panel, theme configurator and guided presentation stay inside the viewport; page ends clear the dock; GEO layer rows are 44px tap targets; traffic.spec (all viewports) + accessibility spec pass.
