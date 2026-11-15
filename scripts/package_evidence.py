"""Publish the fetched evidence and a lightweight first-load index."""
import json,io
from PIL import Image
from pipeline_common import *
def optional(path,default):
 f=DATA/path
 return json.loads(f.read_text(encoding='utf-8')) if f.exists() else default
def main(site_ids=None):
 inventory=read('inventory.json');summaries=[]
 previous={s['siteId']:s for s in read('evidence.json')}
 for site in read('sites.json'):
  if site_ids and site['id'] not in site_ids:
   summaries.append(previous[site['id']]);continue
  sid=site['id'];record=next(r for r in inventory['sites'] if r['siteId']==sid)
  gibs=optional('sites/'+sid+'/gibs/manifest.json',{'frames':[]})
  browse=optional('sites/'+sid+'/browse/manifest.json',{'frames':[]})
  series=optional('sites/'+sid+'/series.json',{'n':0,'rows':[],'status':'not available'})
  stats=optional('sites/'+sid+'/stats.json',{'status':'not available'})
  old=DATA/'observations'/f'{sid}.json'
  processed=json.loads(old.read_text(encoding='utf-8')) if old.exists() else {'acquisitions':[],'comparisons':[]}
  # Do not infer lineage for GIBS from matching dates. Pixel provenance is unavailable.
  for f in gibs['frames']:
   f['maturity']='NOT AVAILABLE (mosaic lineage)'
  save('sites/'+sid+'/evidence.json',{'siteId':sid,'inventory':record,'gibs':gibs,'browse':browse,'series':series,'stats':stats,'processed':processed})
  # Story opens with an exact dated regional HH product; GIBS clips are in the explorer.
  candidates=[f for f in browse['frames'] if f.get('channels',{}).get('HH',{}).get('image')]
  f=candidates[-1] if candidates else None
  item={'siteId':sid,'name':site['name'],'n':record.get('n',0),'date':f['date'] if f else '', 'maturity':f['maturity'] if f else 'not available','crid':f.get('crid','not available') if f else 'not available','channel':'HH / regional quicklook','source':'ASF DAAC','label':'Grayscale regional browse, not a site clip, not calibrated'}
  if f:
   origin=DATA/f['channels']['HH']['image'].removeprefix('data/')
   im=Image.open(origin);im.thumbnail((480,480))
   relative='sites/'+sid+'/thumbnail.png'
   save_image(relative,im)
   item['image']='data/'+relative
  summaries.append(item)
 save('evidence.json',summaries)
 network=read('network-status.json')
 sources=[{'name':r['url'].split('/')[2],**r,'status':str(r.get('status','network error'))+(' reachable' if r['reachable'] else ' not available')} for r in network['sources']]
 for r in inventory['sites']:
  sources.append({'name':'ASF GCOV catalog / '+r['siteId'],'url':r['url'],'status':r['status'],'retrievedAt':r['retrievedAt'],'maturity':'BETA / PROVISIONAL / VALIDATED; see scene rows','crid':'per scene','parameters':r['parameters']})
  plan=r['observationPlan'];sources.append({'name':'Observation plan / '+r['siteId'],**plan,'maturity':'reference plan','crid':'not applicable','parameters':{'bbox':r['bbox'],'comparison':'track/frame'}})
 for site in read('sites.json'):
  weather=optional('context/'+site['id']+'.json',{})
  for request in weather.get('requests',[]):sources.append({'name':'ERA5 '+site['id']+' / '+request['period'],**request,'maturity':'reanalysis','crid':'not applicable'})
 enso=read('enso.json')
 sources.extend([{'name':'NOAA weekly Nino 3.4','url':enso['url'],'status':enso['status'],'retrievedAt':enso['retrievedAt'],'maturity':'operational index','crid':'not applicable','parameters':enso['parameters']},{'name':'NOAA ONI','url':enso['oniSource'],'status':'ready' if enso['oni'] else 'not available','retrievedAt':enso.get('oniRetrievedAt'),'maturity':'operational index','crid':'not applicable','parameters':{'years':'2025-2026'}}])
 news=read('news.json');sources.append({'name':'GDELT DOC 2.0',**news['gdelt']})
 save('method.json',{'retrievedAt':now(),'collections':inventory['collections'],'sources':sources,'citation':'NISAR follows NASA\u2019s standard Data Use and Citation Guidance.','citationStatus':'Dataset-specific exact citation not available; linked NASA guidance 403'})
 save('sources.json',[{'name':s['name'],'url':s['url'],'status':s['status'],'reviewedAt':s.get('retrievedAt',''),'note':s.get('maturity','')} for s in sources])
 print('Published evidence for',len(summaries),'sites')
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--site',action='append')
 main(parser.parse_args().site)
