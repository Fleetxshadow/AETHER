---
name: aether-ui-engineering
description: UI rules for AETHER CITY — functional-first interfaces, themes, responsive layout, accessibility, Motion/GSAP/R3F performance. Use when building or changing any component, page, CSS, animation, or 3D scene in this repo.
---

# AETHER UI engineering

## Non-negotiables

- **Functional before cinematic.** Every visible control must do something real or be clearly disabled with a reason. No decorative buttons, fake loading bars, or numbers that don't come from data. Loading indicators must track an actual pending request.
- Data shown in UI must display its source state (DEMO/LIVE/STALE/OFFLINE) using the existing data-source components (`src/components/data-source.tsx`), not new ad-hoc badges.
- Reuse primitives in `src/components/ui.tsx`, `motion-ui.tsx`, `chart.tsx` before creating new ones.

## Styling

- CSS is plain feature files imported by `src/app/globals.css` + Tailwind 4. `aether-os.css` (imported last) is the design system: `--ae-*` tokens and the shell. Prefer its tokens; don't create a new file per component.
- Shell: `src/components/app-shell.tsx` (sidebar groups, top bar, palette, mobile dock). New routes must be added to `navGroups` there. Shell root classes are `os-app cinematic-command`; never re-add `command-app` (legacy 0,4,0 grid rules key on it).
- Seven themes: nova (default), obsidian, eclipse, original, aqua, spectrum, sage — check contrast in all of them. See `docs/AETHER-OS.md`.
- Breakpoints verified historically: 390×844, 768×1024, 1280×720, 1440×900. No horizontal overflow; touch targets ≥ 44px.

## Accessibility

- Keyboard reachable, visible focus, focus restored after dialogs/panels close.
- Respect `prefers-reduced-motion` and the in-app reduced-motion setting (system setting takes priority).
- Text alternatives for map pins/3D labels; HTML labels stay in the app DOM (`scenes/label-projector.tsx`), not nested React roots.

## Motion and 3D performance

- Use `motion` (`motion/react`) — the project already depends on it; GSAP for existing scroll timelines only. Load the `motion` skill for API details.
- Animate `transform`/`opacity`; avoid animating layout properties. Stop R3F rendering offscreen (`frameloop="demand"` pattern already used for lower quality tiers) and dispose geometry/materials on unmount.
- Keep the WebGL failure fallback and "simplified" quality mode working.

## Done means

`npm.cmd run check` passes, and the change was viewed in a browser at desktop + 390px widths with zero new console errors (see `aether-browser-qa`). Screenshots only count as evidence if they were actually captured this session.
