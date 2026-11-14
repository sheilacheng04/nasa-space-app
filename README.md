# The Two-Faced Pacific
A global, plain-language story connecting Pacific conditions, rainfall and changes on land for NASA Space Apps 2026, **Dancing with the SARs**. React + TypeScript, with a static hosted build and a self-contained offline HTML.

**Real now:** dated NISAR browse for four sites, global radar overviews, 21 monthly MODIS vegetation images, an ASF/CMR scene inventory, NOAA indices, ERA5 comparisons and 293 source-linked headlines. Calibrated water-area and backscatter findings remain unavailable; image changes do not establish land motion, water level or an El Niño cause.

## Open the app
- Double-click [el-nino-app.html](el-nino-app.html). It makes zero external requests, includes real downsampled thumbnails, and labels simulated examples.
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

The first step records every supplied URL. Inventory is a decision gate: real intersecting GCOV scenes and a same-maturity pair must exist before science extraction. `public/data/` is the single authoritative copy of all saved evidence and is served by Vite at `/data/`. All pipeline scripts write there directly. Manifests retain parameters, URL, retrieval time, maturity and CRID. [DATA_STATUS](docs/DATA_STATUS.md) records every blocked, missing and untested operation.

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
**Story → Sites → Globe → Media → Data and method.** Story begins with the global ocean–rainfall–land connection and introduces radar without assuming a science background. Four local examples and source-linked headlines make the questions concrete. Data and method follows the question, each source's role, fair comparisons and conclusions; its glossary, processing details, source ledger, citations and optional CSV import expand when needed.

Sites offers full-image playback alongside the retained before/after comparison. Its **57 saved NASA GIBS frames** comprise Luzon 12, Angat 12, Dadu 22 and Piura 11. Each site's bounds stay fixed as exact dated images advance in discrete steps. Gaps, loading and failures clear the previous image; playback waits for each frame. HH/HV regional quicklooks, hypotheses, weather comparisons and source inspectors remain available. Computed channels stay disabled until real GCOV products exist.

Globe has visible date controls and playback for exact-date radar, plus separate month controls, annual comparisons and playback for real MODIS NDVI. Ocean-mechanism and weather-driven land illustrations remain explicitly conceptual. The original typography, colors, rounded controls and both themes are preserved. Heavy globe/map engines load on demand. CSV stays in the browser; the Claude-style offline sample is a labeled local heuristic.

`HOSTED` in [src/config.js](src/config.js) controls live imagery and map requests. The offline builder sets `__PACIFIC_DEMO__=true`, embeds saved data and thumbnails, and disables live requests. Optional live requests have bounded timeouts and visible fallback states. Real AI requires a configured server, never a client API key.

## Verify
~~~text
npm test
python -m unittest discover -s tests -p "test_*.py"
npm run build
npm run demo
~~~
For browser tests, start `npm run dev:frontend -- --port 5174`, then run `npm run test:browser`. Set `CHECK_OFFLINE=1` to include the standalone HTML. The browser runner uses an installed Chrome/Edge or Playwright Chromium. Additional suites are `npm run test:site-timeline`, `npm run test:globe-display` and `npm run test:satellite`. Results and screenshots are in ignored `.artifacts/`; [docs/VALIDATION.md](docs/VALIDATION.md) records endpoints and the latest results.

Latest revision: production build and 15 Node tests passed, along with 63 browser checks (15 general, 17 globe display, 12 site timeline, 19 satellite). Python was unchanged and not rerun this turn. Measured Story response bodies: **324,350 bytes**; offline HTML: **2,992,188 bytes**; embedded image data URIs: **583,548 bytes**.

First-load budgets: hosted initial page <3 MB; offline file <3 MB; embedded real image data URIs <1 MB. Heavy globe/map assets are deferred in hosted mode. The offline edition includes three real global radar frames, two real GIBS dates per site, both HH/HV quicklooks, complete monthly comparisons and the last 60 daily weather rows.

## Repository layout
- `src/`: the five-page React app, with the restored original design.
- `public/data/`: saved evidence, provenance, browser assets and observation schemas.
- `scripts/`: current evidence pipeline, build and verification commands.
- `backend/`: optional FastAPI accounts and live services.
- `docs/` and `submission/`: methods, validation and submission materials.
- `el-nino-app.html`: the one self-contained edition, regenerated by `npm run demo`.

`dist/` and `.artifacts/` are generated and ignored. Dependencies and local account data stay in `node_modules/`, `.venv/` and `.storage/`. Earlier prototypes and superseded implementations remain in Git history. `npm run refresh` uses the current context/news pipeline and rebuilds the evidence index; it does not use the retired snapshot updater.

## Credits, submission and assumptions
[Data credits](DATA_CREDITS.md), [data status](docs/DATA_STATUS.md), [assumptions](docs/ASSUMPTIONS.md), [90-second script](submission/demo-script.md), [200-word summary](submission/project-summary.md), [six-slide outline](submission/slides.md).

MIT covers the software only. Data retain their providers' terms. The exact accessible ASF guidance sentence is quoted in Data and method; the dataset-specific NASA citation is explicitly unavailable because the linked guidance returned 403. No attribution to El Niño is established by one season.

## Satellite globe and land through time

Satellite opens with a bundled NASA Blue Marble optical Earth beneath exact-date NISAR radar strips. The background is a historical 2004 reference, not current imagery or extra NISAR coverage. Saved radar frames load first; the public NASA GIBS API is an exact-date recovery path. A missing radar day leaves Earth visible. Show more radar coverage selects a genuinely fuller recorded day.

Concept uses calendar months, with 21 real MODIS Terra monthly NDVI images between January 2025 and October 2026. April 2025 is explicitly unavailable. Its land vegetation display changes with the selected month. Local ERA5 rainfall and temperature departures, preceding NOAA ocean records, and separate conceptual soil/water/vegetation drawings help form hypotheses to test with SAR. They do not establish measured land damage or El Nino attribution. November 2026 remains manually selectable as incomplete weather context.

Both modes retain the original fonts, rounded controls and light/dark themes. The camera and each mode's selected date persist. Global images are downsampled browse overviews; zooming does not add farm-scale detail. See [sources and interpretation](docs/DATA_STATUS.md#satellite-earth-and-dated-land-observations).

Refresh radar with `python scripts/render_globe_frames.py` and vegetation with `python scripts/fetch_globe_vegetation.py`. Then run `npm run demo` and `npm run build`. Assets live under `public/data/globe/`. The standalone file embeds the optical Earth, three radar frames and two monthly vegetation frames within its 3 MB budget.

With Vite on 5174, `npm run test:globe-display` checks the optical texture, unchanged radar colors, dated land changes, missing months, request races, graphics recovery and mobile layout. With the production preview on 5175, run `npm run test:satellite` and the existing browser suite. Physical phone performance remains untested.
