"""Small authenticated GET API. No CORS, mutation routes or arbitrary URL proxy."""
import hmac
import ipaddress
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
import threading
import time
from urllib.parse import parse_qs, urlsplit
from .cameras import utc

def bind_address(value):
    ip = ipaddress.ip_address(value)
    if not (ip.is_loopback or (ip.is_private and not ip.is_unspecified and not ip.is_multicast)):
        raise ValueError('bind must be a specific private or loopback address')
    return value

class Server(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False
    request_queue_size = 8
    def __init__(self, address, service, token):
        self.service, self.token = service, token
        self.slots = threading.BoundedSemaphore(12)
        super().__init__(address, Handler)
    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise
    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()

class Handler(BaseHTTPRequestHandler):
    server_version = 'NexusDevice/1'
    def setup(self):
        super().setup()
        self.connection.settimeout(4)
    def log_message(self, *args):
        pass # No token, query or client addresses in request logs.
    def output(self, code, body):
        data = json.dumps(body, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)
    def error(self, status, code, message):
        self.output(status, {'error': message, 'code': code, 'details': {}, 'timestamp': utc(), 'source': 'OFFLINE'})
    def do_POST(self):
        self.error(405, 'READ_ONLY', 'This service supports GET only')
    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_POST
    def do_GET(self):
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + self.server.token).encode('utf-8')):
            self.error(401, 'UNAUTHORIZED', 'A server-side bearer token is required')
            return
        parts = urlsplit(self.path)
        if parts.path in ('/camera/snapshot', '/camera/stream'):
            qs = parse_qs(parts.query)
            ids = qs.get('id', [])
            if len(ids) != 1 or set(qs) != {'id'} or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', ids[0]):
                self.error(400, 'INVALID_CAMERA_ID', 'Supply exactly one configured camera id')
                return
            try:
                camera = self.server.service.camera(ids[0])
            except KeyError:
                self.error(404, 'UNKNOWN_CAMERA', 'Camera is not configured')
                return
            self.media(camera, parts.path.endswith('/stream'))
            return
        try:
            body = self.server.service.document(parts.path)
            self.output(200, body)
        except KeyError:
            self.error(404, 'NOT_FOUND', 'Unknown endpoint')
        except (OSError, ValueError, TimeoutError):
            self.error(503, 'UPSTREAM_UNAVAILABLE', 'Device source unavailable or invalid')
    def media(self, camera, stream):
        frame, seq, observed = camera.current()
        if frame is None:
            self.error(503, 'NO_FRESH_FRAME', 'No connected camera with a fresh frame')
            return
        if not camera.viewers.acquire(blocking=False):
            self.error(429, 'VIEWER_LIMIT', 'Maximum two viewers per camera')
            return
        try:
            self.send_response(200)
            self.send_header('Cache-Control', 'no-store')
            if not stream:
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Content-Length', str(len(frame)))
                self.send_header('X-Frame-Observed-At', utc(observed))
                self.end_headers()
                self.wfile.write(frame)
                return
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=nexus-frame')
            self.end_headers()
            last = -1
            while not self.server.service.stop_event.is_set():
                frame, seq, observed = camera.current()
                if frame is None:
                    break # Close rather than replay an old frame as live.
                if seq != last:
                    header = f'--nexus-frame\r\nContent-Type: image/jpeg\r\nContent-Length: {len(frame)}\r\nX-Frame-Observed-At: {utc(observed)}\r\n\r\n'.encode()
                    self.wfile.write(header + frame + b'\r\n')
                    self.wfile.flush()
                    last = seq
                self.server.service.stop_event.wait(0.05)
            self.wfile.write(b'--nexus-frame--\r\n')
        except (OSError, ValueError):
            pass
        finally:
            camera.viewers.release()
