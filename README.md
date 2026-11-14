# The Two-Faced Pacific

A climate story and SAR observatory for NASA Space Apps 2026, **Dancing with the SARs**. **React + TypeScript frontend, Python FastAPI backend, and SQLAlchemy database**. SQLite runs locally; PostgreSQL is required in production. MapLibre GL JS and globe.gl power the maps.

**The app works now. Quantitative NISAR findings await the team's dataset.** Real regional NISAR HH quicklooks, NOAA context and ERA5 weather snapshots are included. Quicklooks are never used to invent backscatter or water-area measurements.

## Run locally

Use Node 22.12+ and Python 3.13. On Windows:

~~~powershell
npm.cmd ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm.cmd run dev
~~~

Open http://127.0.0.1:5173. One command starts React and the Python API. The local SQLite database is created at `.storage/pacific.db`. On macOS/Linux use `npm` and `.venv/bin/python`.

`index.html` is the React entrypoint. The frontend is in `src/App.tsx`, `src/pages/` and `src/components/`; the backend is in `backend/`. The double-clickable `demo/pacific-preview.html` is an intentionally offline demonstration.

For a compiled application served entirely by Python:

~~~powershell
npm.cmd run build
npm.cmd start
~~~

Open http://127.0.0.1:4173. API docs: `/api/docs`. See **[docs/FULLSTACK.md](docs/FULLSTACK.md)** for architecture, endpoints, accounts and validation.

## Accounts and persistence

CSV imports remain browser-local until you choose **Save to account** in My data. Create a username/password account to save named datasets, reopen them across sessions, update them, export CSV or delete a server copy. Passwords use Argon2id; sessions use HttpOnly cookies. Accounts can access only their own datasets.

## Deploy to Vercel

The tracked configuration uses the **FastAPI** preset, builds React with Vite and serves assets through the supported static-file integration. Configure persistent PostgreSQL `DATABASE_URL`, `APP_ENV=production` and the exact HTTPS `APP_ORIGIN`. Initialize the database once with `python -m backend.manage init-db` in the configured environment, then deploy.

Deployment and a hosted PostgreSQL connection have not been performed. See [docs/FULLSTACK.md](docs/FULLSTACK.md#vercel-deployment). The full system requires its API; publishing `dist/` alone to static hosting does not run it. Scientific preprocessing runs before deployment, not per visitor.

## Included

| Section | Working behavior |
| --- | --- |
| Story | Original-style gradient hero, animated Pacific cross-section, stage buttons/playback, conceptual world-pattern map, dated NOAA context |
| Globe | Full-page atmospheric globe, country/place selection, 909 saved place locators, heat/rain/combined illustrations, timeline, tour, satellite window and CSV points |
| Observatory | Data-driven radar swipe, polarizations, change layers, time series, geographic map, weather charts, hypotheses |
| Local story | Philippine context; explicit slots for a genuine team account and credited photo |
| News & signals | Original 43-item archive, source links and filters, raw VADER and separate climate-adjusted scores, optional AI |
| My data | Local CSV import, globe points, optional login and persistent private datasets |
| Data & method | Source register, availability, processing and scientific limits |

The UI follows the supplied original HTML: compact navigation, system fonts, rounded panels, light/dark themes and a full-page Globe view. Ocean and globe colors are locally labeled conceptual; real climate and radar data stay separately sourced. Animations pause when hidden or offscreen.

The globe supports WebGL 1 and WebGL 2. In previews that block WebGL it automatically uses an interactive Compatibility view, preserving rotation, zoom, search and study-site controls. The compatible browser bundle is local, including in the offline HTML.

Heavy WebGL code and browse images load only when needed in the hosted app. See [docs/VALIDATION.md](docs/VALIDATION.md) for measured checks and limitations.

## Refresh context

Use Python 3.11–3.13. Commands below use Windows; substitute `.venv/bin/python` on macOS/Linux.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
.venv\Scripts\python.exe -u scripts/refresh_context.py --end 2026-11-06 --browse
```

`--end` is the last day of a 60-day ERA5 period; default is today minus seven days. `--browse` adds real regional NISAR HH images and ASF metadata. Files record retrieval timestamps and source URLs. `scripts/requirements.lock.txt` records the complete tested Python environment; the shorter requirements file pins direct dependencies. The reviewed advisory remains separate from the automatically refreshed historical ONI table.

Failures retain the last good snapshot. GDELT returned HTTP 429 during implementation, so the supplied archive remains explicitly labeled. Recompute its scores without calling GDELT:

```powershell
.venv\Scripts\python.exe scripts/refresh_context.py --score-only
```

VADER uses the actual `vaderSentiment` package. The separately named climate adjustment neutralizes `warm`, `warming`, `positive`, `negative`, `record`, `records`, `anomaly`, and `anomalies`. This is a project heuristic; both scores stay visible. Imported scores remain only as `legacyScore`. Headline sentiment is not public opinion, scientific confidence or climate risk.

The Python weather endpoint explicitly requests ERA5 and caches the last successful response. Every chart identifies model, units, dates and retrieval time. Missing values are not zero. Heat and rainfall are never derived from radar.

## Add tomorrow's radar data

See **[docs/DATA_HANDOFF.md](docs/DATA_HANDOFF.md)** for required files and metadata.

```powershell
.venv\Scripts\python.exe scripts/discover.py --site angat --start 2026-10-21 --end 2026-11-13 --source nisar --maturity VALIDATED
.venv\Scripts\python.exe scripts/inspect_gcov.py raw/angat/before.h5
# Copy scripts/manifest.example.json to raw/angat/manifest.json; replace every placeholder.
.venv\Scripts\python.exe scripts/prepare_radar.py raw/angat/manifest.json
npm.cmd test
npm.cmd run build
```

Repeat for `luzon` and `dadu`. Metadata search is public. Optional `--download` prompts for Earthdata credentials without storing them in the repository. Inspect candidates before downloading large HDF5s.

The pipeline requires explicit acquisition metadata and reviewed mask codes. It extracts available channels, averages positive linear power on a shared UTM grid, converts to dB, and writes COGs, geographic PNGs and paired-valid-pixel differences. It records SHA-256 input hashes. Each run writes a new asset directory, so a failed run cannot overwrite the files referenced by the last successful manifest. Comparisons cannot mix sensors, tracks, directions, frequency groups, maturities or processing versions. It does not classify a backscatter difference as a flood or drought.

GCOV `HHHH`, `HVHV`, `VVVV` and `VHVH` map to HH, HV, VV and VH. RGB requires HH and HV; absent channels stay disabled. Output spacing is a declared resampling choice, not native resolution.

For a longer baseline, discover Sentinel-1 with `--source sentinel`, then process GRD to calibrated RTC using a documented external workflow. Import GeoTIFFs as `kind: rtc`. Never subtract C-band from L-band as equivalent observations. `kind: water` accepts OPERA categorical rasters with explicit valid and water classes, without treating class codes as dB.

## Optional context rasters

WorldCover, WorldPop and Copernicus DEM local inputs remain pending. Prepare an attributed GeoTIFF with:

```powershell
.venv\Scripts\python.exe scripts/prepare_context.py raw/worldcover.tif --site angat --kind landcover --date 2021 --attribution "ESA WorldCover 2021 / CC BY 4.0" --source-url https://esa-worldcover.org/en/data-access
```

Use `population` or `elevation` for other kinds, recording the real product/year/license. This adds a geographic-map overlay. Population display does not calculate exposure; elevation does not calculate flood depth. NASA GIBS imagery loads only when its checkbox is enabled.

## Optional AI

Local keyword analysis always works. The Python `/api/analyze` endpoint uses these server-only variables:

~~~text
ANTHROPIC_API_KEY=<server-side key>
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
AI_ENABLED=true
~~~

AI is disabled by default. When enabled, callers must sign in; database-backed limits cap requests per account. Set provider spending limits and deployment-level abuse controls before a public rollout. Only explicitly submitted headline text goes to the provider. CSVs are never sent to AI automatically. Never prefix secrets with `VITE_`.

## Self-contained preview

```sh
npm run demo
```

Creates `demo/pacific-preview.html` with inline CSS, JavaScript, snapshots, outlines and illustrative SVGs. It makes zero network requests. The shared API client and visualization config disable network services when the bootstrap sets `__PACIFIC_DEMO__`. The interactive 3D globe, built-in place search, story animation and comparison demo are bundled locally. Live satellite images, remote geocoding and detailed MapLibre maps need the hosted app. Source hyperlinks can still be opened deliberately.

## Verify

```powershell
npm.cmd run check
.venv\Scripts\python.exe -m unittest discover -s tests -p test_pipeline.py -v
npm.cmd run build
npm.cmd run demo
npm.cmd start
# In another terminal:
$env:TEST_URL = 'http://127.0.0.1:4173'
npm.cmd run test:browser
npm.cmd run test:fullstack
# Additional restored-interaction checks, against the same preview:
node scripts/restoration-check.mjs
```

Checks use installed Chrome/Edge on Windows. Set `BROWSER_PATH` for another executable, or install Playwright Chromium elsewhere. `TEST_URL` defaults to `http://127.0.0.1:4173`. Screenshots/reports are in ignored `.artifacts/`.

Tests cover uploads, safe links, compatible comparisons, API configuration, numeric nodata, COG output, browser navigation, maps, keyboard search, mobile overflow, offline preview and failed-weather fallback. Actual GCOV scientific validation still needs the real scenes and independent observations. Desktop phone emulation does not establish physical mid-range phone performance.

## Files

- `archive/original-prototype.html`: original modeled prototype, preserved outside the deployment.
- `public/data/`: snapshots, quicklooks, manifests and prepared rasters.
- `src/`: React/TypeScript UI, API client, styles and visualization modules.
- `backend/`: Python API, validation, authentication, database and integration tests.
- `scripts/`: launcher, browser checks and scientific workflows.
- `submission/`: 90-second demo, 200-word summary and six-slide outline.
- [DATA_CREDITS.md](DATA_CREDITS.md): attribution and license boundaries.
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md): assumptions and outstanding inputs.

Code is MIT licensed. Data retain their own terms. This independent challenge project is not an official NASA product or operational warning service.
