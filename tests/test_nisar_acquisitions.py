"""Metadata and failure-mode tests; synthetic geometry is not scientific evidence."""
import copy
import gzip
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
import requests

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import expand_nisar_acquisitions as n

SITE={'id':'test','bbox':[0,0,1,1],'coordinates':[.5,.5]}


def feature(kind='GCOV', maturity='VALIDATED', crid='P05036', start='2026-10-30T14:13:40Z', stop='2026-10-30T14:14:15Z'):
    suffix={'VALIDATED':'','PROVISIONAL':'_PROVISIONAL','BETA':'_BETA'}[maturity]
    sid=f'NISAR_{n.LEVELS[kind]}_PR_{kind}_034_092_D_075_4005_DHDH_A_{n.instant(start).strftime("%Y%m%dT%H%M%S")}_{n.instant(stop).strftime("%Y%m%dT%H%M%S")}_{crid}_N_F_J_001'
    collection=f'NISAR_{n.LEVELS[kind]}_{kind}{suffix}_V1'
    return {'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},
      'properties':{'sceneName':sid,'collectionName':collection,'conceptID':'C-test-ASF','crid':crid,'sensor':'L-SAR',
        'processingLevel':kind,'startTime':start,'stopTime':stop,'flightDirection':'DESCENDING','pathNumber':92,'frameNumber':75,
        'url':f'https://nisar.asf.earthdatacloud.nasa.gov/NISAR/{collection}/{sid}/{sid}.h5',
        'mainBandPolarization':['HH','HV'],'sideBandPolarization':['HH','HV']}}


def group(row):
    return {'key':n.acquisition_key(row),'date':row['date'],'products':[row]}


def test_collection_controls_maturity_not_pr_token():
    for maturity,crid in [('BETA','X05009'),('PROVISIONAL','P05023'),('VALIDATED','P05036')]:
        row=n.normalize(feature(maturity=maturity,crid=crid),SITE)
        assert row['maturity']==maturity
        assert row['quantitativeAnalysisAllowed'] is False
        assert row['measurementUnits'] is None
        assert row['projection'] is None
        assert row['validPixelMask'] is None
    bad=feature();bad['properties']['collectionName']='NISAR_UNDOCUMENTED'
    with pytest.raises(ValueError):n.normalize(bad,SITE)


def test_crid_and_identity_must_be_explicit_and_consistent():
    f=feature();f['properties']['crid']='P99999'
    with pytest.raises(ValueError):n.normalize(f,SITE)
    f=feature();f['properties']['sensor']='Sentinel-1 C-band'
    with pytest.raises(ValueError):n.normalize(f,SITE)
    f=feature();f['properties']['startTime']='2026-10-31T14:13:40Z'
    with pytest.raises(ValueError):n.normalize(f,SITE)
    f=feature();f['properties']['url']+='?access_token=secret'
    with pytest.raises(ValueError):n.normalize(f,SITE)
    f=feature();f['properties']['url']=f['properties']['url'].replace('https://','https://user:secret@')
    with pytest.raises(ValueError):n.normalize(f,SITE)


def test_utc_and_fractional_precision_are_preserved():
    assert n.utc('2026-10-30T22:13:40+08:00')=='2026-10-30T14:13:40Z'
    with pytest.raises(ValueError):n.utc('2026-10-30T14:13:40')
    assert n.time_agrees('2026-10-30T14:14:15Z','2026-10-30T14:14:15.999342Z')
    assert not n.time_agrees('2026-10-30T14:14:15Z','2026-10-30T14:14:16Z')
    assert not n.time_agrees('2026-10-30T14:14:15.500Z','2026-10-30T14:14:15.999342Z')


def test_permanent_gap_boundary_and_fractional_seconds():
    for start,stop in [('2026-07-27T22:03:25.001Z','2026-07-27T22:03:26Z'),('2026-08-09T00:00:00Z','2026-08-09T00:00:30Z')]:
        with pytest.raises(ValueError):n.normalize(feature(start=start,stop=stop),SITE)
    assert n.normalize(feature(start=n.GAP[1],stop='2026-08-10T00:56:00Z'),SITE)


def test_real_polygon_overlap_has_explicit_denominator_not_valid_pixels():
    f=feature();f['geometry']['coordinates']=[[[0,0],[.5,0],[.5,1],[0,1],[0,0]]]
    row=n.normalize(f,SITE)
    assert row['bboxCoverageFraction']==.5
    assert row['coversBox'] is False
    assert 'entire study bounding box' in row['coverageMeaning']
    assert 'not equal-area' in row['coverageMeaning']
    assert row['validPixelMask'] is None
    f['geometry']['coordinates']=[[[1,0],[2,0],[2,1],[1,1],[1,0]]]
    assert n.normalize(f,SITE) is None  # boundary-only touch


def test_footprint_holes_and_invalid_geometry_fail_closed():
    f=feature();f['geometry']['coordinates'].append([[.2,.2],[.2,.8],[.8,.8],[.8,.2],[.2,.2]])
    assert n.normalize(f,SITE)['bboxCoverageFraction']==.64
    f['geometry']['coordinates']=[[[0,0],[1,1],[1,0],[0,1],[0,0]]]
    with pytest.raises(ValueError):n.normalize(f,SITE)


def test_duplicate_products_and_reprocessing_are_not_new_acquisitions():
    first=n.normalize(feature('GSLC'),SITE);second=n.normalize(feature('RSLC'),SITE)
    merged=n.merge_acquisitions([group(first)],[group(first),group(second)])
    assert len(merged)==1 and len(merged[0]['products'])==2
    other=n.normalize(feature('GCOV','PROVISIONAL','P05023'),SITE)
    assert n.acquisition_key(first)==n.acquisition_key(other)
    assert len(n.merge_acquisitions(merged,[group(other)]))==1
    assert n.merge_acquisitions(merged,[])==merged


def test_conflicting_crids_cannot_rewrite_an_existing_product():
    row=n.normalize(feature(),SITE);original=group(row);changed=copy.deepcopy(row);changed['crid']='P05023'
    with pytest.raises(ValueError):n.merge_acquisitions([original],[group(changed)])
    assert original['products'][0]['crid']=='P05036'


def test_compatibility_never_authorizes_measurements_from_metadata():
    a=n.normalize(feature(),SITE);b=copy.deepcopy(a)
    assert n.compatible_metadata(a,b)['catalogFieldsMatch']
    assert not n.compatible_metadata(a,b)['quantitativeAnalysisAllowed']
    for key,value in [('maturity','PROVISIONAL'),('crid','P05023'),('track',93),('frame',76),('direction','ASCENDING'),('productType','GSLC'),('sensor','Sentinel-1')]:
        b=copy.deepcopy(a);b[key]=value
        assert not n.compatible_metadata(a,b)['catalogFieldsMatch']
    b=copy.deepcopy(a);b['crid']=None
    assert not n.compatible_metadata(a,b)['catalogFieldsMatch']


def test_missing_and_failed_cmr_products_remain_unverified():
    row=n.normalize(feature(),SITE)
    class Fake:
        def __init__(self,value):self.value=value
        def get(self,*args,**kwargs):return self.value
    assert n.verify_cmr(row,Fake({'status':'retrieved','data':{'items':[]}}))['status']=='not_listed'
    assert n.verify_cmr(row,Fake({'status':'request_failed'}))['status']=='request_failed'
    assert not row['hdf5LayersVerified'] and not row['quantitativeAnalysisAllowed']


def test_access_failures_are_distinct_from_catalog_availability():
    for code,state in [(401,'authentication_required'),(403,'access_denied'),(404,'listed_asset_not_found'),(200,'range_not_honored')]:
        receipt={'status':'checked','httpStatus':code,'request':{'method':'GET_RANGE'}}
        assert n.access_status(receipt)==state
    assert n.access_status({'status':'request_failed'})=='request_failed'
    row=n.normalize(feature(),SITE);row['access']={'status':'request_failed'}
    assert row['catalogStatus']=='listed' and row['downloadStatus']=='not_downloaded' and row['processingStatus']=='not_analyzed'


def test_large_ignored_range_is_not_downloaded_or_secret_headers_saved(tmp_path):
    class Response:
        status_code=200
        headers={'Content-Length':'22000000000','Location':'https://example.org/?access_token=secret'}
        url='https://example.org/?access_token=secret'
        def __enter__(self):return self
        def __exit__(self,*args):pass
        @property
        def raw(self):raise AssertionError('Must not read an ignored Range response')
    with patch.object(requests,'request',return_value=Response()) as call:
        result=n.Sources(tmp_path).get('probe','https://nisar.asf.earthdatacloud.nasa.gov/product.h5',method='GET_RANGE')
    assert result['bytesRead']==0
    assert call.call_args.kwargs['headers']['Range']=='bytes=0-63'
    assert 'secret' not in gzip.decompress((tmp_path/'probe.json.gz').read_bytes()).decode()


def test_public_output_replays_without_network_and_preserves_curated_files(tmp_path):
    index_path=ROOT/'public/data/nisar/index.json'
    if not index_path.exists():pytest.skip('Live snapshot not yet generated')
    index=json.loads(index_path.read_text());snap=ROOT/'public/data/nisar'/index['snapshot']
    originals=[ROOT/'public/data/inventory.json',ROOT/'public/data/sites.json',*[ROOT/f'public/data/sites/{s}/evidence.json' for s in ['angat','luzon','dadu','piura']]]
    before={p:n.digest(p.read_bytes()) for p in originals}
    with patch.object(sys,'argv',['audit','--replay',str(snap/'sources'),'--output',str(tmp_path)]),patch.object(requests,'request',side_effect=AssertionError('Replay must not access network')):
        n.main()
    for site in index['sites']:
        expected=json.loads((ROOT/'public/data/nisar'/site['ledger']).read_text())
        assert json.loads((tmp_path/site['ledger']).read_text())==expected
    assert {p:n.digest(p.read_bytes()) for p in originals}==before
    assert before[ROOT/'public/data/inventory.json']==json.loads((tmp_path/'sites/dadu.json').read_text())['baselineSha256']


def test_published_addition_has_independent_identity_and_no_invented_science():
    path=ROOT/'public/data/nisar/sites/dadu.json'
    if not path.exists():pytest.skip('Live snapshot not yet generated')
    ledger=json.loads(path.read_text())
    keys=[a['key'] for a in ledger['additionalAcquisitions']]
    assert len(keys)==len(set(keys))
    for acquisition in ledger['additionalAcquisitions']:
        for product in acquisition['products']:
            assert product['cmrVerification']['status']=='verified'
            assert product['cmrGranuleId'].endswith('-ASF')
            assert product['downloadStatus']=='not_downloaded'
            assert not product['quantitativeAnalysisAllowed']
            assert product['measurementUnits'] is None and product['projection'] is None
            assert product['processedAt']!=product['date']
            assert n.time_agrees(product['endDate'],product['cmrAcquisitionEndAt'])


def test_candidate_selection_prefers_same_cohort_distinct_observations():
    a=n.normalize(feature(),SITE)
    b=n.normalize(feature(start='2026-11-11T14:13:40Z',stop='2026-11-11T14:14:15Z'),SITE)
    unrelated=copy.deepcopy(b);unrelated['track']=93
    chosen=n.representatives([a,b,copy.deepcopy(b),unrelated])
    assert {p['date'] for p in chosen}=={a['date'],b['date']}
    assert len(chosen)==2 and n.compatible_metadata(*chosen)['catalogFieldsMatch']


def test_identifier_track_and_unknown_catalog_response_are_not_assumed():
    f=feature();f['properties']['pathNumber']=93
    with pytest.raises(ValueError):n.normalize(f,SITE)
    old=n.normalize(feature(),SITE)
    class Unavailable:
        def get(self,*args,**kwargs):return {'status':'retrieved','data':{'features':None}}
    result=n.investigate(SITE,{'sites':[{'siteId':'test','scenes':[old]}]},Unavailable(),'2025-10-17T00:00:00Z','2026-11-14T00:00:00Z',False)
    assert all(s['status']=='query_unavailable' and not s['completeWithinBounds'] for s in result['searches'])
    assert result['additionalAcquisitions']==[]
