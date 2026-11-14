"""B. Download actual GIBS browse; empty/error tiles never become observations."""
import argparse, concurrent.futures, datetime as dt, io, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from pipeline_common import *
LAYER='NISAR_L2_Geocoded_Polarimetric_Covariance_12Day'
SERVERS=['https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi','https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi','https://uat.gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi']
def dates(end):
 output=set()
 for start,stop in [('2026-06-17','2026-10-23'),('2026-10-21',end)]:
  d=dt.date.fromisoformat(start);last=dt.date.fromisoformat(stop)
  while d<=last:output.add(d.isoformat());d+=dt.timedelta(days=12)
 output.add('2026-10-23')
 return sorted(output)
def capabilities():
 global LAYER
 records=[];selected=None;daily_server=None
 for url in SERVERS:
  row={'url':url,'retrievedAt':now(),'parameters':{'SERVICE':'WMS','REQUEST':'GetCapabilities'},'maturity':'not applicable','crid':'not applicable'}
  try:
   r=get(url,row['parameters'],25);root=ET.fromstring(r.content)
   names=[x.text for x in root.iter() if x.tag.split('}')[-1]=='Name']
   row['nisarLayers']=[x for x in names if x and 'NISAR' in x]
   for node in root.iter():
    if node.tag.split('}')[-1]=='Layer' and any(c.tag.split('}')[-1]=='Name' and c.text==LAYER for c in node):
     row['layerMetadata']={c.tag.split('}')[-1]:c.text for c in node if c.tag.split('}')[-1] in ['Abstract','Title','Dimension','Extent']}
   row['status']='reachable'
   if daily_server is None and LAYER.replace('_12Day','') in names and 'epsg4326' in url:daily_server=url
   if selected is None and LAYER in names and 'epsg4326' in url:selected=url
  except Exception as e:row.update(status='not available',error=type(e).__name__)
  records.append(row)
 if selected is None and daily_server:
  selected=daily_server;LAYER=LAYER.replace('_12Day','')
 save('gibs-capabilities.json',{'retrievedAt':now(),'servers':records,'selected':selected,'selectedLayer':LAYER,'rolling12DayAvailable':LAYER.endswith('_12Day')})
 return selected
def fetch_one(site,date,server):
 params=dict(SERVICE='WMS',REQUEST='GetMap',VERSION='1.1.1',LAYERS=LAYER,STYLES='',FORMAT='image/png',TRANSPARENT='TRUE',SRS='EPSG:4326',BBOX=','.join(map(str,site['bbox'])),WIDTH=768,HEIGHT=512,TIME=date)
 row={'date':date,'windowStart':(dt.date.fromisoformat(date)-dt.timedelta(days=11)).isoformat() if LAYER.endswith('_12Day') else date,'status':'not available','url':server,'parameters':params,'retrievedAt':now(),'maturity':'not available at pixel level (GIBS mosaic)','crid':'not available at pixel level','label':'browse imagery, false color, not calibrated','downsampled':True,'n':None}
 if not server:return row
 try:
  r=get(server,params,25);row['url']=r.url
  if not r.content.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('WMS returned no PNG')
  im=Image.open(io.BytesIO(r.content)).convert('RGBA');a=np.array(im)
  valid=a[:,:,3]>0;row['nontransparentFraction']=round(float(valid.mean()),5)
  if not valid.any() or np.unique(a[valid,:3],axis=0).shape[0]<3:raise ValueError('Empty or uniform tile; no usable browse coverage')
  relative='sites/'+site['id']+'/gibs/'+date+'.png'
  save_image(relative,im)
  row.update(status='ready',image='data/'+relative)
 except Exception as e:row['reason']=type(e).__name__+': '+str(e)[:200]
 return row
def main():
 p=argparse.ArgumentParser();p.add_argument('--end',default='2026-11-13');a=p.parse_args()
 server=capabilities();sites=read('sites.json')
 inventory=read('inventory.json')
 tasks=[]
 for site in sites:
  record=next(r for r in inventory['sites'] if r['siteId']==site['id'])
  pair=record.get('pair') or {}
  actual={s['date'][:10] for s in record['scenes'] if s['maturity']!='BETA' and ((s['track']==pair.get('track') and s['frame']==pair.get('frame')) or s['maturity']=='VALIDATED')}
  tasks.extend((site,d) for d in sorted(set(dates(a.end))|actual))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  rows=list(pool.map(lambda item:(item[0]['id'],fetch_one(*item,server)),tasks))
 for site in sites:
  frames=[r for sid,r in rows if sid==site['id']]
  save('sites/'+site['id']+'/gibs/manifest.json',{'siteId':site['id'],'retrievedAt':now(),'source':'NASA GIBS / NASA?ISRO NISAR','layer':LAYER,'mode':'rolling 12-day mosaic' if LAYER.endswith('_12Day') else 'daily mosaic; rolling layer absent from GetCapabilities','note':'A rolling mosaic can contain multiple dates, tracks and processing versions. Do not derive quantitative change, polarization ratios or scene count from RGB. TIME is the mosaic end date, not an acquisition timestamp. GIBS color mapping differs from our HH/HV-ratio composite.','frames':frames,'available':sum(r['status']=='ready' for r in frames)})
  print(site['id'],'GIBS',sum(r['status']=='ready' for r in frames),'/',len(frames),flush=True)
if __name__=='__main__':main()
