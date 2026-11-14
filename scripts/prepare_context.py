"""Prepare a local context GeoTIFF as an attributed geographic map overlay.
Values are display-normalized only. No population counts or flood depths are inferred.
"""
import argparse,json,datetime as dt
from pathlib import Path
import numpy as np
from PIL import Image
from prepare_radar import DATA,ROOT,read_tiff,grid_for,warp,geographic,Resampling
p=argparse.ArgumentParser();p.add_argument('file');p.add_argument('--site',required=True,choices=['luzon','angat','dadu']);p.add_argument('--kind',choices=['landcover','population','elevation'],required=True);p.add_argument('--date',required=True);p.add_argument('--attribution',required=True);p.add_argument('--source-url',required=True);a=p.parse_args()
if not a.source_url.startswith('https://'):raise ValueError('HTTPS source URL required')
site=next(s for s in json.loads((DATA/'sites.json').read_text(encoding='utf-8')) if s['id']==a.site);grid=grid_for(site,60);native,t,crs=read_tiff(Path(a.file),1,site['bbox']);arr=geographic(warp(native,t,crs,grid,Resampling.nearest),grid,site['bbox']);valid=np.isfinite(arr)
if not valid.any():raise ValueError('No valid context pixels')
lo,hi=np.nanpercentile(arr,[2,98]);gray=np.clip((np.nan_to_num(arr,nan=lo)-lo)/max(1,hi-lo),0,1);rgba=np.zeros((*arr.shape,4),dtype='uint8');rgba[:,:,:3]=(70+gray[...,None]*160).astype('uint8');rgba[:,:,3]=valid.astype('uint8')*210
legend=f'Grayscale values {lo:.1f} to {hi:.1f}; reference display only'
if a.kind=='landcover':
    classes={10:('Trees',60),20:('Shrub',80),30:('Grass',100),40:('Cropland',125),50:('Built-up',150),60:('Bare',190),70:('Snow/ice',240),80:('Water',30),90:('Wetland',170),95:('Mangrove',210),100:('Moss/lichen',225)}
    valid=np.isin(arr,list(classes));rgba[:,:,:3]=0
    for code,(name,tone) in classes.items():rgba[arr==code,:3]=tone
    rgba[:,:,3]=valid.astype('uint8')*220
    legend='WorldCover categories (grayscale): '+', '.join(f'{code} {name}' for code,(name,tone) in classes.items())
folder=DATA/'context'/a.site;folder.mkdir(exist_ok=True);png=folder/f'{a.kind}.png';Image.fromarray(rgba).save(png)
manifest_path=DATA/'observations'/f'{a.site}.json';pkg=json.loads(manifest_path.read_text(encoding='utf-8'));layers=[l for l in pkg.get('contextLayers',[]) if l['id']!=a.kind];layers.append(dict(id=a.kind,name={'landcover':'ESA WorldCover','population':'WorldPop','elevation':'Copernicus DEM'}[a.kind],image=str(png.relative_to(ROOT/'public')).replace('\\','/'),bounds=site['bbox'],date=a.date,attribution=a.attribution,sourceUrl=a.source_url,legend=legend,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat()));pkg['contextLayers']=layers;manifest_path.write_text(json.dumps(pkg,indent=2),encoding='utf-8');print('Added attributed context overlay. Record the original product license in DATA_CREDITS.md.')
