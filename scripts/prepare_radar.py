"""Prepare a reviewed manifest of GCOV/RTC/DSWx acquisitions for the web app.
Never infers sensor metadata, mask meanings, or cross-sensor comparability.
Usage: python scripts/prepare_radar.py raw/manifest.json
"""
import argparse,datetime as dt,hashlib,json,math,re
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_origin,from_bounds
from rasterio.warp import transform_bounds,reproject,Resampling
from rasterio.windows import from_bounds as window_from_bounds
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'public/data'
CHANNELS={'HH':'HHHH','HV':'HVHV','VV':'VVVV','VH':'VHVH'}

def hash_file(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
    return h.hexdigest()

def power_db(power):
    output=np.full(power.shape,np.nan,dtype='float32');valid=np.isfinite(power)&(power>0)
    np.log10(power,out=output,where=valid);output[valid]*=10
    return output

def paired_change(before,after):
    valid=np.isfinite(before)&np.isfinite(after)
    result=np.where(valid,after-before,np.nan).astype('float32')
    return result,{'meanDeltaDb':float(np.mean(result[valid])) if valid.any() else None,'validFraction':float(valid.mean())}

def cohort(a):return tuple(a[k] for k in ['sensor','track','direction','frequency','maturity','processingVersion'])
def compatible(a,b):return cohort(a)==cohort(b) and a.get('frame')==b.get('frame') and a['date']<b['date']
def scalar(ds):
    v=ds[()]
    return v.decode() if isinstance(v,bytes) else v.item() if hasattr(v,'item') else v

def read_gcov(path,frequency,channel,bbox,mask_values):
    import h5py
    if not mask_values:raise ValueError('GCOV requires reviewed validMaskValues from product mask metadata. Inspect the file first.')
    with h5py.File(path,'r') as f:
        g=f[f'/science/LSAR/GCOV/grids/frequency{frequency}']
        if CHANNELS[channel] not in g:return None
        xs,ys=g['xCoordinates'],g['yCoordinates'];dx=float(scalar(g['xCoordinateSpacing']));dy=float(scalar(g['yCoordinateSpacing']))
        if dx<=0 or dy>=0:raise ValueError('Unsupported grid orientation; expect eastward columns and southward rows')
        transform=from_origin(float(xs[0])-dx/2,float(ys[0])-dy/2,dx,-dy);crs=f'EPSG:{int(scalar(g["projection"]))}'
        left,bottom,right,top=transform_bounds('EPSG:4326',crs,*bbox,densify_pts=21)
        win=window_from_bounds(left,bottom,right,top,transform=transform).round_offsets().round_lengths()
        r0=max(0,int(win.row_off));c0=max(0,int(win.col_off));r1=min(len(ys),int(win.row_off+win.height)+2);c1=min(len(xs),int(win.col_off+win.width)+2)
        if r1<=r0 or c1<=c0:raise ValueError('Scene does not intersect study area')
        units=g[CHANNELS[channel]].attrs.get('units','')
        if isinstance(units,bytes):units=units.decode()
        if str(units).lower() not in ['1','unitless','linear','linear power','db']:raise ValueError('Unknown GCOV units; inspect HDF5 attributes before conversion')
        if 'rtcGammaToSigmaFactor' not in g or 'numberOfLooks' not in g:raise ValueError('Required RTC factor / looks metadata missing')
        data=np.array(g[CHANNELS[channel]][r0:r1,c0:c1],dtype='float32')
        if str(units).lower()=='db':data=10**(data/10)
        mask=np.array(g['mask'][r0:r1,c0:c1]);valid=np.isin(mask,mask_values)&np.isfinite(data)&(data>0)
        if 'numberOfLooks' in g:valid&=g['numberOfLooks'][r0:r1,c0:c1]>0
        data[~valid]=np.nan
        t=rasterio.windows.transform(rasterio.windows.Window(c0,r0,c1-c0,r1-r0),transform)
        return data,t,crs

def read_tiff(path,band,bbox):
    with rasterio.open(path) as src:
        if not src.crs:raise ValueError('GeoTIFF has no CRS')
        bounds=transform_bounds('EPSG:4326',src.crs,*bbox,densify_pts=21)
        win=window_from_bounds(*bounds,transform=src.transform).round_offsets().round_lengths()
        try:win=win.intersection(rasterio.windows.Window(0,0,src.width,src.height))
        except rasterio.errors.WindowError:raise ValueError('Raster does not intersect study area')
        arr=src.read(band,window=win,masked=True).astype('float32').filled(np.nan)
        return arr,src.window_transform(win),src.crs

def warp(arr,transform,crs,grid,resampling=Resampling.average):
    out=np.full((grid['height'],grid['width']),np.nan,dtype='float32')
    reproject(arr,out,src_transform=transform,src_crs=crs,src_nodata=np.nan,dst_transform=grid['transform'],dst_crs=grid['crs'],dst_nodata=np.nan,resampling=resampling)
    return out

def grid_for(site,resolution):
    zone=int((site['coordinates'][0]+180)//6)+1;epsg=(32600 if site['coordinates'][1]>=0 else 32700)+zone
    l,b,r,t=transform_bounds('EPSG:4326',f'EPSG:{epsg}',*site['bbox'],densify_pts=21)
    l=math.floor(l/resolution)*resolution;b=math.floor(b/resolution)*resolution;r=math.ceil(r/resolution)*resolution;t=math.ceil(t/resolution)*resolution
    width=int(round((r-l)/resolution));height=int(round((t-b)/resolution))
    if width*height>40000000:raise ValueError('Output exceeds 40 million pixels; increase resolution_m or reduce AOI')
    return dict(crs=f'EPSG:{epsg}',transform=from_origin(l,t,resolution,resolution),width=width,height=height)

def write_cog(path,arr,grid):
    with rasterio.open(path,'w',driver='COG',height=grid['height'],width=grid['width'],count=1,dtype='float32',crs=grid['crs'],transform=grid['transform'],nodata=np.nan,compress='DEFLATE',blocksize=256) as dst:dst.write(arr,1)

def geographic(arr,grid,bbox):
    width=900;height=max(180,min(1200,round(width*(bbox[3]-bbox[1])/(bbox[2]-bbox[0]))))
    dest=dict(crs='EPSG:4326',transform=from_bounds(*bbox,width,height),width=width,height=height)
    return warp(arr,grid['transform'],grid['crs'],dest,Resampling.nearest)

def save_png(path,array,grid,bbox,kind='db'):
    arr=geographic(array,grid,bbox);valid=np.isfinite(arr);rgba=np.zeros((*arr.shape,4),dtype='uint8')
    clean=np.nan_to_num(arr,nan=-35)
    if kind=='change':
        gray=(np.clip((clean+6)/12,0,1)*255).astype('uint8');rgba[:,:,:3]=gray[...,None]
    elif kind=='water':rgba[:,:,:3]=np.where((clean>0)[...,None],np.array([30,97,125]),np.array([235,232,223]))
    elif kind=='ratio':rgba[:,:,:3]=(np.clip(clean/20,0,1)*255).astype('uint8')[...,None]
    else:
        gray=(np.clip((clean+35)/35,0,1)*255).astype('uint8');rgba[:,:,:3]=gray[...,None]
    rgba[:,:,3]=valid.astype('uint8')*255;Image.fromarray(rgba).save(path)

def validate_entry(a):
    required=['id','date','sensor','track','direction','frequency','maturity','processingVersion','sourceUrl','kind']
    for key in required:
        if not isinstance(a.get(key),str) or not a[key].strip() or 'REPLACE' in a[key] or 'ACTUAL_' in a[key]:raise ValueError(f'Missing string metadata: {key}')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',a['id']):raise ValueError('Invalid acquisition id')
    dt.date.fromisoformat(a['date'])
    if a['kind'] in ['gcov','gcov-subset'] and not a.get('unitsAndMasksReviewed'):raise ValueError('Set unitsAndMasksReviewed only after inspecting actual HDF5 units, mask flags, numberOfLooks and RTC factor')
    if a['kind'] in ['gcov','gcov-subset'] and not a.get('frame'):raise ValueError('A real GCOV frame is required')
    if not a['sourceUrl'].startswith('https://'):raise ValueError('sourceUrl must be HTTPS')
    if a['kind'] not in ['gcov','gcov-subset','rtc','water']:raise ValueError('kind must be gcov, rtc or water')
    if a['kind'] in ['gcov','gcov-subset'] and (a['sensor']!='NISAR' or a['frequency'] not in ['A','B']):raise ValueError('GCOV requires sensor NISAR and frequency A or B')
    if a['kind'] in ['rtc','gcov-subset'] and a.get('units') not in ['linear_power','dB']:raise ValueError('RTC input units must be explicit: linear_power or dB')
    if a['kind']=='gcov-subset' and (not a.get('validMaskValues') or not all(k in a.get('metadataLayers',{}) for k in ['mask','numberOfLooks','rtcGammaToSigmaFactor'])):raise ValueError('Harmony subsets require reviewed mask values and all three metadata raster paths')
    if a['kind']=='water' and (not a.get('waterClasses') or not a.get('validClasses')):raise ValueError('Water imports require explicit waterClasses and validClasses')

def prepare(manifest_path):
    manifest_path=Path(manifest_path).resolve();manifest=json.loads(manifest_path.read_text(encoding='utf-8'));sites=json.loads((DATA/'sites.json').read_text(encoding='utf-8'));site=next((s for s in sites if s['id']==manifest['siteId']),None)
    if not site:raise ValueError('Unknown study area')
    entries=manifest.get('acquisitions',[])
    if not entries:raise ValueError('No acquisitions provided; pending observations remain untouched')
    for a in entries:validate_entry(a)
    if len(set(a['id'] for a in entries))!=len(entries):raise ValueError('Duplicate acquisition IDs')
    resolution=float(manifest.get('resolution_m',30))
    if not 10<=resolution<=500:raise ValueError('Output pixel spacing must be 10 to 500 m')
    grid=grid_for(site,resolution);west,south,east,north=site['bbox'];aoi={'type':'Polygon','coordinates':[[[west,south],[east,south],[east,north],[west,north],[west,south]]]};aoi_mask=geometry_mask([transform_geom('EPSG:4326',grid['crs'],aoi)],out_shape=(grid['height'],grid['width']),transform=grid['transform'],invert=True);folder=DATA/'rasters'/site['id']/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%f');folder.mkdir(parents=True,exist_ok=True)
    acquisitions=[];arrays={};artifact=lambda p:str(p.relative_to(ROOT/'public')).replace('\\','/')
    for entry in sorted(entries,key=lambda a:a['date']):
        paths=entry.get('channels',{}) if entry['kind'] in ['rtc','gcov-subset'] else {p:entry['path'] for p in (CHANNELS if entry['kind']=='gcov' else ['water'])}
        item={k:entry[k] for k in ['id','date','sensor','track','direction','frequency','maturity','processingVersion','sourceUrl']};item.update(frame=entry.get('frame'),hdf5LayersVerified=entry['kind'] in ['gcov','gcov-subset'],bounds=site['bbox'],channels={},resolutionM=resolution,inputHashes={},maskPolicy={'validMaskValues':entry.get('validMaskValues'),'validClasses':entry.get('validClasses'),'waterClasses':entry.get('waterClasses')})
        for channel,rel in paths.items():
            path=(manifest_path.parent/rel).resolve()
            if channel not in list(CHANNELS)+['water']:raise ValueError(f'Unsupported channel {channel}')
            if not path.is_file():raise ValueError(f'Missing input: {path.name}')
            if path.name not in item['inputHashes']:item['inputHashes'][path.name]=hash_file(path)
            native=read_gcov(path,entry['frequency'],channel,site['bbox'],entry.get('validMaskValues')) if entry['kind']=='gcov' else read_tiff(path,int(entry.get('band',1)),site['bbox'])
            if native is None:continue
            arr,transform,crs=native
            if entry['kind']=='gcov-subset':
                layers={}
                for name,relative in entry['metadataLayers'].items():
                    layer,lt,lc=read_tiff((manifest_path.parent/relative).resolve(),1,site['bbox'])
                    if layer.shape!=arr.shape or lt!=transform or lc!=crs:raise ValueError('Harmony science and quality layers must use identical grids')
                    layers[name]=layer
                valid=np.isin(layers['mask'],entry['validMaskValues'])&np.isfinite(layers['numberOfLooks'])&(layers['numberOfLooks']>0)&np.isfinite(layers['rtcGammaToSigmaFactor'])&(layers['rtcGammaToSigmaFactor']>0)
                arr[~valid]=np.nan
            if entry['kind']=='water':arr=np.where(np.isin(arr,entry['validClasses']),np.isin(arr,entry['waterClasses']).astype('float32'),np.nan);out=warp(arr,transform,crs,grid,Resampling.nearest)
            else:
                if entry['kind'] in ['rtc','gcov-subset'] and entry['units']=='dB':arr=np.where(np.isfinite(arr),10**(arr/10),np.nan)
                arr=np.where(arr>0,arr,np.nan);out=power_db(warp(arr,transform,crs,grid))
            out[~aoi_mask]=np.nan
            valid=np.isfinite(out)
            if not valid.any():raise ValueError(f'{entry["id"]}/{channel}: no valid study-area pixels')
            prefix=f'{entry["id"]}-{channel}';tif=folder/f'{prefix}.tif';png=folder/f'{prefix}.png';write_cog(tif,out,grid);save_png(png,out,grid,site['bbox'],'water' if channel=='water' else 'db')
            item['channels'][channel]={'image':artifact(png),'cog':artifact(tif),'meanDb':float(np.mean(out[valid])) if channel!='water' else None,'validFraction':float(valid.sum()/aoi_mask.sum()),'displayRangeDb':[-35,0] if channel!='water' else None}
            if channel=='water':item['channels'][channel]['waterAreaKm2']=float(np.sum(out==1)*resolution**2/1e6)
            arrays[(entry['id'],channel)]=out
        if not item['channels']:raise ValueError('No supported channels in acquisition')
        if all(p in item['channels'] for p in ['HH','HV']):
            hh=geographic(arrays[(entry['id'],'HH')],grid,site['bbox']);hv=geographic(arrays[(entry['id'],'HV')],grid,site['bbox']);valid=np.isfinite(hh)&np.isfinite(hv);rgb=np.stack([np.clip((hh+35)/35,0,1),np.clip((hv+35)/35,0,1),np.clip((hh-hv)/20,0,1)],axis=-1);rgba=np.concatenate([(np.nan_to_num(rgb)*255).astype('uint8'),(valid*255).astype('uint8')[...,None]],axis=-1);png=folder/f'{entry["id"]}-composite.png';Image.fromarray(rgba).save(png);item['channels']['composite']={'image':artifact(png),'meanDb':None,'definition':'R HH (-35..0 dB), G HV (-35..0 dB), B HH/HV ratio (0..20 dB)'}
        acquisitions.append(item)
    comparisons=[]
    for i,a in enumerate(acquisitions):
        for b in acquisitions[i+1:]:
            if not compatible(a,b):continue
            for channel in set(a['channels'])&set(b['channels'])&set(CHANNELS):
                delta,stats=paired_change(arrays[(a['id'],channel)],arrays[(b['id'],channel)])
                if stats['meanDeltaDb'] is None:continue
                stats['validFraction']=float(np.count_nonzero(np.isfinite(delta))/np.count_nonzero(aoi_mask))
                prefix=f'{a["id"]}--{b["id"]}-{channel}-change';png=folder/f'{prefix}.png';tif=folder/f'{prefix}.tif';save_png(png,delta,grid,site['bbox'],'change');write_cog(tif,delta,grid);comparisons.append(dict(before=a['id'],after=b['id'],channel=channel,image=artifact(png),cog=artifact(tif),displayRangeDb=[-6,6],**stats))
    path=DATA/'observations'/f'{site["id"]}.json';old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {};package=dict(schemaVersion=1,siteId=site['id'],status='ready',retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),acquisitions=acquisitions,comparisons=comparisons,contextLayers=old.get('contextLayers',[]),processing={'script':'prepare_radar.py','resolutionM':resolution,'resampling':'linear power average, then log10; nearest for masks and categorical water','nodata':'NaN; transparent display','reviewRequired':'Check masks, calibration, geometry and uncertainty before making a scientific claim.'})
    if old.get('browse'):package['browse']=old['browse']
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(package,indent=2,allow_nan=False),encoding='utf-8');temp.replace(path)
    print(f'Prepared {len(acquisitions)} acquisitions and {len(comparisons)} comparable channel pairs for {site["name"]}.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('manifest');args=parser.parse_args();prepare(args.manifest)
