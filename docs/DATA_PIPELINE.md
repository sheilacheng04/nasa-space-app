# Refreshing and processing the data

These optional steps are for contributors updating the saved evidence or working with scientific radar products. You do not need them to open or run the website. Run commands from the repository root.

[Back to the README](../README.md)

## Re-run the evidence pipeline
Create a virtual environment and install the requested scientific dependencies:
~~~powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
.venv\Scripts\python.exe scripts/check_sources.py
.venv\Scripts\python.exe scripts/inventory_nisar.py
.venv\Scripts\python.exe scripts/fetch_gibs_nisar.py
.venv\Scripts\python.exe scripts/fetch_browse_pairs.py
.venv\Scripts\python.exe scripts/fetch_nisar_gcov.py
.venv\Scripts\python.exe scripts/fetch_context.py
.venv\Scripts\python.exe scripts/news_sentiment.py
.venv\Scripts\python.exe scripts/package_evidence.py
.venv\Scripts\python.exe scripts/write_data_status.py
npm.cmd run demo
npm.cmd run build
~~~
On macOS/Linux use `.venv/bin/python` and `npm`. Pipeline defaults pin the review to 14 November 2026; edit the explicit dates for a new edition. Weather downloads can trigger provider rate limits; retain saved results and retry later. Do not issue unbounded retries.

The first step records every supplied URL. Inventory is a decision gate: real intersecting GCOV scenes and a same-maturity pair must exist before science extraction. `public/data/` is the single authoritative copy of all saved evidence and is served by Vite at `/data/`. All pipeline scripts write there directly. Manifests retain parameters, URL, retrieval time, maturity and CRID. [DATA_STATUS](DATA_STATUS.md) records every blocked, missing and untested operation.

## Calibrated GCOV work
Credentials come only from the process environment variables **EARTHDATA_USERNAME** and **EARTHDATA_PASSWORD**. Supply them using your shell or secret manager; do not add them to source or paste them into the app. `.env`, raw downloads and local storage are ignored. Authentication uses `earthaccess.login(strategy="environment", persist=False)`. No interactive credential prompts or credential logging are used.

Run `scripts/fetch_nisar_gcov.py --site angat --harmony` to request HH, HV, mask, numberOfLooks and rtcGammaToSigmaFactor as spatially subset EPSG:4326 COGs. This authenticated branch is **untested** in this environment because the credentials are absent.

Run `scripts/fetch_nisar_gcov.py --inspect raw/scene.h5` on actual HDF5 before preparing a reviewed manifest. Update [scripts/manifest.example.json](../scripts/manifest.example.json) with the real paths, acquisition metadata, frame, explicit reviewed valid mask values and `unitsAndMasksReviewed: true` only after inspection. Run:
~~~text
python scripts/fetch_nisar_gcov.py --manifest raw/manifest.json
python scripts/package_evidence.py
~~~
For reviewed Harmony COG subsets, use manifest kind `gcov-subset`, explicit `units` (`linear_power` or `dB`), `channels` paths for HH/HV, and `metadataLayers` paths for `mask`, `numberOfLooks`, and `rtcGammaToSigmaFactor`. They must share a grid. This branch still requires actual HDF5 metadata review and explicit valid mask values; the script fails closed on unknown units or missing metadata.

The processor uses a common metric grid, averages linear power before dB conversion, keeps gamma-0 normalization, blocks mixed maturity/CRID cohorts and propagates missing pixels. Candidate water uses explicit HH/HV thresholds; defaults are -17/-24 dB and are not calibrated for these sites. Supply documented OPERA class mappings and dated reference rasters for agreement/IoU. WorldCover means require a supplied raster and class mapping. No actual validation result is claimed.


## Refresh the globe images

Run `python scripts/render_globe_frames.py` for radar and `python scripts/fetch_globe_vegetation.py` for vegetation. Saved assets live in `public/data/globe/`. Review the resulting records before running `npm run demo` and `npm run build`. The offline edition contains only a small selection of the hosted images.
