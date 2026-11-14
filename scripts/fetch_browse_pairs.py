"""Download catalog-selected same-track HH/HV quicklooks; no numeric science."""
import concurrent.futures,io
from PIL import Image
from pipeline_common import *
def fetch_site(record):
 if not record.get('pair'):return
 pair=record['pair'];selected=[s for s in record['scenes'] if s['id'] in [pair['before'],pair['after']]]
 output=[]
 for scene in selected:
  item={k:v for k,v in scene.items() if k not in ['browseUrls','footprint']}
  item.update(channels={},kind='regional quicklook',retrievedAt=now())
  for pol,ending in [('HH','_NATIVE_A_HHHH.png'),('HV','_NATIVE_A_HVHV.png')]:
   url=next((u for u in scene['browseUrls'] if u.endswith(ending)),None)
   if not url:continue
   try:
    r=get(url,timeout=35);im=Image.open(io.BytesIO(r.content)).convert('L');im.thumbnail((720,720))
    relative='sites/'+record['siteId']+'/browse/'+scene['date'][:10]+'-'+pol+'.png'
    save_image(relative,im)
    item['channels'][pol]={'image':'data/'+relative,'sourceUrl':url,'label':'downsampled regional '+pol+' quicklook; not calibrated; display stretch may differ'}
   except Exception as e:item['channels'][pol]={'status':'not available','reason':type(e).__name__}
  output.append(item)
 save('sites/'+record['siteId']+'/browse/manifest.json',{'siteId':record['siteId'],'retrievedAt':now(),'n':len(output),'status':'browse only','frames':output,'warning':'Same track/frame and maturity; regional native quicklooks are not site clips. Independent display stretches cannot establish backscatter change. HDF5 layers have not been inspected.'})
 print(record['siteId'],'browse pair',len(output),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch_site,read('inventory.json')['sites']))
