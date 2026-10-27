import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from aether_device.agent import Agent, Metrics, number
from aether_device.api import Server, bind_address
from aether_device.cameras import Camera, discovery, jpeg

TOKEN = 'test-device-token-' + 'x' * 32
JPEG = b'\xff\xd8mock-frame\xff\xd9'

def wait_for(fn, timeout=8):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if fn():
            return
        time.sleep(.03)
    raise AssertionError('condition did not become true')

class Tests(unittest.TestCase):
    def test_measurements_and_invalid_values(self):
        with tempfile.TemporaryDirectory() as name:
            p = Path(name)
            (p/'stat').write_text('cpu 10 0 10 80 0 0 0 0 0 0\n')
            (p/'meminfo').write_text('MemTotal: 1000 kB\nMemAvailable: 600 kB\n')
            (p/'temp').write_text('46000')
            m = Metrics(p, p/'temp', p)
            first = m.sample()
            self.assertIsNone(first['cpu_percent']['value'])
            self.assertEqual(first['cpu_temperature']['value'], 46)
            self.assertEqual(first['ram_percent']['value'], 40)
            (p/'stat').write_text('cpu 30 0 10 160 0 0 0 0 0 0\n')
            self.assertEqual(m.sample()['cpu_percent']['value'], 20)
            (p/'temp').write_text('nan')
            self.assertEqual(m.sample()['cpu_temperature']['source'], 'OFFLINE')
        for v in [True, float('nan'), float('inf'), -1, 101]:
            with self.assertRaises(ValueError): number(v, 0, 100)

    def test_missing_camera_and_codec_discovery(self):
        agent = Agent()
        self.assertEqual(agent.document('/camera/status')['source'], 'OFFLINE')
        self.assertEqual(agent.document('/devices')['external_sensors'], [])
        with patch('aether_device.cameras.subprocess.run', side_effect=FileNotFoundError):
            self.assertEqual(discovery(), [])
        for value in ['0.0.0.0', '8.8.8.8', '224.0.0.1']:
            with self.assertRaises(ValueError): bind_address(value)
        self.assertEqual(bind_address('127.0.0.1'), '127.0.0.1')

    def test_stale_and_disconnect(self):
        events = []
        camera = Camera({'id':'test', 'kind':'csi'}, lambda *e: events.append(e))
        camera.accept(JPEG)
        self.assertTrue(camera.status()['online'])
        camera.failed('unplugged')
        self.assertEqual(camera.status()['source'], 'STALE')
        self.assertIsNone(camera.current()[0])
        with camera.lock: camera.frame_mono -= 61
        self.assertEqual(camera.status()['source'], 'OFFLINE')
        camera.accept(JPEG)
        self.assertEqual([e[0] for e in events], ['camera_connected', 'camera_disconnected', 'camera_connected'])

    def test_http_access_and_mutation(self):
        a = Agent()
        server = Server(('127.0.0.1', 0), a, TOKEN)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with self.assertRaises(HTTPError) as e: urlopen(base+'/health')
            self.assertEqual(e.exception.code, 401)
            def get(path):
                return urlopen(Request(base+path, headers={'Authorization':'Bearer '+TOKEN}))
            with get('/health') as r:
                self.assertEqual(json.load(r)['device_type'], 'raspberry-pi')
            for path, expected in [('/camera/snapshot?id=missing',404),('/camera/stream?id=../evil',400),('/unknown',404)]:
                with self.assertRaises(HTTPError) as e: get(path)
                self.assertEqual(e.exception.code, expected)
            with self.assertRaises(HTTPError) as e:
                urlopen(Request(base+'/devices', data=b'{}', method='POST'))
            self.assertEqual(e.exception.code,405)
        finally:
            server.shutdown(); server.server_close(); t.join()

    def test_multiple_cameras_reconnect_and_shutdown(self):
        good = threading.Event(); good.set()
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if not good.is_set(): self.send_error(503); return
                data = JPEG + b''
                self.send_response(200)
                self.send_header('Content-Type','image/jpeg')
                self.send_header('Content-Length',str(len(data)))
                self.end_headers(); self.wfile.write(data)
            def log_message(self,*a): pass
        server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
        t = threading.Thread(target=server.serve_forever,daemon=True); t.start()
        url = f'http://127.0.0.1:{server.server_port}/capture'
        a = Agent({'cameras':[{'id':key,'kind':'esp32','capture_url':url,'fps':5} for key in ('one','two')]})
        try:
            for c in a.cameras.values(): c.start()
            wait_for(lambda: all(c.status()['online'] for c in a.cameras.values()))
            self.assertEqual(len(a.document('/camera/status')['cameras']),2)
            good.clear()
            wait_for(lambda: all(not c.status()['online'] for c in a.cameras.values()))
            good.set()
            wait_for(lambda: all(c.status()['online'] for c in a.cameras.values()))
        finally:
            a.stop(); server.shutdown(); server.server_close(); t.join()
        self.assertTrue(all(not c.thread.is_alive() for c in a.cameras.values()))

    def test_restart_and_config_validation(self):
        c = Camera({'id':'one','kind':'csi'})
        with patch.object(c, 'native', side_effect=OSError):
            c.start(); wait_for(lambda:c.failures>0); c.stop()
            c.start(); wait_for(lambda:c.failures>2); c.stop()
        self.assertFalse(c.thread.is_alive())
        for value in [0,11,float('nan')]:
            with self.assertRaises(ValueError): Camera({'id':'one','kind':'csi','fps':value})
        with self.assertRaises(ValueError):
            Agent({'cameras':[{'id':'one','kind':'csi'},{'id':'one','kind':'csi'}]})
        with self.assertRaises(ValueError): jpeg(b'html')

if __name__ == '__main__': unittest.main()
