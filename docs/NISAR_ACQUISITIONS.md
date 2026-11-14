# Verified NISAR acquisition extension

Investigated 14 November 2026. Acquisition search window: **2025-10-17T00:00:00Z through 2026-11-14T12:13:39.598967Z**. Each request has its own UTC retrieval timestamp. This expands the metadata foundation; it does not add a new measurement or change-detection claim.

## Coverage before and after discovery

All four existing study definitions/bounding boxes are unchanged. Counts below are site-product associations, not independent measurements. Exact repeats are grouped using acquisition UTC start, track, frame and direction; processing versions and product types remain separate product records.

| Site | Existing GCOV products / distinct acquisition keys | Existing BETA / PROVISIONAL / VALIDATED | Existing acquisition range (UTC) | Fresh ASF GCOV / GSLC / RSLC products | New distinct acquisitions |
| --- | --- | --- | --- | --- | --- |
| luzon | 95 / 84 | 0 / 84 / 11 | 2026-06-23T10:31:47Z to 2026-11-02T21:31:05Z | 95 / 95 / 95 | 0 |
| angat | 31 / 31 | 0 / 27 / 4 | 2026-06-23T21:30:35Z to 2026-11-02T21:30:32Z | 31 / 31 / 31 | 0 |
| dadu | 63 / 57 | 13 / 47 / 3 | 2025-11-20T00:53:40Z to 2026-10-27T00:45:20Z | 63 / 64 / 65 | 1 |
| piura | 31 / 31 | 0 / 28 / 3 | 2026-06-21T11:09:03Z to 2026-10-31T23:40:17Z | 31 / 31 / 31 | 0 |

The original GCOV inventory has 220 site-product associations. Some products intersect more than one site and some acquisition keys have multiple product versions; do not sum these as independent observations. Fresh GCOV searches added **zero product IDs**. GSLC/RSLC searches found **one additional Dadu acquisition**, represented by two different product types. The extra RSLC catalog version is not counted as an extra physical acquisition.

Official availability context was rechecked against the [ASF availability guide](https://nisar-docs.asf.alaska.edu/availability-overview/): VALIDATED L0-2 release 2026-11-06, acquisition coverage beginning 2026-10-21; PROVISIONAL coverage begins 2026-06-17. The exact permanent gap remains 2026-07-27T22:03:25Z to 2026-08-10T00:55:27Z. Earlier-data validated reprocessing is planned for 2027, not assumed complete. The release is not evidence of coverage at every site/date. A receipt stores the document URL, retrieval time, response SHA-256 and checks for these facts without copying the page.

## New Dadu observation

- Acquisition start: **2026-10-30T14:13:40Z**. ASF end: **2026-10-30T14:14:15Z**; CMR end: **2026-10-30T14:14:15.999342Z**. The whole-second ASF time agrees with the fractional-second CMR value; both are retained.
- Descending, track **92**, frame **75**, absolute orbit **6592**, L-SAR.
- Filename polarization-mode code **DHDH**. CMR reports HH/HV for frequency A (40 MHz) and frequency B (5 MHz). Beam-mode label is unavailable and remains null.
- Both products are **VALIDATED / P05036**. PR in the filename identifies the production pipeline, not provisional maturity; maturity is verified from collection membership.
- GSLC production: **2026-11-14T07:03:15Z**. RSLC production: **2026-11-14T04:24:01Z**. Catalog insertion/revision timestamps are separate from acquisition/production times.
- Catalog footprint intersection is **89.141731%** of the **entire 67.3-68.3 E, 26.2-27.2 N study bounding box**, computed in longitude/latitude coordinates. The footprint covers the center but not the whole box. This is not equal-area ground coverage, usable radar pixels, flood extent or valid-pixel coverage.

| Product | Level | Maturity | CRID | Archive science-file bytes (not downloaded) | Official granule |
| --- | --- | --- | --- | --- | --- |
| RSLC | L1 | VALIDATED | P05036 | 26,411,532,288 | [G4411378532-ASF](https://cmr.earthdata.nasa.gov/search/concepts/G4411378532-ASF.umm_json) |
| GSLC | L2 | VALIDATED | P05036 | 22,481,469,440 | [G4411422185-ASF](https://cmr.earthdata.nasa.gov/search/concepts/G4411422185-ASF.umm_json) |

Exact source product IDs:

~~~text
NISAR_L2_PR_GSLC_034_092_D_075_4005_DHDH_A_20261030T141340_20261030T141415_P05036_N_F_J_001
NISAR_L1_PR_RSLC_034_092_D_075_4005_DHDH_A_20261030T141340_20261030T141415_P05036_N_F_J_001
~~~

The ledger includes official HTTPS archive URLs, collection concept IDs/DOIs, exact GeoJSON footprints and processing/acquisition metadata, PGE version, product version and processing center. Independent ASF and CMR checks must agree on producer ID, collection, track/frame/direction and observation times before an addition is published. A separate bounded CMR GCOV query returned no results for this new Dadu observation. That absence is timestamped and query-specific, not a claim that GCOV will never become available.

## Access and processing outcome

**Full HDF5 products downloaded: 0. Science products analyzed: 0. Quantitative changes computed: 0.** No new browse image was downloaded or interpreted as a measurement.

Earthdata environment credentials were not configured. HEAD alone was misleading: the archive redirect could return 200 for HEAD, while an actual bounded 64-byte range GET returned 401. Active ledger probes record authentication_required for seven unique reviewed products; the Lower Piura descending candidate timed out and remains request_failed, not falsely labeled inaccessible forever. No large response is read if a server ignores Range. Response cookies, redirect URLs/query tokens and credential values are not saved.

Consequently HDF5 units, actual projection, mask values, per-pixel quality and calibration datasets are still **unverified/null**. All new records explicitly say not_downloaded / not_analyzed and quantitativeAnalysisAllowed=false. Download failure does not erase catalog availability.

[GCOV documentation](https://nisar-docs.asf.alaska.edu/gcov/) describes RTC gamma-0 products, while [GSLC documentation](https://nisar-docs.asf.alaska.edu/gslc/) describes complex DN data whose power is beta-0 before appropriate radiometric conversion. The two types are not interchangeable. [Known issues](https://nisar-docs.asf.alaska.edu/nisar-known-issues/) still require review. No beta/provisional/validated mixing, C-band/L-band differencing, pixel-level coverage inference, or ENSO attribution is authorized by these records.

## Published files and preservation

- [Index](../public/data/nisar/index.json).
- [Central Luzon](../public/data/nisar/sites/luzon.json), [Angat](../public/data/nisar/sites/angat.json), [Dadu](../public/data/nisar/sites/dadu.json), [Lower Piura](../public/data/nisar/sites/piura.json).
- [Snapshot configuration](../public/data/nisar/snapshots/20261114T121339598967Z/run.json) and its sources/ directory contain compressed JSON request receipts (ASF, CMR, official-document checks and access probes). Gzip uses deterministic mtime=0; source receipt names use hashes for long producer IDs. Each receipt records canonical request parameters, retrieval time, HTTP status and the complete returned metadata body; a response SHA-256 is recorded for successful JSON responses.
- [Script](../scripts/expand_nisar_acquisitions.py) and [tests](../tests/test_nisar_acquisitions.py).

The new hosted metadata is about **448.0 KB** including provenance. The curated inventory, site definitions, per-site evidence/series/stats, radar images, hypotheses and other environmental datasets are unchanged. Existing observations and selected before/after pairs are not replaced, and new metadata does not silently appear as dated imagery. Supplemental ledgers retain earlier verified additions on later empty/failed queries and reject conflicting duplicate product metadata. They are not reviewed processing manifests.

## Reproduction and configuration

Use a compatible Python environment with requests and shapely (already declared by scripts/requirements.txt). No application dependency files changed. This run used an isolated Python 3.13 environment under ignored .artifacts/nisar-python because the pre-existing .venv has incompatible/mixed binary wheels; that existing environment was left unchanged.

~~~powershell
python scripts/expand_nisar_acquisitions.py --check-access
# Optional: --start 2025-10-17T00:00:00Z --end EXPLICIT_UTC_CUTOFF --output public/data/nisar
# Rebuild from captured responses without network:
python scripts/expand_nisar_acquisitions.py --replay public/data/nisar/snapshots/20261114T121339598967Z/sources --output .artifacts/nisar-replay
~~~

The script reads current sites/bounds, queries only GCOV, GSLC and RSLC, limits each ASF search to 500 products, and marks a capped/failed/malformed response incomplete. Representative existing GCOV review is bounded to two products per site, preferring a same-cohort pair with distinct observations. It preserves CMR fractions, keeps product identities separate from observation identities, and deduplicates repeated product IDs. It does not execute the old refresh, weather, news, browse-generation, Harmony or quantitative-processing pipelines. Live executions write a new UTC-cutoff snapshot; replay validates recorded request configuration. For a later incremental run, retain prior per-site ledgers when reproducing its merged historical additions.

Tests can be run in a workspace-local temporary directory if Windows denies access to the shared pytest temp root:

~~~powershell
python -m pytest tests/test_nisar_acquisitions.py tests/test_pipeline.py tests/test_science_safeguards.py tests/test_globe_data.py -q -p no:cacheprovider --basetemp .artifacts/pytest-nisar-check
~~~

Do not place credentials in command-line arguments, source or public files. The discovery script never authenticates or downloads science payloads. For future authorized science extraction, use the existing environment-only Earthdata/Harmony workflow, inspect actual HDF5 units/masks/projection, then prepare an explicitly reviewed manifest. Never set unitsAndMasksReviewed based on catalog metadata or browse colors.

## Validation and offline policy

- **31 Python tests passed** (16 new acquisition tests and 15 existing science/pipeline/globe-data tests). Existing affine/rasterio pending-deprecation warnings remain; no numerical failure occurred. Offline replay matched generated public ledgers and original curated-file hashes stayed unchanged.
- npm.cmd test: **43 passed**. TypeScript and production build passed.
- **123 Chrome browser groups passed** across general 15, radar evidence 8, site map 9, site timeline 12, selections 9, startup 13, weather 6, globe display 17, globe performance 9, satellite 19 and accessibility 6. Hosted JSON delivery was checked separately. No new user-facing visualization was introduced.
- Offline HTML is **2,997,271 bytes**, unchanged and not regenerated. The packaging script embeds an explicit curated file list; the new hosted supplemental metadata is intentionally excluded. No source imagery is degraded. Offline browser checks verify zero external requests rather than attempting to fetch the hosted supplement.

## Recommended next addition

Acquire authenticated, spatially bounded **Angat GCOV** data for **2026-10-21T21:30:32Z and 2026-11-02T21:30:32Z**, track 140/frame 9, ascending, VALIDATED P05036. ASF and CMR verify these candidates and their catalog footprints cover the whole study box geometrically, but valid-pixel overlap/calibration/units/masks remain uninspected. Request HHHH, HVHV, mask, numberOfLooks, rtcGammaToSigmaFactor and geolocation metadata; inspect actual HDF5 before any analysis. This is a stronger next step for calibrated backscatter than differencing Dadu GSLC/RSLC browse or mixing the new descending track with older ascending/provisional images. Independent hydrologic/OPERA evidence would still be required for a water interpretation.
