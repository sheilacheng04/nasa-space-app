"""C. Environment-only Harmony extraction, inspection, and local science processing.
No credentials: write an explicit unavailable status, retain real browse, and stop.
Inspect full local HDF5 files before authorizing a quantitative manifest.
"""
import argparse,datetime as dt,json,os,time
from pathlib import Path
from pipeline_common import *
VARIABLES=['HHHH','HVHV','numberOfLooks','mask','rtcGammaToSigmaFactor']
def unavailable(site,reason):
 status={'siteId':site,'status':'not available','execution':'untested on real calibrated GCOV','retrievedAt':now(),'reason':reason,'maturity':'not available','crid':'not available','waterAreaKm2':None,'validation':{'status':'not available','reference':'OPERA DSWx-S1','agreement':None,'iou':None},'worldcover':'not available','gunw':'not attempted; optional'}
 save('sites/'+site+'/stats.json',status)
 save('sites/'+site+'/series.json',{'siteId':site,'status':'not available','n':0,'rows':[],'gap':read('inventory.json')['gap'],'reason':reason})
def inspect_hdf5(path):
 import h5py
 import numpy as np
 out={'file':Path(path).name,'retrievedAt':now(),'status':'inspected','grids':{},'identification':{}}
 with h5py.File(path,'r') as f:
  ident=f.get('/science/LSAR/identification')
  if ident:
   for k,d in ident.items():
    if isinstance(d,h5py.Dataset) and d.size<50:
     value=d[()];out['identification'][k]=value.decode() if isinstance(value,bytes) else str(value)
  for frequency in ['A','B']:
   g=f.get('/science/LSAR/GCOV/grids/frequency'+frequency)
   if g is None:continue
   fields={}
   for key in ['HHHH','HVHV','VVVV','VHVH','numberOfLooks','mask','rtcGammaToSigmaFactor']:
    if key in g:
     ds=g[key];fields[key]={'shape':list(ds.shape),'dtype':str(ds.dtype),'attributes':{k:v.decode() if isinstance(v,bytes) else str(v) for k,v in ds.attrs.items()}}
     if ds.ndim==2:
      sample=ds[::max(1,ds.shape[0]//64),::max(1,ds.shape[1]//64)]
      valid=sample[np.isfinite(sample)]
      fields[key]['sampleRange']=[float(valid.min()),float(valid.max())] if valid.size else None
   out['grids'][frequency]=fields
 return out
def harmony_fetch(site,record,collection):
 import earthaccess,requests
 from harmony import Client,Request,Collection,BBox
 # Bound authentication and polling requests as well as file-download socket time.
 original=requests.Session.request
 def bounded(session,*args,**kwargs):
  if kwargs.get('timeout') is None:kwargs['timeout']=(10,45)
  return original(session,*args,**kwargs)
 requests.Session.request=bounded
 try:
  earthaccess.login(strategy='environment',persist=False)
  client=Client(auth=(os.environ['EARTHDATA_USERNAME'],os.environ['EARTHDATA_PASSWORD']),download_timeout=(10,60))
  frames=[s for s in record['scenes'] if s['id'] in [record['pair']['before'],record['pair']['after']]]
  artifacts=[]
  for scene in frames:
   req=Request(collection=Collection(collection['conceptId']),spatial=BBox(*site['bbox']),crs='EPSG:4326',format='image/tiff',granule_name=[scene['id']],variables=['/science/LSAR/GCOV/grids/frequencyA/'+v for v in VARIABLES],interpolation='nearest')
   job=client.submit(req);deadline=time.monotonic()+300
   while time.monotonic()<deadline:
    status=client.status(job)
    state=status.get('status','')
    if state in ['successful','complete','completed']:break
    if state in ['failed','canceled','cancelled']:raise RuntimeError('Harmony job did not complete')
    time.sleep(3)
   else:raise TimeoutError('Harmony job exceeded five-minute polling limit')
   folder=ROOT/'raw'/site['id']/scene['id'];folder.mkdir(parents=True,exist_ok=True)
   paths=[str(f.result(timeout=120)) for f in client.download_all(status,directory=str(folder))]
   artifacts.append({'sceneId':scene['id'],'jobId':job,'files':paths,'maturity':scene['maturity'],'crid':scene['crid'],'parameters':{'bbox':site['bbox'],'crs':'EPSG:4326','variables':VARIABLES,'interpolation':'nearest'},'retrievedAt':now()})
  save('sites/'+site['id']+'/harmony.json',{'status':'downloaded; HDF5 inspection and mask review required','url':'https://harmony.earthdata.nasa.gov','artifacts':artifacts})
  return artifacts
 finally:requests.Session.request=original
def main():
 p=argparse.ArgumentParser();p.add_argument('--site',default='all');p.add_argument('--harmony',action='store_true');p.add_argument('--inspect');p.add_argument('--manifest');a=p.parse_args()
 if a.inspect:
  result=inspect_hdf5(a.inspect);out=ROOT/'raw'/(Path(a.inspect).stem+'-inspection.json');out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8');print('Inspection saved; review actual units and mask flag meanings.');return
 if a.manifest:
  from prepare_radar import prepare
  from science_products import enrich
  manifest=json.loads(Path(a.manifest).read_text(encoding='utf-8'))
  cohort_keys=['sensor','track','frame','direction','frequency','maturity','processingVersion']
  cohorts={tuple(str(row.get(k,'')) for k in cohort_keys) for row in manifest.get('acquisitions',[])}
  if len(cohorts)!=1:raise ValueError('Use one same-maturity track/frame/CRID cohort for science processing')
  prepare(a.manifest);enrich(a.manifest);return
 inventory=read('inventory.json')
 for site in read('sites.json'):
  if a.site not in ['all',site['id']]:continue
  record=next(r for r in inventory['sites'] if r['siteId']==site['id'])
  if not record.get('pair'):unavailable(site['id'],'Decision gate: no comparable real provisional catalog pair.');continue
  if not (os.getenv('EARTHDATA_USERNAME') and os.getenv('EARTHDATA_PASSWORD')):
   unavailable(site['id'],'EARTHDATA_USERNAME and EARTHDATA_PASSWORD are not configured. Authenticated HDF5/Harmony extraction, masks and OPERA agreement are untested.');print(site['id'],'not available: Earthdata environment credentials absent');continue
  if not a.harmony:unavailable(site['id'],'Authenticated extraction not requested. Run --harmony, inspect actual HDF5 layers, then use a reviewed --manifest.');continue
  collection=next(c for c in inventory['collections'] if c['maturity']=='PROVISIONAL')
  try:harmony_fetch(site,record,collection);unavailable(site['id'],'Harmony subsets downloaded. Quantitative processing awaits full-HDF5 unit/mask inspection and reviewed manifest; do not infer masks.')
  except Exception as e:
   # Never stringify credential-bearing provider exceptions.
   unavailable(site['id'],'Harmony extraction unavailable ('+type(e).__name__+'). No calibrated data substituted.')
if __name__=='__main__':main()
