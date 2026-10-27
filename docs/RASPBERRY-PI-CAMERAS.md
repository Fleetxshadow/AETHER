# Raspberry Pi 3B cameras → AETHER SKY

This is a setup guide, not a hardware-verification claim. No drone actuation, flight control or motors are involved. Firebase carries device metadata; VDO.Ninja or MediaMTX carries video. Begin at 640×360 or 640×480, 10–15 fps and roughly 400–800 kbit/s. Measure CPU, temperature, dropped frames and latency before increasing resolution. Pi 3B software encoding and browser capture can be expensive.

## Capture checks

Use a supported Raspberry Pi OS release and a stable power supply. Confirm camera permissions and supported capture formats before running a service.

USB webcam:

```bash
sudo apt update
sudo apt install ffmpeg v4l-utils
v4l2-ctl --list-devices
v4l2-ctl -d /dev/video0 --list-formats-ext
```

Choose a format the actual webcam advertises. A webcam supplying H.264 can often be remuxed with `-c:v copy`, avoiding software encoding. Do not assume MJPEG or H.264 support.

CSI Camera Module: power down before connecting the ribbon, verify the correct cable/orientation and OS/camera compatibility, then use the OS camera test command (`rpicam-hello --list-cameras` on current Raspberry Pi OS; older releases may call it `libcamera-hello`). Do not mix legacy camera-stack tutorials with modern libcamera/rpicam packages. Verify Pi 3B support in the MediaMTX release's ARM build and camera dependencies.

## Option A: VDO.Ninja demonstration

Use an HTTPS browser on the capture device, select the USB/CSI camera exposed by the OS, and create a private VDO.Ninja publisher according to its current documentation. Keep publisher links and credentials only on the publisher. Raspberry Pi Chromium may struggle; test modest frame rate/resolution first. CSI may require the OS's supported V4L2/virtual-camera bridge, or use MediaMTX instead. No automatic Pi publisher is installed by this project.

As an authorized operator, register only the corresponding **VIEW** link in SKY: `https://vdo.ninja/?view=READ_ID`. Mark test footage as Development. Open the viewer in AETHER; it embeds the provider and does not redirect. It validates message origin, iframe source and stream ID. Connection status comes from documented VDO.Ninja peer events; cross-origin video dimensions and decoded frames are not independently measured. An iframe load alone never marks it live. Closing the viewer removes the iframe.

## Option B: MediaMTX

Install a compatible MediaMTX binary from its official releases. Keep its configuration private and start with LAN/VPN access. Do not expose unauthenticated RTSP, HLS or WHEP endpoints to the internet. Configure publisher/read authorization separately; anonymous read access must be disabled for remote use. AETHER supports a server-side bearer reader token matched to MediaMTX's HTTP/JWT authentication policy. It does not proxy publisher credentials or HTTP Basic URLs.

For a CSI camera, the relevant path configuration is:

```yaml
paths:
  pi-csi:
    source: rpiCamera
    rpiCameraWidth: 640
    rpiCameraHeight: 480
    rpiCameraFPS: 15
    rpiCameraCodec: auto
```

Confirm that the resulting codec is browser-compatible H.264. Hardware encoding availability depends on the Pi/OS/build. Keep authentication from your private full configuration; this fragment does not configure authorization.

For a USB camera, publish an explicitly chosen V4L2 mode to a loopback RTSP path. A software-encoding starting point, **only inside a private, authorized local setup**, is:

```bash
ffmpeg -f v4l2 -framerate 15 -video_size 640x480 -i /dev/video0 \
  -an -c:v libx264 -pix_fmt yuv420p -preset ultrafast -tune zerolatency \
  -b:v 600k -g 30 -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/pi-usb
```

Use MediaMTX's publisher authentication policy in the actual service; the fragment assumes trusted loopback publishing and is not a public server configuration. Avoid putting real credentials in shell history. If Pi CPU is high, lower fps/resolution or use the camera's compatible H.264 output. A MediaMTX `runOnInit` command plus `runOnInitRestart: yes`, or a systemd service with `Restart=on-failure` and a short `RestartSec`, can restart the publisher after disconnect. Avoid tight restart loops; test unplug/replug, permission failure and server outage.

Reader endpoint patterns (replace host, path and TLS configuration):

- WebRTC WHEP: `https://video.example.com/pi-usb/whep` (MediaMTX signaling defaults to port 8889 before a TLS proxy).
- HLS: `https://hls.example.com/pi-usb/index.m3u8` (default port 8888). Prefer `hlsVariant: fmp4` for this proxy; low-latency query controls are not forwarded.

Allow both exact origins in `NEXUS_CAMERA_ALLOWED_ORIGINS`, configure `NEXUS_MEDIAMTX_BEARER_TOKEN` only on the AETHER server, and register WHEP with optional HLS fallback through SKY. AETHER proxies read signaling/HLS to protect credentials. Its WebRTC viewer requires decoded frames before LIVE; otherwise it times out, tries configured HLS once, and retains a labeled demonstration view. Resolution is shown only from decoded video. FPS is displayed only as explicitly device-reported metadata; it is not estimated.

For isolated localhost development only, `NEXUS_CAMERA_ALLOW_LOCAL_HTTP=true` permits allowlisted private/loopback HTTP origins in a development build. Production continues requiring HTTPS. A local Pi URL is useful only if the AETHER server and viewer's media transport can reach it; it is not magically reachable from a public host.

## Network and HTTPS

TLS-secure signaling is necessary for public/remote viewing. Never place an HTTP iframe on an HTTPS page. AETHER proxies WHEP signaling but does not relay WebRTC media: ICE candidates must still be reachable by the viewer. Configure MediaMTX additional host addresses and the required UDP media port (commonly 8189), with network-specific ICE/TURN when direct connectivity fails. The current browser adapter gathers an initial ICE offer; trickle-ICE PATCH and automatic TURN discovery are not implemented. Use HLS or a VPN where the configured ICE path cannot connect. A reverse proxy alone does not solve NAT.

Use a VPN/private network or explicitly authorized TLS gateway, firewall exact ports, restrict allowed origins and require provider authentication. Keep RTSP publishing private. Do not open unsecured camera ports on a home router. Test from the actual viewer network. HLS introduces more latency and bandwidth; it is fallback playback, not a low-latency guarantee.

## Health reporting and recovery

An authenticated device writes its own `devices/{deviceId}` status and each measurement under `telemetry/{deviceId}/latest/{channel}` in the scoped RTDB schema. Separately report `cameraStatus/{cameraId}` with device ID, lastSeen, stream type and actual publisher online state. Use UTC sampling time, sync the Pi clock and heartbeat every 10–20 seconds while healthy. Report `online:false` on graceful shutdown; loss of power/network is detected by freshness expiry. Do not report online merely because a URL exists.

Camera health metadata is never viewer playback evidence. Unplugging the camera should stop/recover the publisher, update device health where possible and cause AETHER to show interrupted/offline playback with demonstration fallback. Reconnect through Retry camera. Close camera, navigation and sign-out clean up the viewer; orphaned WHEP leases expire server-side.

Keep continuous frames out of RTDB. Approved captured evidence would require a separate authenticated storage/retention workflow, which is not implemented. No cloud/hardware operation is required for the complete local demonstration.

References: [MediaMTX Pi cameras](https://mediamtx.org/docs/publish/raspberry-pi-cameras), [webcams](https://mediamtx.org/docs/publish/generic-webcams), [WebRTC](https://mediamtx.org/docs/read/webrtc), [VDO.Ninja](https://docs.vdo.ninja/).
