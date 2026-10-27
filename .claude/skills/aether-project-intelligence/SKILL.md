---
name: aether-project-intelligence
description: Architecture map of AETHER CITY (routes, modules, data flow, APIs, docs) and how to inspect existing behavior before changing it. Use at the start of any feature, bug, or refactor task in this repo, or when asked how a part of AETHER works.
---

# AETHER CITY architecture

## Map

| Area | Where |
| --- | --- |
| Routes | `src/app/page.tsx` (cinematic home), `src/app/command/page.tsx`, `src/app/command/[workspace]/page.tsx`, `src/app/traffic/page.tsx` |
| Modules | `src/lib/modules.ts` — `moduleIds`: sky, flow, rescue, thermal, aqua, road, fire, twin, core, command; plus workspaces reports/settings/response/geo |
| Global state | `src/lib/store.ts` (`useNexus` Zustand store: selection, time step, quality, focus mode, `records`, `integration`) |
| Demo data | `src/lib/data.ts` (`observations`, `demoAdapter`, 5 snapshots 06–18 IST on `demoDate`), `src/lib/telemetry.ts` |
| Live data boundary | `src/lib/data/data-provider.ts` (`NexusDataController` — validation, freshness, DEMO/LIVE/STALE/OFFLINE), `firebase-provider.ts`, `validators.ts`, `hooks.ts`; mounted by `src/components/data-bridge.tsx` |
| Traffic (FLOW) | `src/lib/traffic/*` — `contract.ts`, `engine.ts`, `repository.ts` (demo file store in `.nexus/traffic` vs LIVE Firestore), `mobile-contract.ts` (AETHER MAP public DTO) |
| RESPONSE | `src/lib/response*.ts`, `src/components/response-*.tsx`, `/api/response/*` (same-origin, bounded body, rate limit, HTTP-only session) |
| Cameras (SKY) | `src/lib/cameras/registry.ts`, `mediamtx.ts`, `server.ts`, `/api/response/cameras/*` |
| Maps | `src/lib/google-maps.ts`, `src/components/google-operational-map.tsx`, `src/lib/operational-map.ts`, `geo-contracts.ts`, `geo-review.ts`, MapLibre in `src/lib/map.ts` / `geo-map.tsx` |
| 3D | `src/components/scenes/*` (city, drone, label projector, WebGL boundary) |
| Styles | `src/app/globals.css` imports ~20 feature CSS files; themes in `themes.css`, `theme-colors.css`, `src/lib/themes.ts` |

## Docs are the change log

There is no git history yet. `docs/*.md` record each past phase (e.g. `GOOGLE-MAPS.md`, `REALTIME-INTEGRATION.md`, `TRAFFIC-CONTRACT.md`, `FIREBASE-SCHEMA.md`, `VALIDATION.md`). Read the doc for the area before changing it — it states intended limits (what is demo, what is unimplemented) that the code alone won't reveal.

## Before editing

1. Locate the owner: `Grep` for the symbol/route; follow the import chain from page → component → `src/lib`.
2. Read the Zod schema for any data you touch (`observationSchema`, `geoCoordinate`, traffic validators). Schemas are the contract; extend them rather than bypassing.
3. Check which tests cover it: `tests/*.test.ts` (node, `npm.cmd test`) and `tests/*.spec.ts` (Playwright). Run them before and after.
4. For Next.js APIs, read `node_modules/next/dist/docs/` (Next 16 differs from older versions).
5. State what exists vs. what is proposed. Many modules are DEMO-only by design (see README "Data and behavior").

## Don't

- Don't add a second state store, data layer, or map component when one exists.
- Don't rename `nexus`-prefixed identifiers (env vars, claims, RTDB paths) as part of "AETHER" branding — they're live contracts.
