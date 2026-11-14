"""Refresh public context and real NISAR browse snapshots; retain last good files on failure."""
import argparse,datetime as dt,json,time,urllib.request,urllib.parse,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public/data'
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass
HEADERS={'User-Agent':'TwoFacedPacific-SpaceApps/1.0 (educational data snapshot)'}
def retrieve(url,kind='json',timeout=25):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=timeout) as response:
        body=response.read(12000000)
        print(f'HTTP {response.status}; CORS={response.headers.get("Access-Control-Allow-Origin","not advertised")}; {urllib.parse.urlsplit(url).netloc}')
    return json.loads(body) if kind=='json' else body

def save(path,payload):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(payload,indent=2,ensure_ascii=False,allow_nan=False),encoding='utf-8')
    temp.replace(path)

def refresh_weather(site,end):
    start=end-dt.timedelta(days=59)
    query=urllib.parse.urlencode(dict(latitude=site['coordinates'][1],longitude=site['coordinates'][0],start_date=start.isoformat(),end_date=end.isoformat(),daily='temperature_2m_mean,precipitation_sum',models='era5',timezone='UTC'))
    url='https://archive-api.open-meteo.com/v1/archive?'+query
    r=retrieve(url);daily=r['daily']
    if not daily.get('time'):raise ValueError('Empty weather response')
    output={'status':'ready','retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':'Open-Meteo / ECMWF ERA5 reanalysis','url':url,'model':'ERA5','units':{'temperature':'C','rain':'mm/day'},'daily':[dict(date=date,temperature=daily['temperature_2m_mean'][i],rain=daily['precipitation_sum'][i]) for i,date in enumerate(daily['time'])]}
    save(DATA/'context'/f'{site["id"]}.json',output)

def refresh_browse(site,end):
    query=urllib.parse.urlencode(dict(dataset='NISAR',processingLevel='GCOV',bbox=','.join(map(str,site['bbox'])),start='2026-10-21',end=end.isoformat(),output='geojson',maxResults=3))
    url='https://api.daac.asf.alaska.edu/services/search/param?'+query
    result=retrieve(url)
    candidates=[f for f in result.get('features',[]) if any('_NATIVE_A_HHHH.png' in u for u in f['properties'].get('browse',[]))]
    if not candidates:raise ValueError('No HH browse in returned scenes')
    feature=sorted(candidates,key=lambda f:f['properties'].get('startTime',''))[-1];p=feature['properties'];image_url=next(u for u in p['browse'] if '_NATIVE_A_HHHH.png' in u)
    image=retrieve(image_url,'bytes')
    if not image.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Browse response is not PNG')
    folder=DATA/'browse';folder.mkdir(exist_ok=True);image_path=folder/f'{site["id"]}-hh.png';image_path.write_bytes(image)
    save(folder/f'{site["id"]}-catalog.json',{'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'queryUrl':url,'feature':feature})
    package_path=DATA/'observations'/f'{site["id"]}.json';package=json.loads(package_path.read_text(encoding='utf-8'))
    package['browse']={'image':f'data/browse/{site["id"]}-hh.png','date':p.get('startTime'),'sourceUrl':url,'imageSourceUrl':image_url,'sceneId':p.get('sceneName'),'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'interpretation':'Regional contrast-stretched HH quicklook; not a clipped or quantitative site measurement.'}
    save(package_path,package)

CLIMATE_OVERRIDES={'warm':0.0,'warming':0.0,'positive':0.0,'negative':0.0,'record':0.0,'records':0.0,'anomaly':0.0,'anomalies':0.0}
def score_news(items):
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    raw=SentimentIntensityAnalyzer();adjusted=SentimentIntensityAnalyzer();adjusted.lexicon.update(CLIMATE_OVERRIDES)
    for n in items:
        n['vader']=raw.polarity_scores(n['title'])['compound'];n['vaderAdjusted']=adjusted.polarity_scores(n['title'])['compound']
    return items

def refresh_news(fetch=True):
    path=DATA/'news.json';cached=json.loads(path.read_text(encoding='utf-8'))
    if fetch:
        query=urllib.parse.urlencode({'query':'("El Nino" OR "El Niño" OR NISAR) sourcelang:english','mode':'artlist','format':'json','timespan':'7d','maxrecords':100,'sort':'datedesc'})
        try:
            data=retrieve('https://api.gdeltproject.org/api/v2/doc/doc?'+query)
            articles=data.get('articles',[])
            if not articles:raise ValueError('No articles returned; archive retained')
            seen=set();items=[]
            for a in articles:
                url=a.get('url','')
                if not url.startswith('https://') or url in seen:continue
                seen.add(url);stamp=a.get('seendate','')
                date=dt.datetime.strptime(stamp,'%Y%m%dT%H%M%SZ').date().isoformat()
                items.append(dict(id=str(len(items)),date=date,title=a['title'],url=url,source=a.get('domain','Source'),region=a.get('sourcecountry','Unclassified'),theme='Climate reporting',vader=None,vaderAdjusted=None,ai=None,verification='GDELT discovery; source claim not independently verified'))
            cached={'status':'snapshot','retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':'GDELT DOC 2.0','queryUrl':'https://api.gdeltproject.org/api/v2/doc/doc?'+query,'items':items}
        except Exception as error:print(f'GDELT refresh failed; retained cached news: {error}')
    try:
        cached['items']=score_news(cached['items']);cached['sentimentMethod']={'package':'vaderSentiment 3.3.2','climateOverrides':CLIMATE_OVERRIDES,'warning':'Project heuristic. Raw and adjusted scores are separate; neither measures risk or public opinion.'}
    except ImportError:print('Install vaderSentiment to compute scores; previous scores retained.')
    save(path,cached)

def refresh_oni():
    url='https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';text=retrieve(url,'bytes').decode();rows=[]
    for line in text.splitlines()[1:]:
        parts=line.split()
        if len(parts)==4 and int(parts[1])>=2024:rows.append({'season':parts[0],'year':int(parts[1]),'anomaly':float(parts[3])})
    if not rows:raise ValueError('No valid ONI rows')
    path=DATA/'enso.json';data=json.loads(path.read_text(encoding='utf-8'));data['oni']=rows;data['oniSource']=url;data['oniRetrievedAt']=dt.datetime.now(dt.timezone.utc).isoformat();save(path,data)
    # The manually reviewed advisory is intentionally not overwritten with an inferred index.

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--end',type=dt.date.fromisoformat,default=dt.date.today()-dt.timedelta(days=7));parser.add_argument('--browse',action='store_true');parser.add_argument('--news-only',action='store_true');parser.add_argument('--score-only',action='store_true');args=parser.parse_args()
    if args.score_only:refresh_news(False);return
    if not args.news_only:
        sites=json.loads((DATA/'sites.json').read_text(encoding='utf-8'))
        for site in sites:
            try:refresh_weather(site,args.end)
            except Exception as error:print(f'{site["id"]}: weather unavailable, snapshot retained: {error}')
            if args.browse:
                try:refresh_browse(site,args.end+dt.timedelta(days=7))
                except Exception as error:print(f'{site["id"]}: browse unavailable: {error}')
        try:refresh_oni()
        except Exception as error:print(f'ONI unavailable, snapshot retained: {error}')
    refresh_news()
if __name__=='__main__':main()
