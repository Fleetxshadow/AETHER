# Visual Rebirth: reference study and implementation

The baseline is saved in `docs/rebirth/before/`. It was captured from the unchanged production server before rebuilding. The first fresh dev-server capture timed out; production capture succeeded. The old city geometry, drone assemblies, demo adapter, telemetry, filters, and selection store are retained.

Art direction: **The city that thinks.** Graphite atmosphere, olive instruments, warm ivory type, amber signals. Oversized condensed typography establishes hierarchy; thin technical rules and purposeful opaque surfaces frame the evidence. Seven distinct compositions replace the repeated section rhythm.

## References actually inspected

| Reference       | Inspection and selected technique                                                                                                                                                                            | NEXUS implementation                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transitions.dev | Read the rendered library, card-resize/number-pop-in/notification demonstrations and observed animation keyframes. Its motion audit explicitly distinguishes named properties from `transition: all`.        | Named transform/opacity transitions; spring selection indicators; contextual panel entrances and exits.                                                     |
| motion.dev      | Inspected live layout, gesture, timeline, spring and exit demonstrations; fetched official `useAnimate`, layout and sequencing examples through Context7.                                                    | Scoped two-second entrance; masked heading stagger; magnetic buttons; shared layout selection; AnimatePresence; updating counters and chart indicators.     |
| scrolltide.co   | Inspected the rendered template and component catalogue, including story/depth/scroll slider and shader compositions. Premium source was not copied.                                                         | An original sticky city narrative and scroll-linked camera; alternating editorial, diagram, studio and evidence compositions. Native scroll remains intact. |
| reactbits.dev   | Inspected its interactive ColorBends presentation, editable source example, orbit and carousel previews, and running animation keyframes.                                                                    | A restrained pointer spotlight and a spatial module transition; no extra shader canvas or particle dependency.                                              |
| beui.dev        | Inspected working card, morphing-search, color-picker, treemap and volume-profile previews; read their keyboard and selection behavior.                                                                      | Search focus treatment, drawer/selection choreography, custom chart readouts and accessible tables.                                                         |
| kokonutui.com   | Inspected the rendered particle-button, glass-card, shimmer and prompt previews and source distribution model.                                                                                               | Tactile buttons and small instrument surfaces; effects are curated rather than added to every panel.                                                        |
| ui.bklit.com    | Followed its redirect to bklit.com; inspected actual chart previews and the Area Chart documentation/source examples. Studied gradient areas, hover highlights, crosshairs, data-aligned ticks and tooltips. | Original SVG area/line charts, gradient fills, crosshairs, hover/focus readouts, radial health gauge and data tables using the existing five snapshots.     |

Official GSAP ScrollTrigger/context examples were fetched through Context7. Next.js installed navigation documentation was read before adjusting route-facing UI. Previous project research remains in `docs/reference-research.json` and `docs/skill-research.json`.

No premium source, remote media, new UI package, or paid service is required. Installed Motion, GSAP, R3F, Three.js and MapLibre own the effects. The optional vendor installers were investigated in the earlier project work; this overhaul uses the existing stack.

## Ownership and invariants

- `lib/motion.ts` resolves system preference after a conservative server/first-client snapshot. MotionConfig no longer independently changes SSR transform output. Entrances start after hydration; reduced motion displays content immediately. No hydration-warning suppression.
- Hero timeline animates atmosphere, technical rule, masked typography, controls and instruments. The existing city camera and vertical assembly reveal complete in the same short sequence. Interaction remains available throughout.
- `LivingCity` owns GSAP progress, narrative changes and a camera-progress ref. Its context reverts on cleanup. Manual layer/camera controls remain available, including under reduced motion.
- Network depicts domain lenses and shared simulated records. CORE is explicitly deterministic; TWIN and COMMAND visualize/review shared evidence. No fabricated automated inference pipeline.
- Module previews use existing evidence, telemetry and building footprints. Historical absence produces an honest empty preview.
- Observation details are shared between showcase and command. Escape dismissal, trigger focus and restoration are preserved. A higher modal owns Escape when present.
- MapLibre owns accessible DOM marker buttons. Selection updates their states without replacing them, preserving restoration targets. Severity legend, hover/focus titles and equivalent list are visible.
- Drone geometry remains intact. Studio camera fits the narrower horizontal/vertical field of view, resets on resize, and frames the full explosion. Assemblies separate/reassemble with staggered easing. Selected surfaces glow amber; the shell dims when inspecting the internal controller.
- React owns projected-label DOM; no nested Drei HTML roots. Canvas offscreen pausing, demand rendering, adaptive DPR and presentation pausing remain intact.
- Snapshot/date conversion, validation, source labels, selection clearing, reports and preferences retain their existing behavior. Audio remains opt-in.
