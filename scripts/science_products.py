"""Derive candidate water, ratio, class series and independent agreement.
Inputs must already pass prepare_radar's metadata/mask checks. No browse pixels.
"""
import datetime as dt,json,math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import Resampling
from pipeline_common import ROOT,DATA,save,now
from prepare_radar import read_tiff,warp,write_cog,save_png
def water_mask(hh,hv,hh_threshold=-17.,hv_threshold=-24.):
 valid=np.isfinite(hh)&np.isfinite(hv)
 return np.where(valid,(hh<hh_threshold)&(hv<hv_threshold),np.nan).astype('float32')
def agreement(candidate,reference):
 valid=np.isfinite(candidate)&np.isfinite(reference)
 if not valid.any():return {'status':'not available','nValidPixels':0,'agreement':None,'iou':None}
 a=candidate[valid]>0;b=reference[valid]>0;union=np.sum(a|b)
 return {'status':'computed','nValidPixels':int(valid.sum()),'agreement':float(np.mean(a==b)),'iou':float(np.sum(a&b)/union) if union else None,'truePositive':int(np.sum(a&b)),'falsePositive':int(np.sum(a&~b)),'falseNegative':int(np.sum(~a&b)),'trueNegative':int(np.sum(~a&~b))}
def enrich(manifest_path):
 manifest_path=Path(manifest_path).resolve();m=json.loads(manifest_path.read_text(encoding='utf-8'));sid=m['siteId']
 package=json.loads((DATA/'observations'/f'{sid}.json').read_text(encoding='utf-8'))
 site=next(s for s in json.loads((DATA/'sites.json').read_text(encoding='utf-8')) if s['id']==sid)
 thresholds=m.get('waterThresholdsDb',{'HH':-17.,'HV':-24.});rows=[];validation=[];cohorts=set()
 for scene in package['acquisitions']:
  if not all(p in scene['channels'] for p in ['HH','HV']):continue
  paths=[ROOT/'public'/scene['channels'][p]['cog'] for p in ['HH','HV']]
  with rasterio.open(paths[0]) as src:
   if not src.crs.is_projected or src.crs.linear_units!='metre':raise ValueError('Water area requires a metric projected grid')
   hh=src.read(1,masked=True).filled(np.nan);grid={'width':src.width,'height':src.height,'transform':src.transform,'crs':src.crs}
   pixel_area=abs(src.transform.a*src.transform.e-src.transform.b*src.transform.d)
  with rasterio.open(paths[1]) as src:
   if src.crs!=grid['crs'] or src.transform!=grid['transform'] or (src.width,src.height)!=(grid['width'],grid['height']):raise ValueError('HH/HV grids differ')
   hv=src.read(1,masked=True).filled(np.nan)
  water=water_mask(hh,hv,thresholds['HH'],thresholds['HV']);ratio=np.where(np.isfinite(water),hh-hv,np.nan)
  out=paths[0].parent;valid=np.isfinite(water)
  row={'date':scene['date'],'id':scene['id'],'maturity':scene['maturity'],'crid':scene['processingVersion'],'track':scene['track'],'frame':scene.get('frame'),'HH':float(np.nanmean(hh)),'HV':float(np.nanmean(hv)),'ratio':float(np.nanmean(ratio)),'waterAreaKm2':float(np.nansum(water)*pixel_area/1e6),'validAreaKm2':float(valid.sum()*pixel_area/1e6),'landCover':{},'status':'candidate threshold; validation required'}
  cohorts.add((scene['sensor'],scene['track'],scene['direction'],scene['frequency'],scene['maturity'],scene['processingVersion']))
  for name,array in [('ratio',ratio),('water',water)]:
   tif=out/(scene['id']+'-'+name+'.tif');png=tif.with_suffix('.png')
   write_cog(tif,array,grid);save_png(png,array,grid,site['bbox'],'water' if name=='water' else 'ratio')
   scene['channels'][name]={'image':str(png.relative_to(ROOT/'public')).replace('\\','/'),'cog':str(tif.relative_to(ROOT/'public')).replace('\\','/'),'meanDb':float(np.nanmean(ratio)) if name=='ratio' else None,'waterAreaKm2':row['waterAreaKm2'] if name=='water' else None}
  wc=m.get('worldcover')
  if wc:
   arr,t,c=read_tiff(manifest_path.parent/wc['path'],1,site['bbox']);classes=warp(arr,t,c,grid,Resampling.nearest)
   for code,label in wc['classes'].items():
    pixels=valid&(classes==int(code))
    if pixels.any():row['landCover'][label]={'nPixels':int(pixels.sum()),'HH':float(np.mean(hh[pixels])),'HV':float(np.mean(hv[pixels]))}
  for ref in m.get('operaReferences',[]):
   delta=abs((dt.date.fromisoformat(scene['date'])-dt.date.fromisoformat(ref['date'])).days)
   if delta>3:continue
   if not ref.get('validClasses') or not ref.get('waterClasses'):raise ValueError('Inspect OPERA class codes before validation')
   arr,t,c=read_tiff(manifest_path.parent/ref['path'],1,site['bbox'])
   arr=np.where(np.isin(arr,ref['validClasses']),np.isin(arr,ref['waterClasses']).astype('float32'),np.nan)
   reference=warp(arr,t,c,grid,Resampling.nearest)
   validation.append({'date':scene['date'],'referenceDate':ref['date'],'dateOffsetDays':delta,'sourceUrl':ref['sourceUrl'],**agreement(water,reference)})
  rows.append(row)
 if len(cohorts)>1:raise ValueError('A series must stay in one sensor/track/direction/frequency/maturity/CRID cohort')
 save('sites/'+sid+'/series.json',{'siteId':sid,'status':'processed; candidate water','n':len(rows),'rows':rows,'source':'NASA/ISRO NISAR via ASF DAAC','maturity':rows[0]['maturity'] if rows else 'not available','crid':rows[0]['crid'] if rows else 'not available','retrievedAt':now()})
 save('sites/'+sid+'/stats.json',{'status':'processed; validation required','n':len(rows),'waterThresholdsDb':thresholds,'thresholdMethod':'Fixed heuristic, not calibrated for site; dark soil/shadow can be false water.','validation':validation or {'status':'not available','agreement':None,'iou':None},'landCoverStatus':'computed from supplied WorldCover' if m.get('worldcover') else 'not available','maturity':rows[0]['maturity'] if rows else 'not available','crid':rows[0]['crid'] if rows else 'not available','retrievedAt':now()})
 save('observations/'+sid+'.json',package)
