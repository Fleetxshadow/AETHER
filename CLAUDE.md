@AGENTS.md

# AETHER CITY — project instructions

AETHER = Advanced Ecosystem for Traffic, Hazards, Emergencies & Routing. This repo is **AETHER CITY** (website + `/command` center), package `nexus-v2`. Its sibling **AETHER MAP** (Expo app) lives at `../Nexus Drone app` and has its own CLAUDE.md; it consumes this site's public `trafficIncidents` DTO (`src/lib/traffic/mobile-contract.ts`).

Stack: Next.js 16 App Router, React 19, strict TS, Zod 4, Zustand, Tailwind 4, MapLibre 6 + Google Maps JS (`@googlemaps/js-api-loader`), R3F/Three, Motion + GSAP, Firebase 12 client + Admin. npm only; on Windows PowerShell use `npm.cmd`/`npx.cmd`.

## Working rules

- Read the relevant code and its `docs/*.md` record before editing. Prefer the narrowest change; no rewrites, refactors, or new dependencies without a stated reason.
- Preserve working behavior. The demo must keep working with **no** env vars, keys, or Firebase.
- Data honesty: every record carries a source state — `DEMO`, `LIVE`, `STALE`, `OFFLINE` (see `src/lib/data/types.ts`, `NexusDataController`). Never label demo/mocked/simulated data LIVE, never invent coordinates, incidents, evidence, telemetry, or routes, and show mixed sources rather than labeling the whole site live.
- Never fabricate completed work, passing tests, or integration status. Report what ran and its actual output; separate verified from assumed.
- Secrets: never read out, log, or commit `.env.local` values. Server-only secrets never go in `NEXT_PUBLIC_*`. Don't weaken auth, rules, origin checks, or validators to make a feature "work".
- Ask first before: deploying, Firebase rules deploy, writing to any real Firebase project, deleting data, force-push/reset/discarding changes, paid/billable API usage.

## Verify

```powershell
npm.cmd run check        # typecheck + lint + node domain tests
npm.cmd run build
npm.cmd run test:e2e     # Playwright vs production server on :3001 (builds must be current)
npm.cmd run format:check
```

UI changes also need a real browser look (see `aether-browser-qa` skill). Note: Git has no commits yet — see `aether-git-workflow` before the first commit.

## Skills (`.claude/skills/`)

`aether-project-intelligence` (architecture map) · `aether-ui-engineering` · `aether-geospatial` · `aether-firebase` · `aether-browser-qa` · `aether-git-workflow` · `aether-drone-integration`

## MCP in this project

- `chrome-devtools` (plugin): live Chrome — console, network, performance traces, screenshots.
- `firebase` (`.mcp.json`): global `firebase` CLI, **read-only tool allowlist**. No project is selected (no `.firebaserc`); never add write tools without approval.
- `google-maps-code-assist` (`.mcp.json`): Google Maps Platform docs retrieval only; makes no Maps API calls.
- `typescript-lsp` (plugin): code intelligence via global `typescript-language-server`.
