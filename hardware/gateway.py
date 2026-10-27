#!/usr/bin/env python3
"""Local server-side gateway. Authenticated Pi poller and honest AETHER projections."""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import signal
import sys
import threading
import time
from urllib.error import URLError
from urllib.request import Request

sys.path.insert(0, str(Path(__file__).resolve().parent / 'pi-source'))
from aether_device.api import Server, bind_address
from aether_device.cameras import OPENER, Camera, MAX_JPEG, local_url, utc

ID = re.compile(r'[A-Za-z0-9_-]{1,80}')

def age(value):
    if not isinstance(value, str):
        raise ValueError('missing observation timestamp')
    return time.time() - datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()

def validate(path, body):
    if not isinstance(body, dict) or body.get('schema_version') != '1.0.0':
        raise ValueError('unsupported device schema')
    if not isinstance(body.get('device_id'), str) or not ID.fullmatch(body['device_id']):
        raise ValueError('invalid device ID')
    if not -5 <= age(body.get('timestamp')) <= 60 or body.get('source') not in ('LIVE', 'STALE', 'OFFLINE'):
        raise ValueError('device response is stale or has invalid provenance')
    if path == '/devices':
        rows = body.get('devices')
        if not isinstance(rows, list) or len(rows) > 16:
            raise ValueError('invalid device list')
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not ID.fullmatch(row['id']):
                raise ValueError('invalid device record')
            if type(row.get('online')) is not bool or row.get('source') not in ('LIVE', 'STALE', 'OFFLINE'):
                raise ValueError('invalid device state')
            if row.get('last_seen') is not None and not -5 <= age(row['last_seen']):
                raise ValueError('future device time')
        if len({row['id'] for row in rows}) != len(rows):
            raise ValueError('duplicate device IDs')
    if path in ('/health', '/telemetry'):
        rows = body.get('metrics', {}).values() if path == '/health' else body.get('measurements')
        if rows is None:
            raise ValueError('missing measurements')
        units = {'cpu_percent': ('%', 0, 100), 'ram_percent': ('%', 0, 100),
                 'cpu_temperature': ('°C', -100, 200), 'storage_available': ('bytes', 0, 10**18)}
        if path == '/health':
            rows = [dict(row, channel=key) for key, row in body.get('metrics', {}).items()]
        for row in rows:
            if not isinstance(row, dict) or row.get('channel') not in units:
                raise ValueError('unsupported measurement')
            unit, low, high = units[row['channel']]
            if row.get('unit') != unit or row.get('source') not in ('LIVE', 'OFFLINE'):
                raise ValueError('invalid unit/source')
            if row['source'] == 'LIVE':
                v = row.get('value')
                if type(v) not in (float, int) or not math.isfinite(v) or not low <= v <= high:
                    raise ValueError('invalid measured value')
                if not -5 <= age(row.get('observed_at')) <= 60:
                    raise ValueError('stale measurement labelled live')
            elif row.get('value') is not None:
                raise ValueError('offline value must be null')
    if path == '/camera/status':
        if not isinstance(body.get('cameras'), list) or len(body['cameras']) > 8:
            raise ValueError('invalid camera list')
        for row in body['cameras']:
            if (not isinstance(row, dict) or not isinstance(row.get('id'), str) or not ID.fullmatch(row['id'])
                    or type(row.get('online')) is not bool or row.get('source') not in ('LIVE', 'STALE', 'OFFLINE')):
                raise ValueError('invalid camera state')
            if row['online'] and (row['source'] != 'LIVE' or not -5 <= age(row.get('last_seen')) <= 15):
                raise ValueError('camera online without recent live frame')
    return body

class Mirror(Camera):
    """One shared JPEG poller per explicit camera ID; retains upstream frame timestamps."""
    def __init__(self, gateway, camera_id):
        super().__init__({'id': camera_id, 'kind': 'csi', 'fps': 2})
        self.gateway = gateway
    def run(self):
        while not self.halt.is_set():
            try:
                with self.gateway.open('/camera/snapshot?id=' + self.id) as response:
                    if response.headers.get_content_type() != 'image/jpeg':
                        raise ValueError('invalid JPEG response')
                    stamp = response.headers.get('X-Frame-Observed-At')
                    seconds = age(stamp)
                    if not -1 <= seconds <= 3:
                        raise ValueError('upstream frame stale')
                    data = response.read(MAX_JPEG + 1)
                epoch = datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp()
                with self.lock:
                    previous = self.frame_time
                if previous is None or abs(epoch - previous) > 0.001:
                    self.accept(data)
                    with self.lock:
                        self.frame_time = epoch
                        self.frame_mono = time.monotonic() - max(0, seconds)
            except (OSError, ValueError, __import__('http.client').client.HTTPException) as exc:
                if hasattr(exc, 'close'):
                    exc.close()
                self.failed('Upstream camera unavailable or invalid')
            self.halt.wait(0.5)

class Gateway:
    def __init__(self, base_url, upstream_token, camera_ids=()):
        self.base = local_url(base_url).rstrip('/')
        if len(upstream_token) < 32:
            raise ValueError('upstream token must contain at least 32 characters')
        self.token = upstream_token
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.cache = {}
        self.updated = None
        self.failed = True
        self.thread = None
        self.cameras = {key: Mirror(self, key) for key in camera_ids}
    def open(self, path):
        return OPENER.open(Request(self.base + path, headers={'Authorization': 'Bearer ' + self.token}), timeout=3)
    def poll(self):
        try:
            new = {}
            for path in ('/health', '/devices', '/telemetry', '/camera/status'):
                with self.open(path) as response:
                    if response.headers.get_content_type() != 'application/json':
                        raise ValueError('upstream is not JSON')
                    raw = response.read(131073)
                    if len(raw) > 131072:
                        raise ValueError('response too large')
                    new[path] = validate(path, json.loads(raw))
            if len({v['device_id'] for v in new.values()}) != 1:
                raise ValueError('inconsistent device identity')
            with self.lock:
                self.cache, self.updated, self.failed = new, time.monotonic(), False
        except (OSError, ValueError, TypeError, AttributeError, __import__('http.client').client.HTTPException) as exc:
            if hasattr(exc, 'close'):
                exc.close()
            with self.lock:
                self.failed = True
    def start(self):
        def run():
            while not self.stop_event.is_set():
                self.poll()
                self.stop_event.wait(2)
        self.thread = threading.Thread(target=run, name='pi-poller', daemon=True)
        self.thread.start()
        for camera in self.cameras.values():
            camera.start()
    def stop(self):
        self.stop_event.set()
        for camera in self.cameras.values():
            camera.stop()
        if self.thread:
            self.thread.join(14)
    def camera(self, key):
        return self.cameras[key]
    def document(self, path):
        with self.lock:
            cache, updated, failed = self.cache.copy(), self.updated, self.failed
        since = time.monotonic() - updated if updated is not None else None
        state = 'OFFLINE' if since is None or since > 60 else ('STALE' if failed or since > 5 else 'LIVE')
        envelope = {'schema_version': '1.0.0', 'device_id': 'nexus-local-gateway', 'device_type': 'gateway',
                    'timestamp': utc(), 'source': state, 'upstream_connected': state == 'LIVE',
                    'upstream_age_seconds': round(since, 3) if since is not None else None}
        if path.startswith('/api/nexus/'):
            # Strict browser schemas cannot represent MJPEG or component-level host metrics.
            # Keep those in hardware endpoints; no ambient/battery/camera-bridge fabrication.
            devices = []
            if state == 'LIVE':
                for row in cache.get('/devices', {}).get('devices', []):
                    stamp = row.get('last_seen')
                    if stamp is not None and 0 <= age(stamp) <= 60:
                        devices.append({'id': row['id'], 'name': row.get('name', row['id'])[:100], 'module': 'sky',
                                        'status': 'online' if row['online'] and row['source'] == 'LIVE' else 'offline',
                                        'lastSeen': stamp, 'source': 'LIVE'})
            feeds = dict(envelope, devices=devices, telemetry=[], cameraStatus=[], aiDetections=[], observations=[], incidents=[])
            suffix = path.removeprefix('/api/nexus/')
            if suffix == 'feeds':
                return feeds
            if suffix in ('devices', 'telemetry', 'cameraStatus'):
                return dict(envelope, **{suffix: feeds[suffix]})
            raise KeyError(path)
        if path == '/health':
            return dict(envelope, status='ok' if state == 'LIVE' else 'degraded',
                        upstream_health=cache.get('/health') if state == 'LIVE' else None,
                        error=None if state == 'LIVE' else 'Pi unavailable, stale or invalid')
        if path not in ('/devices', '/telemetry', '/camera/status'):
            raise KeyError(path)
        if state == 'LIVE':
            return dict(cache[path], gateway=envelope)
        key = {'/devices': 'devices', '/telemetry': 'measurements', '/camera/status': 'cameras'}[path]
        # Do not relabel stale per-row values or refresh their observation times.
        return dict(envelope, **{key: []}, error='Pi source unavailable or stale')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upstream', default='http://127.0.0.1:18765')
    parser.add_argument('--bind', type=bind_address, default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--camera-id', action='append', default=[])
    args = parser.parse_args()
    token, upstream = os.environ.get('NEXUS_GATEWAY_TOKEN', ''), os.environ.get('NEXUS_DEVICE_TOKEN', '')
    if len(token) < 32 or any(not ID.fullmatch(key) for key in args.camera_id):
        parser.error('provide token >=32 chars and valid camera IDs')
    gateway = Gateway(args.upstream, upstream, args.camera_id)
    server = Server((args.bind, args.port), gateway, token)
    def shutdown(*unused):
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    gateway.start()
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        gateway.stop()
        server.server_close()

if __name__ == '__main__':
    main()
