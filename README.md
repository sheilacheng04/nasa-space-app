# The Two-Faced Pacific

A climate story and SAR observatory for NASA Space Apps 2026, **Dancing with the SARs**. Vite, vanilla JavaScript, MapLibre GL JS and globe.gl; prepared for Vercel.

**The app works now. Quantitative NISAR findings await the team's dataset.** Real regional NISAR HH quicklooks, NOAA context and ERA5 weather snapshots are included. Quicklooks are never used to invent backscatter or water-area measurements.

## Run locally

Use Node 22.12 or later. On Windows PowerShell use `npm.cmd` if script execution policy blocks `npm.ps1`.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The source `index.html` uses modules and needs a server. For a double-click preview, open `demo/pacific-preview.html`.

## Deploy to Vercel

1. Push the project to GitHub and import it into Vercel.
2. Use **Vite**, install command `npm ci`, build command `npm run build`, output `dist`. These are declared in `vercel.json`.
3. Deploy. Environment variables are optional unless enabling AI.

This implementation has not been published to Vercel. Hash routes need no catch-all rewrite. `/api/analyze` is a Vercel Node function, outside `public/`. Scientific preprocessing runs before deployment, not per visitor. Earthdata credentials do not belong in Vercel or browser code.

For GitHub Pages, publish the contents of `dist/`. Relative paths are configured; AI falls back locally because Pages cannot execute the Vercel function.

## Included

| Section | Working behavior |
| --- | --- |
| Story | Original-style gradient hero, animated Pacific cross-section, stage buttons/playback, conceptual world-pattern map, dated NOAA context |
| Globe | Full-page atmospheric globe, country/place selection, 909 saved place locators, heat/rain/combined illustrations, timeline, tour, satellite window and CSV points |
| Observatory | Data-driven radar swipe, polarizations, change layers, time series, geographic map, weather charts, hypotheses |
| Local story | Philippine context; explicit slots for a genuine team account and credited photo |
| News & signals | Original 43-item archive, source links and filters, raw VADER and separate climate-adjusted scores, optional AI |
| My data | Validated CSV upload/paste, browser-local storage, table, globe points, template download |
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

Browser weather refresh explicitly requests ERA5. Every chart identifies model, units, dates and retrieval time. Missing values are not zero. Heat and rainfall are never derived from radar.

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

Local analysis always works. Hosted AI uses `api/analyze.js`. Configure these **server environment variables** in Vercel:

```text
ANTHROPIC_API_KEY=<server-side key>
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
AI_ENABLED=true
```

Before enabling this paid endpoint publicly, configure Vercel Firewall rate limiting for `/api/analyze` and provider spending limits. It is disabled by default. It checks POST JSON, origin and input size, constrains output and times out upstream calls. Origin validation is not authentication or a global rate limiter. Never prefix a secret with `VITE_`.

Only explicitly submitted text goes to AI. CSVs are never sent automatically. In compatible Claude previews the app attempts `claude.use('sample')`; that environment was unavailable for testing. Static hosting falls back locally. Vite does not emulate Vercel functions; use Vercel's development environment for a keyed endpoint test.

## Self-contained preview

```sh
npm run demo
```

Creates `demo/pacific-preview.html` with inline CSS, JavaScript, snapshots, outlines and illustrative SVGs. It makes zero network requests. `HOSTED` in `src/config.js` becomes false when the bootstrap sets `__PACIFIC_DEMO__`. The interactive 3D globe, built-in place search, story animation and comparison demo are bundled locally. Live satellite images, remote geocoding and detailed MapLibre maps need the hosted app. Source hyperlinks can still be opened deliberately.

## Verify

```powershell
npm.cmd test
.venv\Scripts\python.exe -m unittest discover -s tests -p test_pipeline.py -v
npm.cmd run build
npm.cmd run demo
npm.cmd run preview -- --port 4173
# In another terminal:
$env:TEST_URL = 'http://127.0.0.1:4173'
npm.cmd run test:browser
# Additional restored-interaction checks, against the same preview:
node scripts/restoration-check.mjs
```

Checks use installed Chrome/Edge on Windows. Set `BROWSER_PATH` for another executable, or install Playwright Chromium elsewhere. `TEST_URL` defaults to `http://127.0.0.1:4173`. Screenshots/reports are in ignored `.artifacts/`.

Tests cover uploads, safe links, compatible comparisons, API configuration, numeric nodata, COG output, browser navigation, maps, keyboard search, mobile overflow, offline preview and failed-weather fallback. Actual GCOV scientific validation still needs the real scenes and independent observations. Desktop phone emulation does not establish physical mid-range phone performance.

## Files

- `archive/original-prototype.html`: original modeled prototype, preserved outside the deployment.
- `public/data/`: snapshots, quicklooks, manifests and prepared rasters.
- `src/`: UI/styles; `api/`: Vercel function; `scripts/`: reproducible workflows.
- `submission/`: 90-second demo, 200-word summary and six-slide outline.
- [DATA_CREDITS.md](DATA_CREDITS.md): attribution and license boundaries.
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md): assumptions and outstanding inputs.

Code is MIT licensed. Data retain their own terms. This independent challenge project is not an official NASA product or operational warning service.
