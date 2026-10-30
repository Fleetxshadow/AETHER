# AETHER intro film

A 17-second real-time 3D opening shown once to first-time visitors of `/`. A drone wakes on a
rooftop pad, a scan wave lights a Gurugram-inspired city, the drone launches, observes an
intersection, flags an **illustrative** road disruption and draws an alternative route, then the
camera pulls back to the AETHER mark and the tagline "See the city beyond the traffic." The
overlay then fades into the existing flight hero. The page underneath stays mounted, so no state
is reset.

## One timeline, three consumers

`src/lib/intro-timeline.json` (duration, fps, cue times) is read by:

| Consumer   | File                                                        | Uses cues for                                              |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Blender    | `scripts/blender/aether_intro.py`                           | drone flight keys, prop spool-up, gimbal tilt, camera rigs |
| Soundtrack | `scripts/audio/aether_intro_soundtrack.py`                  | activation, pulse, whooshes, rotors, scan, reveal impact   |
| Web        | `src/components/aether-intro.tsx`, `scenes/intro-scene.tsx` | titles, light wave, scan cone, markers, handoff            |

Change a cue, then regenerate both assets:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python scripts/blender/aether_intro.py -- public/models/intro --poster
python scripts/audio/aether_intro_soundtrack.py $env:TEMP\aether-intro.wav
ffmpeg -y -i $env:TEMP\aether-intro.wav -af loudnorm=I=-20:TP=-2:LRA=11 -ar 48000 -codec:a libmp3lame -b:a 160k public/audio/aether-intro.mp3
```

`--previews` renders ten low-resolution EEVEE frames for checking the camera direction.
`--blend <path>` also saves the `.blend` file.

## Blender build (`scripts/blender/aether_intro.py`)

- **City**: one mesh per material (about 20 draw calls). Facades use world-scaled UVs over four
  procedurally painted facade textures (glass curtain wall, ribbon-window office, residential
  with balconies, low-rise), plus emissive lit-window maps and per-building vertex-colour tints.
  The layout has a 40 m arterial with an elevated metro guideway and station on the median, a
  cross road, secondary grid, plazas, parks, group-housing clusters, plotted houses with rooftop
  tanks, streetlights, trees, a low-detail far skyline and a southern ridge silhouette.
  Traffic is left-hand.
- **Drone**: Quad-X, 0.9 m motor span. Lofted hull, carbon arms, motor bells, twisted two-blade
  props with light tips, landing skids, a GPS puck, a gimbal observation module, red/green/white
  navigation LEDs and a restrained cyan identification strip. The camera module and other
  details are **conceptual** and do not describe installed prototype hardware.
- **Motion**: position is a Hermite spline. Attitude is derived from multirotor physics: pitch
  from forward acceleration plus drag, roll from lateral acceleration, both lagged. Props spool
  up before lift-off (capped at 110°/frame so glTF slerp stays unambiguous). The camera blends
  four rigs (rooftop orbit, crane reveal, drone-relative chase, aerial pull-back), then a
  zero-phase smoothing pass.
- **Export**: two GLBs (Draco level 7, WebP textures, `SCENE` animation mode), extras carry
  traffic lanes and incident placement, empties mark FX anchors. City ≈ 858 KB, drone ≈ 100 KB,
  ≈ 117k triangles total.

## Web playback (`src/components/scenes/intro-scene.tsx`)

- Blender owns geometry, camera path and drone animation; mixers are driven by `setTime(t)` from
  the overlay's master clock. On narrow portrait screens the camera leans toward the drone until
  the incident beat.
- Added in real time: dusk sky and fog, PMREM reflections on glass and the drone, a camera-side
  fill light, a scan wave that switches window and street lights on (shader injection), instanced
  traffic (queues behind the disruption), a metro train, hazard flashers, scan cone and rings,
  the route line drawn progressively along its Blender UVs, and DOM labels projected from 3D.
- Quality: bloom on capable GPUs only. DPR is capped per `quality` setting and dropped by
  `PerformanceMonitor` on decline. Software renderers, coarse pointers and `low` quality get
  half traffic and no bloom. Shaders and textures are compiled (`compileAsync`) before the
  visitor presses Enter.
- Measured on Intel Iris Xe (Chrome, 1440×900, dev server): about 33–62 fps; ready in about
  7–10 s on a dev server.

## Overlay and audio (`src/components/aether-intro.tsx`, `src/lib/intro-audio.ts`)

- **Gate**: the "Enter AETHER" button is the real user gesture that unlocks audio. A sound toggle
  sits next to it, with a loading line showing real byte progress of both models and the
  soundtrack. Skip is always available, and Escape also skips.
- **Audio**: decoded with an `OfflineAudioContext` (no autoplay warnings) and played through
  one module-level slot, so replays and remounts can never stack. Mute ramps gain to 0 while
  playback continues, keeping picture and sound in sync. The soundtrack position is the master
  clock while it plays. Skipping, ending or unmounting fades it out. The tab-hidden state
  suspends both.
- **Visibility**: `src/lib/intro-gate.ts` plus an inline pre-paint script in `layout.tsx` set
  `html[data-intro]` before first paint. New visitors see the gate immediately, returning
  visitors never see a flash, and without JavaScript the overlay stays hidden.
- **Fallbacks**: no WebGL2, `quality: off`, model load failure, context loss, or more than 12 s
  of preparation after Enter switches to the Blender poster with a CSS drift. Reduced motion
  (system or in-app) never autoplays; `/?intro` or the footer "Replay intro film" shows a
  still-frame version.
- **Honesty**: the disclosure line and 3D labels state that the film is illustrative, that the
  city is inspired by Gurugram rather than a geographic model, that the incident is simulated,
  and that the drone design is conceptual.

## Tests

`tests/intro.spec.ts` covers first visit, playback, the asset requests, skip, the returning
visit, reduced motion, the no-WebGL fallback and replay. `playwright.config.ts` seeds
`aether-intro-v1=seen` for every other suite, so they run as returning visitors.
