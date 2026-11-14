"""Bounded ASF/CMR acquisition audit. Metadata only; never updates curated evidence.
Run --replay SNAPSHOT/sources to reproduce without network. No credential handling.
"""
import argparse
import collections
import datetime as dt
import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlencode, urlsplit

import requests
from shapely.geometry import Point, box, shape

ROOT = Path(__file__).resolve().parents[1]
ASF = 'https://api.daac.asf.alaska.edu/services/search/param'
CMR = 'https://cmr.earthdata.nasa.gov/search/'
DOC = 'https://nisar-docs.asf.alaska.edu/availability-overview/'
GAP = ('2026-07-27T22:03:25Z', '2026-08-10T00:55:27Z')
LEVELS = {'GCOV': 'L2', 'GSLC': 'L2', 'RSLC': 'L1'}
COLLECTIONS = {f'NISAR_{level}_{kind}{suffix}_V1': (kind, maturity)
               for kind, level in LEVELS.items()
               for suffix, maturity in [('_BETA', 'BETA'), ('_PROVISIONAL', 'PROVISIONAL'), ('', 'VALIDATED')]}


def instant(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('An explicit UTC offset is required')
    return parsed.astimezone(dt.timezone.utc)


def utc(value):
    return instant(value).isoformat().replace('+00:00', 'Z')


def time_agrees(coarse, precise):
    a, b = instant(coarse), instant(precise)
    return a == b or '.' not in coarse and a == b.replace(microsecond=0)


def now():
    return utc(dt.datetime.now(dt.timezone.utc).isoformat())


def digest(value):
    return hashlib.sha256(value).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False)+'\n', encoding='utf-8')
    temp.replace(path)


class Sources:
    """Immutable request receipts; bounded responses, no science downloads."""
    def __init__(self, directory, replay=False):
        self.directory, self.replay, self.memo = Path(directory), replay, {}
        self.directory.mkdir(parents=True, exist_ok=True)

    def get(self, key, url, parameters=None, method='GET'):
        if key in self.memo:
            return self.memo[key]
        path = self.directory / (key+'.json.gz')
        if self.replay:
            result = json.loads(gzip.decompress(path.read_bytes()))
            if result['request'] != {'url': url, 'parameters': parameters or {}, 'method': method}:
                raise ValueError('Replay request mismatch: '+key)
        else:
            result = {'request': {'url': url, 'parameters': parameters or {}, 'method': method}, 'retrievedAt': now()}
            try:
                with requests.request('GET' if method=='GET_RANGE' else method, url, params=parameters, timeout=(10, 40),
                                      allow_redirects=False if method=='HEAD' else True, stream=True,
                                      headers={'User-Agent': 'TwoFacedPacific-AcquisitionAudit/1.0', **({'Range':'bytes=0-63'} if method=='GET_RANGE' else {})}) as response:
                    result['httpStatus'] = response.status_code
                    if method == 'GET_RANGE':
                        result.update(status='checked', redirectHost=urlsplit(response.url).hostname, requestedRange='bytes=0-63', bytesRead=0)
                        if response.status_code==206 and response.headers.get('Content-Range','').startswith('bytes 0-63/'):
                            sample=response.raw.read(64);result.update(bytesRead=len(sample),hdf5Signature=sample.startswith(b'\x89HDF\r\n\x1a\n'))
                    elif method == 'HEAD':
                        result.update(status='checked', redirectHost=urlsplit(response.headers.get('Location', '')).hostname)
                    else:
                        response.raise_for_status()
                        chunks, size = [], 0
                        for part in response.iter_content(65536):
                            size += len(part)
                            if size > 16_000_000:
                                raise ValueError('Metadata response exceeds 16 MB limit')
                            chunks.append(part)
                        body = b''.join(chunks)
                        result.update(status='retrieved', bodySha256=digest(body),
                                      data=json.loads(body) if url != DOC else None)
                        if url == DOC:
                            text = body.decode('utf-8')
                            result['documentChecks'] = {word: word in text for word in [
                                'November 6, 2026', 'October 21, 2026', 'June 17, 2026',
                                *GAP, '2027', 'P05036', 'P05023']}
            except (requests.RequestException, ValueError) as error:
                result.update(status='request_failed', errorType=type(error).__name__)
            path.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, allow_nan=False).encode(), mtime=0))
        self.memo[key] = result
        return result


def acquisition_key(row):
    fields = ['date', 'track', 'frame', 'direction']
    if any(row.get(k) is None for k in fields):
        raise ValueError('Acquisition identity incomplete')
    return '|'.join([utc(row['date']), str(row['track']), str(row['frame']), row['direction']])


def normalize(feature, site):
    p = feature['properties']; sid = p['sceneName']; parts = sid.split('_')
    if len(parts) < 14 or parts[0] != 'NISAR':
        raise ValueError('Invalid NISAR product identifier')
    collection = p.get('collectionName')
    if collection not in COLLECTIONS:
        raise ValueError('Unrecognized collection maturity')
    kind, maturity = COLLECTIONS[collection]
    if p.get('sensor') != 'L-SAR' or p.get('processingLevel') != kind or parts[1] != LEVELS[kind]:
        raise ValueError('Not the requested L-band product type/level')
    if (int(parts[5]),int(parts[7]),{'A':'ASCENDING','D':'DESCENDING'}.get(parts[6])) != (p.get('pathNumber'),p.get('frameNumber'),p.get('flightDirection')):
        raise ValueError('Track/frame/direction differs from product identifier')
    crid = p.get('crid')
    if not crid or crid not in parts or not re.fullmatch(r'[A-Z]\d{5}', crid):
        raise ValueError('CRID absent or inconsistent with product ID')
    start, stop = utc(p['startTime']), utc(p['stopTime'])
    encoded=[dt.datetime.strptime(t,'%Y%m%dT%H%M%S').replace(tzinfo=dt.timezone.utc).isoformat().replace('+00:00','Z') for t in parts[11:13]]
    if not time_agrees(encoded[0],start) or not time_agrees(encoded[1],stop):
        raise ValueError('Acquisition time differs from product identifier')
    if instant(start) >= instant(stop) or instant(start) < instant(GAP[1]) and instant(stop) > instant(GAP[0]):
        raise ValueError('Invalid acquisition time or permanent instrument gap')
    footprint = shape(feature['geometry']); study = box(*site['bbox'])
    if not footprint.is_valid or footprint.is_empty or footprint.geom_type not in ('Polygon','MultiPolygon'):
        raise ValueError('Invalid catalog footprint')
    west,south,east,north=footprint.bounds
    if not(-180<=west<=east<=180 and -90<=south<=north<=90):
        raise ValueError('Catalog footprint is not supported longitude/latitude geometry')
    overlap = footprint.intersection(study).area
    if overlap <= 0:
        return None
    if p.get('flightDirection') not in ('ASCENDING','DESCENDING'):
        raise ValueError('Unknown orbit direction')
    url = p['url']
    if urlsplit(url).hostname != 'nisar.asf.earthdatacloud.nasa.gov' or urlsplit(url).scheme != 'https' or urlsplit(url).query or urlsplit(url).username or urlsplit(url).password:
        raise ValueError('Unexpected or credential-bearing product URL')
    row = dict(id=sid, date=start, endDate=stop, track=p.get('pathNumber'), frame=p.get('frameNumber'),
               direction=p['flightDirection'], absoluteOrbit=p.get('orbit'), sensor='L-SAR', frequencyBand='L',
               productType=kind, processingLevel=LEVELS[kind], collection=collection, maturity=maturity, crid=crid,
               pgeVersion=p.get('pgeVersion'), productionPipeline=p.get('productionConfiguration'), collectionConceptId=p.get('conceptID'),
               acquisitionMode={'filenamePolarizationModeCode': parts[9], 'beamMode': p.get('beamModeType'),
                                'frequencyA': p.get('mainBandPolarization'), 'frequencyB': p.get('sideBandPolarization')},
               processedAt=utc(p['processingDate']) if p.get('processingDate') else None,
               footprint=feature['geometry'], bboxCoverageFraction=round(overlap/study.area, 8),
               coversCenter=footprint.covers(Point(site['coordinates'])), coversBox=footprint.covers(study),
               coverageMeaning='Catalog footprint intersection / entire study bounding box in longitude/latitude coordinates; not equal-area ground coverage or valid radar pixels.',
               sourceUrl=url, browseUrls=p.get('browse', []),
               sizeBytes=p.get('bytes', {}).get(sid+'.h5', {}).get('bytes'),
               catalogStatus='listed', downloadStatus='not_downloaded', processingStatus='not_analyzed',
               hdf5LayersVerified=False, measurementUnits=None, projection=None, validPixelMask=None,
               calibration='Collection maturity only; individual HDF5 calibration and quality unreviewed',
               quantitativeAnalysisAllowed=False)
    acquisition_key(row)
    return row


def verify_cmr(row, sources):
    key = 'cmr-granule-'+digest(row['id'].encode())[:16]
    receipt = sources.get(key, CMR+'granules.umm_json', {'producer_granule_id': row['id'], 'provider': 'ASF', 'page_size': 10})
    if receipt['status'] != 'retrieved':
        return {'status': 'request_failed', 'receipt': key+'.json.gz'}
    matches = [x for x in receipt['data'].get('items', []) if x['umm'].get('GranuleUR') == row['id']]
    if len(matches) != 1:
        return {'status': 'not_listed' if not matches else 'ambiguous', 'receipt': key+'.json.gz'}
    item = matches[0]; u = item['umm']; temporal = u['TemporalExtent']['RangeDateTime']
    attrs = {a['Name']: a['Values'] for a in u.get('AdditionalAttributes', [])}
    checks = [u['CollectionReference']['ShortName'] == row['collection'],
              time_agrees(row['date'],temporal['BeginningDateTime']), time_agrees(row['endDate'],temporal['EndingDateTime']),
              attrs.get('TRACK_NUMBER') == [str(row['track'])], attrs.get('FRAME_NUMBER') == [str(row['frame'])],
              attrs.get('ASCENDING_DESCENDING') == [row['direction']]]
    if not all(checks):
        return {'status': 'conflict', 'receipt': key+'.json.gz'}
    collection_receipt = sources.get('cmr-collection-'+row['collection'], CMR+'collections.umm_json',
        {'short_name':row['collection'],'provider':'ASF','page_size':10})
    collections_found = [c for c in collection_receipt.get('data',{}).get('items',[])
        if c['umm'].get('ShortName')==row['collection'] and c['meta']['concept-id']==item['meta']['collection-concept-id']] if collection_receipt.get('data') else []
    if len(collections_found)!=1 or row.get('collectionConceptId')!=item['meta']['collection-concept-id']:
        return {'status':'collection_unverified','receipt':key+'.json.gz'}
    row['collectionDoi'] = collections_found[0]['umm'].get('DOI',{}).get('DOI')
    row['collectionReceipt'] = 'cmr-collection-'+row['collection']+'.json.gz'
    row['cmrAcquisitionStartAt']=utc(temporal['BeginningDateTime']);row['cmrAcquisitionEndAt']=utc(temporal['EndingDateTime'])
    row['temporalPrecisionNote']='ASF whole-second values are checked against CMR without discarding CMR fractional seconds.'
    row['processedAt'] = utc(u['DataGranule']['ProductionDateTime'])
    row['acquisitionMode'].update(frequencies=attrs.get('FREQUENCIES'),
        frequencyA=attrs.get('FREQUENCY_A_POLARIZATION'), frequencyB=attrs.get('FREQUENCY_B_POLARIZATION'),
        frequencyARangeBandwidthMHz=attrs.get('FREQUENCY_A_RANGE_BANDWIDTH'),
        frequencyBRangeBandwidthMHz=attrs.get('FREQUENCY_B_RANGE_BANDWIDTH'))
    row['productVersion']=next(iter(attrs.get('PRODUCT_VERSION',[])),None)
    row['processingCenter']=next(iter(attrs.get('PROCESSING_CENTER',[])),None)
    row['cmrPgeVersion']=u.get('PGEVersionClass',{}).get('PGEVersion')
    row['cmrGranuleId'] = item['meta']['concept-id']
    row['cmrCollectionId'] = item['meta']['collection-concept-id']
    row['cmrRevisionAt'] = item['meta']['revision-date']
    row['catalogInsertAt'] = next((p['Date'] for p in u.get('ProviderDates', []) if p['Type']=='Insert'), None)
    row['cmrReference'] = CMR+'concepts/'+row['cmrGranuleId']+'.umm_json'
    return {'status': 'verified', 'receipt': key+'.json.gz'}


def access_status(receipt):
    if receipt['status'] == 'request_failed':
        return 'request_failed'
    code = receipt.get('httpStatus')
    if receipt.get('redirectHost') == 'urs.earthdata.nasa.gov' or code == 401:
        return 'authentication_required'
    if code == 403:
        return 'access_denied'
    if code == 404:
        return 'listed_asset_not_found'
    if receipt['request']['method']=='GET_RANGE':
        return 'bounded_header_only' if code==206 else 'range_not_honored' if code==200 else 'access_unverified'
    return 'head_accessible_not_downloaded' if code == 200 else 'access_unverified'


def compatible_metadata(a, b):
    keys = ['sensor','productType','processingLevel','maturity','crid','track','frame','direction']
    issues = [k for k in keys if a.get(k) is None or b.get(k) is None or a.get(k) != b.get(k)]
    if a.get('maturity') == 'BETA' or b.get('maturity') == 'BETA':
        issues.append('BETA_excluded')
    if a.get('acquisitionMode') != b.get('acquisitionMode'):
        issues.append('acquisitionMode')
    return {'catalogFieldsMatch': not issues, 'conflictsOrMissing': issues,
            'quantitativeAnalysisAllowed': False, 'reason': 'Catalog matching does not verify calibration, common grid, masks or valid-pixel overlap.'}


def merge_acquisitions(previous, incoming):
    merged = {a['key']: {**a, 'products': list(a['products'])} for a in previous}
    for acquisition in incoming:
        target = merged.setdefault(acquisition['key'], {**acquisition, 'products': []})
        target.update({k:v for k,v in acquisition.items() if k!='products'})
        products = {p['id']: p for p in target['products']}
        for product in acquisition['products']:
            if product['id'] in products:
                prior = products[product['id']]
                for key in ['date','productType','maturity','crid','track','frame','direction']:
                    if prior.get(key) != product.get(key):
                        raise ValueError('Conflicting metadata for existing product: '+key)
                products[product['id']]={**product,**prior}
            else:
                products[product['id']] = product
        target['products'] = sorted(products.values(), key=lambda p: p['id'])
    return sorted(merged.values(), key=lambda a: a['key'])


def representatives(rows):
    cohorts=collections.defaultdict(dict)
    for row in rows:
        key=tuple(row.get(k) for k in ['sensor','productType','maturity','crid','track','frame','direction'])+(json.dumps(row.get('acquisitionMode'),sort_keys=True),)
        existing=cohorts[key].get(acquisition_key(row))
        if existing is None or row['bboxCoverageFraction']>existing['bboxCoverageFraction']:
            cohorts[key][acquisition_key(row)]=row
    pairs=[]
    for members in cohorts.values():
        values=sorted(members.values(),key=lambda r:r['date'])
        if len(values)>1:pairs.append([values[0],values[-1]])
    if pairs:
        return max(pairs,key=lambda pair:(all(r['coversCenter'] for r in pair),min(r['bboxCoverageFraction'] for r in pair),pair[-1]['date']))
    return sorted(rows,key=lambda r:(r['coversCenter'],r['bboxCoverageFraction'],r['date']),reverse=True)[:2]


def investigate(site, baseline, sources, start, end, check_access):
    old = next(r for r in baseline['sites'] if r['siteId'] == site['id'])
    known = {acquisition_key(s) for s in old['scenes']}
    rows, searches, rejected = {}, [], []
    for kind in LEVELS:
        receipt = sources.get('asf-'+site['id']+'-'+kind, ASF, {
            'dataset':'NISAR','processingLevel':kind,'intersectsWith':box(*site['bbox']).wkt,
            'start':start,'end':end,'maxResults':500,'output':'geojson'})
        data=receipt.get('data') or {}
        features=data.get('features',[]) if isinstance(data.get('features',[]),list) else []
        valid_response = receipt['status']=='retrieved' and receipt.get('data',{}).get('type')=='FeatureCollection' and isinstance(receipt.get('data',{}).get('features'),list)
        complete = valid_response and len(features)<500
        searches.append({'productType':kind,'status':receipt['status'] if valid_response else 'query_unavailable','count':len(features),
                         'completeWithinBounds':complete,'receipt':'asf-'+site['id']+'-'+kind+'.json.gz'})
        for feature in features:
            try:
                row = normalize(feature, site)
                if row and instant(start) <= instant(row['date']) <= instant(end):
                    if row['id'] in rows and rows[row['id']] != row:
                        raise ValueError('Conflicting duplicate product')
                    rows[row['id']] = row
            except (ValueError, KeyError, TypeError) as error:
                rejected.append({'id':feature.get('properties',{}).get('sceneName'), 'reason':str(error)})
    additions = [r for r in rows.values() if acquisition_key(r) not in known]
    gcov = [r for r in rows.values() if r['productType']=='GCOV' and r['maturity']=='VALIDATED']
    # Review at most two existing calibrated-product candidates per site. Never infer a compatible pair.
    candidates = representatives(gcov)
    selected = {r['id']:r for r in candidates+additions}
    for row in selected.values():
        row['cmrVerification'] = verify_cmr(row, sources)
        if check_access:
            key = 'access-'+digest(row['id'].encode())[:16]
            receipt = sources.get(key, row['sourceUrl'], method='GET_RANGE')
            row['access'] = {'status':access_status(receipt),'receipt':key+'.json.gz'}
    groups = {}
    for row in additions:
        key = acquisition_key(row)
        group = groups.setdefault(key, {'key':key,'date':row['date'],'products':[]})
        # Only independently verified additions enter the published acquisition ledger.
        if row.get('cmrVerification',{}).get('status') == 'verified':
            group['products'].append(row)
    incoming = [a for a in groups.values() if a['products']]
    for acquisition in incoming:
        if any(p['productType']=='GCOV' for p in acquisition['products']):
            continue
        key='cmr-gcov-check-'+digest(acquisition['key'].encode())[:16]
        receipt=sources.get(key,CMR+'granules.umm_json',{'short_name':'NISAR_L2_GCOV_V1','provider':'ASF',
            'bounding_box':','.join(map(str,site['bbox'])),'temporal':acquisition['date']+','+max(p['endDate'] for p in acquisition['products']),'page_size':10})
        data=receipt.get('data') or {}
        acquisition['gcovCheck']={'status':'not_listed_in_query' if receipt['status']=='retrieved' and data.get('hits')==0 else 'unverified',
                                  'receipt':key+'.json.gz','retrievedAt':receipt['retrievedAt']}

    return {'schemaVersion':1,'siteId':site['id'],'bbox':site['bbox'],'studyWindow':{'start':start,'end':end},
        'baseline':{'inventory':'/data/inventory.json','productCount':len(old['scenes']),
                    'uniqueAcquisitionCount':len(known),'maturityCounts':dict(collections.Counter(s['maturity'] for s in old['scenes'])),
                    'dateRange':[min(s['date'] for s in old['scenes']),max(s['date'] for s in old['scenes'])]},
        'searches':searches,'rejectedRecords':rejected,'additionalAcquisitions':incoming,
        'reviewedExistingProducts':candidates,
        'existingCandidateCompatibility':compatible_metadata(*candidates) if len(candidates)==2 else None,
        'unverifiedAdditionalProducts':[r['id'] for r in additions if r.get('cmrVerification',{}).get('status')!='verified'],
        'gcovNewProductIds':sorted(r['id'] for r in rows.values() if r['productType']=='GCOV' and r['id'] not in {s['id'] for s in old['scenes']}),
        'limitations':['No HDF5 science data downloaded or analyzed. Units, CRS, masks and calibration remain unreviewed.',
                       'An empty or failed query is not proof of permanent absence. Catalog overlaps are geometric only.',
                       'GSLC/RSLC are not GCOV gamma-0; no direct cross-type, CRID or maturity differencing is authorized.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', default='2025-10-17T00:00:00Z')
    parser.add_argument('--end', help='Explicit inclusive UTC search cutoff (default: current UTC time)')
    parser.add_argument('--output', type=Path, default=ROOT/'public/data/nisar')
    parser.add_argument('--replay', type=Path, help='Saved receipt directory; no network requests')
    parser.add_argument('--check-access', action='store_true', help='Probe at most 64 bytes using HTTP Range; never downloads full science files')
    args = parser.parse_args(); start = utc(args.start)
    if args.replay:
        plan = json.loads((args.replay.parent/'run.json').read_text(encoding='utf-8'))
        start, end, check = plan['start'], plan['end'], plan['checkAccess']
    else:
        end, check = utc(args.end or now()), args.check_access
    if instant(start) >= instant(end) or instant(end) > instant(now()):
        raise ValueError('Invalid/future study window')
    run_id = end.replace('-','').replace(':','').replace('.','')
    run = args.output/'snapshots'/run_id
    sources = Sources(args.replay or run/'sources', replay=bool(args.replay))
    baseline_path = ROOT/'public/data/inventory.json'
    baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
    sites = json.loads((ROOT/'public/data/sites.json').read_text(encoding='utf-8'))
    docs = sources.get('official-availability', DOC)
    receipts = []
    for site in sites:
        row = investigate(site, baseline, sources, start, end, check)
        ledger_path = args.output/'sites'/(site['id']+'.json')
        previous = json.loads(ledger_path.read_text())['additionalAcquisitions'] if ledger_path.exists() else []
        prefix = '/data/nisar/snapshots/'+run_id+'/sources/'
        for acquisition in row['additionalAcquisitions']:
            if acquisition.get('gcovCheck'):acquisition['gcovCheck']['sourceReceipts']=prefix
        for product in row['reviewedExistingProducts']+[p for a in row['additionalAcquisitions'] for p in a['products']]:
            product['sourceReceipts'] = prefix
        row['additionalAcquisitions'] = merge_acquisitions(previous, row['additionalAcquisitions'])
        row.update(retrievedAt=max(r['retrievedAt'] for r in sources.memo.values()),
                   sourceReceipts='/data/nisar/snapshots/'+run_id+'/sources/', baselineSha256=digest(baseline_path.read_bytes()))
        write(ledger_path, row); receipts.append({'siteId':site['id'],'ledger':'sites/'+site['id']+'.json',
            'baselineProducts':row['baseline']['productCount'],'additionalAcquisitions':len(row['additionalAcquisitions']),
            'additionalProducts':sum(len(a['products']) for a in row['additionalAcquisitions']),
            'newGcovProducts':len(row['gcovNewProductIds'])})
        print(site['id'],receipts[-1],flush=True)
    write(run/'run.json', {'start':start,'end':end,'checkAccess':check,'baselineSha256':digest(baseline_path.read_bytes())})
    write(args.output/'index.json', {'schemaVersion':1,'searchCutoff':end,'snapshot':'snapshots/'+run_id,
        'officialReleaseFacts':{'receipt':'official-availability.json.gz','status':docs['status'],
                                'checks':docs.get('documentChecks',{})},'sites':receipts,
        'editionPolicy':'Supplemental hosted metadata only; curated evidence, images and offline payload are unchanged.'})


if __name__ == '__main__':
    main()
