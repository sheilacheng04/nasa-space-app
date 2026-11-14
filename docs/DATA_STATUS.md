# Data status

Reviewed 14 November 2026. Retrieval timestamps are UTC.

## Decision gate

Real GCOV catalog footprints intersect all four retained sites. Track/frame intersections were checked against the official reference observation-plan ArcGIS service. This establishes catalog coverage, not usable pixels or calibrated measurements. Angat is retained around the actual reservoir near 121.16 E, 14.91 N. Piura adds a covered wet-side hypothesis; Dadu remains a flood-method test, not 2026 El Niño evidence.

| Site | BETA | PROVISIONAL | VALIDATED | Baseline / event | Track/frame | CRID |
|---|---:|---:|---:|---|---|---|
| luzon | 0 | 84 | 11 | 2026-06-23 / 2026-10-09 | 140/9 | P05023 |
| angat | 0 | 27 | 4 | 2026-06-23 / 2026-10-09 | 140/9 | P05023 |
| dadu | 13 | 47 | 3 | 2026-06-24 / 2026-10-10 | 142/15 | P05023 |
| piura | 0 | 28 | 3 | 2026-06-21 / 2026-10-19 | 104/175 | P05023 |

Counts include overlapping frames and collections, and can include multiple granules from one acquisition. Luzon and Angat share scenes. Pair selection uses same track/frame/direction/maturity/CRID and favors footprint coverage; it does not identify a hydrologic event. See [inventory.json](../data/inventory.json) for every scene and observation-plan match.

## Imagery fetched

GetCapabilities was checked on production EPSG:4326, production EPSG:3857, and UAT EPSG:4326. They advertised the daily NISAR layer. The requested rolling 12-day layer was absent. The pipeline uses real daily mosaics, preserves missing dates at the requested 12-day intervals, and adds actual catalog acquisition dates. It never silently substitutes nearby dates.

| Site | Ready daily tiles | Requested dates | Regional before/after scenes |
|---|---:|---:|---:|
| luzon | 12 | 24 | 2 |
| angat | 12 | 24 | 2 |
| dadu | 22 | 25 | 2 |
| piura | 11 | 26 | 2 |

Browse is labeled **false color, not calibrated** or **grayscale regional HH/HV quicklook, not calibrated**. WMS TIME describes a daily mosaic. Pixel-level contributing acquisition time, maturity and CRID are not available from GIBS. ASF quicklooks carry exact scene dates, PROVISIONAL maturity and P05023, but are regional and can have different display stretches.

NASA browse false color is not the requested HH/HV-ratio composite: co-pol contributes to red and blue; cross-pol to green. The computed composite and ratio remain disabled until measured channels exist. VV is not exposed without HDF5 inspection.

## Science processing

**Not available / untested on real GCOV:** authenticated Harmony extraction, HDF5 unit/mask inspection, calibrated COGs, ratio, computed composite, change layers, water extent, class backscatter series and OPERA agreement. EARTHDATA_USERNAME and EARTHDATA_PASSWORD are absent. No credential values were printed or saved. No full multi-gigabyte scenes were downloaded.

The pipeline checks actual coverage before authentication; uses earthaccess.login(strategy="environment"); requests Harmony spatial subsets in EPSG:4326; and requires a reviewed manifest. It reads actual units, mask flags, numberOfLooks and rtcGammaToSigmaFactor. Unknown units fail closed. Gamma-0 remains gamma-0. Linear power is averaged before 10 log10. Ratio dB is HH dB minus HV dB.

Candidate water defaults to HH < -17 dB AND HV < -24 dB. These thresholds are **untested and not calibrated for these sites**. Area uses a metric projected grid. No water-area result is displayed. OPERA code computes agreement and IoU on common valid pixels with explicit reference class mappings; real agreement is **not available**. WorldCover means require a supplied reference raster. GUNW, SME2, WorldCover, WorldPop and DEM processing were not attempted. Synthetic-fixture tests do not establish real-world accuracy.

Permanent gap: 2026-07-27T22:03:25Z through 2026-08-10T00:55:27Z. BETA is historical context only and excluded from change calculations. PROVISIONAL pairs use P05023. VALIDATED starts 21 October, released 6 November, initially P05036. Reprocessing in 2027 may change older measurements. SME2 is preliminary; validated SME2 is not available.

## Weather, ocean and news

Direct NOAA CPC files replace the previous advisory-based index. The weekly file reports +3.3 °C for the week centered 4 November 2026. ONI ASO 2026 is +2.46 °C. These have different averaging periods. They provide ocean context, not NISAR observations or local attribution.

All four sites have monthly ERA5 rain and temperature, a 2025 comparison, and the named 1991–2020 same-calendar-month baseline. Temperature averages daily (maximum + minimum) / 2. Partial months remain null. Piura initially returned HTTP 429; a later bounded retry succeeded. Daily data stop 8 November to allow for ERA5 latency. ERA5 is reanalysis, not a station observation.

GDELT returned 250 recent items in the 15 August–14 November 2026 query. All 43 supplied archive items were preserved, yielding 293 source-linked items. GDELT dates are first-seen dates. Claims are not independently verified. Raw and climate-adjusted VADER scores are separate. Actual AI scores remain null; the offline Claude-style sample is a simulated local heuristic, not a Claude response.

## Network audit

45 of 50 supplied URLs returned success. Reachability does not establish usable data or a readable schema.

| URL | HTTP / result | Retrieved |
|---|---|---|
| https://nisar-docs.asf.alaska.edu/ | 200 | 2026-11-14T02:17:42.693202+00:00 |
| https://nisar-docs.asf.alaska.edu/availability-overview/ | 200 | 2026-11-14T02:17:42.693946+00:00 |
| https://nisar-docs.asf.alaska.edu/products-overview/ | 200 | 2026-11-14T02:17:42.694316+00:00 |
| https://nisar-docs.asf.alaska.edu/access-overview | 200 | 2026-11-14T02:17:42.694558+00:00 |
| https://nisar-docs.asf.alaska.edu/observation-plan | 200 | 2026-11-14T02:17:42.694892+00:00 |
| https://nisar-docs.asf.alaska.edu/worldview/ | 200 | 2026-11-14T02:17:42.695171+00:00 |
| https://nisar-docs.asf.alaska.edu/harmony | 200 | 2026-11-14T02:17:42.695881+00:00 |
| https://nisar-docs.asf.alaska.edu/python-tutorials | 200 | 2026-11-14T02:17:42.696993+00:00 |
| https://nisar-docs.asf.alaska.edu/storymaps | 200 | 2026-11-14T02:17:42.699653+00:00 |
| https://nisar-docs.asf.alaska.edu/applications-overview | 200 | 2026-11-14T02:17:42.704644+00:00 |
| https://nisar-docs.asf.alaska.edu/gcov | 200 | 2026-11-14T02:18:15.867920+00:00 |
| https://nisar-docs.asf.alaska.edu/nisar-known-issues | 200 | 2026-11-14T02:18:15.876286+00:00 |
| https://nisar-docs.asf.alaska.edu/provisional-known-issues | 200 | 2026-11-14T02:18:15.886359+00:00 |
| https://nisar-docs.asf.alaska.edu/data-use-citation-guidance | 200 | 2026-11-14T02:18:15.909221+00:00 |
| https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/nisar/nisar-composite-release-id-crid | 200 | 2026-11-14T02:18:16.138604+00:00 |
| https://search.asf.alaska.edu/#/?prodConfig=PR&dataMaturity=PROVISIONAL | 200 | 2026-11-14T02:18:16.148526+00:00 |
| https://search.earthdata.nasa.gov/search/granules/collection-details?p=C2854338529-ASF | 200 | 2026-11-14T02:18:16.149816+00:00 |
| https://urs.earthdata.nasa.gov/ | 200 | 2026-11-14T02:18:16.158419+00:00 |
| https://cmr.earthdata.nasa.gov/search/collections.json?keyword=NISAR%20GCOV | 200 | 2026-11-14T02:18:16.180248+00:00 |
| https://harmony.earthdata.nasa.gov/docs | 200 | 2026-11-14T02:18:16.356670+00:00 |
| https://github.com/nasa/harmony-py | 200 | 2026-11-14T02:18:17.010172+00:00 |
| https://docs.asf.alaska.edu/ | 200 | 2026-11-14T02:18:17.248656+00:00 |
| https://experience.arcgis.com/experience/6052a864cd01459393884a7f751558e3 | 200 | 2026-11-14T02:18:17.278877+00:00 |
| https://experience.arcgis.com/experience/0042193b06104889971cd77f505190e0 | 200 | 2026-11-14T02:18:17.439129+00:00 |
| https://science.nasa.gov/mission/nisar/data/ | 200 | 2026-11-14T02:18:17.589817+00:00 |
| https://worldview.earthdata.nasa.gov/?v=-283.0791525473933,-136.9755200581828,233.8728850905137,117.46181096672454&l=Reference_Labels_15m(hidden),Reference_Features_15m(hidden),Coastlines_15m,NISAR_L2_Geocoded_Polarimetric_Covariance_12Day,NISAR_L2_Geocoded_Polarimetric_Covariance,Land_Water_Map(opacity=0.77)&lg=true&t=2026-07-17-T13%3A26%3A54Z | 200 | 2026-11-14T02:18:17.729888+00:00 |
| https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi | 200 | 2026-11-14T02:18:17.757577+00:00 |
| https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi. | 200 | 2026-11-14T02:18:17.829122+00:00 |
| https://nasa-gibs.github.io/gibs-api-docs/ | 200 | 2026-11-14T02:18:18.170432+00:00 |
| https://asfopensarlab.github.io/NISAR_Cookbook/ | 200 | 2026-11-14T02:18:18.590048+00:00 |
| https://github.com/ASFOpenSARlab/NISAR_Cookbook | 200 | 2026-11-14T02:18:18.633799+00:00 |
| https://asfopensarlab.github.io/NISAR_Cookbook/notebooks/nisar-gcov-time-series-example | 404 | 2026-11-14T02:18:18.656203+00:00 |
| https://asfopensarlab.github.io/NISAR_Cookbook/notebooks/gcov-intro | 404 | 2026-11-14T02:18:18.825231+00:00 |
| https://podaac.jpl.nasa.gov/dataset/OPERA_L3_DSWX-S1_V1 | 200 | 2026-11-14T02:18:19.502513+00:00 |
| https://open-meteo.com/en/docs/historical-weather-api | 200 | 2026-11-14T02:18:20.250044+00:00 |
| https://power.larc.nasa.gov/docs/services/api/ | 200 | 2026-11-14T02:18:20.671925+00:00 |
| https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt | 200 | 2026-11-14T02:18:21.545380+00:00 |
| https://api.gdeltproject.org/api/v2/doc/doc | ReadTimeout: HTTPSConnectionPool(host='api.gdeltproject.org', port=443): Read timed out. (read timeout=8) | 2026-11-14T02:18:22.664077+00:00 |
| https://nasa-impact.github.io/etci2021 | 200 | 2026-11-14T02:18:31.086703+00:00 |
| https://www.kaggle.com/datasets/maelysboudier/ecti-2021 | 200 | 2026-11-14T02:18:48.827517+00:00 |
| https://www.kaggle.com/datasets/osamaktk/pakistan-flood-dataset-2022-2024-dadu-sindh | 200 | 2026-11-14T02:18:48.829247+00:00 |
| https://www.earthdata.nasa.gov/learn/trainings/introduction-synthetic-aperture-radar | 200 | 2026-11-14T02:18:48.832257+00:00 |
| https://appliedsciences.nasa.gov/join-mission/training/english/arset-radar-remote-sensing-land-water-disaster-applications | 200 | 2026-11-14T02:18:48.833275+00:00 |
| https://www.earthdata.nasa.gov/learn/trainings/harnessing-nisar-next-generation-radar-observations-earth-applications | 200 | 2026-11-14T02:18:49.490950+00:00 |
| https://doi.org/10.48577/jpl.UD4HV3 | ConnectTimeout: HTTPConnectionPool(host='dataverse.jpl.nasa.gov', port=80): Max retries exceeded with url: /citation?persistentId=doi:10.48577/jpl.UD4HV3 (Caused by ConnectTimeoutError(<HTTPConnection(host='dataverse.jpl.nasa.gov', port=80) at 0x1750841bb60>, 'Conne | 2026-11-14T02:18:49.492984+00:00 |
| https://science.nasa.gov/mission/nisar/arcgis-storymaps/ | 200 | 2026-11-14T02:18:49.833245+00:00 |
| https://storymaps.arcgis.com/stories/c00d7691b8004b20a14f28df710d05fd | 200 | 2026-11-14T02:18:50.066012+00:00 |
| https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/ | SSLError: HTTPSConnectionPool(host='www.spaceappschallenge.org', port=443): Max retries exceeded with url: /2026/challenges/dancing-with-the-sars/ (Caused by SSLError(SSLCertVerificationError('A certificate chain processed, but terminated in a root certificate | 2026-11-14T02:18:50.174836+00:00 |
| https://bhoonidhi.nrsc.gov.in/NISAR/ | 200 | 2026-11-14T02:18:50.572768+00:00 |
| https://www.eodms-sgdot.nrcan-rncan.gc.ca/index-en.html | 200 | 2026-11-14T02:18:50.573805+00:00 |

Additional content checks: both Kaggle pages and public metadata APIs failed to expose filenames or columns (later requests returned empty 404 responses). Schemas are **not available / unverified**; neither dataset is used. The two supplied Cookbook notebook URLs returned 404; the root and repository are reachable. Optional S-band and RCM sources were probed but not used.

## Provenance and parameters

Every dataset request records URL, retrieval time, maturity, CRID and parameters, or an explicit not-applicable/not-available value. Exact requests are in [method.json](../data/method.json), [network-status.json](../data/network-status.json), [inventory.json](../data/inventory.json), each data/sites/<site>/gibs/manifest.json and browse/manifest.json, each data/context/<site>.json, [enso.json](../data/enso.json), and [news.json](../data/news.json).

## Citation wording

> NISAR follows NASA’s standard Data Use and Citation Guidance.

Exact available sentence from [ASF guidance](https://nisar-docs.asf.alaska.edu/data-use-citation-guidance/). Linked [NASA guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance) and DOI landing pages returned HTTP 403. CMR CollectionCitations was empty. Dataset-specific recommended citation wording is **not available**; none has been invented.

| Collection | CMR concept | Verified DOI |
|---|---|---|
| NISAR_L2_GCOV_BETA_V1 | C3622214170-ASF | 10.5067/NIL2GCOV-B1 |
| NISAR_L2_GCOV_PROVISIONAL_V1 | C2854338529-ASF | 10.5067/NIL2GCOV-P1 |
| NISAR_L2_GCOV_V1 | C3622241360-ASF | 10.5067/NIL2GCOV-V1 |

Angat location: National Power Corporation telemetry specification, PDF page 34, lists the dam water-level station at 14°54′34.6″N, 121°09′40.3″E. This is a station, not a reservoir centroid. [NPC specification](https://www.napocor.gov.ph/bcsd/bid_files/Bid%20Docs_HO-FFW23-010.pdf).
