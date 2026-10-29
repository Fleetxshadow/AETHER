# AETHER CITY traffic contract v1

The existing website owns detection, investigation and review. AETHER MAP consumes a public projection. The app at `../Nexus Drone app` was inspected read-only; no app source, configuration, dependencies or artifacts were changed. No deployment, paid provider, Cloud Function or aircraft operation is required for the local demonstration.

## Ownership

| Collection               | Responsibility                                                                                                   | Client access                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `trafficRegistry`        | Directional geometry/network version, nullable legal speed/baseline, aggregates and bounded history              | Authorized server API        |
| `trafficCases`           | Authoritative private incident lifecycle, cause, verification timestamp, source provenance and affected segments | Authorized server API        |
| `incidentInvestigations` | Candidates, evidence references, uncertainty and private notes                                                   | Authorized server API        |
| `inspectionRequests`     | Human planning recommendations, decisions and review AOIs                                                        | Authorized server API        |
| `incidentEvidence`       | Private sample metadata, review status and retention                                                             | Authorized server API        |
| `trafficPublications`    | Approved safe summary, publication revision and expiry                                                           | Server only                  |
| `trafficIncidents`       | Exact existing AETHER MAP v1 public DTO, derived transactionally                                                  | Existing public subscription |
| `trafficWorkspaces`      | Site revision, clock and temporary hashed replay IDs                                                             | Server only                  |
| `trafficWindows`         | Expiring speeds, pseudonymous contributors, kinds and times; no raw positions                                    | Server only                  |
| `trafficAudit`           | Bounded events/state snapshots, event time and actual recording time                                             | Authorized server API        |

`trafficCases` is the sole private authority. The app already reserves `trafficIncidents` for a **strict public DTO**, so that collection is a whitelisted read model. Never add private case fields there. Existing generic `incidents`, `responseReports`, app `approvedHazards`, and unrelated hazard schemas remain unchanged.

Private records carry `schemaVersion: 1`, `siteId`, source `DEMO|LIVE` and ISO UTC times. Geometry is WGS84 `[longitude, latitude]`. Mobile times are numeric epoch milliseconds and source is `DEMO|AUTHORIZED`. Validators reject unknown fields, unsupported versions, unsafe IDs, invalid coordinates, invalid review state, mismatched site/source and broken case references. Persisted records are validated before use.

## Runtime and security

The explicit demo grants simulation-only capability through an HTTP-only, same-site RESPONSE session. Each principal has isolated file storage in `.nexus/traffic`, never uploaded to Firebase. Writes are serialized and atomically replaced in one Node process. Sessions expire after 30 minutes; files expire after 24 hours and cleanup runs on subsequent traffic activity. Restarting an existing simulation requires its current revision. Multiple server processes cannot safely share this sandbox.

LIVE requires dedicated existing Firebase Admin configuration, matching client/server project ID, `NEXUS_TRAFFIC_LIVE_ENABLED=true`, and a verified non-revoked token with matching `nexusSite` plus explicit `nexusTrafficRole`:

- `INGESTOR`: authorized observations; no investigation reads or review rights.
- `ANALYST`: read/analyze investigations.
- `REVIEWER`: registry management, planning review, verification, publication and resolution.

The local RESPONSE operator password and `nexusRole=operator` alone grant no LIVE traffic capability. Mutations require same origin, bounded body, rate limit and expected revision. Client writes are denied by Firestore rules. Error responses omit filesystem paths, credentials and SDK internals.

LIVE uses a Firestore transaction with a site revision and canonical documents. Review, audit and approved projection updates commit atomically. Explicit prototype capacities: 200 roads/windows; 300 cases/investigations/publications; 600 recommendations; 150 evidence items; 2,000 audit events. Queries read capacity plus one and fail closed on overflow. Transactions above 450 writes are rejected. This is a bounded prototype, not a proven city-scale storage system.

## Detection invariants

Validate source, consent where applicable, Gurugram coordinates, heading, accuracy, confidence, freshness and plausible directional map match. Hash contributor/observation identifiers server-side before temporary storage; retain no raw positions. One latest value per independent contributor enters a median/MAD aggregate. Genuine contributor independence remains an authorized upstream requirement, not something caller-chosen identifiers can prove.

Defaults: four independent samples, 90-second freshness, 120-second significant congestion persistence, 180-second recovery, 600-second cooldown, 900-second incident expiry. Validated environment settings can change thresholds. A stale gap breaks persistence. Reliable baselines need at least seven sample days and suitable IST weekday/weekend/hour context. Unknown baselines and legal speeds remain null.

Ratios classify NORMAL/LIGHT/MODERATE/HEAVY/SEVERE; sparse, stale or unsuitable support stays UNKNOWN. Connected same-corridor, same-direction segments merge; distant components remain separate. Only persistent HEAVY/SEVERE support creates a case. Fresh sustained recovery resolves; missing data expires without claiming recovery. Closed cases remain seven days after closure. Evidence and aggregation cleanup run on subsequent processing; no scheduled cloud retention service is activated.

## CORE, SKY and publication

Speed supports congestion, not causation. CORE starts with UNKNOWN cause, conservative structured findings, uncertainty and next review step. Recent usable evidence and outstanding/recently rejected recommendations suppress duplicate requests. Planning states are RECOMMENDED → PENDING_REVIEW → APPROVED_FOR_OPERATOR_PLANNING → OBSERVATION_AVAILABLE → ANALYSIS_COMPLETE, with rejection/cancellation and audit events. AOIs are human review geometry, never aircraft destinations.

Evidence is an original labeled synthetic road SVG, not a photograph, aircraft recording or completed mission. The deterministic analyzer reads fixture annotations, performs no pixel inference and reports null calibrated confidence. Candidates remain unverified until a reviewer inspects evidence and documents confirmation/rejection. No face, plate or owner analysis is implemented.

Publication uses safe server templates. Unknown congestion can be approved as unknown; known causes require review and a canonical verification timestamp. Changing verification withdraws the prior publication. Recovery marks an approved record RESOLVED. Expired support is excluded from public feeds. Private notes, actors, contributors and media never enter the DTO.

## Actual mobile compatibility

The app subscribes to `trafficIncidents` with `publicApproved == true`, `schemaVersion == 1`, `source == AUTHORIZED`, limit 200. `src/lib/traffic/mobile-contract.ts` preserves its exact field list and chronology. Private LIVE maps to AUTHORIZED; VEHICLE_BREAKDOWN → BREAKDOWN; ROAD_CONSTRUCTION → ROADWORK; FLOODING → WATERLOGGING; unsupported verified causes → OTHER. Improving trend maps to RECOVERING.

Public records have no `siteId` or extra private fields. First detection ≤ update < expiry; verification time ≤ update. RESOLVED status/causeStatus agree. Selection rejects future, stale, expired, unapproved, malformed, wrong-source and irrelevant-route records, including cached snapshots. The public listener reports cache/error states, unsubscribes on cleanup and rechecks expiry locally.

Relevance requires exact **directed segment IDs and network version**. App IDs include `osm-node:{from}:{to}`; never fabricate these from corridor names. A licensed registry must preserve the native routing graph's IDs/version. Null version cannot establish relevance. OSRM availability does not establish custom closure avoidance or ETA changes.

DEMO uses `nexus-gurugram-sketch-v1` and virtual time that may advance ahead of wall time. It never enters the app's AUTHORIZED subscription. The website preview exercises the DTO through an isolated route-filtered HTTP feed; this is **not native delivery**. Routes are illustrative, ETA is unavailable, speech requires user opt-in, and no phone/audio connection is involved.

## Migration and rollout

The app schema is strict: adding unknown public fields breaks v1. Keep the public DTO exact. Shape/semantic changes require reviewed v2 contracts, coordinated app validators, backup/export, staging validation and separately authorized rollout. Only pre-release local demo records backfill verification time from their own recorded review event; LIVE migrations are not automatic.

Rules/indexes are prepared, not deployed. Review and merge with the dedicated project's existing app rules before any authorized rollout; never replace unrelated project rules. Passing local tests does not establish a real Firebase, native-navigation, municipal or calibrated-model integration.
