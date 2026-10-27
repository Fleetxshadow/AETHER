## Aether Link hardware integration — 27 October 2026

Current device agent and gateway setup: [hardware integration guide](docs/NEXUS-HARDWARE-INTEGRATION.md). Read [hardware inventory](docs/NEXUS-HARDWARE-INVENTORY.md), [test report](docs/NEXUS-HARDWARE-TEST-REPORT.md) and [AGY handoff](docs/NEXUS-AGY-HANDOFF.md). Real Pi host metrics and firmware compilation are verified; physical cameras and website adoption remain pending. Pi code lives in `~/nexus-sky/aether_device` on the Pi; `hardware/pi-source` is its review snapshot. The older notes below describe earlier project stages.

> **CORE and MAVERICK local prototypes:** trained synthetic mission classifier and simulation-only navigation policy are in [nexus-ai](nexus-ai/README.md). See [three-model readiness](nexus-ai/READINESS.md). These do not change the camera/Pi/physical-control path below.

> Current Pi code is developed in `nexus@nexus.local:~/nexus-sky/cameras/esp32cam/nexus_eye.py`. The desktop `pi/` folder below is a historical baseline. See [current work record](docs/pi-work.md) for deployment and verification; avoid overwriting the newer remote client with this baseline.

# NEXUS SKY / NEXUS EYE v0.1

NEXUS EYE is camera firmware for an **AI-Thinker ESP32-CAM**; NEXUS SKY is the lightweight Raspberry Pi client. The Pi fetches JPEGs without decoding them. A Mac mini M4 may handle AI later. No flight control, website, AI inference, SD recording, OTA, or remote command execution is included.

## Hardware status and stop point

Live read-only SSH inspection on 12 October 2026 confirmed `nexus@nexus.local`: Debian 13.7 (trixie), aarch64, 905 MiB RAM, Python 3.13.5 in `~/nexus-sky/.venv`. The existing directory contained only its venv. USB enumeration showed the Pi hub/Ethernet devices, no serial programmer or USB camera. No files or configuration on the Pi were changed during inspection.

The Pi device tree confirms Raspberry Pi 3 Model B Rev 1.2. User reports AI-Thinker ESP32-CAM and a CH340 USB bridge on the Nano. The camera sensor, flash/PSRAM size, exact Nano/CH340 variant and UART electrical levels still require inspection. Firmware assumes Espressif's AI-Thinker camera pin map and a JPEG-capable sensor, normally OV2640; successful compilation cannot verify these. GPIO4 flash LED stays off. No microSD use.

**Do not wire or flash yet.** “Arduino Nano” does not identify the serial bridge or its voltage. The classic ATmega328P Nano is a 5 V board; ESP32 GPIO is not 5 V tolerant. A 3.3 V power pin on a Nano does not prove that its UART signals are 3.3 V. Nano-labelled boards vary.

Before a wiring plan is approved:

1. Identify the exact Nano model/clone and USB bridge part from markings and its schematic.
2. Verify the USB bridge's actual TX level with documentation and a meter/logic analyser; confirm the reverse RX compatibility too.
3. Confirm an appropriate UART level shifter if required, or use a verified 3.3 V-logic USB-UART adapter instead. Identify how the Nano MCU would be held inactive; do not assume the pin labels map like a dedicated adapter.
4. Verify the ESP32-CAM board/sensor, correct supply input, and a stable supply with adequate camera/Wi-Fi current capacity. Do not power it from the Nano's 3.3 V regulator. Do not connect competing power sources or apply 5 V to ESP32 UART/GPIO.
5. Only after those checks, document the exact ground, supply, UART and boot/reset wiring. No wiring recipe is provided at this stage. The desktop upload helper below must only be used after these checks.

Primary references: [Espressif AI-Thinker pin map](https://github.com/espressif/arduino-esp32/blob/3.3.12/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h), [Arduino Nano documentation](https://docs.arduino.cc/hardware/nano), [Nano family voltage differences](https://support.arduino.cc/hc/en-us/articles/11264980365468-Nano-family-overview), [ESP32 datasheet electrical limits](https://documentation.espressif.com/esp32_datasheet_en.html).

## Firmware contract

Use a trusted 2.4 GHz Wi-Fi network with client-to-client traffic allowed. There is no access point fallback and no mDNS responder; get the camera IP from its 115200-baud serial log or router DHCP lease.

| Endpoint | Result |
| --- | --- |
| `http://CAMERA_IP:80/status` | JSON with version, camera state/error, Wi-Fi state/RSSI, uptime, free heap and PSRAM presence |
| `http://CAMERA_IP:80/capture` | JPEG; 503 on unavailable/busy camera |
| `http://CAMERA_IP:81/stream` | Multipart MJPEG, Content-Length on every JPEG |

Compatibility aliases `/health` and `/snapshot` remain available on port 80.

Camera defaults: QVGA (320 × 240) with or without PSRAM, JPEG quality 14, one framebuffer, approximately at most 10 fps. One active stream owns the camera; snapshots return 503 while streaming. Health runs on a separate HTTP server. Network reconnect is attempted every 10 seconds; startup does not wait forever for Wi-Fi. HTTP server startup retries after failures. A camera initialization failure remains visible in health and needs diagnosis/reboot; no automatic camera reset loop.

**Local trusted LAN only:** plain HTTP, no authentication or TLS. Anyone on that network can view the camera. Do not forward ports, expose it publicly, or aim it at private scenes on an untrusted network. The stream monopolizes its server until disconnect/timeout; multi-client streaming is not supported. Reconnect and power stability need physical validation.

## Compile safely on the desktop

Arduino CLI 1.3.1 and Arduino-ESP32 **3.3.12** are the selected build versions. The `esp32cam` board profile configures AI-Thinker flash/PSRAM and partition defaults. Compile on the desktop to avoid stressing the 1 GB Pi. Run `./tools/setup.sh` to install the pinned core, or use the explicit commands below. Installing the toolchain downloads substantial files; compiling needs no connected hardware.

From this `nexus-sky` directory, with Arduino CLI installed:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.12 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
cp firmware/nexus_eye/secrets.example.h firmware/nexus_eye/secrets.h
# Edit secrets.h locally with your Wi-Fi SSID and password.
./tools/build.sh
```

For a credential-free compile check, run `./tools/compile-test.sh`. It copies the sketch into a temporary directory, uses only placeholder credentials, and removes its outputs afterward. It never changes your local `secrets.h` or uploads firmware.

`tools/build.sh` only compiles; it never uploads or selects a serial port. If using the locally downloaded CLI, run `ARDUINO_CLI="$PWD/.tools/arduino-cli" ./tools/build.sh`. Windows Arduino IDE alternative: install ESP32 by Espressif 3.3.12, select “AI Thinker ESP32-CAM”, open the sketch and use **Verify** only.

`secrets.h`, build outputs, local environments and images are ignored. Compiled firmware embeds Wi-Fi credentials, so do not publish binaries or build folders. No SSH password is stored here. Ignore rules apply only after initializing/using Git; inspect staged files before committing. Do not add secrets to tracked examples or use force-add.

## Pi client

No pip packages required. The client uses Python 3.10+ standard library, disables proxy use and redirects, limits JPEGs to 2 MiB and health bodies to 8 KiB, validates JPEG envelope markers, and replaces output files atomically. It does not fully decode/validate image contents. Socket timeout defaults to 5 seconds; a continuously trickling peer can extend total operation time. Stream retries have a finite total budget with capped backoff, not endless retrying.

After hardware checks and flashing are completed in a later step, copy **only** `pi/nexus_eye.py` into the Pi's existing `~/nexus-sky/` directory. Preserve its `.venv`; do not replace the folder or copy credentials/build outputs. Example transfer from this project directory:

```sh
scp pi/nexus_eye.py nexus@nexus.local:~/nexus-sky/nexus_eye.py
ssh nexus@nexus.local
cd ~/nexus-sky
source .venv/bin/activate
python nexus_eye.py --host CAMERA_IP health
python nexus_eye.py --host CAMERA_IP snapshot --output snapshot.jpg
python nexus_eye.py --host CAMERA_IP stream --frames 100 --retries 3 --output latest.jpg
```

Replace `CAMERA_IP` with the actual camera address; the Pi and camera need network reachability on ports 80 and 81. `health` requests `/status`; `snapshot` requests `/capture`. `health` exits 1 if camera/Wi-Fi readiness is false. `snapshot` saves one JPEG. `stream` overwrites the latest JPEG, exits after the requested total frame count and can be stopped with Ctrl-C. Failures retain the last successful output, which may be stale; check its modification time. The output parent directory must already exist. IPv6 literals, if used, need brackets; ESP32 normally receives IPv4 via DHCP.

Local tests:

```sh
python3 -m unittest discover -s tests -v
python3 pi/nexus_eye.py --help
```

See [VALIDATION.md](VALIDATION.md) for actual outcomes. Next physical checks: identify hardware and voltage levels; verify power and boot mode; flash only with an approved wiring plan; check camera init/PSRAM, health and real JPEG decoding; measure Pi frame rate/memory; disconnect/reconnect Wi-Fi and stream client; confirm snapshot-busy behavior and simultaneous health access. No physical success is claimed yet.

## Upload from the Omarchy desktop

Arduino CLI 1.3.1 is installed for this user at `~/.local/bin/arduino-cli`, already on the command path. No Arduino IDE or Pi-based flashing is required. The pinned ESP32 core and firmware compile status are recorded in VALIDATION.md.

```sh
arduino-cli version
arduino-cli core list
arduino-cli board list
```

A CH340 adapter can appear as an unknown board; select the ESP32-CAM firmware target explicitly. Do not select an Arduino Nano target for this camera sketch. Plug in the Nano alone for device identification; keep ESP32-CAM wiring disconnected until its voltage and power checks are complete.

After those checks, prepare the ignored `firmware/nexus_eye/secrets.h` locally, verify the bootloader wiring/reset procedure for the actual adapter, and use the actual device path:

```sh
# Run from this nexus-sky directory only AFTER hardware checks.
./tools/upload.sh --hardware-checked /dev/serial/by-id/ACTUAL_DEVICE
```

The helper checks the serial port and local credentials file, compiles fresh firmware, and uploads at 115200 baud. The example path is a placeholder; never guess a connected device. The `--hardware-checked` flag is your acknowledgement that the electrical and boot checks were actually done. This command changes the ESP32's firmware. It has not been run against any hardware during setup.

If the port is inaccessible, inspect `ls -l /dev/ttyUSB*` and your group membership before changing permissions. Do not run the whole build as root or make serial ports world-writable. Close other serial monitors before upload. After upload, follow the verified normal boot procedure, then inspect serial output:

```sh
arduino-cli monitor --port /dev/serial/by-id/ACTUAL_DEVICE --config baudrate=115200
```

A Nano USB bridge may require manual boot/reset control; CLI cannot supply missing adapter circuitry. If uploads fail, re-check power, levels, UART routing and boot mode before trying again. Keep compiled credential-bearing firmware private.
