# Realtime data and camera integration

Implemented locally on 18 October 2026. No cloud project was selected, rules deployed, real calls activated, or hardware controlled. The existing interface and demonstration remain available without configuration.

## Behavior

- One data controller owns validation, freshness, fallback, received telemetry history, and listener cleanup. Fresh readings update connected KPIs/charts automatically. Each chart uses only received samples from its selected device; no historical points are invented.
- No configuration uses DEMO. Connected empty feeds say **Connected — awaiting device data**. Failed/disconnected feeds withdraw current values and restore the demo. Stale readings remain inspectable with their timestamps while the demo returns. Sign-out clears protected records and received history.
- Fresh observations replace demo observations only in the matching module. The historical demo slider does not hide current live observations. Source, device and timestamp remain inspectable; live records never receive synthetic captured evidence or replay.
- RTDB supplies scoped device, multi-channel telemetry and camera-health feeds. Firestore supplies observations, AI results, and operator-only sanitized incident/RESPONSE projections. CORE's local summaries remain deterministic; camera health is separate from video delivery.
- SKY supports an authorized camera registry, selection, registration, open/close/retry/fullscreen, status, and fallback. VDO.Ninja accepts restricted VIEW links. MediaMTX WHEP/HLS stays behind protected server endpoints; upstream credentials are not returned to the browser.
- MediaMTX LIVE requires decoded frames. VDO.Ninja uses documented provider peer events and explicitly discloses that frames are not independently measured. A URL or device heartbeat alone never establishes viewer LIVE.
- Existing themes, city/drone models, observations, navigation and RESPONSE demo are preserved. SKY's mobile payload value can wrap without shrinking its text or touch controls. Reports and previews identify reported records separately from demo samples.
- Saved preferences hydrate before data/workspace effects can write state, preserving audio, motion and rendering settings across direct reloads.

## Security and configuration

See [Firebase setup](FIREBASE-SETUP.md), [schema and claims](FIREBASE-SCHEMA.md), [Pi camera guide](RASPBERRY-PI-CAMERAS.md), and `.env.example`.

The proposed rules deny access by default, scope reads by site/role, permit hardware RTDB writes only for its own identity, and deny Firestore browser writes. Privileged camera registration requires server authorization, same-origin requests, bounded validation and rate limits. Stream destinations use explicit allowlists; MediaMTX redirects, embedded credentials and query tokens are rejected. WHEP sessions use scoped opaque leases and cleanup. No secrets were added to browser configuration.

To connect real devices, supply a dedicated Firebase web configuration, provision authenticated accounts/custom claims, review and separately test/apply the rules, and configure authorized video reader endpoints. Admin persistence/token verification additionally requires explicit server opt-in and application-default credentials. No paid provider is needed for the local demonstration.

## Verified evidence

- TypeScript, ESLint, and production build passed. Integration-related files pass Prettier.
- 25 domain tests passed, including validation, fresh/stale/offline fallback, module replacement, received-history deduplication, cleanup, camera URLs, and the existing RESPONSE invariants.
- Six integration browser journeys passed: empty/fresh/invalid/stale/offline feeds, theme updates, live observation evidence, camera authorization/URL redaction, VDO sender validation/disconnection, synthetic WebRTC, and responsive camera accessibility. The live-observation journey also passed after adding report-row source checks.
- A seventh integration journey verifies saved audio and rendering settings across settings/twin reloads. All ten existing application E2E journeys passed against the final production build, including guided navigation, maps, module controls, persistence, exports, accessibility, reduced motion, and keyboard focus.
- Final rerun: `npm run check` passed (TypeScript, ESLint, 25 domain tests), and the complete seven-journey integration browser suite passed together, including the protected synthetic WebRTC stream. The production build and ten production E2E journeys also passed. Development fixture and QA servers were stopped; the user-facing production build remains available on port 3000, bound for the previously requested LAN access.
- The controlled loopback WebRTC publisher passed SDP through the actual protected server proxy, delivered decoded **320×180** synthetic frames, transitioned OFFLINE on publisher interruption, and received upstream DELETE on close. [Captured proof](integration/controlled-webrtc.png). This verifies the viewer/proxy, not Pi hardware or an installed MediaMTX binary.
- Production dependency audit reports **0 vulnerabilities**. MapLibre uses its v6 module worker and copied shared module; WebGL2 is required, with the existing accessible fallback retained.
- The final production matrix passed **32 combinations**: Original/Aqua/Spectrum/Sage × 390×844, 768×1024, 1280×720, 1440×900 × normal/reduced motion. It checks actual normal entrance states, city transparency/clipping, map marker keyboard selection/focus restoration, 44 px layer controls, labeled KPIs, responsive camera fallback, and source/camera accessibility. No console errors, failed requests or accessibility violations were recorded. RESPONSE demo accept/play/pause/restart/end passed on mobile and desktop in both motion modes. Thirteen workspace/report/settings routes also passed their hydrated-page and console/network checks.
- Screenshots and machine-readable results: [verified matrix](integration/verified/results.json), `integration/verified/hero-*.png`, `command-*.png`, and `camera-*.png`. Representative mobile, tablet, short-desktop and camera renders were visually inspected. The QA harness waits for settled streamed pages and allows headless WebGL initialization time; two timing assertions were corrected without changing product behavior.

## Remaining limits

- No real Firebase project or emulator connection was verified. Mock feeds provide repeatable data tests. This host has Java 8; current Firebase emulators need a compatible newer runtime. Proposed security rules were not emulator-executed or deployed.
- No Raspberry Pi, actual MediaMTX server, or external VDO publisher was verified. VDO tests use an explicitly controlled provider-event fixture. Successful HLS media playback has not been verified.
- Initial ICE gathering is supported; trickle ICE and automatic TURN discovery are not implemented. Remote video still needs suitable HTTPS, authentication, routing/NAT/ICE or VPN/HLS configuration.
- Camera registry defaults to process-local memory. Explicit Admin configuration persists registry records, but playback sessions and rate limits remain process-local; multi-instance hosting requires shared state.
- Cloud historical-query UI, Storage evidence retention, automatic upload of local RESPONSE demo reports, and hardware actuation are outside this implementation. Received charts retain bounded session samples rather than claiming cloud history.
- Repository-wide formatting check still reports unrelated older formatting differences; integration-related files were checked separately.
