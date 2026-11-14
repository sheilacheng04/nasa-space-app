# Project handoff: The Two-Faced Pacific

> **Latest fix:** The blank globe now uses the original WebGL 1/2 compatible bundle, with an interactive canvas fallback and graphics-context recovery. Hosted and offline compatibility checks passed. See the final section of [docs/UI_RESTORATION.md](docs/UI_RESTORATION.md).

> **Update, 14 November 2026:** The user requested restoration of the supplied original UI, globe and animations. That work is complete. Read [docs/UI_RESTORATION.md](docs/UI_RESTORATION.md) for the current interface, full offline 3D globe, camera fix and latest test results. The older editorial design direction and offline-globe limitations below are historical; the scientific data requirements and pending-data status still apply.

Prepared from the working tree and saved validation records on 13 November 2026.

**Current position:** the modular application, standalone offline preview, preprocessing tools and submission drafts are implemented. The last recorded build and automated checks passed. The team's actual scientific dataset is still pending. No quantitative site finding should be presented as measured NISAR evidence yet. The project is prepared for Vercel but has not been deployed.

This handoff is documentation only. No application, data, configuration or test files were changed to prepare it. Test results below describe the preceding implementation session; they were inspected, not rerun for this document.

Workspace: `C:\Users\Sheila\Downloads\NASA Space App\nasa-space-app`.

## 1. Project objective and requirements

Build an interactive, open-source NASA Space Apps 2026 entry for **Dancing with the SARs**. Turn the original single-file prototype into a working, maintainable site that explains surface change through radar observations, context and a coherent climate story. The working title is **The Two-Faced Pacific**.

The user's latest hosting requirement is **Vercel**. This takes precedence over the older pasted brief's GitHub Pages target. Static deployment remains possible, with local analysis instead of a server AI function.

The source briefs are preserved outside the repository at:

- `C:\Users\Sheila\.codex\attachments\0a39afe0-9a20-4c87-aa08-a38b69b19730\Pasted text.txt`: NASA challenge description.
- `C:\Users\Sheila\.codex\attachments\77a67c79-4ac1-4bbc-b51e-1044029b185a\Pasted text.txt`: detailed design and engineering requirements.

Essential requirements:

- Real NISAR observations for Central Luzon and Angat, with Dadu, Sindh as a flood-method test case. Support calibrated Sentinel-1 RTC or OPERA water products when appropriate, preserving sensor/product distinctions.
- Comparable before/after images, a change layer, acquisition playback, polarization exploration and time-series charts. Expose only polarizations actually present.
- Per-site hypotheses, physical explanations, disconfirming evidence and human drivers such as irrigation, dam operations and land use.
- Real climate context from NOAA and ERA5; radar does not measure air temperature or prove an El Nino cause. Do not replace missing science with invented measurements.
- Optical imagery, land cover, population and elevation context; a genuine Philippine local story and credited photo; future NISAR applications and transparent methodology.
- Retain news, source links, actual VADER scores, a separate climate adjustment and optional AI re-scoring. Keep uploaded CSV data local unless explicitly submitted elsewhere.
- An editorial design: warm off-white, near-black, serif headlines, system body fonts, tabular numeric text, orange for heat, blue for water and grayscale radar. Thin rules and whitespace replace the prototype's card-heavy presentation.
- Keyboard operation, visible focus, reduced-motion support, mobile layout and accessible chart alternatives. Initial loading below 3 MB; eventually verify on a physical mid-range phone.
- Two outputs: a hosted modular app and a self-contained, clearly labeled offline HTML preview. Live requests need error handling, timeouts and fallbacks.
- MIT code license, data credits, reproducible setup, a 90-second demo script, a 200-word summary and a six-slide outline.

The user said actual data would arrive tomorrow relative to implementation. Treat this as an outstanding input, not an automatic release guarantee. Educational/noncommercial use is assumed; paid APIs are disabled.

## 2. Features already implemented and working

Six sections share hash navigation, a sticky header, progress indicator and command-style search:

| Section | Implemented behavior | Current data boundary |
| --- | --- | --- |
| Story | Pacific locator, interactive trade-wind/warm-pool explanation, dated NOAA context, study-site links | Animation is conceptual, not a measured global heat map |
| Observatory | Site selection, available polarizations, before/after swipe, change display, acquisition playback, charts, hypotheses, local map and weather | Controls are exercised with explicit illustrative data; scientific site packages remain pending |
| Local story | Philippine context and slots for an authentic team account and photo | Personal account, permissions and photo have not been supplied |
| News and signals | 43-item archive, filters, source links, raw VADER and climate-adjusted scores, local text analysis and optional AI | Fresh GDELT retrieval was rate limited; article claims/links are not independently reverified |
| My data | CSV upload/paste, validation, preview, template download, persistence, clearing and globe points | User observations are not silently uploaded or treated as satellite measurements |
| Data and method | Source register, processing, availability, limits and future applications | Real-data interpretation and external scientific validation remain outstanding |

Additional working behavior:

- Lazy-loaded globe.gl globe with study-site tour and user points; D3/SVG locators for light/offline contexts.
- Lazy-loaded MapLibre map with local Natural Earth outlines, study bounds, prepared radar/context overlays and optional dated NASA GIBS MODIS imagery.
- Real ASF NISAR HH regional browse images and catalogue metadata for all sites. These are attributed thumbnails, not georeferenced quantitative site observations.
- Saved ERA5 snapshots with explicit browser refresh and last-good-snapshot fallback.
- Search for app content plus explicitly requested Photon place search; keyboard selection and mobile bottom sheet.
- CSV input capped at 1 MB and 2,000 observations. Bad rows reject the import atomically; missing numeric values remain missing and zero remains zero.
- SVG charts with units, sources, missing-data gaps, actual timestamp spacing and data-table alternatives.
- Optional Vercel AI proxy with server-only credentials and local fallback. Disabled by default; live provider calls untested.
- Standalone HTML opens from disk with zero network requests.
- Python discovery, GCOV inspection, radar preparation, context import and refresh tools. Controlled numerical fixtures pass; this does not validate findings on the pending team dataset.

## 3. Files created or modified and their purposes

### Root and deployment

| Path | Purpose/status |
| --- | --- |
| `index.html` | Modified: semantic six-section shell/content, loaded through Vite |
| `README.md` | Modified: setup, deployment, refresh, data ingestion, optional AI, offline output and verification |
| `package.json`, `package-lock.json` | New: pinned JavaScript dependencies and commands |
| `vite.config.js` | New: relative asset base, ES2022 build, development server and production security headers for preview |
| `vercel.json` | New: install/build/output settings, Node function limit and security headers |
| `.env.example` | New: optional server AI configuration, no secret values |
| `.gitignore` | New: excludes dependencies, builds, raw inputs, environments, credentials and validation artifacts |
| `LICENSE` | New: MIT code license; data retain their own terms |
| `DATA_CREDITS.md` | New: attribution, licensing boundaries and pending sources |
| `archive/original-prototype.html` | New: preserved original modeled prototype, outside production output |
| `HANDOFF.md` | New: this continuation record |

`index.html.html` was already deleted in the user's working tree before implementation. Its deletion was left unchanged. Do not restore, stage or remove it incidentally.

### Browser application

| Path | Purpose |
| --- | --- |
| `src/app.js` | Startup, routing, section rendering, search, weather state, news, CSV persistence and tours |
| `src/config.js` | `HOSTED` flag, data root, timeout, review date and polarization explanations |
| `src/styles.css` | Editorial design, typography, responsiveness, focus and reduced motion |
| `src/map.css` | Radar/map controls, image comparison and map presentation |
| `src/core.js` | Escaping, safe URLs/assets, CSV parsing, observation validation, comparison compatibility, local sentiment/storage |
| `src/services.js` | Timed requests, data loading, ERA5, Photon and optional AI/fallback |
| `src/charts.js` | SVG charts, descriptions/tables, units, gaps and timestamp positions |
| `src/world.js` | SVG locators, conceptual ocean diagram, lazy globe and guided tour |
| `src/radar.js` | Pending/ready/demo states, channels, dates, swipe, comparisons, charts and map lifecycle |
| `src/local-map.js` | MapLibre and explicit bundled worker, geographic overlays and GIBS request |
| `src/demo.js` | Explicitly invented HH/HV acquisitions/comparison for interaction preview |
| `src/method.js` | Source/methodology presentation |
| `api/analyze.js` | Optional Vercel POST endpoint for Anthropic; validation, origin check, output limit, timeout and safe errors |

### Data and generated outputs

| Path | Contents/purpose |
| --- | --- |
| `public/data/sites.json` | Study rectangles, questions, hypotheses, evidence and human drivers |
| `public/data/enso.json` | Dated NOAA advisory and separate historical ONI series |
| `public/data/sources.json` | Source register and review information |
| `public/data/news.json` | 43 archived headlines, `legacyScore`, actual raw/adjusted VADER and review status |
| `public/data/world.topo.json` | Local world-atlas/Natural Earth outlines |
| `public/data/WORLD_ATLAS_LICENSE.txt` | Distributed world-atlas license |
| `public/data/observations/{luzon,angat,dadu}.json` | Version 1 packages: pending, empty acquisitions/comparisons/context layers, real browse metadata |
| `public/data/browse/*-hh.png` | Real regional NISAR quicklooks cached locally |
| `public/data/browse/*-catalog.json` | ASF metadata, retrieval times and query provenance |
| `public/data/context/{luzon,angat,dadu}.json` | Saved 60-day ERA5 temperature/rainfall with source URLs |
| `public/data/demo/HH-{0,1,2}.svg`, `HV-{0,1,2}.svg`, `change.svg` | Labeled schematic radar images for the illustrative package |
| `public/data/example-observation.json` | Pending browser-package example |
| `public/data/rasters/` | Future science output destination; no team science raster ingested |
| `demo/pacific-preview.html` | Self-contained offline preview; 387,581 bytes at handoff |
| `dist/` | Production build, ignored by Git; rebuild before deployment |

### Processing, tests and documentation

| Path | Purpose |
| --- | --- |
| `scripts/discover.py` | ASF NISAR/Sentinel or earthaccess OPERA search; optional explicit Earthdata download |
| `scripts/inspect_gcov.py` | Inspect HDF5 shapes, attributes and small metadata before selecting masks/channels |
| `scripts/prepare_radar.py` | Reviewed GCOV, calibrated RTC or categorical water manifests to COGs/PNGs/browser packages |
| `scripts/prepare_context.py` | Attributed land-cover/population/elevation GeoTIFF overlays and package registration |
| `scripts/manifest.example.json` | Input template; replace placeholders and review mask values |
| `scripts/refresh_context.py` | ERA5, historical ONI, optional ASF browse, GDELT and VADER; last-good fallback |
| `scripts/requirements.txt` | Pinned direct Python dependencies |
| `scripts/requirements.lock.txt` | Complete frozen environment used for validation |
| `scripts/build-demo.mjs` | Inline JS/CSS/data/SVG and light offline replacements for live views |
| `scripts/browser-check.mjs` | Fourteen browser checks, screenshots, loading measurement and console report |
| `scripts/service-check.mjs` | Browser ERA5/Photon/GIBS checks under the security policy |
| `scripts/capture-preview.mjs` | Clean screenshots and actual optical-control check |
| `tests/core.test.js` | Nine Node tests for parsing, links, comparison/schema, local tone and endpoint guards |
| `tests/test_pipeline.py` | Four Python tests for dB/nodata, paired pixels, synthetic GCOV and end-to-end RTC |
| `docs/DATA_HANDOFF.md` | Incoming files, bounds, metadata, masks and schemas |
| `docs/ASSUMPTIONS.md` | Hosting/data/use assumptions and outstanding inputs |
| `docs/VALIDATION.md` | Saved checks, environment, performance and limits |
| `submission/demo-script.md` | 90-second narrative matching pending-data state |
| `submission/project-summary.md` | 200-word body, excluding heading |
| `submission/slides.md` | Six-slide outline |
| `.artifacts/` | Ignored browser/service reports and screenshots |
| `.venv/`, `node_modules/` | Installed local dependencies, ignored by Git |

## 4. Architecture, dependencies and data flow

### Runtime and dependencies

The frontend is vanilla ES modules built by Vite; no React application, database or user account service is required. Hash routes avoid server-side rewrites. Static data are copied from `public/` into `dist/`. CSV data use localStorage key `pacific-observations`.

Declared Node requirement: `>=22.12.0`. Recorded test environment: Node 25.6.1, Python 3.13.4, Windows and installed Chrome. README recommends Python 3.11-3.13.

| JavaScript dependency | Pinned version |
| --- | --- |
| d3-geo | 3.1.1 |
| globe.gl | 2.32.0 |
| maplibre-gl | 6.18.0 |
| topojson-client | 3.1.0 |
| Vite | 6.4.6 |
| esbuild | 0.25.12 |
| @playwright/test | 1.56.1 |

Direct Python pins: numpy 2.3.5, rasterio 1.4.3, h5py 3.15.1, Pillow 12.0.0, asf_search 10.0.3, earthaccess 0.15.1, vaderSentiment 3.3.2 and truststore 0.10.4. Use the lock file to reproduce the complete tested environment.

### Application and processing flow

```text
Public catalogues / team files / independent local evidence
    -> ignored raw inputs + reviewed processing manifest
    -> Python preprocessing and provenance checks
    -> public/data/observations/<site>.json + versioned rasters
    -> Vite build -> dist -> Vercel static hosting
    -> browser validation -> radar controls, maps and charts

NOAA / ERA5 / ASF browse / GDELT
    -> refresh script -> dated public/data snapshots
    -> app loads saved context; optional weather/optical/search requests

CSV upload -> strict parser -> localStorage + table + globe points
Explicit AI action -> optional same-origin /api/analyze -> Anthropic
                   -> local heuristic if unavailable/unconfigured
```

Scientific preprocessing happens before deployment, not in a visitor's browser or a Vercel function. Raw HDF5s and Earthdata credentials do not belong in frontend/Vercel configuration. COGs are available for scientific inspection/download; the browser displays prepared geographic PNG overlays rather than reading full HDF5/COG files.

`HOSTED` becomes false when the standalone bootstrap sets `__PACIFIC_DEMO__`. That output embeds data/assets, uses light locator views and suppresses live requests. Source links can still be opened deliberately.

Production CSP allows the configured Open-Meteo, Photon and GIBS endpoints. Preview uses the same headers. MapLibre 6 uses a namespace import and an explicit Vite `?worker&url` import for `maplibre-gl-worker.mjs`; preserve this when changing map code.

### Observation contract and scientific guardrails

Browser packages have `schemaVersion: 1`, site ID, status (`pending`, `ready` or `demo`), acquisitions/comparisons and optional context layers. Acquisitions carry UTC dates, sensor, track, direction, frequency group, maturity, processing version/CRID, geographic bounds, channels and provenance.

A comparison requires the same sensor, track, direction, frequency, maturity, processing version, bounds and requested channel, with distinct acquisitions in chronological order. Do not mix Sentinel C-band and NISAR L-band or compare different processing cohorts silently.

The pipeline:

- Reads NISAR covariance diagonals: HHHH/HVHV/VVVV/VHVH become HH/HV/VV/VH. Uses reviewed masks and number-of-looks information; zero is not assumed valid.
- Accepts calibrated RTC with explicit `linear_power` or `dB` units. It does not convert raw Sentinel GRD into RTC.
- Clips to a study rectangle, uses a shared local UTM grid and averages positive linear power before converting with `10 * log10(power)`.
- Produces float COGs and geographic PNGs. Display stretches: -35 to 0 dB and -6 to +6 dB change. Display clipping does not alter scientific COG values; nodata stays missing/transparent.
- Computes change on paired valid pixels, records valid coverage against the AOI and SHA-256 hashes original inputs.
- Requires explicit valid/water classes for categorical water. Water area remains separate from dB; categorical resampling is nearest-neighbor.
- Writes each run into a unique timestamped directory and publishes the manifest atomically after success. Failed runs do not overwrite assets referenced by the prior package.

Current study bounds, ordered west/south/east/north:

| Site | Center longitude/latitude | Bounds |
| --- | --- | --- |
| luzon | 120.90, 15.50 | 120.65, 15.20, 121.15, 15.80 |
| angat | 121.16, 14.91 | 121.08, 14.84, 121.24, 15.00 |
| dadu | 67.80, 26.70 | 67.60, 26.50, 68.00, 26.90 |

These are study rectangles, not official reservoir/administrative polygons. Default 30 m output spacing is a resampling choice, not a blanket claim about NISAR native resolution.

## 5. Changes made during recent work

- Preserved the original prototype; replaced production with a modular editorial application and coherent six-section story.
- Removed simulated global heat/rain/radar values from factual presentation. Kept an explicitly illustrative comparison to exercise controls while scientific acquisitions are unavailable.
- Added real ASF browse/metadata, ERA5 snapshots and a dated NOAA advisory. The saved advisory reports weekly Nino 3.4 of +2.5 C on 12 November 2026, separate from ONI/RONI. This is a dated snapshot, not a claim that it remains current indefinitely.
- Corrected Angat's coordinates/bounds; added sources, hypotheses, human drivers and disconfirming evidence.
- Replaced inherited geographic outlines with a local, attributed world-atlas source and included its license.
- Recomputed 43 headlines with actual VADER. Raw, climate-adjusted and legacy scores remain distinct. Browser-local analysis is labeled a keyword heuristic, not VADER.
- Added radar/context preprocessing, metadata guards, paired-valid calculations, input hashes and atomic publication into separate run folders.
- Fixed charts to use actual timestamps, gaps and coverage; fixed conceptual warm-band polygon winding.
- Fixed MapLibre 6 import/worker errors; strengthened browser checks to wait for a rendered idle map, not only a canvas.
- Added GIBS cancellation/retry behavior, including rejecting service-exception XML returned with HTTP 200.
- Fixed Python HTTPS certificate validation through `truststore` and the system trust store; TLS verification was not disabled.
- Upgraded MapLibre and Vite after audit findings; final recorded npm audit reported zero vulnerabilities.
- Added Vercel settings/security headers, disabled-by-default AI configuration, offline output, tests, credits and submission drafts.
- Fixed Windows text-encoding corruption during generation with explicit UTF-8; continue specifying UTF-8 in source reads/writes.

## 6. Remaining tasks and unfinished implementations

The principal missing requirement is **real processed radar evidence for at least the two Philippine sites**. Current scientific packages have no acquisitions or comparisons. Browse thumbnails do not satisfy that requirement.

Required before presenting scientific findings:

1. Receive original calibrated files and metadata, preferably three comparable dates per site and at least two. Review masks, orbit/track, frequency, maturity, CRID and dates.
2. Process and independently inspect results. Confirm calibration, coverage, geolocation, masks, channels and units against actual product specifications/files.
3. Obtain independent rainfall, planting/irrigation, reservoir operations/levels or field records. Separate hypotheses from demonstrated causes.
4. Add real WorldCover, WorldPop and DEM rasters with provenance. Their importer exists; inputs are absent.
5. Add a genuine Philippine team account and a photograph with location, date, photographer and permission. No personal experience was invented.
6. Refresh/review news when GDELT permits it; verify links/claims and preserve honest freshness labels.
7. Update narrative, charts, source register and submission drafts to match validated findings, including contradictory or absent change.
8. Verify physical phone performance, assistive technology and deployed behavior; complete scientific review and publish to Vercel when authorized.

Optional/deferred capabilities:

- Paid AI requires a key, endpoint validation and deployed abuse/spending controls; core features do not require it.
- GPM IMERG, SMAP, NASA POWER, FIRMS, Cesium terrain and commercial tiles are not implemented substitutes for ERA5/GIBS/local outlines.
- No automated CI/scheduled data refresh is configured. `npm run build` does not fetch/validate new science data; run refresh and preprocessing deliberately before building.
- No validated crop classifier, operational alert, interferometric displacement workflow, flood-depth calculation, population-exposure statistic, significance test or speckle uncertainty estimate is claimed.

## 7. Known bugs, errors and issues still needing attention

### Confirmed limits and service issues

- GDELT returned HTTP 429. The 43-item archive was retained; fresh-news retrieval is unresolved.
- GIBS intermittently returned a service exception with HTTP 200. Later requests and the actual UI succeeded; retain content-type checks and retry/fallback.
- A nonfatal affine/rasterio deprecation warning appeared during Python testing. Four numerical tests passed; revisit compatibility during a dependency upgrade.
- Anthropic and Claude preview capability were not tested with a live key/environment. Vite preview does not execute Vercel functions.
- The optional AI endpoint has no authentication or distributed rate limiter. An origin check supplies neither. Keep `AI_ENABLED=false` until provider spending limits and appropriate Vercel Firewall/rate limiting are configured.
- GCOV reader tests use synthetic files. Actual team files may expose product-version, mask or geometry cases absent from fixtures.

### Concrete follow-ups identified while preparing this handoff

These were documented without modifying feature code:

- `src/core.js:loadSaved()` checks stored coordinates but does not revalidate every saved field. `src/app.js:renderCSV()` inserts `p.value` into HTML without escaping it. Normal CSV imports guarantee numeric/null values, but malformed or externally altered localStorage can bypass that assumption. Revalidate restored records and escape displayed values; add a focused regression case. No exploit was executed during this handoff.
- Context-source descriptions in `src/app.js` hardcode "Local raster pending". Correct now, these become stale after real context imports. Render availability from the selected site's package when adding layers.
- `tests/core.test.js` asserts all three scientific packages are pending and empty. Browser checks also expect pending messages. After legitimate ingestion, update these assertions and retain separate pending/demo fixtures; otherwise valid new data will fail the old tests.
- `scripts/capture-preview.mjs` assumes port 4174 and pending-map controls. Adapt it when ready-data UI replaces these states. The main browser suite supports `TEST_URL`/`BROWSER_PATH`; smaller screenshot/service utilities have more local-environment assumptions.

No uncaught browser JavaScript errors remained in the saved final suite. This describes tested flows, not every future dataset/device.

## 8. Testing performed and results

Evidence: `docs/VALIDATION.md`, `.artifacts/browser-report.json`, `.artifacts/service-report.json` and screenshots in `.artifacts/`. Artifacts are ignored by Git and remain local unless separately preserved.

| Check | Saved result |
| --- | --- |
| Production build | Passed, including separately bundled MapLibre worker |
| Node suite | 9 tests passed |
| Python suite | 4 passed; calibrated RTC fixture produced expected 3.0103 dB change and valid COGs |
| Browser suite | 14 checks passed with production security headers |
| Browser console | No uncaught JS or unexpected console errors; deliberately aborted weather request produced expected `net::ERR_FAILED` |
| Failed weather request | Saved snapshot retained and error communicated |
| Standalone HTML | Opens from disk; zero network requests; 387,581 bytes, approximately 378 KiB |
| Initial hosted resources | 81,884 encoded bytes plus HTML; below 3 MB; map/globe code and browse images load later |
| External requests | ERA5 HTTP 200 JSON; Photon HTTP 200 JSON; final GIBS HTTP 200 PNG |
| Actual optical control | MODIS imagery dated 6 November 2026 loaded successfully |
| Dependency audit | Zero reported npm vulnerabilities after upgrades |
| Whitespace/diff check | `git diff --check` passed |

Browser checks cover story, real browse/pending states, demo swipe/change/polarizations, unavailable VV, invalid comparisons, map/worker, news filtering, CSV errors/persistence, keyboard search, globe/tour, local/method routes, 390 px mobile layout, weather failure and offline output. Desktop viewport was 1440 x 1000; mobile emulation 390 x 844; reduced motion enabled.

Not verified: physical mid-range phones, full WCAG/screen-reader audit, live keyed AI, Claude sample integration, actual Vercel deployment, team GCOV science, field truth or real context rasters. Saved tests do not prove climate causation or successful deployment.

## 9. Exact next steps to continue

### A. Resume without losing local work

1. Read this file, `README.md`, `docs/DATA_HANDOFF.md` and `docs/VALIDATION.md`.
2. Run `git status --short`. At handoff, `README.md` and `index.html` are modified, `index.html.html` has the pre-existing deletion, and added project files/directories are untracked. No commit or push was made during implementation. Last observed commit: `ab47796` (merge of main).
3. Do not reset, clean or replace the project with its archived prototype. No preview server is expected to remain running; earlier 4173/4174 processes were stopped. The handoff port check returned no listening entries.
4. This session's filesystem is read-only by default. Writes/install/build commands may need escalation; obey active runtime permissions. For PowerShell text passed to Python, set `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` and write UTF-8 explicitly. Split large generated commands to avoid Windows command-length limits.

If dependencies need reinstalling, run these from the project root. Existing environments need not be recreated just to resume:

```powershell
npm.cmd ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/requirements.lock.txt
npm.cmd run dev
```

Open Vite's printed URL. Do not double-click modular `index.html`; use `demo/pacific-preview.html` for a local offline preview.

### B. Ingest and review incoming data

Obtain original science files and source metadata, not only screenshots. Confirm file/mask requirements in `docs/DATA_HANDOFF.md`. Do not save passwords/API keys in the repository.

Example discovery/inspection using the original reviewed date window; adjust deliberately for the real dataset:

```powershell
.venv\Scripts\python.exe scripts/discover.py --site angat --start 2026-10-21 --end 2026-11-13 --source nisar --maturity VALIDATED
.venv\Scripts\python.exe scripts/inspect_gcov.py raw/angat/before.h5
```

Create a manifest under ignored `raw/angat/` from `scripts/manifest.example.json`. Replace every placeholder, reference actual files, and review `validMaskValues`, track, direction, frequency, maturity and CRID. The example must not run unchanged. Then:

```powershell
.venv\Scripts\python.exe scripts/prepare_radar.py raw/angat/manifest.json
```

Repeat for `luzon`; use a justified, separately comparable dataset for `dadu`. Sentinel discovery returns GRD candidates; use a documented external calibration/terrain-correction workflow before RTC import. For OPERA, inspect the actual product version and class definitions. Do not subtract different sensors as interchangeable observations.

Inspect COGs, PNG geolocation, masks, dB distributions, site means, paired coverage and metadata independently before accepting ready packages. Do not use a regional ASF footprint as an invented georeference for its native browse PNG. Keep demonstration data separate.

### C. Add context and evidence

Import reviewed context rasters, for example:

```powershell
.venv\Scripts\python.exe scripts/prepare_context.py raw/worldcover.tif --site angat --kind landcover --date 2021 --attribution "ESA WorldCover 2021 / CC BY 4.0" --source-url https://esa-worldcover.org/en/data-access
```

Use actual product/year/license for population and elevation. Update hardcoded availability labels described in section 7. Add the real local story, photo and independent reservoir/field evidence. Update hypotheses only as supported.

Refresh with a suitable end date; omitting `--end` uses today minus seven days:

```powershell
.venv\Scripts\python.exe -u scripts/refresh_context.py --end 2026-11-06 --browse
# Re-score cached news without requesting GDELT again:
.venv\Scripts\python.exe scripts/refresh_context.py --score-only
```

Avoid repeated requests while GDELT is rate limited. Manually review the NOAA advisory and update its dated fields separately from automatically fetched historical ONI. Saved weather currently spans 8 September-6 November 2026; it does not update itself after deployment.

### D. Fix documented follow-ups and validate the final data state

Harden restored localStorage records/value rendering, make context availability labels data-driven and adapt pending-only tests while retaining pending/demo coverage. Add meaningful tests for newly encountered product behavior.

```powershell
npm.cmd test
.venv\Scripts\python.exe -m unittest discover -s tests -p test_pipeline.py -v
npm.cmd run build
npm.cmd run demo
npm.cmd audit
npm.cmd run preview -- --port 4174
```

In a second terminal:

```powershell
$env:TEST_URL = 'http://127.0.0.1:4174'
npm.cmd run test:browser
node scripts/service-check.mjs
node scripts/capture-preview.mjs
git diff --check
```

Keep preview running during browser checks. Main browser suite defaults to 4173 without `TEST_URL`; screenshot script currently expects 4174. Set `BROWSER_PATH` for the main suite if installed Chrome/Edge is elsewhere, or install Playwright Chromium as appropriate.

Review screenshots, physical phone behavior, keyboard/screen-reader flows, units, provenance, missing data and claim accuracy. Regenerate offline HTML after relevant edits. Update submission drafts to match final evidence.

### E. Deploy the reviewed application

The current task only creates this handoff. No publication is performed here.

For the later deployment task, review intended files and the existing deletion before committing/pushing. Import the reviewed repository into Vercel with:

- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build`.
- Output: `dist`.
- Core app: no environment variables required.
- Optional AI: server-only `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`, and `AI_ENABLED=true` only after provider limits and endpoint protection. Never prefix secrets with `VITE_`.

Test deployed assets, hash routes, headers and optional function on the actual Vercel URL. Vite preview does not emulate the function. Record the URL and validation results. No deployed URL exists at this handoff.
