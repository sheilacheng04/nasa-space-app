# Angat GCOV access and preparation report

Public ASF and CMR metadata rechecked on 14 November 2026. **No science request was sent, no authenticated session was opened, and no subset was downloaded.** The environment has no supported Earthdata token, complete username/password pair, or Earthdata login in the checked netrc files. This is an authentication prerequisite, not evidence that the catalog products are inaccessible or absent.

## Exact products

```text
NISAR_L2_PR_GCOV_033_140_A_009_4005_DHDH_A_20261021T213032_20261021T213106_P05036_N_F_J_001
NISAR_L2_PR_GCOV_034_140_A_009_4005_DHDH_A_20261102T213032_20261102T213106_P05036_N_F_J_001
```

| Acquisition start UTC | CMR end UTC | Production UTC | Official CMR reference |
| --- | --- | --- | --- |
| 2026-10-21T21:30:32Z | 2026-10-21T21:31:06.999342Z | 2026-11-07T06:10:53Z | [G4404197169-ASF](https://cmr.earthdata.nasa.gov/search/concepts/G4404197169-ASF.umm_json) |
| 2026-11-02T21:30:32Z | 2026-11-02T21:31:06.999342Z | 2026-11-11T12:50:06Z | [G4408731464-ASF](https://cmr.earthdata.nasa.gov/search/concepts/G4408731464-ASF.umm_json) |

Both independently verified records are L-SAR, Level 2 GCOV, ascending track 140/frame 9, VALIDATED collection NISAR_L2_GCOV_V1, CRID P05036. The filename PR token denotes production pipeline, not provisional maturity. ASF end timestamps stop at whole seconds; CMR fractional precision is retained. CMR advertises HH/HV in frequencies A and B (40/5 MHz respectively). Actual HDF5 band datasets have not been opened. Each advertised full science file is **5,276,434,432 bytes**, not a downloaded or subset size.

Both catalog polygons cover the entire Angat bounding box [121.08, 14.84, 121.24, 15.0] geometrically. This does not establish usable pixels, actual radar coverage, equal-area coverage or a common valid measurement area.

## Reproducible metadata and bounded request plan

[plan.json](nisar/angat-gcov/plan.json) records exact identities, catalog metadata, official unsigned archive references, request bounds, planned variables, output separation and pending validation. Its sources directory contains four compressed public metadata receipts with UTC retrieval timestamps and response hashes. There are no authentication headers, cookie jars, credential-bearing request URLs or science payloads. This supplement is under docs, not application data, and is not embedded in the offline edition.

```powershell
python scripts/plan_angat_gcov.py
# No network; reconstruct the same plan from captured catalog responses:
python scripts/plan_angat_gcov.py --replay docs/nisar/angat-gcov/sources --output .artifacts/angat-gcov-replay
```

Use a compatible environment with requests and shapely from the existing requirements. This run used the existing isolated .artifacts/nisar-python environment because the older .venv has incompatible binary wheels. No dependencies were added. Public metadata requests are bounded to 16 MB and connection/read timeouts of 10/40 seconds. A transient timeout/429/5xx receives at most one retry after one second; 401/403/404 are not retried. Replay never accesses the network. Exact missing, duplicated, conflicting or failed catalog results stay unavailable; no alternative acquisition is selected. Reports expose authentication configuration categories only. They do not test credential validity.

The planned ROI is [121.14, 14.89, 121.18, 14.93], a small rectangle inside the study box, not the whole reservoir or study boundary. A custom ROI must remain within Angat and cannot exceed 0.04 degrees in either dimension. Geographic request bounds are not an actual native pixel window; that window remains unknown until the source grid is inspected.

## Access prerequisite and next execution

Configure Earthdata authentication outside the repository and chat, using EARTHDATA_TOKEN, a complete EARTHDATA_USERNAME/EARTHDATA_PASSWORD environment pair, or a netrc entry for urs.earthdata.nasa.gov. Do not put credentials in CLI arguments, public files or receipts. The official [earthaccess environment authentication](https://earthaccess.readthedocs.io/en/latest/user/howto/authenticate-with-environment-variables/) supports these environment methods. A future authenticated run must explicitly use a noninteractive strategy and persist=False; no successful login is claimed here.

ASF's [Harmony customization](https://nisar-docs.asf.alaska.edu/harmony/) supports spatially bounded GCOV variable extraction to separate COGs. Select only the two exact granules, trim to the planned ROI, and extract frequencyA HHHH, HVHV, mask, numberOfLooks and rtcGammaToSigmaFactor. Do not request output reprojection or resampling. Retain original source identification/processing and coordinate metadata alongside each output. Use separate ignored directories raw/angat/gcov/P05036/{exact-product-id}/. Record retrieval UTC, file sizes/hashes, native transform/CRS, source variable and actual bounds. Never retain authenticated redirects or job URLs containing credentials.

**Automated authenticated science retrieval is not implemented or tested by this metadata-only command.** Authentication was absent, so development stops before a live service job. The plan is a continuation artifact, not a promise that the service preserves every needed attribute. Future retrieval must check service capabilities and output metadata first, stop on 401/403, allow at most two attempts for transient failures, use bounded polling/time limits, and reject any fallback to a whole-product download. Failed or empty jobs must leave no output marked valid.

Do not run the old fetch_nisar_gcov.py default workflow for these targets: its Harmony path selects the older provisional pair and requests EPSG:4326 reprojection; its main routine also writes curated unavailable series/stats. It was deliberately left unchanged. The broader prepare_radar.py workflow performs transformations and statistics outside this task.

## Actual measurement validation remains pending

**Subset files: none. Total subset bytes: 0. Ready for scientific analysis: no.** No successful download, measurement preservation, mask interpretation or spatial pixel validation is claimed.

The [GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/) describes gamma-0 power, a mask describing averaging ensembles, number of looks, and a gamma-to-sigma normalization factor. These are documentation-level descriptions. Actual per-file units, fill values, valid-pixel policy, calibration annotations, quality flags, looks, RTC values, projection, geolocation and spacing remain null/unverified. Do not infer numeric mask meanings or treat every finite pixel as valid. Preserve measurements and masks without unit conversion or resampling; review mask definitions and fill values before any future summary. Unknown or missing layers must remain unavailable.

The pair's catalog cohort matches, but common native grid, calibration, geometry, quality and overlapping valid pixels have not been verified. CRID alone does not establish comparability. No differences, flood extent, water level, volume, hydrology or ENSO interpretation were calculated.

## Validation

45 Python tests passed (14 preparation-plan cases plus 31 existing pipeline/catalog safeguards); 13 existing rasterio/affine pending-deprecation warnings. Tests cover exact catalog identities and UTC precision, bounded planned ROI, missing/conflicting/duplicated records, credential-free configuration reporting, reproducible no-network replay and bounded public metadata retries. They do not substitute for authenticated retrieval or actual mask/grid validation. JavaScript: 43 passed. TypeScript and production build passed. Browser/offline results are recorded in the task report.

No curated observation, site ledger, scientific dataset, image, application source or dependency file changed. The offline HTML was not regenerated and remains **2,997,271 bytes**.
