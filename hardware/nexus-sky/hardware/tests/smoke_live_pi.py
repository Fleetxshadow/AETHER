"""Read-only real Pi API smoke via explicit SSH tunnel; requires private env tokens."""
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

root=Path(__file__).resolve().parents[2]
def fetch(base,path,token):
    with urlopen(Request(base+path,headers={'Authorization':'Bearer '+token}),timeout=5) as r:
        return json.load(r)

def main():
    samples={}
    for base,token in [('http://127.0.0.1:18765',os.environ['NEXUS_DEVICE_TOKEN']),('http://127.0.0.1:8766',os.environ['NEXUS_GATEWAY_TOKEN'])]:
        for endpoint in ['/health','/devices','/telemetry','/camera/status']:
            samples[base+endpoint]=fetch(base,endpoint,token)
        try: urlopen(base+'/health',timeout=5)
        except HTTPError as e: assert e.code==401
        else: raise AssertionError('unauthenticated access succeeded')
    health=samples['http://127.0.0.1:18765/health']
    assert health['device_type']=='raspberry-pi'
    assert health['metrics']['cpu_temperature']['source']=='LIVE'
    assert health['metrics']['ram_percent']['source']=='LIVE'
    assert samples['http://127.0.0.1:18765/camera/status']['source']=='OFFLINE'
    feeds=fetch('http://127.0.0.1:8766','/api/nexus/feeds',os.environ['NEXUS_GATEWAY_TOKEN'])
    assert feeds['source']=='LIVE' and len(feeds['devices'])==1
    assert all(feeds[k]==[] for k in ['telemetry','cameraStatus','aiDetections','observations','incidents'])
    samples['aether_feeds']=feeds
    target=root/'docs/hardware-evidence/real-pi-api.json'
    target.write_text(json.dumps(samples,indent=2,ensure_ascii=False)+'\n')
    print('Real Pi telemetry and laptop gateway verified; no live camera/sensor claims. Evidence:',target)

if __name__=='__main__': main()
