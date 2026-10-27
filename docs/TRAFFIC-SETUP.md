# AETHER FLOW local demonstration

Run `npm run dev` in this website and open `http://localhost:3000/traffic`, or **CITY TRAFFIC** in Command. Existing modules, homepage, 3D city/drone scenes, maps, camera and RESPONSE features remain available. Nothing is deployed.

No credentials, mobile app, paid provider, sensor or aircraft is required for the demo.

1. Start private demo. All six directional reference corridors begin UNKNOWN.
2. Generate normal readings, then sustained slowdown. Six independent synthetic contributors are processed in 30-second virtual steps until one persistent case appears.
3. Run CORE analysis. Cause remains UNKNOWN and a recommendation appears.
4. Write private notes (15+ characters), begin operator review, then approve **for operator planning**. This cannot launch/control aircraft.
5. Select the labeled obstruction/water illustration, acknowledge synthetic provenance and link it.
6. Analyze evidence; inspect the frame and uncertainty. Confirm or reject with evidence acknowledgement and notes.
7. Approve a public-safe summary. The separate AETHER MAP preview receives only the approved route-relevant DTO. Before confirmation, publication keeps the cause UNKNOWN.
8. Enable browser voice and select **Listen to approved alert**. Available voices/audio depend on browser and OS; no native or telephone connection is claimed.
9. Switch to a demo alternative or keep the selected route. No real routing/ETA is provided.
10. Generate sustained recovery: case and approved public record become RESOLVED. Advancing without readings instead yields UNKNOWN roads and EXPIRED support, not confirmed recovery.

Controls use a responsive toolbar; road buttons provide keyboard equivalents to canvas selection. Arrow keys and plus/minus operate MapLibre. Timeline playback uses backend snapshots and pauses review controls. KPI, speed/history, hourly starts, recurrence, duration and cause distribution derive from retained records; no citywide historical observations are invented.

## Authorized LIVE preparation

Read [TRAFFIC-CONTRACT.md](TRAFFIC-CONTRACT.md) and existing Firebase guidance. Keep credentials outside browser variables and source control.

- Configure the existing dedicated Firebase project/Admin credentials and explicit opt-in from `.env.example`.
- Provision matching site and explicit traffic roles server-side through your approved account-management process, then sign in under Command settings.
- Register licensed WGS84 directional roads, real provenance and suitable IST baselines. Leave unknown legal speeds/baselines null. Preserve exact native graph IDs and compatible `networkVersion`. LIVE rejects reference sketches and seeds no synthetic data.
- Use authenticated `POST /api/response/traffic?source=LIVE` with same-origin authority and revision-checked commands. `register-roads` accepts small batches; `ingest` accepts at most 40 observations within the 12 KB body limit. Read/review current state before retrying conflicts.
- Review the prepared rules/index in `firebase/`; no deployment is authorized here. Private traffic collections deny all client reads/writes. Only the approved AUTHORIZED public DTO is client-readable.

The dashboard polls its protected snapshot every 15 seconds while visible. LIVE public preview uses Firebase snapshot metadata/cache/error handling and independently rejects stale records. A real continuous ingestion/retention worker, provider authorization and reviewed production storage/scale/backup plan remain prerequisites for operations. Public consumers enforce expiry even without an online operator.

## Checks and evidence

- `npm run check`: TypeScript, lint, existing tests plus 14 traffic domain tests.
- `npm run build`: production build.
- `npm exec -- playwright test tests/traffic.spec.ts`: human workflow, API boundaries, public filtering, session isolation, four viewport sizes, both motion preferences, keyboard and four themes.

Screenshots: `docs/traffic/screenshots/`. Playwright retains traces on failure. Domain tests cover invalid/sparse/duplicate data, direction, outliers, baseline matching, stale persistence gaps, connected grouping, cooldown, recovery/expiry, conservative analysis, inspection rejection/cancellation, evidence/review/publication, strict mobile compatibility, roles, offline/stale snapshots and retention.

Windows sandbox `tsx` may fail before test loading with `uv_os_get_passwd ENOMEM`; the authorized host runner works. Android testing was unavailable because the emulator failed to boot/probe. The user explicitly approved browser/backend testing instead.

## Remaining external requirements

- Licensed Gurugram basemap and surveyed/authorized directional road registry. Existing optional `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` are supported; no license/key is assumed.
- Genuine independent traffic data, reliable day/time baselines and authorized municipal reports/weather/closures. Missing context is uncertainty; no private Google dataset or municipal connection is implied.
- Configured/authorized Firebase project, reviewed rules/index rollout, remote listener/security validation and operational retention/backup. Local tests alone do not verify a remote service.
- Lawful real-media upload/storage/access/retention and calibrated image analysis. Current evidence supports labeled demo illustrations only; demo evidence is refused in LIVE.
- Separately authorized native-app tests with matching routing graph, real alternative routes/ETA, native speech and delivery acknowledgement. The app repository remains untouched.

This is a local decision-support prototype with a complete synthetic workflow. It is not a flight controller, citywide coverage claim, production-scale certification or municipal integration.
