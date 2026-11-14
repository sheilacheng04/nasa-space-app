"""Preparation-plan safeguards; these do not validate unaccessed science pixels."""
import copy
import json
from pathlib import Path
import sys
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
import plan_angat_gcov as p

SITE = next(s for s in json.loads((ROOT/'public/data/sites.json').read_text()) if s['id'] == 'angat')
SOURCES = ROOT/'docs/nisar/angat-gcov/sources'


def replay():
    return p.RetryingSources(SOURCES, replay=True)


def test_exact_catalog_identity_and_fractional_utc():
    products = p.verify_products(replay(), SITE)
    assert tuple(x['id'] for x in products) == p.IDS
    for product in products:
        assert product['catalogStatus'] == 'verified'
        row = product['catalog']
        assert (row['track'], row['frame'], row['direction']) == (140, 9, 'ASCENDING')
        assert (row['maturity'], row['crid'], row['productType']) == ('VALIDATED', 'P05036', 'GCOV')
        assert row['cmrAcquisitionEndAt'].endswith('06.999342Z')
        assert row['coversBox']
        assert row['projection'] is None and not row['hdf5LayersVerified']
        assert product['subsetFiles'] == [] and product['subsetBytes'] == 0
        assert not product['readyForAnalysis']


@pytest.mark.parametrize('bounds', [[0, 0, 1, 1], [121.1, 14.9, 121.2, 14.93],
                                     [121.14, 14.9, 121.14, 14.93], [float('nan'), 0, 1, 1]])
def test_unbounded_or_invalid_roi_rejected(bounds):
    with pytest.raises(ValueError):
        p.subset_bounds(bounds, SITE)


def test_roi_and_measurements_are_planned_without_resampling():
    report = p.plan(replay(), SITE, p.ROI, 'not_configured')
    assert report['requestedBoundsWgs84'] == p.ROI
    assert report['accessStatus'] == 'authentication_required'
    assert report['scienceRequestsMade'] == 0
    prep = report['preparation']
    assert not prep['resampling'] and not prep['reprojection']
    assert [v.split('/')[-1] for v in prep['variables']] == p.LAYERS
    assert not prep['automatedScienceRetrievalImplemented']
    assert all(x['actualMeasurementMetadata'] is None for x in report['products'])


def test_auth_configuration_never_returns_credentials(tmp_path):
    assert p.authentication_method({}, tmp_path) == 'not_configured'
    assert p.authentication_method({'EARTHDATA_TOKEN': 'SECRET'}, tmp_path) == 'environment_token'
    assert p.authentication_method({'EARTHDATA_USERNAME': 'SECRET', 'EARTHDATA_PASSWORD': 'SECRET'}, tmp_path) == 'environment_username_password'
    (tmp_path/'.netrc').write_text('machine urs.earthdata.nasa.gov login SECRET password SECRET\n')
    assert p.authentication_method({}, tmp_path) == 'netrc'
    (tmp_path/'.netrc').write_text('machine urs.earthdata.nasa.gov login')
    assert p.authentication_method({}, tmp_path) == 'invalid_configuration'


def test_replay_is_reproducible_and_has_no_network_or_secrets():
    with patch('requests.request', side_effect=AssertionError('Network forbidden')):
        a = p.plan(replay(), SITE, p.ROI, 'not_configured')
        b = p.plan(replay(), SITE, p.ROI, 'not_configured')
    assert a == b
    encoded = json.dumps(a).lower()
    for secret in ['authorization', 'access_token=', 'password=', 'cookie', 'bearer ']:
        assert secret not in encoded


@pytest.mark.parametrize('status', ['not_listed', 'metadata_conflict', 'ambiguous', 'request_failed'])
def test_missing_conflicting_failed_and_duplicate_products_remain_unavailable(status):
    sources = replay()
    original = sources.get('asf-angat-exact-window', p.catalog.ASF, {
        'dataset':'NISAR', 'processingLevel':'GCOV', 'intersectsWith':p.box(*SITE['bbox']).wkt,
        'start':'2026-10-21T00:00:00Z','end':'2026-11-03T00:00:00Z','maxResults':100,'output':'geojson'})
    receipt = copy.deepcopy(original)
    if status == 'request_failed':
        receipt.update(status='request_failed', data=None)
    elif status == 'not_listed':
        receipt['data']['features'] = []
    else:
        receipt['data']['features'] = [f for f in receipt['data']['features'] if f['properties']['sceneName'] in p.IDS]
        if status == 'ambiguous':
            receipt['data']['features'] *= 2
        else:
            for f in receipt['data']['features']:
                f['properties']['crid'] = 'P99999'
    sources.memo['asf-angat-exact-window'] = receipt
    for product in p.verify_products(sources, SITE):
        assert product['catalogStatus'] == status
        assert not product['readyForAnalysis']


def test_metadata_retry_is_bounded_and_auth_errors_do_not_retry(tmp_path):
    failure = {'status':'request_failed', 'httpStatus':503}
    success = {'status':'retrieved', 'data':{}}
    with patch.object(p.catalog.Sources, 'get', side_effect=[failure, success]) as get, patch.object(p.time, 'sleep'):
        result = p.RetryingSources(tmp_path).get('x', p.catalog.ASF)
        assert result['attempts'] == 2 and get.call_count == 2
    for code in [401, 403, 404]:
        with patch.object(p.catalog.Sources, 'get', return_value={'status':'request_failed','httpStatus':code}) as get:
            p.RetryingSources(tmp_path).get('x', p.catalog.ASF)
            assert get.call_count == 1


def test_no_science_range_requests_supported(tmp_path):
    with pytest.raises(ValueError):
        p.RetryingSources(tmp_path).get('x', 'https://example.invalid', method='GET_RANGE')
