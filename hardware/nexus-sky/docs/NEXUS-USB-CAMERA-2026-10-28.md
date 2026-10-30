# Verified USB camera activation — 28 October 2026

## Physical result

The Pi detected USB Microdia Camera (0c45:6340), UVC card USB 2.0 Camera: USB Camera, model/udev name Sonix Technology Co., Ltd. /dev/video0 is Video Capture; /dev/video1 is Metadata Capture. CSI discovery still reports no camera; this is a USB camera.

Verified 320x240 MJPEG input at 10 fps, the lowest enumerated camera rate. The Pi uses a single ffmpeg acquisition process with explicit MJPEG input, single codec threads, and fps=5 output filtering. The agent emits at most 5 fps, and the laptop mirror polls at 2 fps. The existing web MJPEG endpoint may repeat the latest fresh frame at its own 10-Hz loop; that is not 10 unique sensor frames per second.

A real camera JPEG was captured on the Pi and decoded successfully. The authenticated gateway and new backend Pi source passed image decoding at 320x240. AETHER's /api/camera/stream?annotate=false yielded 30 decodable frames over 2.96 seconds, including 6 distinct frame hashes. This was a physical camera test through the actual website API, not a mock. No new visual browser inspection or long-duration camera test is claimed.

/api/nexus/feeds reports the actual Pi and pi-usb-cam-01 online. Strict cameraStatus remains empty because the existing city feed validator has no MJPEG type; the already-implemented local CameraPanel path uses /api/camera/sources and /api/camera/stream separately. No MediaMTX service or WebRTC bridge is claimed.

## Code and configuration

Authoritative Pi edits in /home/nexus/nexus-sky:
- aether_device/cameras.py: safe stable /dev/v4l/by-id paths, optional validated V4L2 input_format/input_fps, explicit output frame-rate cap, single decoder/encoder threads.
- tests/test_aether_device.py: added stable-node and ffmpeg rate/input command test; final Pi suite 20/20 passes.
- config/aether-agent.private.json: explicit verified USB config, mode 0600. Original empty example was preserved. Non-secret example mirrored on PC at hardware/config/verified-usb-camera.example.json.
- logs/cameras-before-usb-2026-10-28.py: original source backup, not included in source snapshot.
- captures/usb-first-light-2026-10-28.jpg: private real capture retained on the Pi, not committed.

Desktop changes in /home/blu/Projects/nexus-sky:
- hardware/gateway.py: supports NEXUS_CAMERA_IDS as the default explicit relay list; command-line IDs remain supported.
- hardware/config/local.private.env: added only NEXUS_CAMERA_IDS=pi-usb-cam-01; existing tokens preserved and kept private.
- backend/cameras.py: GatewayCameraSource reads the authenticated local relay, preserves frame observation times, rejects invalid/stale JPEGs, and suppresses frames after disconnection. Pi source replaces the old fixed Ethernet host. The existing backend file is outside the AETHER subtree; hardware/patches/backend-usb-camera.patch records the exact change, already applied to the desktop backend. Do not apply it twice.
- hardware/pi-source: refreshed review snapshot of changed Pi source/tests.
- hardware/runtime/pi-usb-through-aether.jpg: private web-path snapshot, ignored by Git.

The website UI was not changed. Existing CameraPanel has a local Pi option and Next rewrites /api/camera/* to the backend. Its old status text still mentions 192.168.50.2; actual transport is SSH over the existing Wi-Fi link. AGY should update that informational text separately; it is not the address used by the new adapter.

## Runtime

Agent was restarted with config/aether-agent.private.json. The gateway was restarted to load the explicit relay ID. AI backend was restarted to load the Pi adapter; the old backend closed its listener but its active stream worker blocked graceful shutdown, so the exact old read-only development process was terminated after SIGTERM/SIGINT failed to drain it. New backend uses a five-second graceful-shutdown timeout. Website/Next stayed running. Existing model weights were not changed.

All services, SSH tunnel and camera acquisition are LEFT RUNNING. Active camera source was set to pi through AETHER's existing /api/camera/source API. Refresh the website and open Raspberry Pi Camera. Camera images remain local; no frames or tokens are included in the commit.

For a future Pi agent launch, use the existing venv/private token and the new config:

```sh
cd ~/nexus-sky
. config/aether.private.env
.venv/bin/python -m aether_device.agent --config config/aether-agent.private.json
```

The desktop launcher sources the existing private env, so the updated gateway automatically picks up NEXUS_CAMERA_IDS on future launches. It still does not start the Pi agent or SSH tunnel. The new gateway/backend are manually detached processes; the already-running launcher's old PID variables do not own them. Inspect processes/listeners before stopping or starting another copy. Reboot and SSH loss still require manual reconnection; no boot service was installed.

## Evidence and remaining checks

- docs/hardware-evidence/usb-camera-live-2026-10-28.json: real decoded frame counts, source status and AETHER feed.
- docs/hardware-evidence/pi-usb-tests-2026-10-28.txt: 20/20 Pi tests.
- docs/hardware-evidence/gateway-usb-tests-2026-10-28.txt: gateway regression suite.
- Backend disconnected and >3-second stale frame suppression checked directly.

Physical unplug/replug recovery, long-duration frame rate/CPU thermal stability, annotated AI results and ESP32 runtime remain unverified. No flight/control interface, wiring, flashing, UI redesign, cloud compute or model training occurred.
