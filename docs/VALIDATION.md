# Validation record

Checked on 14 November 2026 using Windows, Node 25.6.1, Python 3.13.4 and installed Chrome. The project requires Node >=22.12.

## Globe design and display correction

The original system font, rounded controls and both color themes are restored on Globe. Satellite now includes optional, labeled Natural Earth geographic context beneath the actual dated radar strips.

Validation passed: **8 focused display checks**, **18 satellite acceptance checks**, **14 existing browser regression checks**, **8 Node tests**, TypeScript and the production build. Browser reports contain **zero application/console errors**. The offline edition also passed with zero external requests.

The focused checks verify inherited typography and themes, unchanged RGB for all 1,057 opaque pixels in the latest real frame, independent geographic-context controls, Find this frame camera positioning, isolation of a delayed Concept optical image, normal graphics recovery, and recovery during initialization. The optical race screenshot comparison permits only one-channel-level raster quantization; the observed difference was six pixels out of 756,327, with no meaningful color shift.

Updated sizes: production Story resource bodies 486,211 bytes; offline HTML 2,864,625 bytes; embedded real image data URIs 508,469 bytes. No geographic base image download was added: the reference globe is drawn from the existing local outlines. Physical phone performance and screen-reader speech remain untested.

Run npm run test:globe-display with Vite on port 5174. The targeted report and light/dark/recovery screenshots are in ignored .artifacts/. Satellite and existing browser acceptance suites use the production preview on port 5175.

## Earlier satellite add-on acceptance

The add-on passed **18 browser checks**, plus **14 existing browser regression checks**, against the production build. Eight Node tests and 15 Python tests passed, including six new checks for domains, partial gap boundaries, overlapping release windows, provenance and image budgets. TypeScript and Vite builds passed. Optional API behavior was unchanged; earlier API results below are from the cleanup revision.

The satellite suite checks default mode, advertised endpoints, date/maturity/source, reduced motion, camera/date preservation, keyboard navigation and playback, the permanent gap, January-June imagery, waiting for delayed images, stop-at-end, site selection and exact-date routing, command search, both fallback levels and retry, the three-request cap, mobile layout, offline playback and the CPU compatibility renderer. Date announcements remain unchanged while playing and the loading status has aria-live off. Controlled loading failures use unusable image responses. Console errors: **0**; uncaught errors: **0**.

Live NASA GIBS loaded in the default view. A separate real-layer probe confirms MapLibre globe tiles and globe.gl dated textures. Reports are reproducible with scripts/satellite-browser-check.mjs and scripts/probe-globe-options.mjs; output is in ignored .artifacts/.

| Current measurement | Result |
| --- | ---: |
| Story resource response bodies, production Chrome | approximately 485 KB |
| Standalone HTML | 2,858,831 bytes |
| Real embedded image data URIs, including encoding overhead | 508,469 bytes |
| Initial globe engine/controller/date manifest/frame requests | 0 |
| Maximum simultaneous image requests, including crops | 3 |
| Offline external requests | 0 |
| Phone emulation | 390x844, touch, no horizontal overflow |
| Phone renderer pixel ratio | <=1.25 |
| Global archive | 361 real frames, each <=150 KB |

The mobile globe stays above a scrolling bottom sheet. Desktop, phone, offline and Canvas screenshots were reviewed. Real hardware frame rate, physical phone memory limits, Safari/Firefox and screen-reader speech remain untested. Emulation is not a real-device performance result. Actual pixel maturity, calibrated water change and independent OPERA validation remain unavailable.

Reproduce with a production preview on port 5175 and npm run test:satellite. The existing suite accepts PREVIEW_URL=http://127.0.0.1:5175 and CHECK_OFFLINE=1.

## Design restoration

The original gradient hero, sans-serif typography, rounded controls, compact navigation and light/dark theme toggle have been restored with the updated NISAR evidence retained. The production build, both themes at phone width, theme persistence, keyboard search and standalone HTML were checked after this change. The orange accent is slightly deeper in light mode for readable small text.

## Repository cleanup

Removed the duplicate root data mirror, duplicate offline preview, superseded prototype/pages/renderers, retired browser checks, obsolete refresh script and generated deployment archives. The source tree now has 231 files instead of 360, saving about 67 MB of source files. All retained evidence files were compared before deleting the mirror. Data now lives only in public/data/; el-nino-app.html is the single standalone edition.

Saved image references and documentation links resolve. The production CSS and JavaScript hashes are unchanged by the cleanup, preserving the restored design and behavior. The offline file was rebuilt, and the current browser runner checks it directly.

## Earlier cleanup validation

- TypeScript type checking and the production Vite build.
- Twenty-two API tests and seven optional account/database browser scenarios passed with an isolated SQLite test database.
- Eight Node tests covering CSV parsing/validation, safe assets and compatible observation data.
- Nine Python tests covering power-to-dB conversion, invalid-pixel handling, a synthetic HDF5 fixture, raster preparation, missing water pixels, agreement metrics, incomplete weather months, news merging and real catalog pair compatibility.
- Fourteen browser checks against the production build: real dated Story imagery; all text pages; HH/HV before/after swipe and unavailable computed channels; simulated mode and missing dates; Dadu's La Niña distinction; site switching; lazy MapLibre; Media filtering and the labeled local Claude-style fallback; CSV quoting and zero values; keyboard search and focus; lazy 3D globe; 390 px layouts; mobile search; numerical contrast; persistent light/dark mode; and the offline edition.
- Browser console errors: **0**. Uncaught page errors: **0**.
- Standalone HTML opened from disk with real embedded thumbnails, all five pages and the 3D globe; external requests: **0**.
- Python scripts compile. The submission summary contains exactly 200 whitespace-separated words, excluding its title.

Browser and size reports are written to ignored `.artifacts/` by the reproducible check scripts. Screenshots were reviewed at desktop and phone widths.

## Earlier cleanup size and loading

| Check | Measured result |
| --- | ---: |
| Initial hosted page responses, uncompressed, 1440 × 1000 viewport | 953,009 bytes |
| Standalone HTML | 2,882,677 bytes |
| Real embedded image data URIs, including encoding overhead | 495,940 bytes |
| Initial globe/MapLibre requests | 0 |

The first-load measurement includes the visible Story images and bootstrap JSON; images further down the page load on demand. Full study archives are deliberately much larger and are fetched only when their pages need them. Offline thumbnails are downsampled; the standalone edition includes a smaller image/date subset.

## Contrast

Computed foreground/background contrast against the restored light background:

| Use | Ratio |
| --- | ---: |
| Body text | 14.97:1 |
| Muted text | 5.53:1 |
| Water blue | 4.97:1 |
| Heat orange | 4.68:1 |

These tested text colors exceed 4.5:1. This is a focused numerical and keyboard check, not a formal accessibility certification.

## Scientific and service limits

The scene catalog, CMR collection metadata, observation plan, real GIBS/ASF browse, NOAA context, ERA5 weather and GDELT refresh were run. Per-request results and retrieval timestamps are in [DATA_STATUS](DATA_STATUS.md) and the saved manifests.

Authenticated Harmony/GCOV extraction remains **untested** because EARTHDATA_USERNAME and EARTHDATA_PASSWORD are absent. Synthetic processor tests are software checks, not validation of real NISAR measurements. No calibrated site water extent, backscatter series, OPERA agreement or WorldCover class result is claimed. Browse comparisons cannot substitute for these products.

The requested rolling 12-day GIBS layer was absent from GetCapabilities. Available daily imagery is used and missing dates remain visible. Exact dataset citation wording from the linked NASA guidance remains unavailable after 403 responses. Kaggle schemas could not be verified. Optional GUNW, SME2, S-band, RCM and population analysis were not attempted.

The retained FastAPI account/database features are optional and disabled in the static edition. They were revalidated locally with SQLite during cleanup; production PostgreSQL was not tested. Actual Claude responses require a configured server; the offline local heuristic is labeled simulated. Live provider availability and latency can change.

## Reproduce

~~~text
npm test
.venv\Scripts\python -m unittest discover -s tests -p "test_*.py"
npm run test:api
npm run build
npm run demo
~~~

Serve `dist/` on port 4175, then run:

~~~powershell
$env:PREVIEW_URL='http://127.0.0.1:4175'
$env:CHECK_OFFLINE='1'
npm run test:browser
node scripts/measure-build.mjs
~~~

The browser scripts use installed Chrome or Edge on Windows. Configure an available Playwright browser on another platform.

For optional account browser checks, start the backend with a separate test DATABASE_URL, set TEST_URL to that server, and run npm run test:fullstack. The runner explicitly enables the optional API for that browser context.
