> **Autostart update (28 October):** The Pi agent and USB camera now start through `nexus-device.service`, verified by a real reboot. See [Pi autostart](NEXUS-PI-AUTOSTART.md). Do not launch a second manual agent while the service is running. Earlier manual-start instructions below describe the initial setup.

# NEXUS hardware integration — Operation Aether Link

Implemented 27 October 2026 on branch `hardware/aether-link`. Status: real Pi host metrics verified; camera transport software tested with fixtures; physical camera/sensor connections and AGY website adoption pending. The dedicated hardware gateway does not alter the running AI backend or website.

## Locations and ownership

- Desktop: `/home/blu/Projects/nexus-sky`. Firmware, gateway, setup tools and both-machine documentation.
- Pi: `nexus@nexus.local:/home/nexus/nexus-sky`. Authoritative Pi code: `aether_device/`. Existing `cameras/esp32cam/client.py`, `cameras/esp32cam/nexus_eye.py`, diagnostics, captures and `.venv` preserved.
- `hardware/pi-source/` is a review/recovery snapshot copied FROM the Pi after development. Do not develop Pi code in the old desktop `pi/` baseline or blindly overwrite newer Pi files.
- AETHER and AI backend remain AGY-owned. No AETHER source, styling, weights or model code changed. No cloud resources used.

Read the pre-change [inventory](NEXUS-HARDWARE-INVENTORY.md), [shared contract](NEXUS-INTEGRATION-CONTRACT.md), [proposed hardware addendum](NEXUS-HARDWARE-CONTRACT-PROPOSAL.md) and [AGY handoff](NEXUS-AGY-HANDOFF.md). The addendum is shared as a review artifact, not claimed approved by AGY.

## Architecture and exposure

```
Pi host metrics + configured cameras
  -> Pi agent 127.0.0.1:8765
  -> SSH tunnel laptop 127.0.0.1:18765
  -> laptop gateway 127.0.0.1:8766
  -> AGY server-side adapter -> AETHER
```

The agent and gateway use separate Bearer tokens of at least 32 characters. Tokens are server-side only, never query strings or browser configuration. No CORS is enabled. No mutation/actuator endpoints exist. Defaults bind loopback, explicit private-IP binds are supported, wildcard/public binds are rejected. Keep loopback + SSH for normal use. SSH protects the network hop; direct private-LAN HTTP has no TLS and is only appropriate on an explicitly trusted LAN. No router forwarding, firewall changes or persistent services were installed.

Both private token files were generated with mode 0600, without displaying values:

- Pi: `~/nexus-sky/config/aether.private.env`.
- Desktop: `hardware/config/local.private.env` (includes device and separate gateway tokens).

They are ignored by Git. Do not paste their contents into chat, commit them, or use a NEXT_PUBLIC environment variable. For a clean machine, generate cryptographically random tokens with Python secrets, store in the same private 0600 files, and securely provision the matching device token on both hosts. The files in this checkout are already prepared; do not overwrite them unnecessarily.

## Launch manually

No persistent daemon is enabled. During this task, temporary test processes were started, verified and stopped; use these commands to run again.

Terminal 1 on the Pi:

```sh
ssh nexus@nexus.local
cd ~/nexus-sky
. config/aether.private.env
exec .venv/bin/python -m aether_device.agent --config config/aether-agent.example.json
```

Terminal 2 on laptop:

```sh
cd /home/blu/Projects/nexus-sky
ssh -o ExitOnForwardFailure=yes -N -L 127.0.0.1:18765:127.0.0.1:8765 nexus@nexus.local
```

Terminal 3 on laptop:

```sh
cd /home/blu/Projects/nexus-sky
. hardware/config/local.private.env
python3 hardware/gateway.py
```

Use Ctrl-C in each terminal to stop. SIGINT/SIGTERM stop acquisition, terminate native capture children, join workers and close the HTTP listener. Camera viewers are bounded to two per camera; HTTP request workers to 12. Acquisition uses one worker per source and capped FPS, not one capture per browser. Native camera subprocess stderr is suppressed to avoid exposing paths/config; public errors identify the failing acquisition class. Inspect local hardware tooling separately when diagnosing a physical device.

Read API without exposing token in process arguments:

```sh
. hardware/config/local.private.env
python3 - <<'PY'
import os, json
from urllib.request import Request, urlopen
req = Request('http://127.0.0.1:8766/health', headers={
    'Authorization': 'Bearer ' + os.environ['NEXUS_GATEWAY_TOKEN']})
with urlopen(req, timeout=5) as r:
    print(json.dumps(json.load(r), indent=2))
PY
```

## Device agent endpoints

All routes require `Authorization: Bearer TOKEN`.

| GET path | Payload or transport |
|---|---|
| `/health` | Version, stable hashed machine ID, agent uptime, real resource measurements, interfaces, bounded event history |
| `/devices` | Actual Pi, explicitly configured camera identities, discovered camera candidates and empty unverified external sensor list |
| `/telemetry` | Per-measurement CPU %, RAM %, CPU temperature °C, free storage bytes, observed timestamp/source/error/calibration metadata |
| `/camera/status` | Per-camera availability, error, last frame timestamp/age, capture latency, lifetime received FPS, target FPS, counts and transport |
| `/camera/snapshot?id=ID` | Fresh JPEG with Content-Length and X-Frame-Observed-At, or 503 |
| `/camera/stream?id=ID` | MJPEG `multipart/x-mixed-replace; boundary=nexus-frame`, per-frame Content-Length and X-Frame-Observed-At |

CPU usage is measured from successive /proc/stat samples; the first sample is unavailable, not a fabricated zero. RAM uses MemTotal/MemAvailable. Temperature uses the Pi CPU thermal zone. Free storage uses the project filesystem. Missing/invalid measurements have null value/time and OFFLINE source; no battery, altitude, weather or vehicle readings are invented. No external sensor calibration or offsets are invented. CPU measurements are kernel-reported, not ambient sensors.

Stable Pi ID hashes /etc/machine-id; raw machine ID is never returned. Configured camera IDs are logical IDs, not inferred hardware serial numbers. Firmware separately provides its efuse-derived eye ID through /status. ESP32 timestamps are uptime, not UTC; camera frame timestamps are Pi receipt times.

## Camera discovery and configuration

Actual audit found no CSI camera and only codec/ISP V4L2 devices. The safe example config contains `{"cameras": []}`. Discovery runs every 10 seconds, lists CSI candidates using rpicam and V4L2 capture capabilities, and excludes known codec/ISP nodes. Discovery never proves capture and never opens a serial/controller interface.

`hardware/config/cameras.example.json` shows optional sources, ALL illustrative and unverified. Never use its addresses/devices as observations. Add only hardware actually identified to a private config on the Pi; default to one source on a Pi 3B:

- ESP32: kind=esp32, explicit local capture_url (commonly `/capture`), 0.2–10 FPS, 2 FPS recommended. This polls JPEG snapshots with backoff; firmware MJPEG remains available directly on port 81. No dependency on heavyweight decoding or AI.
- CSI: kind=csi, verified camera index, rpicam-vid MJPEG at 320x240, 5 FPS recommended.
- USB/V4L2: kind=v4l2, verified capture `/dev/videoN`, ffmpeg MJPEG at 320x240, 5 FPS recommended. Codec nodes are not cameras.

Native tools already exist on this Pi; none were installed. Missing tools/devices produce explicit acquisition failure and bounded exponential retry (1–8 s), not fake frames. No native camera adapter has been physically verified. JPEG envelope/size checks do not fully decode imagery.

To relay a configured camera through the laptop, launch `python3 hardware/gateway.py --camera-id ACTUAL_ID`. At most two viewers share the mirror's 2-FPS acquisition; original frame observation times are retained. Unknown IDs return 404, unavailable frames 503. There is no URL-selection or device-control API. Neither gateway nor Pi replays a stale frame as live. A disconnected source immediately becomes non-online; a retained frame is labelled STALE for up to 60 seconds, then OFFLINE. Last saved images from the older CLI may still be stale after errors; check mtime.

## Gateway/AETHER adapter

The gateway polls the configured Pi URL every two seconds, with three-second per-request socket timeouts and bounded JSON bodies. It rejects wrong version/IDs, units, non-finite/out-of-bounds values, future/stale observation timestamps, malformed JSON, duplicate device IDs and invalid camera availability. This is not a total request deadline against a trickling malicious peer; use the trusted SSH link.

The gateway exposes the four JSON hardware endpoints and authenticated camera relay. `/health` reports LIVE/STALE/OFFLINE upstream state. Failed/older-than-five-second polls remove live rows; a retained aggregate is STALE until 60 seconds, then OFFLINE. Per-row observed times are not regenerated. Empty unavailable responses do not contain retained stale measurements; the aggregate status explains why.

Additional `/api/nexus/feeds`, `/api/nexus/devices`, `/api/nexus/telemetry`, `/api/nexus/cameraStatus` support AGY's feed shape. Only recently observed actual devices are projected into strict AETHER device rows. City telemetry, observations, AI detections and incidents remain empty. The current AETHER strict schema cannot represent component=cpu resource metrics or MJPEG, so these stay in hardware endpoints. No phantom MediaMTX/WebRTC stream is advertised. AGY must create the server-side adapter and any required transport bridge; the existing AI backend was not switched to this gateway.

Errors use `{error, code, details, timestamp, source:OFFLINE}`. Codes/statuses: unauthorized 401, read-only mutation 405, invalid camera ID 400, unknown source/path 404, no fresh frame/upstream invalid 503, viewer limit 429. GET status endpoints return 200 with explicit OFFLINE/STALE when the service itself is available. No application endpoint reboots, flashes, arms or controls actuators.

Typed payloads: `hardware/types.ts`. Real captured examples: `docs/hardware-evidence/real-pi-api.json`. These are historical observations with their original timestamps, not current LIVE fixtures. Strict-feed compatibility test uses AETHER's actual unmodified validators.

## ESP32 firmware

`firmware/nexus_eye/nexus_eye.ino` v0.2.0 retains /health, /status, /snapshot and /capture on :80 and /stream on :81. Added efuse-derived identity, schema version, 64-bit uptime, readable initialization errors, capture/failure counters, serial heartbeat, connection events and camera-init retry every 30 seconds. Captures and streaming serialize on a mutex; the status server stays separate from the stream server. One framebuffer and flash LED off are preserved.

`config.h` exposes build-time FPS 1–10 (default 5), JPEG quality 10–40 (default 14), QVGA/VGA resolution (default QVGA; no-PSRAM fallback QVGA). Restart/rebuild to change settings; no remote controls. Wi-Fi retries every 10 seconds. Calibration/power stability, recovery after capture faults and API concurrency require a real board.

Arduino-ESP32 **3.3.12** is installed and now pinned by setup.sh. `./tools/compile-test.sh` passed with placeholder credentials: 1,018,785 bytes flash (32% of 3,145,728); 57,696 static RAM bytes (17% of 327,680). It uses a temporary sketch/build, preserves local secrets, and deletes test outputs. There is no flash step in that helper. `secrets.h` and credential-bearing binaries remain ignored/private.

**No wiring or flashing performed.** Board identity, Nano model/3.3 V UART compatibility, supply and boot/reset procedure remain physical gates. Do not derive wiring from a CH340 marking. All drone inspection remains grounded, disarmed and propeller-free; no actuator interfaces are opened. The proposed Ethernet/hotspot IPs are not configured by this work.

## Tests and troubleshooting

```sh
# On Pi
cd ~/nexus-sky
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python tests/soak_aether_stream.py
# Laptop, no private env required for unit tests
cd /home/blu/Projects/nexus-sky
python3 -m unittest discover -s hardware/tests -v
./tools/compile-test.sh
# With temporary agent, SSH tunnel and gateway running:
. hardware/config/local.private.env
python3 hardware/tests/smoke_live_pi.py
/home/blu/Projects/AETHER/node_modules/.bin/tsx hardware/tests/check_aether_schemas.ts
```

The soak intentionally uses JPEG-envelope fixtures and simulated source dropouts. It does not prove camera imaging, physical Wi-Fi/Ethernet failover or image decoding. Do not attach its fixture status to production feeds.

401: source the correct private env file; tokens differ by service. 503/STALE: check Pi SSH, manual agent process and tunnel; never substitute demo readings with LIVE timestamps. 404 camera: configure that ID on Pi and pass --camera-id to gateway. Missing camera: run rpicam-hello --list-cameras or v4l2-ctl --list-devices; codec/ISP entries do not qualify. Capture failure: verify physical device, permissions, format, board/power and tool availability. Do not use broad chmod, guessed serial ports, network rewrites or automatic flashing. Missing temperature: expect null/OFFLINE on unsupported hardware.
