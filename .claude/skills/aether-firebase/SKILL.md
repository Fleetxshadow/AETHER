---
name: aether-firebase
description: Firebase in AETHER CITY — config/env boundary, RTDB + Firestore schema, custom claims, security rules, emulators, Admin opt-in, and the read-only Firebase MCP. Use when touching src/lib/firebase, src/lib/data, firebase/*.rules, traffic LIVE storage, or debugging auth/permission errors.
---

# AETHER Firebase

## Current state (verify before assuming otherwise)

- No Firebase project is selected: there is no `.firebaserc`, and `NEXT_PUBLIC_FIREBASE_*` are unset in `.env.local`. Without them `firebaseConfigured` is false and the app runs DEMO only.
- Rules in `firebase/` are **proposed, not deployed** (`docs/FIREBASE-SCHEMA.md`, `docs/FIREBASE-SETUP.md`).
- Firebase CLI is logged in on this machine; that is not authorization to touch any project.

## Code boundary

- `src/lib/firebase/config.ts` — public web config, `siteId`, `freshnessMs` (default 60s), `useEmulators`.
- `src/lib/firebase/client.ts` — browser SDK, sign-in/out, emulator wiring.
- `src/lib/firebase/admin.ts` — Admin SDK only when `NEXUS_FIREBASE_ADMIN_ENABLED=true` **and** `NEXUS_FIREBASE_PROJECT_ID` matches the public project ID; emulator hosts must be `127.0.0.1`.
- `src/lib/data/firebase-provider.ts` + `validators.ts` — subscriptions; every payload is validated, invalid ones are dropped and counted.

## Schema essentials

- RTDB under `nexus/{siteId}/`: `devices/{deviceId}`, `telemetry/{deviceId}/latest/{channel}`, `cameraStatus/{cameraId}`. Device writes only to their own `deviceId` (claim `nexusRole: device`).
- Firestore: `observations`, `aiDetections`, `devices` (scoped read), `incidents`, `responseReports`, `eventHistory` (operator read), `trafficIncidents` (public read only if `publicApproved && schemaVersion==1 && source=='AUTHORIZED'`). All browser writes denied; everything else default-deny.
- Claims: `nexusSite`, `nexusRole` (viewer/operator/device), `deviceId`, `nexusTrafficRole` (INGESTOR/ANALYST/REVIEWER) — set only by a trusted admin.

## Safe workflow

1. Rule changes: edit `firebase/*.rules*`, validate with MCP `firebase_validate_security_rules`, and test against emulators (`firebase emulators:start` — auth 9099, RTDB 9000, Firestore 8080, `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`).
2. Never run `firebase deploy`, change rules in a real project, or write/delete real data without explicit approval. The project MCP server is deliberately limited to read-only tools; don't add write tools to `.mcp.json` unasked.
3. Never loosen a rule or validator to make a UI show data. Fix the data or claims instead.
4. Keep secrets out of `NEXT_PUBLIC_*`, source, logs, docs and test fixtures. Service-account JSON stays outside the repo (`GOOGLE_APPLICATION_CREDENTIALS`).

## Debugging

- `permission-denied`: check claims (`nexusSite` vs document `siteId`), role, and RTDB query limits (`limitToLast <= 200` on `devices`).
- Empty but connected → UI must say "Connected — awaiting device data", not show demo as live.
- LIVE only from a validated, fresh reading; stale → STALE, disconnect → OFFLINE + demo fallback.
