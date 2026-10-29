> **Boot update (28 October):** Pi agent and USB camera now start automatically through an enabled system service, verified after an actual reboot. Use [Pi service controls](../hardware/nexus-sky/docs/NEXUS-PI-AUTOSTART.md); earlier manual-start instructions below are superseded for the Pi. The laptop stack/tunnel remain separate.

> **28 October update:** A real USB camera is now capturing and streaming through the existing AETHER camera API. See the [physical camera activation record](../hardware/nexus-sky/docs/NEXUS-USB-CAMERA-2026-10-28.md). The earlier inventory and pending-camera statements below describe the 27 October handoff.

# AGY handoff — Operation Aether Link

**Prepared for:** Antigravity (AGY), AETHER website and AI/backend integration owner
**Prepared by:** Codex, hardware/device integration
**Date:** 27 October 2026
**State:** Ready for backend integration; physical camera and website end-to-end acceptance remain pending.

## Start here

Connect AETHER to the authenticated local hardware gateway without changing the visual interface. Start by replacing the existing hardcoded `LIVE` feed records. The verified live device is the Raspberry Pi host; no external camera or sensor was detected during the audit. Keep unavailable camera/sensor data explicitly offline.

This is a handoff artifact, not evidence that AGY has accepted the contract or that the website is already connected. Services used for verification were stopped after testing. Recheck reachability before integration.

## Repository and ownership

| Item | Location / state |
|---|---|
| Shared repository | [Fleetxshadow/AETHER](https://github.com/Fleetxshadow/AETHER) |
| Hardware branch | [hardware/aether-link](https://github.com/Fleetxshadow/AETHER/tree/hardware/aether-link) |
| Hardware subtree | `hardware/nexus-sky/` within AETHER |
| AETHER base | `feature/nexus-ai-integration`, commit `b64884b` |
| Verified import | `7e9dfab` — exact import of 45 committed hardware files; original AETHER files unchanged |
| Repository provenance | `a4100b7` |
| Existing hardware worktree | `/home/blu/Projects/nexus-sky/.tools/aether-link-worktree` |
| Desktop working project | `/home/blu/Projects/nexus-sky` |
| Authoritative Pi code | `nexus@nexus.local:/home/nexus/nexus-sky/aether_device/` |

The separate AETHER checkout at `/home/blu/Projects/AETHER` remains on AGY's integration branch. Use the existing hardware worktree to inspect this branch without disturbing that checkout. In another clone, fetch `origin` and check out `hardware/aether-link` normally.

`hardware/nexus-sky/hardware/pi-source/` is the review/recovery snapshot copied **from** the Pi; its hashes match the authoritative remote files. Future Pi development belongs on the Pi, followed by a deliberate snapshot refresh. The old desktop `pi/` client is not the current Pi source. Do not copy an old baseline over the Pi project or replace its `.venv`.

AGY owns website providers, server-side API routes, AI/backend integration and any camera transport bridge. Codex owns the Pi agent, ESP32 firmware and device interfaces. No website styling, trained weights, serial controls or cloud resources were changed by the hardware implementation.

## Verified state

These are recorded outcomes from 27 October, not a new assertion that the devices are online when you read this document.

| Area | Evidence-backed result |
|---|---|
| Pi hardware | Raspberry Pi 3 Model B Rev 1.2; Debian 13.7 ARM64; Python 3.13.5; existing venv preserved |
| Actual network | Pi Wi-Fi `192.168.3.224/22`, laptop Wi-Fi `192.168.3.69/22`; Ethernet down |
| Intended links | `192.168.50.1/.2` Ethernet and `192.168.60.1` hotspot were not configured by this work |
| Real data | CPU usage, RAM usage, CPU thermal-zone temperature and available project storage via authenticated Pi API and laptop gateway |
| Source identity | Stable hashed Pi machine identity; raw machine-id is not returned |
| Cameras | CSI discovery reported none; V4L2 nodes were codec/ISP devices; no external camera proven connected |
| Other sensors/controllers | None verified; no readings invented and no flight interface opened |
| Recovery | Actual Pi agent SIGTERM made gateway state STALE and removed live rows; actual restart restored the feed |
| Tests | Pi 19/19; gateway 5/5; existing desktop client regression 10/10 |
| Camera transport | 30.74-second fixture test: two viewers, 122 unique frames each, two injected source outages, 116 health requests, no parse errors |
| AETHER compatibility | Actual Pi device row passed AETHER's unmodified strict device schema |
| Firmware build | ESP32-CAM target compiled with Arduino-ESP32 3.3.12: 1,018,785 flash bytes and 57,696 static RAM bytes |

Camera fixtures validate software transport, not physical imaging, full JPEG decoding or realistic camera bandwidth. Firmware compilation is not flashing or device execution.

## Integration contract

The existing AETHER [integration contract](NEXUS-INTEGRATION-CONTRACT.md) remains AGY-owned. The subtree [hardware addendum](../hardware/nexus-sky/docs/NEXUS-HARDWARE-CONTRACT-PROPOSAL.md) is proposed and locally implemented; confirm its adoption before treating it as the final shared API. The subtree contract contains an additive pointer to that proposal; do not overwrite the root contract with the older duplicate.

```text
Pi host metrics / configured cameras
  -> Pi device service 127.0.0.1:8765
  -> SSH tunnel at laptop 127.0.0.1:18765
  -> laptop hardware gateway 127.0.0.1:8766
  -> AGY server-side adapter / existing AI backend
  -> AETHER provider and website
```

Keep the existing AI backend on port 8000. The gateway is a hardware read service, not an inference server: do not globally replace `NEXUS_BACKEND_URL` with port 8766 if that setting also serves VISION/CORE/MAVERICK calls. Add a separate server-only hardware URL/token setting or merge the hardware feed inside the existing backend.

All device/gateway routes require a server-side Bearer token. No CORS or public exposure is enabled. Do not send tokens, private configuration or raw hardware controls to the browser.

| Gateway GET endpoint | Use |
|---|---|
| `/health` | Upstream connection state and real Pi health when fresh |
| `/devices` | Versioned hardware registry, actual last-seen timestamps and discovery |
| `/telemetry` | CPU/RAM/storage measurements with units, timestamps, component, provenance and errors |
| `/camera/status` | Independent camera availability, frame age, acquisition errors and performance |
| `/camera/snapshot?id=ID` | Authenticated fresh JPEG relay for an explicitly configured camera ID |
| `/camera/stream?id=ID` | Authenticated MJPEG relay; `multipart/x-mixed-replace; boundary=nexus-frame` |
| `/api/nexus/feeds` | Narrow AETHER-compatible device projection plus empty unsupported feeds |
| `/api/nexus/devices` | AETHER device rows |
| `/api/nexus/telemetry` | Empty until a verified city sensor and semantic mapping exist |
| `/api/nexus/cameraStatus` | Empty until camera schema/transport support exists |

The agent/gateway schema version is `1.0.0`. Types are in [hardware/types.ts](../hardware/nexus-sky/hardware/types.ts); complete captured payloads are in [real-pi-api.json](../hardware/nexus-sky/docs/hardware-evidence/real-pi-api.json). Those examples retain historical observation times; do not replay them as current LIVE data.

Preserve these semantics:

- `LIVE` means a fresh real observation at that component. Gateway/Pi health LIVE does not imply camera LIVE.
- Gateway poll failures or an aggregate older than five seconds remove projected live rows. Retained aggregate status is STALE up to 60 seconds, then OFFLINE. `/telemetry` returns no retained stale measurements on upstream failure.
- A disconnected camera immediately becomes non-online. A retained frame is STALE for up to 60 seconds, then OFFLINE, and is not served as a live image.
- Missing measurements carry `value: null`, no observed timestamp and OFFLINE status. The first CPU sample is unavailable until a second sample exists.
- CPU temperature is `component: cpu`, not ambient/city temperature. No battery, altitude, rainfall, traffic speed or city-health values are derived from host resource metrics.
- All strict AETHER city telemetry, cameraStatus, AI detections, observations and incidents are intentionally empty in the hardware feed. AGY may merge separately verified AI outputs without changing their provenance.
- ESP32 raw status exposes an efuse-derived identity and uptime; uptime is not UTC. Pi frame times are receipt times, not a synchronized sensor exposure clock.

Errors use `{error, code, details, timestamp, source: "OFFLINE"}`. Expect 401 without the correct token, 400 for invalid camera IDs, 404 for unknown routes/sources, 503 for no fresh frame and 429 for the camera viewer limit. Mutations are rejected with 405. A functioning status endpoint can return HTTP 200 with source OFFLINE/STALE; HTTP success alone does not mean hardware is live.

## Launch and configuration

On this PC, private tokens already exist outside Git with mode 0600:

- Pi: `~/nexus-sky/config/aether.private.env` contains the device token.
- Desktop: `/home/blu/Projects/nexus-sky/hardware/config/local.private.env` contains the matching device token and a separate gateway token.

These files are deliberately absent from the GitHub branch/worktree. Do not print them or copy them into frontend environment variables. A fresh machine needs securely provisioned tokens of at least 32 random characters; do not assume the repository examples are credentials. The SSH password is not included in this document.

Start three foreground processes in separate terminals:

```sh
# Terminal 1: Pi agent, preserving the existing environment and safe empty camera config.
ssh nexus@nexus.local
cd ~/nexus-sky
. config/aether.private.env
exec .venv/bin/python -m aether_device.agent --config config/aether-agent.example.json
```

```sh
# Terminal 2: laptop tunnel, loopback only.
ssh -o ExitOnForwardFailure=yes -N   -L 127.0.0.1:18765:127.0.0.1:8765 nexus@nexus.local
```

```sh
# Terminal 3: laptop gateway from the verified desktop project.
cd /home/blu/Projects/nexus-sky
. hardware/config/local.private.env
python3 hardware/gateway.py
```

The same gateway code is versioned at `hardware/nexus-sky/hardware/gateway.py` in AETHER. If running that copy from the hardware worktree, source the private env by its absolute desktop path first; there is no private config inside the subtree. Do not start both gateway copies on port 8766.

The safe Pi config has no cameras. After a camera is physically identified and tested, configure its actual URL/device/index on the Pi and pass its logical ID with `--camera-id ACTUAL_ID` when starting the gateway. Example addresses in `cameras.example.json` do not identify connected hardware. No persistent service was installed; Ctrl-C/SIGTERM stops the manual processes.

## AGY implementation order

1. **Fix provenance before exposing live feeds.** Inspect `/home/blu/Projects/nexus-sky/backend/server.py`, especially `get_live_devices_data`, `get_live_telemetry_data`, `get_live_cameras_data`, `get_live_observations_data` and `get_nexus_feeds`. The audited functions generate fixed battery 78.4%, altitude 45 m, speed 38.2 km/h, phantom flow/radar devices and a fixed AI detection with fresh LIVE timestamps. Replace those rows with verified sources or explicitly segregated DEMO data. This finding is scoped to these feed functions; it does not assert that every inference route is fake. That existing backend is outside the imported hardware subtree and must be handled in its actual desktop location.
2. **Add the authenticated server-side hardware adapter.** Fetch the loopback gateway with a bounded timeout, validate rows against existing AETHER schemas and preserve source/observation times. Catch unreachable/invalid upstream states. Never require the browser to call the Pi or carry its token.
3. **Merge real devices with real inference outputs.** Keep hardware feed availability separate from model availability. Do not fabricate incidents or refresh timestamps to keep old observations alive. Leave unsupported sensor channels empty; CPU resource metrics may use a separate typed system adapter.
4. **Resolve camera transport explicitly.** AETHER currently accepts only `mediamtx` or `vdo-ninja` in its camera health validator. Hardware provides MJPEG. Either create and verify a real transport bridge or adopt an explicit MJPEG-capable schema/provider path. Until then, preserve empty cameraStatus/OFFLINE camera state; do not label MJPEG as MediaMTX.
5. **Exercise the existing interface without redesign.** Verify actual device rows, unavailable states, labelled demo fallback, reconnect behavior and any eventual real camera feed. Keep styling, layout and model weights unchanged.
6. **Record adoption and results.** Update the root integration contract with agreed hardware semantics, record changed files/commits and report separately what passed with real devices versus fixtures. A merge/website release has not been performed as part of this handoff.

## Acceptance checks

Before declaring the website integration complete:

- Authenticated Pi and gateway health return current timestamps and the actual Pi identity; unauthorized access returns 401.
- The website receives the real Pi device row through AGY's server-side adapter, with no private token or device config in browser payloads.
- Existing hardcoded LIVE devices/readings/detections are removed or explicitly isolated as DEMO.
- With no camera connected, the UI shows unavailable camera state and does not manufacture a stream or MediaMTX transport.
- Stopping the Pi agent removes live rows and yields STALE/OFFLINE; restarting it recovers without replaying old values as fresh. Keep demo fallback clearly labelled.
- Host CPU temperature remains distinct from ambient/city telemetry; absent physical sensor channels remain empty.
- A future camera integration proves actual image capture/decoding, the selected browser transport and recovery from a real disconnect. Fixture-only tests cannot satisfy this item.
- Existing frontend behavior and tests pass without visual redesign; no actuator/control route is introduced.

Recorded hardware suites can be rerun on their intended hosts:

```sh
# Pi
cd ~/nexus-sky
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python tests/soak_aether_stream.py  # mock transport only

# Existing desktop hardware project
cd /home/blu/Projects/nexus-sky
python3 -m unittest discover -s hardware/tests -v
./tools/compile-test.sh  # placeholder credentials; compile only
```

The optional real-Pi smoke requires the agent/tunnel/gateway and sourced private env. The AETHER-schema check reads local validators via its existing tsx dependency. Exact commands and limitations are in the [integration guide](../hardware/nexus-sky/docs/NEXUS-HARDWARE-INTEGRATION.md).

## Known limits and safety boundaries

Physical ESP32 firmware execution, PSRAM, real camera capture, JPEG decoding, native CSI/USB adapters, sustained full-size video and physical Wi-Fi/Ethernet failure/recovery are unverified. No other sensors or flight controller were verified. Network topology was inspected but not rewritten.

No flashing or wiring was performed. Nano exact variant, 3.3 V TX/RX compatibility, supply and boot/reset procedure must be verified before hardware connection or flashing. Any physical drone work stays grounded, disarmed and propeller-free. No arming, motor output, autonomous flight or actuator command is authorized by this handoff.

No persistent service, public device exposure, paid cloud compute, model retraining or weight modification is part of this integration. Existing Pi clients, diagnostics, captures and environment were preserved.

## Evidence and commits

- [Hardware inventory](../hardware/nexus-sky/docs/NEXUS-HARDWARE-INVENTORY.md)
- [Complete test report](../hardware/nexus-sky/docs/NEXUS-HARDWARE-TEST-REPORT.md)
- [Hardware contract proposal](../hardware/nexus-sky/docs/NEXUS-HARDWARE-CONTRACT-PROPOSAL.md)
- [Pi API evidence](../hardware/nexus-sky/docs/hardware-evidence/real-pi-api.json)
- [Pi stop/recovery evidence](../hardware/nexus-sky/docs/hardware-evidence/pi-service-recovered.json)
- [Fixture streaming results](../hardware/nexus-sky/docs/hardware-evidence/pi-stream-soak.json)
- [Pi snapshot hash manifest](../hardware/nexus-sky/docs/hardware-evidence/pi-source-manifest.json)

AETHER commits: `7e9dfab` imports the hardware subtree; `a4100b7` records repository provenance. The original standalone hardware commits were `eefa603` (audit/baseline), `d268441` (implementation) and `bbb0693` (verification records); they were imported as a squashed subtree and are not ordinary AETHER branch ancestors. The handoff document is added in a subsequent documentation commit; use branch history for its hash.
