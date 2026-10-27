## Aether Link read-only device service

New Pi agent: `aether_device/`. Run with the existing venv and private device token:

```sh
cd ~/nexus-sky
. config/aether.private.env
.venv/bin/python -m aether_device.agent --config config/aether-agent.example.json
```

The safe example config has no cameras. The service defaults to loopback port 8765 with Bearer auth. GET /health, /devices, /telemetry and /camera/status expose real host metrics and explicit camera availability; /camera/snapshot?id=ID and /camera/stream?id=ID require an explicitly configured camera. Metrics identify CPU temperature separately from ambient temperature. No flight/actuator interfaces exist. No system or boot service was installed. Ctrl-C/SIGTERM stops the agent and acquisition children. Logs rotate in logs/aether-device.log.

Tests: `.venv/bin/python -m unittest discover -s tests -v`. The 30-second `tests/soak_aether_stream.py` uses mock JPEG-envelope frames, never a physical-camera claim. Full setup, contract, gateway commands and both-machine evidence are documented on the PC in /home/blu/Projects/nexus-sky/docs/NEXUS-HARDWARE-INTEGRATION.md and NEXUS-HARDWARE-TEST-REPORT.md. The previous client documentation below is preserved.

# NEXUS SKY Pi client

Run from `/home/nexus/nexus-sky` using the existing Python environment. No extra packages required for the new client. The original diagnostics and requests-based snapshot client are preserved.

```sh
cd ~/nexus-sky
.venv/bin/python cameras/esp32cam/nexus_eye.py --host CAMERA_IP health
.venv/bin/python cameras/esp32cam/nexus_eye.py --host CAMERA_IP snapshot
.venv/bin/python cameras/esp32cam/nexus_eye.py --host CAMERA_IP stream --frames 100 --retries 3
.venv/bin/python -m unittest discover -s tests -v
python3 diagnostics/check.py
```

Replace CAMERA_IP with the ESP32-CAM address. Alternatively export NEXUS_EYE_HOST in your shell; see config/camera.env.example. Status/capture command aliases are supported. Defaults save captures/snapshot.jpg or captures/latest.jpg inside this project, even from another working directory. Explicit --output overrides them. Output directories are created. Snapshots and stream frames replace files atomically; a failed capture keeps the previous file, which may be stale. Check its modification time.

Health/status reads /status JSON on port 80 and exits 1 when camera or Wi-Fi is unready. Snapshot/capture reads /capture JPEG on port 80. Stream reads /stream MJPEG on port 81, saves the latest frame and finishes after a finite number of frames; reconnect retries have a finite budget. Ctrl-C stops it. JPEG envelope validation does not decode image contents. Socket timeout defaults to five seconds; it is not a total operation deadline. One firmware stream occupies the camera; snapshots may return 503 during streaming. Use only a trusted LAN.

The older cameras/esp32cam/client.py remains untouched and takes --url. Use the new nexus_eye.py for the v0.1 interface. No service or boot task is installed. No AI or flight control runs here. Physical camera validation requires the firmware and hardware checks first; no camera address has been supplied yet.
