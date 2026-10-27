import copy
import json
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from gateway import Gateway, validate
from aether_device.agent import Agent
from aether_device.api import Server
from aether_device.cameras import utc, Camera

TOKEN='test-upstream-token-'+'x'*32

def metric(value=42):
    return {'schema_version':'1.0.0','device_id':'pi-real','source':'LIVE','timestamp':utc(),
            'measurements':[{'channel':'cpu_temperature','value':value,'unit':'°C','source':'LIVE','observed_at':utc()}]}

class Tests(unittest.TestCase):
    def test_invalid_telemetry(self):
        for val in [True, float('nan'), float('inf'), 9999]:
            with self.assertRaises(ValueError): validate('/telemetry',metric(val))
        row=metric(); row['measurements'][0]['unit']='F'
        with self.assertRaises(ValueError): validate('/telemetry',row)
        row=metric(); row['timestamp']='2020-01-01T00:00:00Z'
        with self.assertRaises(ValueError): validate('/telemetry',row)

    def test_unreachable_stale_and_expired(self):
        g=Gateway('http://127.0.0.1:9',TOKEN)
        g.poll()
        self.assertEqual(g.document('/health')['source'],'OFFLINE')
        self.assertEqual(g.document('/api/nexus/feeds')['telemetry'],[])
        g.cache={'/devices':{'devices':[]}}
        g.updated=time.monotonic(); g.failed=True
        self.assertEqual(g.document('/health')['source'],'STALE')
        g.updated-=61
        self.assertEqual(g.document('/health')['source'],'OFFLINE')
        self.assertEqual(g.document('/telemetry')['measurements'],[])

    def test_real_http_poller_and_projection(self):
        agent=Agent(); agent.metrics=agent.sampler.sample()
        server=Server(('127.0.0.1',0),agent,TOKEN)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        gateway=Gateway(f'http://127.0.0.1:{server.server_port}',TOKEN)
        try:
            gateway.poll()
            self.assertFalse(gateway.failed)
            feeds=gateway.document('/api/nexus/feeds')
            self.assertEqual(feeds['source'],'LIVE')
            self.assertEqual(len(feeds['devices']),1)
            self.assertEqual(feeds['devices'][0]['id'],agent.id)
            self.assertEqual(feeds['telemetry'],[]) # no CPU-as-ambient fabrication
            self.assertEqual(feeds['cameraStatus'],[]) # no invented MediaMTX
            self.assertEqual(feeds['aiDetections'],[])
            self.assertEqual(gateway.document('/camera/status')['source'],'OFFLINE')
            with patch.object(gateway,'open',side_effect=OSError): gateway.poll()
            self.assertEqual(gateway.document('/api/nexus/feeds')['devices'],[])
            self.assertEqual(gateway.document('/health')['source'],'STALE')
            gateway.poll()
            self.assertEqual(gateway.document('/health')['source'],'LIVE')
        finally:
            server.shutdown();server.server_close();t.join();gateway.stop()

    def test_gateway_camera_snapshot_stream_and_disconnect(self):
        frame=b'\xff\xd8fixture\xff\xd9'
        agent=Agent({'cameras':[{'id':'fixture','kind':'csi'}]})
        agent.cameras['fixture'].accept(frame)
        upstream=Server(('127.0.0.1',0),agent,TOKEN)
        ut=threading.Thread(target=upstream.serve_forever,daemon=True);ut.start()
        g=Gateway(f'http://127.0.0.1:{upstream.server_port}',TOKEN,['fixture'])
        g.start()
        server=Server(('127.0.0.1',0),g,TOKEN)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        def get(path):
            return urlopen(Request(f'http://127.0.0.1:{server.server_port}'+path,headers={'Authorization':'Bearer '+TOKEN}),timeout=3)
        try:
            end=time.monotonic()+4
            while g.cameras['fixture'].current()[0] is None and time.monotonic()<end:time.sleep(.02)
            with get('/camera/snapshot?id=fixture') as r:
                self.assertEqual(r.read(),frame)
                self.assertEqual(r.headers['X-Frame-Observed-At'],utc(agent.cameras['fixture'].frame_time))
            with get('/camera/stream?id=fixture') as r:
                self.assertEqual(r.readline(),b'--nexus-frame\r\n')
                headers={}
                while True:
                    line=r.readline()
                    if line==b'\r\n':break
                    k,v=line.decode().split(':',1);headers[k]=v.strip()
                self.assertEqual(r.read(int(headers['Content-Length'])),frame)
            agent.cameras['fixture'].failed('fixture disconnected')
            end=time.monotonic()+4
            while g.cameras['fixture'].current()[0] is not None and time.monotonic()<end:time.sleep(.02)
            self.assertIsNone(g.cameras['fixture'].current()[0])
        finally:
            g.stop();server.shutdown();upstream.shutdown();server.server_close();upstream.server_close();t.join();ut.join()

    def test_bad_auth(self):
        agent=Agent(); server=Server(('127.0.0.1',0),agent,TOKEN)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            g=Gateway(f'http://127.0.0.1:{server.server_port}','wrong-token-'+'x'*32)
            g.poll();self.assertTrue(g.failed)
        finally: server.shutdown();server.server_close();t.join()

if __name__=='__main__':unittest.main()
