# NEXUS hardware test report — 27 October 2026

Overall: PARTIAL integration. Real Pi host observations, authenticated local device/gateway transport and ESP32 compilation pass. Camera software tests pass with explicit fixtures. Physical camera/ESP32/sensor operation and AGY website adoption remain unverified.

## Evidence and outcomes

| Check | Outcome | Evidence / exact boundary |
|---|---|---|
| Pre-change inventory | Passed, physical Pi SSH inspection | NEXUS-HARDWARE-INVENTORY.md; Wi-Fi actual 192.168.3.224; Ethernet down; no CSI or external serial device |
| Existing Pi client baseline | 13/13 passed | hardware-evidence/pi-baseline.txt; mock transport, not imaging |
| Pi final suite | 19/19 passed (13 preserved + 6 new) | hardware-evidence/pi-agent-tests.txt; real Pi Python 3.13.5 |
| Gateway suite | 5/5 passed | hardware-evidence/gateway-tests.txt; validation, auth, unavailable/stale/expiry/recovery, real local HTTP polling, snapshot/MJPEG relay and disconnect |
| Existing desktop camera client | 10/10 passed | hardware-evidence/desktop-client-regression.txt |
| Actual Pi metrics via tunnel/gateway | Passed | hardware-evidence/real-pi-api.json; CPU/RAM percentages, CPU thermal-zone °C, project storage bytes; actual observed timestamps |
| Unauthorized API access | Rejected with 401 | unit suite + real Pi/gateway smoke; separate private tokens, no CORS |
| Mutations / invalid camera ID / missing source | 405 / 400 / 404 | Pi suite; unavailable fresh source 503 and viewer limit implemented |
| Pi agent graceful stop | Passed, actual SIGTERM | hardware-evidence/pi-service-unavailable.json; gateway transitions STALE, live device/telemetry rows removed |
| Pi agent restart | Passed, actual process restart | hardware-evidence/pi-service-recovered.json; gateway recovered without a restart |
| Two-viewer transport soak | Passed, 30.74 seconds | hardware-evidence/pi-stream-soak.json; 122 unique frames per viewer, 116 health requests, two simulated 2-second source outages, no parse errors, 28,732 KiB process max RSS |
| JPEG image decoding | Not tested | Soak uses envelope fixtures, not a real sensor or full image decoder |
| AETHER schema compatibility | Passed for actual Pi device record | hardware-evidence/aether-schema-check.txt; unmodified AETHER deviceSchema used; no AETHER edits |
| Camera transport compatibility | Partial | Hardware/gateway MJPEG tested with mocks; AETHER requires mediamtx/vdo-ninja. Its cameraStatus is intentionally empty pending a bridge/schema decision |
| ESP32 build | Passed | hardware-evidence/esp32-compile.txt; Arduino-ESP32 3.3.12, esp32:esp32:esp32cam; 1,018,785 flash bytes, 57,696 static RAM bytes, placeholder credentials only |
| Syntax and types | Passed | Python syntax, shell syntax and standalone hardware/types.ts TypeScript check |

Soak metrics describe a mock transport workload running on the real Pi, not physical-camera FPS, real JPEG decoding, a thermal endurance test or an image-quality benchmark. Small fixture frames do not establish full-size camera network throughput. No multi-hour stability claim is made.

Captured API examples retain original UTC timestamps; they are historical real observations, not evergreen LIVE fixtures. The live gateway validates freshness independently and does not replace observation times when polling.

## Failure / recovery coverage

- Pi available/unavailable: actual SSH/HTTP success and actual agent shutdown/restart; unreachable port tested locally.
- Camera absent/unplugged: no real camera discovered; missing/invalid sources and connected→disconnected→reconnected transitions tested with fixtures, not physical unplugging.
- ESP32 disconnection: HTTP source errors/backoff/reconnect exercised with mocks; board runtime remains pending.
- Wi-Fi/Ethernet loss: generic upstream connection failure and gateway recovery tested in software. Actual interface interruption/failover is NOT tested; current Ethernet is down. No remote network configuration was changed and the SSH link was not deliberately severed.
- Invalid telemetry: non-finite/bool/out-of-range values, wrong units and stale envelope timestamps rejected; unavailable Pi measurements explicitly null/OFFLINE.
- Multiple sources: two mock source IDs acquired independently and shut down cleanly; no physical multi-camera claim.
- Restart: actual Pi service restarted, stable machine identity retained, gateway recovered; native capture worker restart exercised with mocks.
- Streaming: two concurrent local MJPEG clients, parallel health access and recovery after two injected source outages; gateway relay tested through a second authenticated local API.

## Implemented and unverified

Implemented: Pi standard-library agent, real host metrics, discovery with codec filtering, explicit source config, native CSI/V4L2 and ESP32 snapshot adapters, bounded logging/threads/viewers/frame size, reconnect/backoff, graceful shutdown, device/gateway Bearer access, strict schema validation, stale/offline states, narrow AETHER device projection, typed examples, firmware identity/heartbeat/config/recovery and setup documentation.

Unverified: real camera capture/decoding; CSI/V4L2 subprocess adapters with physical devices; ESP32 firmware runtime, PSRAM and initialization recovery; physical Wi-Fi/Ethernet interruption; other sensors/controllers; Nano board and 3.3 V TX/RX compatibility; power/boot wiring; MediaMTX/WebRTC bridge; AGY backend feed merge and final browser behavior. All grounded hardware checks, prop removal and any flashing remain separate steps. No serial control, arming, motor output, autonomous flight or cloud compute occurred.

Critical integration finding: existing backend/server.py fixed city measurements/detections are labelled LIVE. This code was not reused or silently treated as evidence. AGY handoff specifies replacement/relabel work before website live use. No proof of end-to-end website completion is claimed.

## Preservation and runtime cleanup

Pi legacy clients, diagnostics, .venv and captures preserved; new files added under /home/nexus/nexus-sky. Laptop unrelated AI/training/weights work remains untracked and untouched. AETHER working tree remains clean. Tokens are in ignored 0600 files, not commits. Temporary agent/gateway/tunnel processes used for testing are stopped before handoff; no system service or firewall/network configuration installed. Re-launch explicitly using NEXUS-HARDWARE-INTEGRATION.md.

## Changed files and commits

A selective hardware branch was created from an unborn desktop repository. Baseline commit eefa603 preserves the existing firmware, build scripts, ignore rules, shared contract and inventory. Only hardware implementation, documentation/evidence and the Pi review snapshot are included in follow-up commits; no datasets, trained weights, cloud credentials or unrelated UI changes are staged.

The exact implementation commit and changed-file manifest are recorded in hardware-evidence/commit-record.txt and hardware-evidence/changed-files.txt. The documentation record commit is available from `git log --oneline hardware/aether-link` (a commit cannot contain its own final hash).
