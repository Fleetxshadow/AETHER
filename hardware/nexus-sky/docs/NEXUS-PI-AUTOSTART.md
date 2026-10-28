# Raspberry Pi autostart — 28 October 2026

Enabled and physically reboot-verified: nexus-device.service starts the NEXUS agent, host telemetry, camera discovery, authenticated HTTP endpoints and USB camera acquisition during system boot, without a user login or a manual app command. One managed agent owns its ffmpeg child; legacy snapshot clients, tests, soak fixtures and one-off diagnostics are not boot services because they would duplicate capture or run test traffic.

## Installed files

Pi authoritative project /home/nexus/nexus-sky:
- tools/run-device-agent.sh — executable boot entrypoint; sources existing private token file; uses the existing venv and verified private camera config.
- deploy/nexus-device.service — review copy of the unit.
- deploy/README.md — operation and maintenance instructions.
- /etc/systemd/system/nexus-device.service — root-owned installed unit, mode 0644, enabled for multi-user.target.

Service runs as user/group nexus, with existing video-group access; loopback HTTP remains unchanged. Starts after network-online.target, restarts on failure after five seconds, and uses KillMode=control-group so camera children stop with the agent. It uses the existing USB source at 320x240, 5 fps output. Credential files stay private, ignored and unmodified; no password or token is in the service/unit/snapshot. The obsolete detached-process PID file was removed; use systemd MainPID instead.

## Real boot verification

Boot ID changed from 0f5dd3b7-d925-40e7-a52b-7937a8968e8e to 7a2edc84-8cfe-44e8-b7bc-300d5c19d84b. On the new boot, systemd reported enabled/active/running, MainPID 723, NRestarts 0. Service started about 35.7 seconds into Linux boot, before the read-only validation session. USB acquisition then reported LIVE, 209 frames and approximately 4.98 fps, with no acquisition errors at the sample time. These are captured historical values, not fixed current readings.

Evidence: docs/hardware-evidence/pi-boot-2026-10-28.json. Unit syntax was checked with systemd-analyze verify, wrapper syntax with bash -n, and post-reboot authenticated /health and /camera/status succeeded. The laptop SSH tunnel was reconnected afterward, and its existing gateway also saw camera LIVE. No new visual website check was performed; the website itself was not running during this check.

## Controls on the Pi

```sh
systemctl status nexus-device.service
journalctl -u nexus-device.service -b --no-pager
sudo systemctl restart nexus-device.service
sudo systemctl stop nexus-device.service
sudo systemctl disable --now nexus-device.service
```

Avoid manually launching a second agent or ffmpeg capture process while this service is active. If deliberately changing the source unit, inspect the installed version first, install the reviewed unit, run sudo systemctl daemon-reload and restart. Existing credentials and device configuration must be preserved.

## Laptop boundary

Pi boot automation does not start the laptop's AETHER/AI/gateway stack or reconnect an SSH connection that was broken by a Pi power cycle. The laptop still needs the stack and loopback SSH tunnel. This task reconnected the tunnel and left the Pi service and gateway running. No laptop boot/login service was installed, no router/firewall settings changed, and no hardware was wired/flashed.

Review/recovery copies of all three Pi files are in hardware/pi-source; develop Pi changes on the Pi first. Earlier documents describing a manually detached agent reflect the prior setup; use this service from now on.
