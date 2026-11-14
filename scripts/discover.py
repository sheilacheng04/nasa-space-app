"""Discover scenes; downloads only with explicit --download and Earthdata authentication."""
import argparse,json,datetime as dt
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--site',choices=['luzon','angat','dadu'],required=True);parser.add_argument('--start',required=True);parser.add_argument('--end',required=True);parser.add_argument('--source',choices=['nisar','sentinel','opera'],default='nisar');parser.add_argument('--maturity',choices=['VALIDATED','PROVISIONAL','BETA'],default='VALIDATED');parser.add_argument('--download',action='store_true');args=parser.parse_args()
    start=dt.date.fromisoformat(args.start);end=dt.date.fromisoformat(args.end)
    if end<start:raise ValueError('End date precedes start')
    site=next(s for s in json.loads((ROOT/'public/data/sites.json').read_text(encoding='utf-8')) if s['id']==args.site);l,b,r,t=site['bbox'];folder=ROOT/'raw'/args.site;folder.mkdir(parents=True,exist_ok=True)
    if args.source=='opera':
        import earthaccess
        results=earthaccess.search_data(short_name='OPERA_L3_DSWX-S1_V1',bounding_box=tuple(site['bbox']),temporal=(args.start,args.end),count=100)
        (folder/'opera-search.json').write_text(json.dumps([dict(x) for x in results],indent=2,default=str),encoding='utf-8')
        if args.download:earthaccess.login();earthaccess.download(results,str(folder/'opera'))
    else:
        import asf_search as asf
        polygon=f'POLYGON(({l} {b},{r} {b},{r} {t},{l} {t},{l} {b}))';options=dict(intersectsWith=polygon,start=args.start,end=args.end,maxResults=100)
        options.update(dict(dataset='NISAR',processingLevel='GCOV',dataMaturity=args.maturity) if args.source=='nisar' else dict(platform='Sentinel-1',processingLevel='GRD_HD'))
        results=asf.search(**options);(folder/f'{args.source}-search.geojson').write_text(json.dumps(results.geojson(),indent=2),encoding='utf-8')
        if args.download:
            import getpass
            username=input('Earthdata username: ');password=getpass.getpass('Earthdata password (not stored): ');session=asf.ASFSession().auth_with_creds(username,password);dest=folder/args.source;dest.mkdir(exist_ok=True);results.download(path=str(dest),session=session)
    print(f'{len(results)} matching products. Inspect metadata, quality, footprint and channels before selecting dates.')
    if args.source=='sentinel':print('GRD discovery is not RTC processing. Use ASF HyP3 or another documented RTC workflow before importing GeoTIFFs.')
if __name__=='__main__':main()
