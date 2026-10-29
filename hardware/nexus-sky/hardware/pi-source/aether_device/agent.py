"""Pi telemetry sampler, discovery and read-only hardware service."""
import argparse
from collections import deque
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import threading
import time

from .cameras import Camera, discovery, utc

VERSION = '1.0.0'
ROOT = Path(__file__).resolve().parents[1]

def identity():
    try:
        raw = Path('/etc/machine-id').read_text().strip()
    except OSError:
        import socket
        raw = socket.gethostname()
    return 'pi-' + hashlib.sha256(raw.encode()).hexdigest()[:16]

def number(value, low, high):
    if type(value) not in (float, int) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError('measurement outside supported bounds')
    return round(value, 3)

class Metrics:
    def __init__(self, proc=Path('/proc'), thermal=Path('/sys/class/thermal/thermal_zone0/temp'), storage=ROOT):
        self.proc, self.thermal, self.storage = proc, thermal, storage
        self.previous = None

    def sample(self):
        now = utc()
        def metric(fn, unit, low, high):
            try:
                return {'value': number(fn(), low, high), 'unit': unit, 'observed_at': now,
                        'source': 'LIVE', 'error': None}
            except (OSError, ValueError, KeyError, ZeroDivisionError, IndexError):
                return {'value': None, 'unit': unit, 'observed_at': None, 'source': 'OFFLINE',
                        'error': 'Measurement unavailable or invalid'}
        def cpu():
            # guest counters are already included in user/nice; do not count twice.
            values = [int(v) for v in (self.proc / 'stat').read_text().splitlines()[0].split()[1:9]]
            total, idle = sum(values), values[3] + values[4]
            old, self.previous = self.previous, (total, idle)
            if old is None or total <= old[0]:
                raise ValueError('CPU needs two samples')
            return 100 * (1 - (idle - old[1]) / (total - old[0]))
        def mem():
            rows = dict(line.split(':', 1) for line in (self.proc / 'meminfo').read_text().splitlines())
            total = int(rows['MemTotal'].split()[0])
            available = int(rows['MemAvailable'].split()[0])
            return 100 * (total - available) / total
        return {'cpu_percent': metric(cpu, '%', 0, 100),
                'ram_percent': metric(mem, '%', 0, 100),
                'cpu_temperature': metric(lambda: float(self.thermal.read_text()) / 1000, '°C', -100, 200),
                'storage_available': metric(lambda: shutil.disk_usage(self.storage).free, 'bytes', 0, 10**18)}

class Agent:
    def __init__(self, config=None):
        config = config or {}
        self.id = identity()
        self.started = time.monotonic()
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.events = deque(maxlen=50)
        self.metrics = {}
        self.discovered = []
        self.network = []
        self.sampler = Metrics()
        self.cameras = {}
        if not isinstance(config.get('cameras', []), list) or len(config.get('cameras', [])) > 8:
            raise ValueError('configure at most eight cameras')
        for item in config.get('cameras', []):
            camera = Camera(item, self.event)
            if camera.id in self.cameras or camera.id == self.id:
                raise ValueError('duplicate/reserved camera ID')
            self.cameras[camera.id] = camera
        self.thread = None

    def event(self, kind, device_id):
        entry = {'timestamp': utc(), 'event': kind, 'device_id': device_id}
        with self.lock:
            self.events.append(entry)
        logging.getLogger('nexus.device').info(json.dumps(entry))

    def start(self):
        self.event('agent_started', self.id)
        self.thread = threading.Thread(target=self.run, name='metrics', daemon=True)
        self.thread.start()
        for camera in self.cameras.values():
            camera.start()

    def stop(self):
        self.stop_event.set()
        for camera in self.cameras.values():
            camera.stop()
        if self.thread:
            self.thread.join(8)
        self.event('agent_stopped', self.id)

    def run(self):
        last_discovery = -100
        previous_network = None
        while not self.stop_event.is_set():
            metrics = self.sampler.sample()
            with self.lock:
                self.metrics = metrics
            if time.monotonic() - last_discovery >= 10:
                devices = discovery()
                try:
                    result = subprocess.run(['ip', '-j', 'address'], capture_output=True, text=True, timeout=3)
                    network = [{'interface': r['ifname'], 'state': r['operstate'],
                                'addresses': [a['local'] for a in r.get('addr_info', [])]}
                               for r in json.loads(result.stdout) if r['ifname'] != 'lo']
                except (OSError, ValueError, KeyError, subprocess.SubprocessError):
                    network = []
                if previous_network is not None and network != previous_network:
                    self.event('network_changed', self.id)
                previous_network = network
                with self.lock:
                    self.discovered, self.network = devices, network
                last_discovery = time.monotonic()
            self.stop_event.wait(1)

    def envelope(self):
        return {'schema_version': VERSION, 'device_id': self.id, 'device_type': 'raspberry-pi',
                'timestamp': utc(), 'source': 'LIVE'}

    def document(self, path):
        body = self.envelope()
        with self.lock:
            metrics, network, devices, events = self.metrics.copy(), self.network[:], self.discovered[:], list(self.events)
        cameras = [c.status() for c in self.cameras.values()]
        if path == '/health':
            body.update(status='ok' if metrics else 'starting', uptime_seconds=round(time.monotonic() - self.started, 2),
                        metrics=metrics, network=network, events=events, camera_count=sum(c['online'] for c in cameras))
        elif path == '/devices':
            body['devices'] = [{'id': self.id, 'device_type': 'raspberry-pi', 'name': 'NEXUS Pi edge node',
                                'online': True, 'last_seen': body['timestamp'], 'source': 'LIVE'}] + [
                                {'id': c['id'], 'device_type': c['device_type'], 'name': c['id'],
                                 'online': c['online'], 'last_seen': c['last_seen'], 'source': c['source']} for c in cameras]
            body['discovered_cameras'] = devices
            body['external_sensors'] = []
        elif path == '/telemetry':
            body['measurements'] = [dict(v, device_id=self.id, component='cpu' if k == 'cpu_temperature' else 'system',
                                         channel=k, calibration={'kind': 'kernel-reported', 'offset': None}) for k, v in metrics.items()]
        elif path == '/camera/status':
            body['cameras'], body['discovered'] = cameras, devices
            body['source'] = 'LIVE' if any(c['online'] for c in cameras) else ('STALE' if any(c['source'] == 'STALE' for c in cameras) else 'OFFLINE')
        else:
            raise KeyError(path)
        return body

    def camera(self, camera_id):
        return self.cameras[camera_id]

def main():
    from .api import Server, bind_address
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--bind', default='127.0.0.1', type=bind_address)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    token = os.environ.get('NEXUS_DEVICE_TOKEN', '')
    if len(token) < 32:
        parser.error('NEXUS_DEVICE_TOKEN must contain at least 32 characters')
    config = json.loads(args.config.read_text()) if args.config else {}
    (ROOT / 'logs').mkdir(exist_ok=True)
    logger = logging.getLogger('nexus.device')
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(ROOT / 'logs/aether-device.log', maxBytes=262144, backupCount=2)
    logger.addHandler(handler)
    agent = Agent(config)
    server = Server((args.bind, args.port), agent, token)
    def shutdown(*unused):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    agent.start()
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        agent.stop()
        server.server_close()
        handler.close()

if __name__ == '__main__':
    main()
