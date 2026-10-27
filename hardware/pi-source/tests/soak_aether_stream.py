"""30-second MJPEG transport fixture test on Pi; no real camera proof."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import resource
import sys
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from aether_device.agent import Agent
from aether_device.api import Server

TOKEN='fixture-soak-token-'+'x'*32
FRAME=b'\xff\xd8transport-fixture-not-decoded\xff\xd9'

def main():
    available=threading.Event(); available.set()
    done=threading.Event()
    class Source(BaseHTTPRequestHandler):
        def do_GET(self):
            if not available.is_set(): self.send_error(503);return
            self.send_response(200);self.send_header('Content-Type','image/jpeg')
            self.send_header('Content-Length',str(len(FRAME)));self.end_headers();self.wfile.write(FRAME)
        def log_message(self,*args):pass
    source=ThreadingHTTPServer(('127.0.0.1',0),Source)
    st=threading.Thread(target=source.serve_forever,daemon=True);st.start()
    a=Agent({'cameras':[{'id':'fixture-camera','kind':'esp32','capture_url':f'http://127.0.0.1:{source.server_port}/capture','fps':5}]})
    api=Server(('127.0.0.1',0),a,TOKEN)
    at=threading.Thread(target=api.serve_forever,daemon=True);at.start();a.start()
    base=f'http://127.0.0.1:{api.server_port}'
    counts=[0,0];errors=[];stamps=[set(),set()]
    def consume(index):
        while not done.is_set():
            try:
                req=Request(base+'/camera/stream?id=fixture-camera',headers={'Authorization':'Bearer '+TOKEN})
                with urlopen(req,timeout=4) as r:
                    while not done.is_set():
                        line=r.readline(256)
                        if line in (b'',b'--nexus-frame--\r\n'):break
                        if line!=b'--nexus-frame\r\n':raise ValueError('bad boundary')
                        headers={}
                        while True:
                            line=r.readline(1024)
                            if line==b'\r\n':break
                            key,value=line.decode().split(':',1);headers[key.lower()]=value.strip()
                        size=int(headers['content-length'])
                        data=r.read(size)
                        if data!=FRAME or r.read(2)!=b'\r\n':raise ValueError('bad fixture')
                        stamp=headers['x-frame-observed-at']
                        # On reconnect the first fresh cached frame may have already been seen.
                        stamps[index].add(stamp)
                        counts[index]+=1
            except HTTPError as e:
                if e.code not in (503,429):errors.append(str(e.code))
                e.close()
            except OSError:
                pass
            except Exception as e:
                errors.append(type(e).__name__)
            done.wait(.1)
    clients=[threading.Thread(target=consume,args=(i,),daemon=True) for i in range(2)]
    for c in clients:c.start()
    start=time.monotonic();health_checks=0
    try:
        while time.monotonic()-start<30:
            elapsed=time.monotonic()-start
            if 8<=elapsed<10 or 18<=elapsed<20:available.clear()
            else:available.set()
            with urlopen(Request(base+'/health',headers={'Authorization':'Bearer '+TOKEN}),timeout=3) as r:
                json.load(r);health_checks+=1
            done.wait(.25)
    finally:
        done.set()
        for c in clients:c.join(5)
        a.stop();api.shutdown();source.shutdown();api.server_close();source.server_close();at.join();st.join()
    report={'test_kind':'MOCK_MJPEG_TRANSPORT_ON_REAL_PI','duration_seconds':round(time.monotonic()-start,2),
            'frames_per_viewer':counts,'unique_frames_per_viewer':[len(s) for s in stamps],
            'health_checks':health_checks,'source_outages_seconds':[[8,10],[18,20]],
            'events':list(a.events),'errors':errors,'max_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            'physical_camera_tested':False,'jpeg_decode_tested':False,
            'passed':not errors and min(counts)>80 and health_checks>80 and all(not c.is_alive() for c in clients)}
    (Path(__file__).resolve().parents[1]/'logs/aether-stream-soak.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));return 0 if report['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
