# Hardware inventory before implementation — 2026-10-27

Read-only audit completed before device-code modification.

| Item | Observed | Boundary |
|---|---|---|
| Pi | SSH nexus@nexus.local; Raspberry Pi 3 Model B Rev 1.2; Debian 13.7 ARM64; Python 3.13.5 | Real host inspection |
| Pi Wi-Fi | wlan0 192.168.3.224/22; default via 192.168.0.1 | Live route; no network changes |
| Pi Ethernet | eth0 DOWN, no address | Intended 192.168.50.2 absent |
| Laptop | Wi-Fi 192.168.3.69/22; Ethernet enp1s0 DOWN | Intended 192.168.50.1 and hotspot 192.168.60.1 absent |
| CSI camera | rpicam-hello --list-cameras: No cameras available | No camera inferred from files |
| V4L2 | bcm2835 codec and ISP nodes only, video10–31 | These are not capture cameras |
| USB | Pi hub and Ethernet adapter only; no external serial by-id devices | No Nano/ESP32/controller identified |
| Pi temperature | thermal_zone0 reports 46160 millidegrees Celsius (46.16 °C), point-in-time | Actual CPU temperature, not ambient/city temperature |
| ESP32-CAM | AI-Thinker firmware source exists; no configured camera host or verified endpoint | Prior captured JPEG files do not establish current connection |
| Sensors/controller | No verified external modules or interfaces | No fabricated sensors/readings, no serial probing or actuation |
| Pi tools | ffmpeg, rpicam-hello, rpicam-vid, v4l2-ctl present; existing .venv preserved | No installs required |
| Pi listeners | SSH only; no project persistent service | Preserve configuration |
| Firmware tools | Arduino CLI installed, ESP32 core 3.3.12 now installed | Earlier 3.3.2 compile failure is historical |

## Existing code and coordination

Pi authoritative files remain under /home/nexus/nexus-sky; existing camera client, diagnostics, .venv and captures will be preserved. New Pi code is authored there, with a desktop source snapshot only for review/versioning.

Desktop /home/blu/Projects/nexus-sky has an unborn Git master and substantial unrelated untracked AI/model/training work. Use hardware/aether-link and selective commits only; never stage weights, datasets or unrelated code.

AETHER local checkout exists at /home/blu/Projects/AETHER on feature/nexus-ai-integration. Local head b64884b; upstream HEAD audited as adefed9f81b069e3438e023dbe53973d99631fc0. No AETHER files will be edited. Shared contract docs/NEXUS-INTEGRATION-CONTRACT.md is present, version 1.0.0 ACTIVE/ADOPTED. Its hardware ingest POST endpoint is specified but absent from backend/server.py.

Critical integration finding: backend/server.py get_live_devices_data, get_live_telemetry_data, get_live_cameras_data, get_live_observations_data and feeds return fixed battery/altitude/speed/camera/detection values with freshly generated LIVE timestamps. These do not establish physical observations. AGY must remove or relabel these before connecting the existing backend to live website data. The new gateway will not reuse them.

The existing AETHER camera validator accepts only mediamtx/vdo-ninja. MJPEG must stay a documented device transport; do not falsely label it mediamtx. Proposed addendum and backend handoff will cover this gap.
