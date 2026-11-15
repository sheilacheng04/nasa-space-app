"""Bounded expansion using the existing ASF, GIBS and ERA5 pipelines.

Stage discovery/fetch separately; publish only candidates with dated browse and
complete weather baselines. Existing sites and their downloaded evidence survive.
"""
import argparse
import concurrent.futures
import json
import datetime as dt
from pipeline_common import ROOT, DATA, read, save, now, get
from inventory_nisar import inventory_site
from fetch_browse_pairs import fetch_site
from fetch_context import weather
import fetch_gibs_nisar as gibs

STAGE = ROOT / '.artifacts/study-area-expansion.json'

def candidates():
    places = {p['id']: p for p in read('places.json')}
    rows = json.loads((ROOT / 'scripts/study-area-candidates.json').read_text())
    return [{**p, 'name': places[p['id']]['name'], 'country': places[p['id']]['country'],
             'coordinates': [places[p['id']]['lng'], places[p['id']]['lat']],
             'bbox': places[p['id']]['bounds'],
             'selectionNote': 'Existing study-place bounds; promoted only after fetched imagery and context pass the expansion gate.'} for p in rows]

def discover():
    sites = candidates()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(inventory_site, sites))
    STAGE.parent.mkdir(exist_ok=True)
    STAGE.write_text(json.dumps({'sites': sites, 'records': records}, indent=2))

def fetch():
    stage = json.loads(STAGE.read_text())
    # Reuse the reviewed advertised daily layer without rewriting existing capabilities.
    capability = read('gibs-capabilities.json')
    gibs.LAYER = capability['selectedLayer']
    server = capability['selected']
    for site, record in zip(stage['sites'], stage['records']):
        if not record.get('pair'):
            print(site['id'], 'not promoted: no compatible catalog pair', flush=True)
            continue
        pair = record['pair']
        dates = sorted({s['date'][:10] for s in record['scenes'] if s['maturity'] != 'BETA'
                        and s['track'] == pair['track'] and s['frame'] == pair['frame']})
        # Retain unfilled 12-day slots, including the mission interruption.
        day = dt.date.fromisoformat(dates[0])
        slots = set(dates)
        while day <= dt.date(2026, 11, 13):
            slots.add(day.isoformat()); day += dt.timedelta(days=12)
        manifest_path = f"sites/{site['id']}/gibs/manifest.json"
        previous = {f['date']: f for f in read(manifest_path)['frames']} if (DATA / manifest_path).exists() else {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            frames = list(pool.map(lambda date: previous.get(date) or gibs.fetch_one(site, date, server), sorted(slots)))
        save(manifest_path, {
            'siteId': site['id'], 'retrievedAt': now(), 'source': 'NASA GIBS / NASA–ISRO NISAR',
            'layer': gibs.LAYER, 'mode': 'daily mosaic',
            'note': 'TIME identifies the requested daily mosaic, not pixel acquisition time. Pixel maturity and CRID are unavailable. False color, not calibrated.',
            'frames': frames, 'available': sum(f['status'] == 'ready' for f in frames)})
        print(site['id'], 'GIBS', sum(f['status'] == 'ready' for f in frames), '/', len(frames), flush=True)
        if not (DATA / f"sites/{site['id']}/browse/manifest.json").exists(): fetch_site(record)
        if not (DATA / f"context/{site['id']}.json").exists(): weather(site)

def publish():
    stage = json.loads(STAGE.read_text())
    sites, inventory, places = read('sites.json'), read('inventory.json'), read('places.json')
    existing = {s['id'] for s in sites}
    for site, record in zip(stage['sites'], stage['records']):
        sid = site['id']
        if sid in existing:
            continue
        frames = read(f'sites/{sid}/gibs/manifest.json')
        browse = read(f'sites/{sid}/browse/manifest.json')
        climate = read(f'context/{sid}.json')
        usable_browse = [f for f in browse['frames'] if all(f.get('channels', {}).get(p, {}).get('image') for p in ['HH', 'HV'])]
        if frames['available'] < 2 or len(usable_browse) < 2 or len(climate['baselineMonthly']) != 12 or not all(b['nYears'] == 30 for b in climate['baselineMonthly']) or not climate['monthly']:
            raise ValueError(f'{sid}: incomplete imagery or weather; not published')
        site.update(coverageStatus=record['status'], sceneCount=record['n'])
        sites.append(site)
        inventory['sites'].append(record)
        for place in places:
            if place['id'] == sid:
                place.update(siteId=sid, hasRadarFrames=True)
        print('Promoted', sid, flush=True)
    save('sites.json', sites)
    save('inventory.json', inventory)
    save('places.json', places)
    coverage = read('nisar/places-coverage.json')
    for site in sites:
        sid = site['id']
        site['savedFrameCount'] = read(f'sites/{sid}/gibs/manifest.json')['available']
        if sid in {s['id'] for s in stage['sites']}:
            coverage[sid].update(hasSavedFrames=True, asfApiReachable=True,
                                 asfProbeNote='ASF catalog, regional HH/HV browse and dated NASA GIBS crops verified during study-area expansion.')
    save('sites.json', sites)
    save('nisar/places-coverage.json', coverage)

def news():
    """Query the existing headline provider; never manufacture local matches."""
    import hashlib
    import re
    from news_sentiment import merge, OVERRIDES
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    from build_places_and_news import build_news_by_place, match_headline_to_place
    queries = {'cagayan-valley': '("Cagayan Valley" OR Magat) (rain OR flood OR water OR rice)',
               'mekong-delta': '"Mekong Delta" (rain OR flood OR water OR rice)',
               'guayas-babahoyo': '(Guayas OR Babahoyo) (rain OR flood OR water OR agriculture)'}
    places = {p['id']: p for p in read('places.json')}
    audit, added = [], []
    for sid, query in queries.items():
        params = dict(query=query+' sourcelang:english', mode='artlist', format='json',
                      startdatetime='20260815000000', enddatetime='20261114000000', maxrecords=25, sort='datedesc')
        row = dict(siteId=sid, url='https://api.gdeltproject.org/api/v2/doc/doc', parameters=params, retrievedAt=now())
        try:
            response=get(row['url'], params, 25); row['url']=response.url
            articles=response.json().get('articles', [])
            row.update(status='ready', returned=len(articles))
            for article in articles:
                url=article.get('url', '')
                if not url.startswith('https://'): continue
                item=dict(id=hashlib.sha256(url.encode()).hexdigest()[:16], title=article['title'],
                          source=article.get('domain', 'Source'), url=url,
                          date=dt.datetime.strptime(article['seendate'], '%Y%m%dT%H%M%SZ').date().isoformat(),
                          theme='Climate reporting', region=article.get('sourcecountry', 'Unclassified'),
                          verification='GDELT discovery; date is first seen, claims not independently verified', ai=None)
                topical = re.search(r'\b(rain\w*|flood\w*|drought\w*|water|irrigat\w*|climate|salinity|river|weather|El Ni[nñ]o)\b', item['title'], re.I)
                if topical and '2026-08-15'<=item['date']<'2026-11-14' and match_headline_to_place(item, places[sid]) in ['place-name','query']:
                    added.append(item)
        except Exception as error:
            row.update(status='not available', reason=type(error).__name__+': '+str(error)[:180])
        audit.append(row);print(sid, 'news', row['status'], row.get('returned',0), flush=True)
    archive=read('news.json')
    if added:
        raw=SentimentIntensityAnalyzer();adjusted=SentimentIntensityAnalyzer();adjusted.lexicon.update(OVERRIDES)
        for item in added:
            item.update(vader=raw.polarity_scores(item['title'])['compound'], vaderAdjusted=adjusted.polarity_scores(item['title'])['compound'])
        archive['items']=merge(archive['items'],added);archive['retrievedAt']=now()
        save('news.json',archive);build_news_by_place(list(places.values()))
    save('study-area-news-audit.json', {'retrievedAt':now(),'requests':audit,'matchedRecords':len(added)})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['discover', 'fetch', 'publish', 'news'])
    args = parser.parse_args()
    globals()[args.stage]()
