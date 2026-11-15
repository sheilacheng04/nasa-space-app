# Study-area expansion — 15 November 2026

Three existing global study locations now have complete browse-evidence packages. The original four areas remain intact. There are **7 radar study areas, 88 saved GIBS frames and 34 global study locations**. Bounds and locator coordinates come from the existing reviewed place catalog; these are study boxes, not administrative boundaries.

| Added area | Catalog scenes (provisional / validated) | Saved daily GIBS images / requested dates | Regional HH/HV pair | Track / frame |
| --- | --- | --- | --- | --- |
| Cagayan Valley & Magat Basin, Philippines | 28 / 3 | 10 / 12 | 28 June–14 October 2026 | 32 / 80 |
| Mekong Delta, Vietnam | 95 / 12 | 11 / 12 | 24 June–10 October 2026 | 155 / 7 |
| Guayas & Babahoyo lowlands, Ecuador | 38 / 4 | 10 / 13 | 21 June–19 October 2026 | 112 / 89 |

Catalog discovery used the existing ASF/CMR query and official observation-plan intersection checks, bounded by the existing 14 November review date. Scene footprints intersect each study box. Regional pairs share track, frame, direction, PROVISIONAL maturity and P05023. Each pair has downloaded HH and HV quicklooks. This establishes catalog and visual evidence, not calibrated change or valid-pixel comparability.

GIBS images retain their exact TIME, BBOX, layer, request URL, retrieval timestamp and nontransparent pixel fraction. Missing 12-day slots remain explicit gaps. Several Mekong crops are about 67% nontransparent; the uncovered area remains transparent. The image time is a daily mosaic date. Pixel acquisition time, maturity and CRID remain unavailable. No pixel values were invented or filled. Sources: [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) and [ASF NISAR GCOV guidance](https://nisar-docs.asf.alaska.edu/gcov/).

Every new area has ERA5 daily context through 8 November 2026, 22 complete monthly values for January 2025–October 2026, an explicitly incomplete November, and all 12 same-calendar-month baselines from 30 complete years (1991–2020). The original temperature definition is retained: daily mean of maximum and minimum, then monthly average. These are reanalysis estimates at a point, not local gauges or whole-basin measurements. [Open-Meteo ERA5 source](https://open-meteo.com/en/docs/historical-weather-api).

The existing MODIS vegetation globe provides monthly geographic context for the added locations. Optical imagery in the satellite window remains an explicitly requested online NASA GIBS view. Its Study radar tab now uses the same saved regional evidence package as Sites, including offline thumbnails, so it works for all seven study areas.

The existing headline archive retains 16 matches for Cagayan, 2 for Mekong and none for Guayas. Additional GDELT requests were bounded to 25 records per area and the existing archive window. Cagayan and Mekong returned HTTP 429. Guayas returned 10 records, but no title matched both a local alias and a climate/water topic; a general industry-event headline was excluded. No articles were added. The exact queries and outcomes are in [the request audit](../public/data/study-area-news-audit.json). Existing match labels distinguish place, query and country matches; these are not verified impact reports.

Calibrated backscatter, salinity, crop health, water extent, reservoir volume and causal attribution are not supplied. Those require independent measurements and the existing authenticated, reviewed science pipeline. Full science products were not downloaded.

## Reproduce

Use the existing Python environment and `scripts/requirements.txt`:

```powershell
.venv/Scripts/python.exe scripts/expand_study_areas.py discover
.venv/Scripts/python.exe scripts/expand_study_areas.py fetch
.venv/Scripts/python.exe scripts/expand_study_areas.py publish
.venv/Scripts/python.exe scripts/expand_study_areas.py news
.venv/Scripts/python.exe scripts/package_evidence.py --site cagayan-valley --site mekong-delta --site guayas-babahoyo
npm.cmd run demo
npm.cmd run build
node scripts/study-area-check.mjs
```

Discovery is staged in `.artifacts/study-area-expansion.json`. Fetch reuses existing saved dates and context; missing 12-day slots are requested once. Publishing gates new areas on at least two real GIBS dates, both HH/HV regional pairs, and 12 complete 30-year baseline months. Existing sites are preserved. Candidate metadata lives in `scripts/study-area-candidates.json`. The place-catalog builder now derives radar flags from the saved site packages, preventing a later refresh from reverting the added areas.

## Presentation and offline packaging

The satellite-window launcher is a full-width orange action near the top of concept controls, before the layer and playback controls. It shows the selected location and falls back to the first study area before a selection. The former buried duplicate is removed. Opening brings the globe window into view; closing returns focus to the launcher.

The standalone edition retains two dated GIBS thumbnails and regional HH/HV browse for each of seven sites. Other date slots remain present and explicitly unavailable offline. Its JSON and image data URIs are losslessly gzip-compressed at build time and restored with the browser's native `DecompressionStream` before React starts. No package or network dependency was added. A current browser with that API is required; startup failure displays a readable message. The build verifies exact compression round-trip and retains the 3,000,000-byte HTML and 1,000,000-byte embedded-image budgets.

Assumptions: “more study areas” means promoting three already-listed places to evidence-backed studies; the existing review period, scientific limits and source families remain appropriate. News absence and partial imagery are acceptable only when displayed honestly.
