"""Bounded acquisition: configured HTTP JPEG, CSI MJPEG or V4L2 MJPEG."""
import ipaddress
import os
from pathlib import Path
import select
import shutil
import socket
import subprocess
import threading
import time
from urllib.parse import urlsplit
from urllib.request import build_opener, ProxyHandler, HTTPRedirectHandler

MAX_JPEG = 2 * 1024 * 1024

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

OPENER = build_opener(ProxyHandler({}), NoRedirect())

def local_url(url):
    p = urlsplit(url)
    if p.scheme != 'http' or not p.hostname or p.username or p.password or p.query or p.fragment:
        raise ValueError('camera URL must be plain local HTTP without credentials/query/fragment')
    if any(not (ipaddress.ip_address(a[4][0]).is_private or ipaddress.ip_address(a[4][0]).is_loopback)
           for a in socket.getaddrinfo(p.hostname, p.port or 80, type=socket.SOCK_STREAM)):
        raise ValueError('camera must resolve to a private/local address')
    return url

def jpeg(data):
    if not 4 <= len(data) <= MAX_JPEG or not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):
        raise ValueError('invalid or oversized JPEG envelope')
    return data

def utc(epoch=None):
    from datetime import datetime, timezone
    return datetime.fromtimestamp(time.time() if epoch is None else epoch, timezone.utc).isoformat().replace('+00:00', 'Z')

def discovery():
    # Codec/ISP nodes are deliberately excluded. Listing a node is not a frame test.
    devices = []
    for node in sorted(Path('/sys/class/video4linux').glob('video*')):
        try:
            name = (node / 'name').read_text().strip()
            if any(word in name.lower() for word in ('codec', 'isp', 'decode', 'encode')):
                continue
            device = '/dev/' + node.name
            result = subprocess.run(['v4l2-ctl', '-d', device, '--all'], capture_output=True, text=True, timeout=3)
            caps = result.stdout.split('Device Caps', 1)[-1]
            if result.returncode == 0 and 'Video Capture' in caps:
                devices.append({'kind': 'v4l2', 'path': device, 'name': name, 'verified_capture': False})
        except (OSError, subprocess.SubprocessError):
            continue
    try:
        r = subprocess.run(['rpicam-hello', '--list-cameras'], capture_output=True, text=True, timeout=5)
        import re
        for line in (r.stdout + r.stderr).splitlines():
            m = re.match(r'\s*(\d+)\s*:\s*(.+)', line)
            if m:
                devices.append({'kind': 'csi', 'index': int(m[1]), 'name': m[2], 'verified_capture': False})
    except (OSError, subprocess.SubprocessError):
        pass
    return devices

class Camera:
    def __init__(self, config, event=lambda *a: None):
        import re
        self.id = config['id']
        if not isinstance(self.id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', self.id):
            raise ValueError('invalid camera ID')
        self.kind = config['kind']
        self.fps = config.get('fps', 2)
        if type(self.fps) not in (float, int) or not 0.2 <= self.fps <= 10:
            raise ValueError('camera fps must be 0.2–10')
        self.url = local_url(config['capture_url']) if self.kind == 'esp32' else None
        if self.kind not in ('esp32', 'csi', 'v4l2'):
            raise ValueError('unsupported camera kind')
        self.device = config.get('device', '/dev/video0')
        self.index = config.get('index', 0)
        if not isinstance(self.index, int) or not 0 <= self.index < 16:
            raise ValueError('invalid CSI index')
        if not re.fullmatch(r'/dev/video\d+', self.device):
            raise ValueError('invalid V4L2 device')
        self.event = event
        self.lock = threading.Lock()
        self.halt = threading.Event()
        self.thread = None
        self.process = None
        self.connected = False
        self.frame = None
        self.frame_time = None
        self.frame_mono = None
        self.sequence = self.failures = 0
        self.first_mono = None
        self.last_capture_ms = None
        self.error = 'No frame received'
        self.viewers = threading.BoundedSemaphore(2)

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.halt.clear()
        self.thread = threading.Thread(target=self.run, name='camera-' + self.id, daemon=True)
        self.thread.start()

    def stop(self):
        self.halt.set()
        p = self.process
        if p and p.poll() is None:
            p.terminate()
        if self.thread:
            self.thread.join(6)
        self.failed('Agent stopped')

    def accept(self, frame, duration=0):
        frame = jpeg(frame)
        with self.lock:
            changed = not self.connected
            self.frame, self.frame_time, self.frame_mono = frame, time.time(), time.monotonic()
            self.first_mono = self.first_mono or self.frame_mono
            self.sequence += 1
            self.connected, self.error = True, None
            self.last_capture_ms = round(duration * 1000, 2)
        if changed:
            self.event('camera_connected', self.id)

    def failed(self, reason):
        with self.lock:
            changed = self.connected
            self.connected = False
            self.error = reason
            self.failures += 1
        if changed:
            self.event('camera_disconnected', self.id)

    def status(self):
        with self.lock:
            age = time.monotonic() - self.frame_mono if self.frame_mono is not None else None
            online = self.connected and age is not None and age <= max(3, 3 / self.fps)
            source = 'LIVE' if online else ('STALE' if age is not None and age <= 60 else 'OFFLINE')
            elapsed = time.monotonic() - self.first_mono if self.first_mono is not None else 0
            return {'id': self.id, 'device_type': self.kind, 'online': online, 'source': source,
                    'last_seen': utc(self.frame_time) if self.frame_time is not None else None,
                    'frame_age_seconds': round(age, 3) if age is not None else None,
                    'frames_received': self.sequence, 'error_count': self.failures,
                    'capture_ms': self.last_capture_ms, 'target_fps': self.fps,
                    'received_fps': round((self.sequence - 1) / elapsed, 2) if elapsed > 0 else None,
                    'error': self.error if not online else None, 'transport': 'mjpeg',
                    'calibration': {'kind': 'none', 'note': 'JPEG envelope checked; no image calibration'}}

    def current(self):
        status = self.status()
        with self.lock:
            return (self.frame, self.sequence, self.frame_time) if status['online'] else (None, self.sequence, self.frame_time)

    def native(self):
        if self.kind == 'csi':
            cmd = ['rpicam-vid', '--camera', str(self.index), '--codec', 'mjpeg', '--width', '320',
                   '--height', '240', '--framerate', str(self.fps), '--timeout', '0', '--nopreview', '--output', '-']
        else:
            if not Path(self.device).exists():
                raise OSError('Configured capture device is absent')
            cmd = ['ffmpeg', '-nostdin', '-loglevel', 'error', '-f', 'v4l2', '-framerate', str(self.fps),
                   '-video_size', '320x240', '-i', self.device, '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '10', '-']
        self.process = p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        buf = bytearray()
        last = time.monotonic()
        try:
            while not self.halt.is_set():
                if not select.select([p.stdout], [], [], 1)[0]:
                    if time.monotonic() - last > 10:
                        raise TimeoutError('Native camera produced no frame for 10 seconds')
                    continue
                chunk = os.read(p.stdout.fileno(), 65536)
                if not chunk:
                    raise OSError('Native camera exited without further frames')
                buf.extend(chunk)
                if len(buf) > MAX_JPEG:
                    raise ValueError('Native frame exceeds size limit')
                while True:
                    start = buf.find(b'\xff\xd8')
                    end = buf.find(b'\xff\xd9', start + 2) if start >= 0 else -1
                    if start < 0 or end < 0:
                        break
                    self.accept(bytes(buf[start:end + 2]), time.monotonic() - last)
                    last = time.monotonic()
                    del buf[:end + 2]
        finally:
            if p.poll() is None:
                p.terminate()
            try:
                p.wait(timeout=2)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()
            p.stdout.close()
            self.process = None

    def run(self):
        backoff = 1
        while not self.halt.is_set():
            try:
                if self.kind != 'esp32':
                    self.native()
                else:
                    started = time.monotonic()
                    with OPENER.open(self.url, timeout=3) as r:
                        if r.headers.get_content_type() != 'image/jpeg':
                            raise ValueError('Camera returned non-JPEG content type')
                        self.accept(r.read(MAX_JPEG + 1), time.monotonic() - started)
                    backoff = 1
                    self.halt.wait(max(0, 1 / self.fps - (time.monotonic() - started)))
            except (OSError, ValueError, TimeoutError, __import__('http.client').client.HTTPException) as exc:
                if hasattr(exc, 'close'):
                    exc.close()
                # Never include URLs, credentials or upstream body text in public errors.
                self.failed(type(exc).__name__ + ': camera acquisition failed')
                self.halt.wait(backoff)
                backoff = min(backoff * 2, 8)
