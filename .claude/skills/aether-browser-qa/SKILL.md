---
name: aether-browser-qa
description: Verify AETHER CITY in a real browser — run the right server, drive pages with Chrome DevTools MCP, check console/network/layout/a11y, and run the Playwright suites. Use after any UI or behavior change, when debugging a browser-only bug, or when asked to test/QA the site.
---

# AETHER browser QA

Compiling is not verification. A change is verified only when the behavior was observed in a running app.

## Servers and ports

| Use | Command | Port |
| --- | --- | --- |
| Dev (HMR) | `npm.cmd run dev` | 3000 (binds 0.0.0.0) |
| Production for E2E/QA scripts | `npm.cmd run build` then `npm.cmd run start -- --port 3001` | 3001 |
| Integration suite (auto-starts dev with test env) | `npx.cmd playwright test -c playwright.integration.config.ts` | 3003 |

Run long-lived servers with `run_in_background`. Check whether a port is already in use before starting another server; stop servers you started when done. `NEXT_PUBLIC_*` changes need a rebuild, not just a restart.

## Interactive check (chrome-devtools MCP)

1. `new_page`/`navigate_page` to the route (e.g. `/command/flow`).
2. `take_snapshot` to get element uids; interact with `click`/`fill`; `wait_for` the expected text.
3. `list_console_messages` — zero new errors/warnings caused by the change.
4. `list_network_requests` — no failed requests (4xx/5xx) except the expected missing-Maps-key state.
5. `resize_page` to 390×844 and 1440×900; `take_screenshot` for evidence; check no horizontal scroll.
6. Performance-sensitive change (3D, animation): `performance_start_trace` / `performance_stop_trace` and report the actual numbers.
7. Accessibility/SEO spot check: `lighthouse_audit` on the changed route (complements, not replaces, the axe Playwright scans).

## Automated suites

- `npm.cmd run check` — typecheck, lint, node tests (`tests/*.test.ts`).
- `npm.cmd run test:e2e` — Playwright `tests/*.spec.ts` (Chrome channel, 1440×900, production server :3001, `reuseExistingServer`). **Make sure :3001 serves a current build** or you're testing stale code.
- Google Maps is stubbed in specs via `installGoogleMapsDouble` (`tests/map-setup.ts`); real Google rendering requires the user's key and a manual check.
- Accessibility: `@axe-core/playwright` is available; scripts in `scripts/*-qa.mjs` show the established matrix pattern (themes × viewports × motion). Write new outputs to a fresh `test-results-*`/`docs/...` folder only when asked to produce evidence.

## Reporting

Report exactly: commands run, pass/fail counts, console/network findings, screenshots taken (with paths). If something couldn't be run (no key, no device, port busy), say so — don't substitute a guess.
