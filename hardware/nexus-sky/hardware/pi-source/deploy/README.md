# NEXUS Pi boot service

Installed and enabled as nexus-device.service on 28 October 2026. Verified by a real reboot: the agent and USB capture worker started without a manual application launch. The agent provides telemetry/discovery/HTTP endpoints and owns the ffmpeg camera worker; do not separately launch the old snapshot clients or tests at boot.

The service runs as nexus, loads private credentials through tools/run-device-agent.sh and prefers config/aether-agent.private.json. Missing private camera config falls back to the safe empty example. It waits for network-online.target, restarts on process failure with five-second backoff and stops all camera children together. A missing/unplugged camera is retried by the agent while telemetry remains available. No login is needed for startup.

```sh
systemctl status nexus-device.service
journalctl -u nexus-device.service -b --no-pager
sudo systemctl restart nexus-device.service
sudo systemctl stop nexus-device.service
sudo systemctl disable --now nexus-device.service
```

Use systemctl show nexus-device.service -p MainPID for the current process. The old logs/aether-agent.pid belonged to the former detached manual process and has been removed; do not use a saved numeric PID to manage this service.

Canonical unit: /etc/systemd/system/nexus-device.service (root-owned, mode 0644). Review copy: deploy/nexus-device.service. If deliberately updating the unit, inspect differences first, then install it, run sudo systemctl daemon-reload and restart. Do not duplicate an existing manual agent or ffmpeg capture process.

Laptop website, AI backend, gateway and SSH tunnel remain separate. Booting the Pi does not start the PC stack, and a Pi reboot breaks an existing SSH tunnel. The laptop must reconnect it; no laptop boot/login automation was installed. The Pi service binds loopback and does not expose camera/control APIs publicly. Diagnostics, tests, fixture soak scripts and legacy snapshot commands stay manual.
