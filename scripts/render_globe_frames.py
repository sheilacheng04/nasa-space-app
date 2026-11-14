"""Build truthful global NISAR browse playback from the live GIBS date domain.
No login. No interpolation, recoloring, synthesized coverage, or maturity inference.
"""
import argparse, concurrent.futures, datetime as dt, io, json, re, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from pipeline_common import DATA, get, save, now

DAILY='NISAR_L2_Geocoded_Polarimetric_Covariance'
ROLLING=DAILY+'_12Day'
WMTS='https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi'
WMS='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
GUIDE='https://nisar-docs.asf.alaska.edu/availability-overview/'
GAP={'start':'2026-07-27T22:03:25Z','end':'2026-08-10T00:55:27Z','label':'Permanent acquisition gap','source':GUIDE}
WINDOWS=[
 {'label':'BETA subset','start':'2025-10-17','end':'2026-01-20','source':GUIDE},
 {'label':'PROVISIONAL','start':'2026-06-17','end':'2026-10-23','source':GUIDE},
 {'label':'VALIDATED','start':'2026-10-21','end':None,'source':GUIDE}
]
def text_of(node,name):
 return next((e.text for e in node.iter() if e.tag.split('}')[-1]==name),None)
def parse_domain(domain):
 """Expand advertised ISO date intervals, never assume a continuous date range."""
 found=set()
 for value in domain.split(','):
  parts=value.strip().split('/')
  if len(parts)==1:
   if parts[0]:found.add(parts[0][:10])
  elif len(parts)==3:
   first,last=map(lambda s:dt.date.fromisoformat(s[:10]),parts[:2])
   match=re.fullmatch(r'P(\d+)D',parts[2])
   if not match:raise ValueError('Unsupported advertised interval: '+parts[2])
   step=int(match.group(1))
   if step<1:raise ValueError('Invalid interval')
   while first<=last:found.add(first.isoformat());first+=dt.timedelta(days=step)
  else:raise ValueError('Unrecognized GIBS date domain')
 return sorted(found)
def maturity_window(date):
 labels=[w['label'] for w in WINDOWS if date>=w['start'] and (not w['end'] or date<=w['end'])]
 return ' / '.join(labels) if labels else 'Unconfirmed release window'
def capabilities(url):
 params={'SERVICE':'WMTS','REQUEST':'GetCapabilities','VERSION':'1.0.0'}
 r=get(url,params,35);root=ET.fromstring(r.content);layers={}
 for node in root.iter():
  if node.tag.split('}')[-1]!='Layer':continue
  ident=next((c.text for c in node if c.tag.split('}')[-1]=='Identifier'),None)
  if ident not in [DAILY,ROLLING]:continue
  links=[text_of(c,'TileMatrixSet') for c in node if c.tag.split('}')[-1]=='TileMatrixSetLink']
  layers[ident]={'id':ident,'title':text_of(node,'Title'),'matrixSets':links}
 return {'url':r.url,'retrievedAt':now(),'status':r.status_code,'cors':r.headers.get('Access-Control-Allow-Origin'),'layers':layers}
def fetch_frame(date,layer,advertised,old,width,refresh):
 frame={'date':date,'maturity':'not available at pixel level','maturityWindow':maturity_window(date),'layer':layer,'crid':'not available (mosaic lineage)','downsampled':True}
 if not advertised:
  return {**frame,'status':'no-data','reason':'No date advertised by GIBS DescribeDomains','image':None}
 if old and not refresh and old.get('status') in ['ready','empty'] and (old.get('status')=='empty' or (DATA/old['image'].removeprefix('data/')).exists()):
  return old
 params={'SERVICE':'WMS','REQUEST':'GetMap','VERSION':'1.1.1','LAYERS':layer,'STYLES':'','FORMAT':'image/png','TRANSPARENT':'TRUE','SRS':'EPSG:4326','BBOX':'-180,-90,180,90','WIDTH':width,'HEIGHT':width//2,'TIME':date}
 frame.update(retrievedAt=now(),parameters=params)
 try:
  r=get(WMS,params,35);frame.update(sourceUrl=r.url,cors=r.headers.get('Access-Control-Allow-Origin'))
  im=Image.open(io.BytesIO(r.content)).convert('RGBA');alpha=np.asarray(im)[:,:,3]
  valid=alpha>0;frame['nontransparentPixels']=int(valid.sum());frame['totalPixels']=int(valid.size)
  if not valid.any():return {**frame,'status':'empty','reason':'Advertised date returned a fully transparent mosaic','image':None}
  memory=io.BytesIO();im.save(memory,format='WEBP',lossless=True,method=6)
  for cap in (768,512,384):
   if memory.tell()<=150000:break
   # Nearest-neighbor downsampling keeps source channel values; no recoloring.
   im.thumbnail((cap,cap//2),Image.Resampling.NEAREST);memory=io.BytesIO();im.save(memory,format='WEBP',lossless=True,method=6)
  if memory.tell()>150000:raise ValueError('Lossless overview exceeds 150 KB; keep as unavailable')
  folder=DATA/'globe/frames'/('rolling' if layer==ROLLING else 'daily');folder.mkdir(parents=True,exist_ok=True)
  path=folder/(date+'.webp');path.write_bytes(memory.getvalue())
  # Densest coarse geographic bin is only a camera hint, never an area estimate.
  ys,xs=np.where(valid);bins=np.zeros((9,18));np.add.at(bins,(ys*9//valid.shape[0],xs*18//valid.shape[1]),1)
  yi,xi=np.unravel_index(bins.argmax(),bins.shape)
  frame.update(status='ready',image='data/'+path.relative_to(DATA).as_posix(),bytes=path.stat().st_size,width=im.width,height=im.height,focus={'lng':float(-170+20*xi),'lat':float(80-20*yi)})
 except Exception as e:frame.update(status='unavailable',reason=type(e).__name__+': '+str(e)[:180],image=None)
 return frame
def main():
 p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');p.add_argument('--workers',type=int,default=3);a=p.parse_args()
 probes=[]
 for server in [WMTS,WMTS.replace('epsg4326','epsg3857'),WMTS.replace('gibs.','uat.gibs.')]:
  try:probes.append(capabilities(server))
  except Exception as e:probes.append({'url':server,'retrievedAt':now(),'status':'unavailable','error':str(e)[:180]})
 primary=probes[0]
 if not primary.get('layers'):raise RuntimeError('No live layer capabilities. Retain the existing manifest; do not fabricate dates.')
 previous=json.loads((DATA/'globe/manifest.json').read_text(encoding='utf-8')) if (DATA/'globe/manifest.json').exists() else {}
 layers={}
 for ident,meta in primary['layers'].items():
  params={'SERVICE':'WMTS','REQUEST':'DescribeDomains','VERSION':'1.0.0','LAYER':ident,'TILEMATRIXSET':meta['matrixSets'][0],'TIME':'all'}
  r=get(WMTS,params,35);domain=text_of(ET.fromstring(r.content),'Domain');dates=parse_domain(domain)
  if not dates:continue
  first,last=map(dt.date.fromisoformat,[dates[0],dates[-1]])
  calendar=[(first+dt.timedelta(days=i)).isoformat() for i in range((last-first).days+1)]
  old={f['date']:f for f in previous.get('layers',{}).get(ident,{}).get('frames',[])};advertised=set(dates)
  with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(3,a.workers))) as pool:
   frames=list(pool.map(lambda date:fetch_frame(date,ident,date in advertised,old.get(date),1024,a.refresh),calendar))
  layers[ident]={**meta,'kind':'rolling 12-day' if ident==ROLLING else 'daily','domain':domain,'domainUrl':r.url,'retrievedAt':now(),'start':dates[0],'end':dates[-1],'advertisedDates':dates,'frames':frames}
  print(ident,len(frames),'calendar dates,',sum(f['status']=='ready' for f in frames),'real images',flush=True)
 if not layers:raise RuntimeError('No usable live date domain; previous manifest retained')
 output={'schemaVersion':1,'retrievedAt':now(),'defaultLayer':ROLLING if ROLLING in layers else DAILY,'rollingAvailable':ROLLING in layers,'defaultReason':'Rolling 12-day layer absent; daily mosaic selected' if ROLLING not in layers else 'Advertised rolling 12-day mosaic','source':'NASA GIBS / NASA-ISRO NISAR L2 GCOV browse','capabilities':probes,'maturityWindows':WINDOWS,'gap':GAP,'maturityNote':'Release windows are guide context, not pixel lineage. Mosaic acquisition times, maturity and CRID cannot be confirmed from dates alone. Supplemental provisional products exist.','colorMapping':{'status':'confirmed for dual-pol browse','text':'For dual-polarization browse, red and blue use co-polarized HH or VV; green uses cross-polarized HV or VH. Dark covered pixels have low displayed returns. Transparent pixels are not imaged. Colors are not temperature, natural color or a calculated HH/HV ratio.','source':'https://nisar-docs.asf.alaska.edu/worldview/'},'limits':['1024 by 512 global browse overview, about 39 km per pixel at the equator; not full-resolution science.','Lossless WebP encoding preserves the returned browse colors and transparency.','DescribeDomains advertises dates, not uniform coverage. Nontransparent pixel counts are not Earth-area coverage.'],'layers':layers}
 save('globe/manifest.json',output)
 print('Wrote public/data/globe/manifest.json',flush=True)
if __name__=='__main__':main()
