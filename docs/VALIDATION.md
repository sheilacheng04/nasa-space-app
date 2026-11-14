# Validation record

Checked on 14 November 2026 using Windows, Node 25.6.1, Python 3.13.4 and installed Chrome. The project requires Node >=22.12.

## Design restoration

The original gradient hero, sans-serif typography, rounded controls, compact navigation and light/dark theme toggle have been restored with the updated NISAR evidence retained. The production build, both themes at phone width, theme persistence, keyboard search and standalone HTML were checked after this change. The orange accent is slightly deeper in light mode for readable small text.

## Passed for this revision

- TypeScript type checking and the production Vite build.
- Eight Node tests covering CSV parsing/validation, safe assets and compatible observation data.
- Nine Python tests covering power-to-dB conversion, invalid-pixel handling, a synthetic HDF5 fixture, raster preparation, missing water pixels, agreement metrics, incomplete weather months, news merging and real catalog pair compatibility.
- Fourteen browser checks against the production build: real dated Story imagery; all text pages; HH/HV before/after swipe and unavailable computed channels; simulated mode and missing dates; Dadu's La Niña distinction; site switching; lazy MapLibre; Media filtering and the labeled local Claude-style fallback; CSV quoting and zero values; keyboard search and focus; lazy 3D globe; 390 px layouts; mobile search; numerical contrast; persistent light/dark mode; and the offline edition.
- Browser console errors: **0**. Uncaught page errors: **0**.
- Standalone HTML opened from disk with real embedded thumbnails, all five pages and the 3D globe; external requests: **0**.
- Python scripts compile. The submission summary contains exactly 200 whitespace-separated words, excluding its title.

Browser and size reports are written to ignored `.artifacts/` by the reproducible check scripts. Screenshots were reviewed at desktop and phone widths.

## Size and loading

| Check | Measured result |
| --- | ---: |
| Initial hosted page responses, uncompressed, 1440 × 1000 viewport | 953,009 bytes |
| Standalone HTML | 2,882,708 bytes |
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

The retained FastAPI account/database features are optional, disabled in this static edition and were not revalidated as part of this revision. Actual Claude responses require a configured server; the offline local heuristic is labeled simulated. Live provider availability and latency can change.

## Reproduce

~~~text
npm test
.venv\Scripts\python -m unittest discover -s tests -p "test_*.py"
npm run build
npm run demo
~~~

Serve `dist/` on port 4175, then run:

~~~powershell
$env:PREVIEW_URL='http://127.0.0.1:4175'
$env:CHECK_OFFLINE='1'
node scripts/revision-browser-check.mjs
node scripts/measure-build.mjs
~~~

The browser scripts use installed Chrome or Edge on Windows. Configure an available Playwright browser on another platform.
