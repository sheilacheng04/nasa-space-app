"""A. Public ASF/CMR discovery. No authentication; no inferred acquisitions."""
import concurrent.futures, collections, json, re
from urllib.parse import urlencode
import asf_search as asf
from shapely.geometry import shape,box,Point
from pipeline_common import *
COLLECTIONS=['NISAR_L2_GCOV_BETA_V1','NISAR_L2_GCOV_PROVISIONAL_V1','NISAR_L2_GCOV_V1']
class BoundedSession(asf.ASFSession):
 def request(self,*args,**kwargs):
  kwargs.setdefault('timeout',(10,40))
  return super().request(*args,**kwargs)
def inventory_site(site):
 bbox=site['bbox']; polygon=box(*bbox)
 params=dict(dataset='NISAR',processingLevel='GCOV',shortName=COLLECTIONS,intersectsWith=polygon.wkt,start='2025-10-17T00:00:00Z',end=AS_OF+'T00:00:00Z',maxResults=1000)
 record={'siteId':site['id'],'bbox':bbox,'retrievedAt':now(),'parameters':params,'url':'https://api.daac.asf.alaska.edu/services/search/param?'+urlencode({**params,'output':'geojson'}),'scenes':[],'status':'not available'}
 try:
  results=asf.search(**params,opts=asf.ASFSearchOptions(session=BoundedSession()))
  geo=results.geojson()
  # Some installed ASF clients omit new collection fields/validated IDs. Merge the public ASF REST catalog.
  rest_params={k:v for k,v in params.items() if k!='shortName'}
  rest=get('https://api.daac.asf.alaska.edu/services/search/param',{**rest_params,'output':'geojson'})
  combined={f['properties']['sceneName']:f for f in geo.get('features',[])}
  combined.update({f['properties']['sceneName']:f for f in rest.json().get('features',[])})
  geo={'type':'FeatureCollection','features':list(combined.values())}
  record['catalogMethods']=['asf_search.search','ASF public REST catalog merge for current collection metadata']
  save('catalog/'+site['id']+'.geojson',geo)
  for feature in geo.get('features',[]):
   p=feature['properties']; name=p.get('collectionName') or next((c for c in COLLECTIONS if '/'+c+'/' in p.get('url','')), '')
   if name not in COLLECTIONS:continue
   foot=shape(feature['geometry']);intersection=foot.intersection(polygon)
   if intersection.is_empty:continue
   maturity='BETA' if '_BETA_' in name else 'PROVISIONAL' if '_PROVISIONAL_' in name else 'VALIDATED'
   record['scenes'].append(dict(id=p.get('sceneName',p.get('fileID')),date=p.get('startTime'),track=p.get('pathNumber') or int(p['sceneName'].split('_')[5]),frame=p.get('frameNumber'),direction=p.get('flightDirection'),maturity=maturity,crid=p.get('crid') or re.search(r'_(P[0-9]{5})_',p['sceneName']).group(1),collection=name,polarizations=p.get('mainBandPolarization',[]),hdf5LayersVerified=False,footprint=feature['geometry'],coversCenter=foot.covers(Point(site['coordinates'])),coversBox=foot.covers(polygon),bboxCoverageFraction=round(intersection.area/polygon.area,4),sourceUrl=p.get('url'),browseUrls=p.get('browse',[])))
  record['scenes'].sort(key=lambda x:x['date'])
  cohorts=collections.defaultdict(list)
  for s in record['scenes']:
   if s['maturity']=='PROVISIONAL' and s['coversCenter']:
    cohorts[(s['track'],s['frame'],s['direction'],s['crid'])].append(s)
  candidates=[ss for ss in cohorts.values() if len({s['date'] for s in ss})>=2]
  chosen=max(candidates,key=lambda ss:((ss[-1]['date'][:10]>ss[0]['date'][:10]),min(s['bboxCoverageFraction'] for s in ss),len(ss))) if candidates else []
  record['pair']={'before':chosen[0]['id'],'after':chosen[-1]['id'],'maturity':'PROVISIONAL','crid':chosen[0]['crid'],'track':chosen[0]['track'],'frame':chosen[0]['frame'],'status':'catalog-selected; valid-pixel overlap and calibration untested'} if chosen else None
  record['n']=len(record['scenes']);record['status']='catalog coverage confirmed' if record['n'] else 'not available'
  record['maturityCounts']=dict(collections.Counter(s['maturity'] for s in record['scenes']))
  plan_url='https://services7.arcgis.com/WSiUmUhlFx4CtMBB/arcgis/rest/services/nisar_merged_observation_plans/FeatureServer/0/query'
  try:
   plan_response=get(plan_url,dict(f='json',where='1=1',geometry=','.join(map(str,bbox)),geometryType='esriGeometryEnvelope',inSR=4326,spatialRel='esriSpatialRelIntersects',outFields='track,frame,producegcov,passdirection,DH,DV,QP',returnGeometry='false'))
   plan=plan_response.json()
   if 'error' in plan:raise ValueError('Observation plan query returned an error')
   planned=[f['attributes'] for f in plan.get('features',[])]
   keys={(int(p['track']),int(p['frame'])) for p in planned if p.get('producegcov')==1}
   for scene in record['scenes']:scene['matchesObservationPlan']=(scene['track'],scene['frame']) in keys
   record['observationPlan']={'url':plan_response.url,'retrievedAt':now(),'status':'track/frame intersections checked against official reference plan','records':planned}
  except Exception as e:record['observationPlan']={'url':plan_url,'status':'not available','error':type(e).__name__}
 except Exception as e:record['error']=type(e).__name__+': '+str(e)[:350]
 print(site['id'],record['status'],record.get('maturityCounts',{}),flush=True)
 return record
def main():
 sites=json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
 # Refined Angat box already follows the actual reservoir near 121.16 E, not the approximate prompt center.
 for s in sites:
  if s['id']=='luzon':s['bbox']=[120.4,15.0,121.4,16.0]
  if s['id']=='dadu':s['bbox']=[67.3,26.2,68.3,27.2]
  s['selectionNote']='Angat uses the existing reservoir-centered box; the supplied 121.4 E center is east of this reservoir.' if s['id']=='angat' else 'Prompt study box; retained only with real intersecting GCOV footprints.'
 # A wet-side candidate is investigated to provide a valid second face; it is included only on confirmed coverage.
 peru=dict(id='piura',name='Lower Piura',subtitle='A Pacific floodplain',country='Peru',coordinates=[-80.63,-5.2],bbox=[-80.85,-5.45,-80.4,-5.0],type='Wet-side hypothesis',question='Does surface water expand on the Piura floodplain?',description='A coastal Peru site for testing seasonal water change, subject to the timing of the local rainy season.',hypothesis='Extra seasonal rain can coincide with Pacific warming. Coastal SST, local rainfall and river operations must support this interpretation.',evidence='Same-track water masks, rainfall and independent river or flood observations; a seasonal baseline is needed.',disprove='No rainfall increase, stable river levels, or irrigation explaining the signal would weaken the hypothesis.',humanDrivers='Irrigation, levees, reservoir releases and land use can change surface water.',selectionNote='Additional wet-side candidate; retained only after public ASF GCOV coverage is confirmed.')
 records=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: records=list(pool.map(inventory_site,sites if any(s['id']=='piura' for s in sites) else sites+[peru]))
 if records[-1].get('n',0) and not any(s['id']=='piura' for s in sites):sites.append(peru)
 for s in sites:
  r=next(r for r in records if r['siteId']==s['id'])
  s['coverageStatus']=r['status'];s['sceneCount']=r.get('n',0)
 collection_rows=[]
 for short in COLLECTIONS:
  url='https://cmr.earthdata.nasa.gov/search/collections.json'
  try:
   response=get(url,{'short_name':short,'page_size':100})
   entries=response.json()['feed']['entry']
   for e in entries:collection_rows.append({'shortName':short,'conceptId':e['id'],'title':e.get('dataset_id'),'doi':e.get('doi') or {'NISAR_L2_GCOV_BETA_V1':'10.5067/NIL2GCOV-B1','NISAR_L2_GCOV_PROVISIONAL_V1':'10.5067/NIL2GCOV-P1','NISAR_L2_GCOV_V1':'10.5067/NIL2GCOV-V1'}[short],'url':response.url,'retrievedAt':now(),'maturity':'BETA' if 'BETA' in short else 'PROVISIONAL' if 'PROVISIONAL' in short else 'VALIDATED','crid':'see scene records'})
  except Exception as e:collection_rows.append({'shortName':short,'status':'not available','error':type(e).__name__})
 save('sites.json',sites)
 save('inventory.json',{'schemaVersion':1,'retrievedAt':now(),'asOf':AS_OF,'method':'asf_search.search: dataset=NISAR, processingLevel=GCOV; CMR collection IDs queried by short_name. Footprint intersection is catalog coverage, not valid-pixel coverage.','gap':{'start':'2026-07-27T22:03:25Z','end':'2026-08-10T00:55:27Z','source':'https://nisar-docs.asf.alaska.edu/availability-overview/'},'collections':collection_rows,'sites':records,'decision':'Science extraction may proceed only for catalog-confirmed sites; all numeric changes remain unavailable until authenticated data and masks are inspected.'})
if __name__=='__main__':main()
