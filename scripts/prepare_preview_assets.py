"""Create small, downsampled versions of real imagery for the offline HTML."""
import base64,io,json
from PIL import Image
from pipeline_common import *
def main():
 assets={};selected={}
 for site in read('sites.json'):
  sid=site['id'];e=read('sites/'+sid+'/evidence.json')
  paths=[('data/sites/'+sid+'/thumbnail.png',240)]
  g=[f for f in e['gibs']['frames'] if f.get('image')]
  chosen=[g[0],g[-1]] if g else []
  selected[sid]=[f['image'] for f in chosen]
  paths.extend((f['image'],224) for f in chosen)
  for f in e['browse']['frames']:
   paths.extend((v['image'],160) for v in f.get('channels',{}).values() if v.get('image'))
  for name,size in paths:
   original=DATA/name.removeprefix('data/')
   if not original.exists():continue
   im=Image.open(original);im.thumbnail((size,size))
   if im.mode in ['RGB','RGBA']:im=im.convert('RGBA').quantize(colors=96,method=Image.Quantize.FASTOCTREE)
   memory=io.BytesIO();im.save(memory,format='PNG',optimize=True)
   assets[name]='data:image/png;base64,'+base64.b64encode(memory.getvalue()).decode()
 budget=sum(len(v) for v in assets.values())
 if budget>1000000:raise ValueError('Embedded real image data-URI budget exceeded')
 folder=ROOT/'.artifacts';folder.mkdir(exist_ok=True)
 (folder/'preview-assets.json').write_text(json.dumps({'assets':assets,'selected':selected,'bytes':budget}),encoding='utf-8')
 print('Offline real-image data URIs:',len(assets),'bytes:',budget)
if __name__=='__main__':main()
