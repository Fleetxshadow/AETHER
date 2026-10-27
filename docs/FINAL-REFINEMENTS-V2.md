# NEXUS V2 — final refinements and voice demo V2

Validated locally on 14 October 2026. No deployment or real telephone connection.

## Changes

- **Curved city frame:** transparent hero WebGL canvas, no opaque Three scene background, and a dedicated curved clipping layer. One theme-aware background helper synchronizes the frame and fog. Theme switching preserves the city model and intended frame.
- **Information typography:** larger telemetry, units, KPI descriptions, chart annotations, map details and tour captions. Map heading annotations are 11 px; KPI titles are 14 px; tour captions are 15 px on mobile and 17 px elsewhere. Decorative microtext remains secondary. The tour header has a theme-matched backdrop so its logo and exit control remain visible over the dark city.
- **Map controls:** all four layers occupy a dedicated toolbar above the map. Mobile uses a 2×2 grid with 44 px minimum targets. Marker buttons, selection details, Escape focus restoration and severity legend remain available. Light-theme observation statuses and demo badges use accessible semantic ink; the map severity text uses its dark scene's text color.
- **KPI context:** each sparkline names its metric and units, shows the current value and sample time, and identifies the existing 12 October 2026 06:00–18:00 IST demo range. The current snapshot is 15:00 IST. No new historical observations were invented.
- **Honest call simulation:** accepted calls display **DEMO CONNECTED** and **No phone/audio connection — simulated conversation**. The example conversation is visibly labeled as simulated text. Accept creates one simulated waterlogging incident through the existing schema; the assistant claims a save only after server success. Play/pause/restart reveal example lines, and End Demo Call stops playback. Replay does not duplicate the incident. Location is Sector 51, Gurugram; coordinates remain unknown.
- **Separate browser intake:** sample mode disables browser microphone and welcome speech. After ending, Start separate browser report clears sample text/location before browser intake resumes. Saved reports remain available; browser voice keeps its own channel.
- **Future telephone integration:** provider-neutral inbound verification/normalization, session status, audio stream, recognition and synthesis contracts reuse the existing language and incident lifecycle. Only the free signed local demo adapter is active; media adapters are explicitly absent and authorized/live telephone mode is disabled. No credentials, paid provider requirement or outbound dialing were added.

The ten modules, city/drone geometry, drone numbering, observation details, guided tour, simulated-data disclosures, keyboard controls and reduced-motion behavior remain intact.

## Validation and evidence

The required viewports were tested across Original, Aqua, Spectrum and Sage, with normal and reduced motion:

| Viewport | Both motion modes, all four themes |
| --- | --- |
| 390×844 | Passed |
| 768×1024 | Passed |
| 1280×720 | Passed |
| 1440×900 | Passed |

- **32 behavioral cases:** city alpha/clipping, entrance completion, tour captions, horizontal overflow, KPI metadata, all layer targets, keyboard layer selection, marker selection/focus restoration, toolbar/marker separation, analytics context, demo extraction and transitions, pause/restart/end, and no duplicate reports. Console errors and unexpected failed/error network requests: **zero**. [Results](refinements-v2/verified/results.json).
- **32 final loaded-tour cases:** all viewports/themes/motion modes after the header contrast correction. Fresh console errors: **zero**. **12 final Axe scans** across tour, command and connected sample call, one per theme/workspace, reported **zero violations**. [Final accessibility results](refinements-v2/verified/accessibility-final.json). The first matrix's accessibility results retain the initial light-theme failures; the final scan is the corrected evidence.
- **32 final map-legend cases:** visible Critical/Elevated/Normal labels, at least 12 px, with minimum computed-style contrast **7.14:1**. Fresh console/network errors: **zero**. Four additional command Axe scans after the legend correction reported **zero violations**. [Legend results](refinements-v2/verified/legend-final.json).
- Complete sample playback passed in both motion modes. A controlled 503 save failure displayed the retry message without a false saved-report claim. Browser recognition event fixtures proved a fresh browser-voice report cannot inherit the sample's statement or Gurugram location.
- Existing checks passed: **15 domain tests**, **10 Playwright journeys**, TypeScript, ESLint and production build. Existing journeys cover city/drone inspection, modules, keyboard navigation, observation replay/history, WebGL/service fallbacks and reduced motion.
- LAN homepage was opened in the browser with two canvases, completed normal entrance, no horizontal overflow and no console warnings/errors. Local development remains available at **http://192.168.3.72:3000** while this computer/server remain running. Another physical device was not independently tested.

Representative screenshots:

- Aqua frame [before](refinements-v2/aqua-before.png) / [after](refinements-v2/verified/hero-aqua-1440x900-normal.png).
- [Tablet Aqua hero](refinements-v2/verified/hero-aqua-768x1024-normal.png) and [short desktop hero](refinements-v2/verified/hero-original-1280x720-normal.png).
- [Mobile command](refinements-v2/verified/command-aqua-390x844-normal.png) and [tablet command](refinements-v2/verified/command-aqua-768x1024-normal.png).
- [Loaded Aqua tour](refinements-v2/verified/tour-aqua-1440x900-normal.png), [mobile sample call](refinements-v2/verified/call-aqua-390x844-normal.png) and [desktop sample call](refinements-v2/verified/call-aqua-1440x900-normal.png).

Reproduce the behavioral matrix with `node scripts/refinements-qa.mjs`; loaded-tour and accessibility checks use `node scripts/refinements-accessibility.mjs`. Both default to `http://localhost:3002`; `NEXUS_QA_URL` overrides it. The production QA server is local-only. No emergency link was activated.

## Remaining limitations

- Sample playback is text only. There is no phone call, received audio, acoustic transcription or live AI conversation. Extraction uses local keyword rules and still requires operator review.
- Browser acoustic microphone recognition was not successfully verified; fixtures exercise event wiring. The tested native speech attempt returned `synthesis-failed`, and no Hindi voice was installed. Browser language/services vary. HTTP LAN IP access may lack the secure context required for microphone/geolocation; text intake remains usable.
- A real authorized Indian number/provider requires onboarding, provider-specific signatures/events, actual media services and approved credentials. The local NEXUS HMAC is not Exotel signature verification. No real calls or automatic emergency-service contact exist.
- Reports and sessions remain private, memory-only and expire after 30 minutes. Restarting the server deletes them. This is not a durable, multi-instance dispatch service.
- Automated accessibility scans supplement keyboard and visual checks; they do not establish complete accessibility conformance. Screenshot evidence is static; no new motion recording was captured for this refinement pass.

See [RESPONSE architecture and trust boundaries](RESPONSE.md) for the existing intake, consent and server safeguards.
