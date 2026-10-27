# Proposed AETHER integration schema

This is a new, local proposal, not a deployed database. No existing project is selected or reused. The browser SDK targets a dedicated Firebase project with the default Firestore database. No Firebase service is required for the bundled demonstration.

## Access and tenancy

All operational documents have `siteId`. Authorized users need trusted custom claims `nexusSite` and `nexusRole` (`viewer` or `operator`). Hardware needs `nexusSite`, `nexusRole: device`, and `deviceId`. Claims are assigned only by a trusted administrator. Anonymous users cannot read or write operational data. Private incidents and response reports are operator-only. Browser writes to Firestore are denied; privileged camera registration goes through an authenticated, same-origin server endpoint. Device writes to RTDB are restricted to their own ID and validated fields. No contact details enter observation, camera or telemetry records.

## Realtime Database

Paths are scoped under `nexus/{siteId}`:

- `devices/{deviceId}`: `id`, `module`, `name`, `status` (`online`/`offline`), `lastSeen` (ISO UTC), `source: LIVE`.
- `telemetry/{deviceId}/latest/{channel}`: `deviceId`, `module`, `channel`, `value`, `unit`, `observedAt` (ISO UTC), `source: LIVE`. Channels: temperature (°C), speed (km/h), rainfall (mm), water (cm), health (%), altitude (m), battery (%). One device can publish several channels without replacing its other measurements. The client retains only readings actually received, bounded in memory, for a real sample trace.
- `cameraStatus/{cameraId}`: `cameraId`, `deviceId`, `online` (device-reported boolean), `lastSeen` (ISO UTC), `streamType` (`vdo-ninja`/`mediamtx`), `source: LIVE`. Optional resolution/FPS must be measured, not assumed. Device reports are distinct from viewer media evidence.

## Firestore

Collections: `observations`, `incidents`, `aiDetections`, `devices`, `cameraMetadata`, `responseReports`, `eventHistory`. Every document includes `siteId` and ISO UTC timestamps. Observations reuse the existing title, module, location [longitude, latitude], conceptual position, severity, confidence, description, evidence, metric, unit and sensor shape, with `source: Device observation` or `AI detection`, `dataSource: LIVE`, and `deviceId`. IDs must match document IDs. Position is an explicit reference into AETHER's conceptual city, not a claim of a surveyed digital twin. Unknown positions must be resolved during ingestion; do not fabricate coordinates.

`aiDetections`: `id`, `siteId`, `module`, `deviceId`, `observedAt`, `source: LIVE`, `category`, `description`, `confidence`, `observationIds`. This is a structured external result, not an inference invented by the browser.

`incidents` and `responseReports`: `id`, `siteId`, `reportedAt`, `source: LIVE`, `category`, `description`, `location`, `status`, and `externalContactConfirmed` (boolean). These operator-only feeds do not expose caller contacts. The existing private, memory-only RESPONSE demo queue remains a separate channel; connecting Firebase does not silently upload demo conversations.

`cameraMetadata`: `id`, `siteId`, `deviceId`, `name`, `provider`, `url`, optional `hlsUrl`, `development` (boolean), `updatedAt`, `source`. Only approved viewer URLs are accepted. Publishing keys, passwords and long-lived provider credentials are forbidden. MediaMTX credentials remain server-only. Camera URLs are not embedded in public environment variables.

`devices` is approved descriptive metadata; `eventHistory` is an operator-only audit collection. Unknown collections are denied. Storage is optional; no browser video upload or public bucket is created.

## Freshness and fallback

Default maximum age: 60 seconds, configurable. A reading more than 30 seconds in the future is rejected. Invalid payloads are ignored and counted. LIVE requires a validated, fresh reading from a confirmed transport; a configured URL, cached Firestore snapshot or device report alone cannot establish current media/measurement status. Empty successful subscriptions display **Connected — awaiting device data** while the existing demo remains available. Disconnection restores demo values with an OFFLINE indicator. Expired readings become STALE, remain inspectable with timestamps, and are excluded from current values. Sign-out clears all operational data and listeners.

Demo replay continues using its original five snapshots. Current live observations are labeled separately and never placed into fictional historical snapshots. Other modules retain demo content when their own source is missing. The interface must identify mixed sources rather than label the whole site live.
