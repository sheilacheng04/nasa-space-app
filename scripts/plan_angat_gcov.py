"""Reverify two exact GCOV products and prepare a credential-free subset request.

Metadata only: no authenticated request or science download is performed. A plan
is not a downloaded subset or a reviewed processing manifest.
"""
import argparse
import gzip
import json
import math
import netrc
import os
from pathlib import Path
import time

from shapely.geometry import box
import expand_nisar_acquisitions as catalog

IDS = tuple(f'NISAR_L2_PR_GCOV_{cycle}_140_A_009_4005_DHDH_A_{day}T213032_{day}T213106_P05036_N_F_J_001'
            for cycle, day in [('033', '20261021'), ('034', '20261102')])
LAYERS = ['HHHH', 'HVHV', 'mask', 'numberOfLooks', 'rtcGammaToSigmaFactor']
ROI = [121.14, 14.89, 121.18, 14.93]


def authentication_method(env=None, home=None):
    """Report configuration only, never authenticate, persist, prompt or expose it."""
    env = os.environ if env is None else env
    if env.get('EARTHDATA_TOKEN', '').strip():
        return 'environment_token'
    if env.get('EARTHDATA_USERNAME') and env.get('EARTHDATA_PASSWORD'):
        return 'environment_username_password'
    if env.get('EARTHDATA_USERNAME') or env.get('EARTHDATA_PASSWORD'):
        return 'invalid_configuration'
    paths = [Path(env['NETRC'])] if env.get('NETRC') else [Path(home or Path.home()) / n for n in ['.netrc', '_netrc']]
    for path in paths:
        if not path.exists():
            continue
        try:
            auth = netrc.netrc(str(path)).authenticators('urs.earthdata.nasa.gov')
            if auth and auth[0] and auth[2]:
                return 'netrc'
            if auth:
                return 'invalid_configuration'
        except (OSError, netrc.NetrcParseError):
            return 'invalid_configuration'
    return 'not_configured'


def subset_bounds(bounds, site):
    if len(bounds) != 4 or not all(math.isfinite(x) for x in bounds):
        raise ValueError('Four finite longitude/latitude bounds are required')
    w, s, e, n = bounds
    if not (w < e and s < n) or not box(*site['bbox']).covers(box(*bounds)):
        raise ValueError('Subset must be nonempty and contained in the Angat study box')
    if e-w > .04+1e-10 or n-s > .04+1e-10:
        raise ValueError('Subset exceeds the bounded 0.04-degree width or height')
    return list(bounds)


class RetryingSources(catalog.Sources):
    """At most two public metadata attempts; failures are not cached forever."""
    def get(self, key, url, parameters=None, method='GET'):
        if method != 'GET':
            raise ValueError('Only public metadata GET is supported')
        result = super().get(key, url, parameters, method)
        if not self.replay and result['status'] == 'request_failed' and result.get('httpStatus', 503) in [429, 500, 502, 503, 504]:
            time.sleep(1)
            self.memo.pop(key, None)
            result = super().get(key+'-retry', url, parameters, method)
            result = {**result, 'attempts': 2}
            (self.directory/(key+'.json.gz')).write_bytes(gzip.compress(json.dumps(result, sort_keys=True).encode(), mtime=0))
            self.memo[key] = result
        return result


def verify_products(sources, site):
    receipt = sources.get('asf-angat-exact-window', catalog.ASF, {
        'dataset': 'NISAR', 'processingLevel': 'GCOV', 'intersectsWith': box(*site['bbox']).wkt,
        'start': '2026-10-21T00:00:00Z', 'end': '2026-11-03T00:00:00Z', 'maxResults': 100, 'output': 'geojson'})
    results = []
    for product_id in IDS:
        matches = [f for f in (receipt.get('data') or {}).get('features', [])
                   if f.get('properties', {}).get('sceneName') == product_id]
        entry = {'id': product_id, 'catalogStatus': 'request_failed' if receipt['status'] != 'retrieved' else 'not_listed',
                 'downloadStatus': 'not_attempted', 'subsetFiles': [], 'subsetBytes': 0,
                 'actualMeasurementMetadata': None, 'readyForAnalysis': False}
        if len(matches) == 1:
            try:
                row = catalog.normalize(matches[0], site)
                expected = {'productType': 'GCOV', 'processingLevel': 'L2', 'maturity': 'VALIDATED',
                            'crid': 'P05036', 'track': 140, 'frame': 9, 'direction': 'ASCENDING'}
                if row is None or any(row.get(k) != v for k, v in expected.items()):
                    raise ValueError('Unexpected identity')
                cmr = catalog.verify_cmr(row, sources)
                entry.update(catalogStatus=cmr['status'], catalog=row, cmrVerification=cmr)
            except (ValueError, KeyError, TypeError):
                entry['catalogStatus'] = 'metadata_conflict'
        elif len(matches) > 1:
            entry['catalogStatus'] = 'ambiguous'
        results.append(entry)
    return results


def plan(sources, site, bounds, method):
    bounds = subset_bounds(bounds, site)
    return {'schemaVersion': 1, 'siteId': 'angat', 'requestedBoundsWgs84': bounds,
            'authenticationConfiguration': method, 'scienceRequestsMade': 0,
            'accessStatus': 'authentication_required' if method == 'not_configured' else
                            'invalid_authentication_configuration' if method == 'invalid_configuration' else 'authenticated_access_not_tested',
            'products': verify_products(sources, site),
            'preparation': {'service': 'ASF Harmony variable extraction and spatial subsetting',
                'documentation': 'https://nisar-docs.asf.alaska.edu/harmony/',
                'variables': ['/science/LSAR/GCOV/grids/frequencyA/'+name for name in LAYERS],
                'output': 'Separate native-grid COGs per exact granule and layer; retain source metadata separately',
                'reprojection': False, 'resampling': False,
                'outputDirectoryTemplate': 'raw/angat/gcov/P05036/{exact-product-id}/',
                'requiredValidation': ['Exact source granule and acquisition UTC metadata',
                    'Actual units, calibration and mask definitions, including fill values',
                    'Native CRS, affine transform, spacing and subset intersection',
                    'Preserve original measurements, masks, looks and RTC factors',
                    'No statistics until an explicit valid-pixel policy is reviewed',
                    'Compare common grid, geometry, quality and calibration; CRID alone is insufficient'],
                'downloadRetryPolicy': 'No attempts without configured authentication. Future authenticated retrieval: stop on 401/403; at most two attempts on timeout/429/5xx; never fall back to a full product.',
                'automatedScienceRetrievalImplemented': False}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=catalog.ROOT/'docs/nisar/angat-gcov')
    parser.add_argument('--replay', type=Path, help='Previously saved sources directory; makes no network requests')
    parser.add_argument('--bounds', nargs=4, type=float, default=ROI)
    args = parser.parse_args()
    site = next(s for s in json.loads((catalog.ROOT/'public/data/sites.json').read_text()) if s['id'] == 'angat')
    subset_bounds(args.bounds, site)
    sources = RetryingSources(args.replay or args.output/'sources', replay=bool(args.replay))
    report = plan(sources, site, args.bounds, authentication_method())
    catalog.write(args.output/'plan.json', report)
    print(json.dumps({'catalogStatuses': [p['catalogStatus'] for p in report['products']],
                      'accessStatus': report['accessStatus'], 'scienceRequestsMade': 0}))


if __name__ == '__main__':
    main()
