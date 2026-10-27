# AETHER CITY - migration report

## 1. What changed

The existing website now presents AETHER CITY across navigation, homepage, module workspaces, city/drone overlays, assistant/intake text, reports, map attribution, loading/404 states and application metadata. Existing routes, models, cinematic sequences, keyboard controls and source disclosures remain functional. No deployment occurred.

The audit identified Next.js 16.4.0 App Router, React 19, TypeScript and npm, with existing Motion/GSAP, R3F/Drei/Three, MapLibre, Zustand and optional Firebase integrations. Actual routes remain `/`, `/command`, `/command/[workspace]`, `/traffic` and their existing APIs.

## 2. Files modified

The complete [file inventory](aether/changed-files.json) lists actual source and asset paths. Main ownership:

- `src/lib/brand.ts`, `themes.ts`, `theme-palettes.json`: shared identity, artwork views and five-theme configuration.
- `src/components/brand-mark.tsx`, `ui.tsx`, `cinematic-hero.tsx`, `experience.tsx`, `command.tsx`, `workspaces.tsx`: official identity and product copy.
- Existing module, map, drone, RESPONSE and traffic presentation components: public names and labels.
- `src/app/layout.tsx`, loading/404 pages and command metadata: application name, titles, descriptions, icons, manifest and sharing metadata.
- `src/app/aether.css`, generated theme tokens and existing logo/tooltip styles: responsive composition, independent emblem/wordmark sizing and readable map tooltips.
- `public/brand/`, `public/manifest.webmanifest`, `src/app/opengraph-image.png`, `src/app/twitter-image.png`: logo and browser/share assets.
- `scripts/aether-assets.tsx`, `scripts/aether-qa.mjs`, existing browser tests and current setup documentation: generation and verification.

## 3. Brand implementation

The user's official JPEG is preserved byte-for-byte at `public/brand/aether-original.jpeg`; equality with the supplied file and the served HTTP asset was verified. Navigation and loading use views of its emblem/wordmark. The mission area includes the full artwork. Favicon, application icons and social images derive from the same source. Dark, light-frame and monochrome presentations are provided. [Asset provenance](../public/brand/PROVENANCE.md) records the source hash. SVG wrappers embed raster artwork; they are not vector tracings.

AETHER Eclipse adds midnight, graphite, teal and gold through the existing token system. Original, Aqua, Spectrum and Sage remain available. Saved theme cookies and preferences are retained. Condensed Barlow typography stays in place.

The hero uses AETHER CITY, the requested supporting headline/copy and `INTELLIGENCE ABOVE. SAFETY BELOW.` The full form and `Observe. Understand. Anticipate.` appear in the experience. Tablet text has separate space from the scene; short desktop layouts gain vertical room; mobile layer controls retain their readable 2x2 arrangement and 44px targets.

## 4. Modules updated

SKY, FLOW, RESCUE, THERMAL, AQUA, ROAD, FIRE, TWIN, CORE and COMMAND workspaces; RESPONSE intake; GEO map/intake references; MAP public-contract preview; traffic investigation; reports/settings.

GEO is a bridge, not a standalone workspace. MAP is a website preview, not an app-store download or native app delivery. CORE remains deterministic source-linked analysis, without a connected external language model. No absent module or live capability was invented.

## 5. Backend compatibility

Existing API routes, Firebase collections/RTDB paths and app identifiers, `NEXUS_*` environment names, `nexusSite`/`nexusRole`/`nexusTrafficRole` claims, session/theme cookies, storage keys, webhook headers, `.nexus` storage and strict mobile DTO provenance values remain compatible. `public/nexus.svg` is retained as an alias serving the new official artwork. Historical design reports retain relevant old branding.

The separate mobile application was not modified. Demo/live/unknown distinctions, evidence verification, human approvals and operational boundaries remain intact. No real calls, aircraft operation, emergency dispatch, credentials or paid service were activated.

## 6. Verification results

| Proof | Result |
| --- | --- |
| `npm.cmd run check` | Passed TypeScript, ESLint and all 39 domain/backend tests |
| `npm.cmd run build` | Passed production compilation and route generation |
| Existing browser/API regression suite | 21/21 passed during migration |
| Final asset-sensitive browser rerun | 3/3 passed after official-logo and tooltip fixes (followed by isolated mission color verification): cinematic entry/tour, ten modules/drone controls, desktop/mobile accessibility |
| Viewport/theme/motion matrix | 40 combinations covered: four sizes x five themes x normal/reduced motion |
| Accessibility | 17 clean final WCAG scans: 11 across home/COMMAND/RESPONSE plus 6 focused checks of the scrolled mission section across all themes and mobile |
| Fresh browser audit | Zero console errors and zero failed/error network requests in the consolidated normal-flow matrix; final LAN-page console clean |
| Metadata/assets | Local/LAN page, favicon, manifest and both social images returned HTTP 200; rebranded missing page returned expected 404 |
| Motion | Heading-frame changes, command transition and demo-call UI verified; [recording](aether/aether-motion.webm) saved |

Sizes: 390x844, 768x1024, 1280x720 and 1440x900. [Final matrix](aether/validation.json), [21-test report](aether/regression-suite-21.html), [final three-test report](aether/final-suite-3.html), [HTTP proof](aether/asset-http-check.json) and [fresh console](aether/final-console.txt) and [scrolled-section proof](aether/mission-accessibility.json) are saved.

Visual checks exposed and corrected desktop footer clearance, overly broad legacy SVG sizing, and a keyboard-focused tooltip contrast defect in light themes. The final isolated tooltip foreground correction was rechecked in all ten desktop/theme/motion combinations and all eleven accessibility scans; the thirty unchanged smaller-viewport combinations retain their verified results. A final scrolled-artwork inspection also corrected low-contrast mission headline/acronym text; six focused theme/mobile scans passed after that isolated change. Initial findings remain separately recorded. Rendered-city screenshots wait for actual canvas content rather than only the canvas element. Motion is sampled from before replay begins.

[Before](aether/before-home-1440.png), [final desktop](aether/final-home-1440.png), [final mobile](aether/final-home-390.png), [official artwork in context](aether/final-official-artwork.png), and the other sizes/themes are under `docs/aether/`.

## 7. Remaining limitations

- Firebase integration code is present, but no live project, devices/cameras or provider credentials are configured locally. Live authentication/data connectivity cannot be certified from this demo-only environment.
- Social-image absolute URLs fall back to localhost because no production canonical origin was supplied. Configure the authorized origin when hosting is separately approved. Next also retains its existing home-package-lock root warning.
- The official source is JPEG. SVG presentations preserve its pixels and do not provide resolution-independent vector detail.
- LAN HTTP/browser access was verified from this host; another physical computer and firewall/router isolation were not tested. Android testing was outside this website migration; the user authorized browser/backend validation.

## 8. How to run

The final production build remains running on `0.0.0.0:3000`:

- Local: http://localhost:3000/
- Same Wi-Fi: http://192.168.31.225:3000/

From the existing project directory, stop the running production server before reusing port 3000 for development:

```powershell
npm.cmd run dev
```

To rebuild/start production locally:

```powershell
npm.cmd run build
npm.cmd run start
```

The site was not deployed; hosting and DNS were not changed.

The scrolled-section audit is reproducible with `node scripts/aether-mission-qa.mjs` against the running localhost:3000 server. Final build passed after the mission color correction.
