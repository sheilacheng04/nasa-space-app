"""List GCOV grids, metadata and mask flags without reading full scenes."""
import argparse,json
import h5py
from prepare_radar import scalar
p=argparse.ArgumentParser();p.add_argument('file');a=p.parse_args()
with h5py.File(a.file,'r') as f:
    for key in ['/science/LSAR/identification','/science/LSAR/GCOV/grids']:
        if key not in f:continue
        def visit(name,obj):
            if isinstance(obj,h5py.Dataset):
                out={'path':key+'/'+name,'shape':obj.shape,'dtype':str(obj.dtype),'attributes':{k:str(v) for k,v in obj.attrs.items()}}
                if obj.size<=20:out['value']=str(obj[()])
                print(json.dumps(out,ensure_ascii=False))
        f[key].visititems(visit)
