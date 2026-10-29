---
name: aether-drone-integration
description: Interfaces between AETHER SKY hardware (Raspberry Pi cameras, ESP32/ESP8266 sensors, drone telemetry) and the AETHER CITY backend — what is implemented vs. proposed. Use when working on device telemetry, camera streams, RTDB device contracts, or any Pi/ESP/drone code.
---

# AETHER drone & device integration

## Implementation status (as of this skill's creation — re-verify)

| Piece | Status |
| --- | --- |
| Website RTDB ingestion (devices, telemetry, cameraStatus) | **Implemented** — `src/lib/data/firebase-provider.ts`, `validators.ts`, rules in `firebase/database.rules.json` |
| Camera viewer registry (VDO.Ninja VIEW links, MediaMTX WHEP/HLS via server) | **Implemented** — `src/lib/cameras/*`, `/api/response/cameras/*`, SKY workspace |
| Raspberry Pi 3B camera publishing | **Guide only** — `docs/RASPBERRY-PI-CAMERAS.md`; no Pi code in repo |
| ESP32 / ESP8266 firmware, sensor publishing | **Not present** anywhere in the workspace |
| Drone flight control / actuation | **Out of scope** — none exists; the 3D drone is an illustrative model |
| Live AI detection pipeline | **Contract only** (`aiDetections`); browser never invents detections |

Never describe the "Not present"/"Guide only" rows as working. Simulated telemetry must be labeled DEMO.

## Device → backend contract (what firmware must send)

RTDB path `nexus/{siteId}/…`, device authenticated with claims `nexusSite`, `nexusRole: "device"`, `deviceId`:

- `devices/{deviceId}`: `id` (= deviceId), `name`, `module` (sky|flow|rescue|thermal|aqua|road|fire|twin|core|command), `status` online|offline, `lastSeen` ISO UTC `YYYY-MM-DDTHH:MM:SS(.mmm)Z`, `source: "LIVE"`.
- `telemetry/{deviceId}/latest/{channel}`: `deviceId`, `module`, `channel` (temperature °C, speed km/h, rainfall mm, water cm, health %, altitude m, battery %), `value` within bounds in `validators.ts`, `unit`, `observedAt`, `source: "LIVE"`.
- `cameraStatus/{cameraId}`: `cameraId`, `deviceId`, `online`, `lastSeen`, `streamType` vdo-ninja|mediamtx, `source: "LIVE"`; resolution/fps only if measured.

Freshness: default 60s (`NEXT_PUBLIC_NEXUS_FRESHNESS_MS`); readings > 30s in the future rejected. Check exact field validation in `firebase/database.rules.json` before writing device code.

## Rules for new device work

- Firmware/edge code goes in a clearly named new directory (e.g. `devices/esp32-<sensor>/`, `devices/pi-camera/`) with its own README stating what was tested on real hardware vs. only compiled.
- Devices authenticate with their own scoped credentials; never embed Admin SDK keys, MediaMTX publisher creds, or VDO.Ninja publisher links in firmware committed to the repo.
- Test against the Firebase emulator (RTDB :9000) before any real project, and only with approval.
- Video: viewer LIVE needs decoded frames (MediaMTX) or documented peer events (VDO.Ninja). A URL or heartbeat alone is not LIVE.
- Pi 3B: start 640×480 @ 10–15 fps; measure CPU/temp/latency before raising.
