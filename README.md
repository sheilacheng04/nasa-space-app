# The Two-Faced Pacific
A NISAR-first field journal for NASA Space Apps 2026, **Dancing with the SARs**. React + TypeScript, with a static hosted build and a self-contained offline HTML.

**Real now:** dated NISAR browse for four covered sites, an ASF/CMR scene inventory checked against the observation plan, NOAA indices, ERA5 monthly comparisons, and 293 source-linked headlines. **Not available:** calibrated water-area and backscatter findings. Browse imagery is never treated as calibrated pixels.

## Open the app
- Double-click [el-nino-app.html](el-nino-app.html), also saved as [demo/pacific-preview.html](demo/pacific-preview.html). It makes zero external requests, includes real downsampled thumbnails, and labels simulated examples.
- For development: run `npm ci`, then `npm run dev:frontend`. Open the Vite URL.
- For hosting: run `npm run build`; serve `dist/`. It contains `index.html`, `css/`, `js/`, lazy assets, and `data/`. A Python API is not required for these five pages.
- `npm run dev` still supports the retained optional FastAPI backend. Account/real-AI functions require `globalThis.__PACIFIC_API__ = true` before startup and the configured backend. Browser-local CSV import works without it.

Node 22.12+ and Python 3.11+ are required. This revision was built with Node 25 and Python 3.13 on Windows. On PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

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

The first step records every supplied URL. Inventory is a decision gate: real intersecting GCOV scenes and a same-maturity pair must exist before science extraction. Root `data/` holds reproducible snapshots; `public/data/` contains the copies served by Vite. Manifests retain parameters, URL, retrieval time, maturity and CRID. [DATA_STATUS](docs/DATA_STATUS.md) records every blocked, missing and untested operation.

## Calibrated GCOV work
Credentials come only from the process environment variables **EARTHDATA_USERNAME** and **EARTHDATA_PASSWORD**. Supply them using your shell or secret manager; do not add them to source or paste them into the app. `.env`, raw downloads and local storage are ignored. Authentication uses `earthaccess.login(strategy="environment", persist=False)`. No interactive credential prompts or credential logging are used.

Run `scripts/fetch_nisar_gcov.py --site angat --harmony` to request HH, HV, mask, numberOfLooks and rtcGammaToSigmaFactor as spatially subset EPSG:4326 COGs. This authenticated branch is **untested** in this environment because the credentials are absent.

Run `scripts/fetch_nisar_gcov.py --inspect raw/scene.h5` on actual HDF5 before preparing a reviewed manifest. Update [scripts/manifest.example.json](scripts/manifest.example.json) with the real paths, acquisition metadata, frame, explicit reviewed valid mask values and `unitsAndMasksReviewed: true` only after inspection. Run:
~~~text
python scripts/fetch_nisar_gcov.py --manifest raw/manifest.json
python scripts/package_evidence.py
~~~
For reviewed Harmony COG subsets, use manifest kind `gcov-subset`, explicit `units` (`linear_power` or `dB`), `channels` paths for HH/HV, and `metadataLayers` paths for `mask`, `numberOfLooks`, and `rtcGammaToSigmaFactor`. They must share a grid. This branch still requires actual HDF5 metadata review and explicit valid mask values; the script fails closed on unknown units or missing metadata.

The processor uses a common metric grid, averages linear power before dB conversion, keeps gamma-0 normalization, blocks mixed maturity/CRID cohorts and propagates missing pixels. Candidate water uses explicit HH/HV thresholds; defaults are -17/-24 dB and are not calibrated for these sites. Supply documented OPERA class mappings and dated reference rasters for agreement/IoU. WorldCover means require a supplied raster and class mapping. No actual validation result is claimed.

## Pages and interaction
**Story → Sites → Globe → Media → Data and method.** Local writing/photo slots and future applications finish Story. Sites has real-image swipe, date availability, HH/HV regional quicklooks, gaps, source metadata, hypothesis tests and monthly weather comparisons. Computed channels remain disabled until real GCOV products exist. The 3D globe and MapLibre load on demand. The globe climate overlays, ocean mechanism and opt-in radar demo are simulated. CSV imports stay in the browser; the Claude-style offline sample is a local heuristic, not a model response.

`HOSTED` in [src/config.js](src/config.js) controls live imagery and map requests. The offline builder sets `__PACIFIC_DEMO__=true`, embeds saved data and thumbnails, and disables live requests. Optional live requests have bounded timeouts and visible fallback states. Real AI requires a configured server, never a client API key.

## Verify
~~~text
npm test
python -m unittest discover -s tests -p "test_*.py"
npm run build
npm run demo
~~~
For browser tests, start `npm run dev:frontend -- --port 5174`, then run `node scripts/revision-browser-check.mjs`. Set `CHECK_OFFLINE=1` to include the standalone HTML. The browser runner uses an installed Chrome/Edge or Playwright Chromium. Results and screenshots are in ignored `.artifacts/`; the human-readable report is [docs/VALIDATION.md](docs/VALIDATION.md).

First-load budgets: hosted initial page <3 MB; offline file <3 MB; embedded real image data URIs <1 MB. Heavy globe/map assets are deferred in hosted mode. The offline edition includes two real GIBS dates per site, both HH/HV quicklooks, complete monthly comparisons and the last 60 daily weather rows.

## Credits, submission and assumptions
[Data credits](DATA_CREDITS.md), [data status](docs/DATA_STATUS.md), [assumptions](docs/ASSUMPTIONS.md), [90-second script](submission/demo-script.md), [200-word summary](submission/project-summary.md), [six-slide outline](submission/slides.md).

MIT covers the software only. Data retain their providers' terms. The exact accessible ASF guidance sentence is quoted in Data and method; the dataset-specific NASA citation is explicitly unavailable because the linked guidance returned 403. No attribution to El Niño is established by one season.
