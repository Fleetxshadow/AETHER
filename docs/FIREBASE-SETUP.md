# Firebase integration setup

No Firebase project is selected, provisioned, connected, or deployed by this change. Start without environment configuration to keep the full demonstration. Firebase is optional at runtime; video uses a separate provider.

## Dedicated project and access

1. Create a dedicated AETHER project yourself and register a web app. Enable email/password Authentication, RTDB and a default Firestore database. Choose region, retention and billing intentionally. Never copy unrelated project credentials.
2. Copy `.env.example` to a local environment file without replacing existing RESPONSE secrets. Supply the web app's five required `NEXT_PUBLIC_FIREBASE_*` values. The storage bucket is optional; no Storage upload/download is implemented. Set the site ID and freshness threshold. Restart development or rebuild: public variables are fixed into the browser build.
3. A trusted project administrator provisions accounts and custom claims: `{nexusSite: 'main', nexusRole: 'viewer'}` or `operator`. Hardware accounts additionally use `nexusRole: 'device'` and their assigned `deviceId`. Never let a browser assign claims. Reauthenticate or refresh the ID token after changing claims. No public sign-up or anonymous operational access is provided.
4. Review `firebase/database.rules.json`, `firebase/firestore.rules` and `firebase/firestore.indexes.json`. They are a local proposed configuration. An authorized project administrator must review/test and separately apply them to the correct project. No deployment is performed here. SDK configuration alone does not secure a database.
5. Sign in at **System settings → Protected device access**. Only matching site/role accounts subscribe. Viewers cannot read incidents or response reports. Firestore browser writes and direct camera-metadata reads are denied.

Use [FIREBASE-SCHEMA.md](FIREBASE-SCHEMA.md) as the producer contract. Timestamps are ISO UTC strings, not Firestore Timestamp objects. Collection documents must include their exact document ID and `siteId`. Queries filter the site, order the relevant timestamp descending and limit to 200 records. Raw RESPONSE incidents with private contacts are not accepted by the operational projection: trusted ingest must create the sanitized incident shape documented in the schema. Local RESPONSE intake is not automatically copied into Firebase.

## Device example

An authenticated device `pi-1` for site `main` may write this object at `nexus/main/telemetry/pi-1/latest/temperature`:

```json
{"deviceId":"pi-1","module":"thermal","channel":"temperature","value":31.5,"unit":"°C","observedAt":"2026-10-18T06:30:00.000Z","source":"LIVE"}
```

Replace the example timestamp with the actual sampling time. Do not replay this example as a current measurement. Devices write only their own status/measurements; trusted server ingest validates observations/AI/incidents with the exported Zod schemas before writing via Admin. Admin SDK bypasses rules and must remain server-only with least-privilege IAM. No device needs an Admin service-account key.

RTDB rules validate shape, ownership, units and bounds. The client additionally rejects impossible dates, readings more than 30 seconds in the future, wrong sites, extra fields and malformed payloads. ISO-string timestamp shape in RTDB rules is not a trusted clock. Sync Pi time and audit device credentials; a compromised device can still report plausible false values. These are reported measurements, not independently verified facts.

## Freshness and fallback

- No configuration or authorization: DEMO; all bundled observations, charts and visualizations remain available.
- Connected but empty: **Connected — awaiting device data**; no sensor is claimed online.
- Valid fresh data: automatic updates, source/device/timestamp visible. Only the matching observation module is replaced. Other panels remain explicitly demo. Current live observations are independent of the historical demo time slider.
- Connection error/offline: current live values withdraw immediately; last reports remain inspectable. Demo returns.
- Age exceeds `NEXT_PUBLIC_NEXUS_FRESHNESS_MS` (default 60 seconds): STALE; last timestamps remain inspectable, current panels use demo.
- Sign-out: listeners, live records and in-memory sample traces clear. Camera playback and server camera cookies are revoked by the sign-out action. Device history is never persisted in browser preferences.

The global badge can say LIVE + DEMO. It does not mean every panel is live. Inspect Sources shows individual feed connections and last-known records. Charts retain up to 60 actual received samples from the current device; no backfilled history or invented baseline is marked live. Current telemetry is bounded to 500 validated records in memory. Firestore `eventHistory` is reserved for trusted archival ingestion; there is no historical-cloud-query UI yet.

## Local emulators (optional)

Install a compatible Firebase CLI and its required Java runtime. From this workspace, run:

```powershell
npx firebase-tools emulators:start --project demo-nexus-local --only auth,database,firestore
```

Use only a `demo-` project identifier for isolated local work. `firebase.json` binds all emulators to loopback. For the local client set a dummy API key, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nexus-local`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-nexus-local.firebaseapp.com`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://demo-nexus-local-default-rtdb.firebaseio.com`, a dummy app ID, and `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`. Use localhost, not the LAN IP. Provision emulator users and custom claims through a local trusted Admin script. Do not reuse production accounts or service credentials.

For the server registry opt-in, set `NEXUS_FIREBASE_ADMIN_ENABLED=true`, matching `NEXUS_FIREBASE_PROJECT_ID`, and loopback `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`. For a real authorized server use workload identity/application-default credentials or `GOOGLE_APPLICATION_CREDENTIALS` pointing outside this repository. No privileged key belongs in a public variable, browser bundle, screenshot or commit.

## Camera authorization

AETHER SKY supports the existing local RESPONSE operator session for local development, or scoped Firebase ID tokens verified server-side when Admin is enabled. Camera registry defaults to bounded, process-local memory and resets on restart. Admin opt-in persists camera configuration in Firestore. A local operator password is server-only; generate it with the existing `scripts/response-setup.mjs` workflow. The UI identifies local-memory registration.

The registry accepts only `https://vdo.ninja/?view=READ_ID` with a small viewer-only parameter set, or exact server-allowlisted MediaMTX origins. Publish IDs, embedded credentials, query tokens and arbitrary iframe URLs are rejected. VDO VIEW identifiers remain reader capabilities visible to authorized viewers; rotate them as needed. MediaMTX provider tokens stay on the server. Same-origin requests and rate limits protect registration/signaling. Upstream redirects are rejected; HLS resources stay within the approved stream directory.

MediaMTX playback uses an HttpOnly, SameSite camera session lasting at most 10 minutes or the Firebase token expiry. WHEP sessions have a renewable two-minute server lease and are deleted on close/sign-out/expiry. Refresh the registry to renew access. In-memory sessions and rate limits require a shared durable implementation before multi-instance hosting; this project has not been deployed.

See [RASPBERRY-PI-CAMERAS.md](RASPBERRY-PI-CAMERAS.md) for network, authentication and capture requirements. Neither valid Firebase metadata nor a configured stream URL proves usable video.
