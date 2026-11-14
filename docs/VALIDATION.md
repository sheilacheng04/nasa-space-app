# Validation record

## Prompt 1 UX, Shared Data Contracts, Blank-Page Guardrails & Task Flows (14 November 2026)

1. **Unit & Data Contract Tests (`npm test` & Python unittest)**:
   - **47 Node unit tests (`fail 0`)**: Includes `tests/places-and-news.test.js` (verifies `public/data/places.json` schema with 34 global places, 6 Philippine places, and `dadu` as `"la-nina-reference"`, plus `public/data/news-by-place.json` with 494 matched items) and `tests/readability.test.js` (verifies Flesch reading ease >= 60 and average sentence length < 20 words across all 5 pages, plus all 14 `GlossaryTerm` definitions).
   - **15 Python science/acquisition tests (`OK`)**: Curated file hashes (`inventory.json`, `sites.json`, and all 4 `evidence.json` files) remain 100% intact.
2. **Permanent Blank-Page Browser Suite (`node scripts/blank-page-check.mjs`)**:
   - **8 check groups (`findings: 0`)**: Verifies all 5 routes (`Story`, `Sites`, `Globe`, `Media`, `Method`) in Light and Dark themes at `1280px` and `390px`, plus slow network + 4x CPU throttling + `prefers-reduced-motion: reduce`, WebGL disabled (`2D Canvas compatibility globe`), hidden-then-shown tab visibility lifecycle, and the standalone offline `el-nino-app.html` bundle (`0` external requests).
3. **Automated Usability & Task Flows (`node scripts/ux-task-flows-check.mjs`)**:
   - Verifies the dismissable 3-step first-visit guide (`localStorage` + `#open-guide` header `?` button), all **6 user task flows in <= 5 clicks/actions**, the `"Radar frames not saved for this place"` + ASF Vertex link banner for non-radar global places, the `"No saved headlines for this place yet"` + disabled `"Search live"` state, the Globe status strip + Philippines preset + Local GIBS Map handoff, the Media & Regional Overview Dashboard, and captures all 20 after-screenshots in `docs/ux/after/`.
4. **Offline Bundle Size (`npm run demo`)**:
   - `el-nino-app.html` is **2,969,768 bytes** (< `3,000,000` byte cap), embedding `places.json`, `gazetteer.json`, and tuple-packed `news-by-place.json` with **zero external network requests**.

## Verified NISAR acquisition metadata extension

On 14 November 2026, bounded ASF/CMR queries verified one additional Dadu acquisition (2026-10-30T14:13:40Z), with VALIDATED P05036 GSLC/RSLC products. No new GCOV products were found. No full science product was downloaded or analyzed; seven active unique product probes required authentication and one timed out. See [NISAR_ACQUISITIONS.md](NISAR_ACQUISITIONS.md) for provenance, gaps, complete metadata, the reproducible script and the recommended next calibrated GCOV subset.

Validation: **31 Python tests** (16 new, 15 existing) passed in an isolated compatible Python environment; existing affine/rasterio deprecation warnings remain. **43 Node tests**, TypeScript/build and **123 Chrome browser groups** passed. The new hosted supplement does not change curated datasets or application behavior. Offline HTML remains **2,997,271 bytes**, unchanged; offline checks passed with zero external requests. The pre-existing optional-backend environment issue in the submission audit was not modified or claimed resolved.

The final cross-browser submission audit, fixes, exact browser versions and manual checklist are recorded in [FINAL_AUDIT.md](FINAL_AUDIT.md). Frontend: **43 unit tests and 175 browser groups passed**, plus TypeScript/build. Optional backend test collection remains blocked by the local Python/pydantic-core binary mismatch; see the audit report. Final offline size: **2,997,271 bytes**.

## Globe performance and inactive views

Verified on 14 November 2026 with installed Chrome. **43 unit tests**, TypeScript and production build passed. **123 browser groups** passed: 9 new globe-performance, 17 globe-display, 19 satellite, 9 selections, 13 startup, 6 accessibility, 15 general, 6 weather, 8 radar evidence, 9 detailed map and 12 site timeline. Source-module performance/display checks use Vite 5174; other suites use production preview 5175.

Inspection confirmed the existing renderer already pauses for inactive routes, hidden tabs and offscreen canvases. Additional avoidable work came from radar loading/prefetch and crops during Concept mode, abandoned metadata/image requests being repeated after navigation, repeated surface compositions/texture allocations, and repeated marker setup for unchanged inputs. Story already schedules animation only when active/visible; the detailed MapLibre map already disposes on leaving Sites. Those lifecycles were preserved.

- GlobePage now sends tab visibility through the existing active-view lifecycle. Playback pauses without advancing dates while hidden; renderer instances survive ordinary navigation. Camera marker listeners/RAFs are removed while inactive and rebound on return.
- Globe JSON metadata is cached separately from startup datasets. It loads only after Globe is needed; vegetation metadata/context waits for Concept. Successful and in-flight metadata/vegetation images are reused; failed requests are evicted and explicit Retry remains fresh.
- Radar loading, two-frame prefetch and crop requests run only in active radar mode. Pausing discards queued prefetch and prevents new live fallbacks. Up to three already-running frame requests may finish and populate the bounded cache, avoiding repeated downloads. Crops retain up to four exact site/layer/date results, including honest unresolved coarse-coverage states; blob URLs are revoked on eviction, Retry or unmount. Radar and decoded vegetation caches remain bounded to eight and four successful images respectively.
- Surface composition and texture replacement are skipped for unchanged source inputs and deferred while inactive/offscreen. Selection metadata stays current; the surface is composed before rendering resumes. Replaced textures retain disposal; final teardown additionally disconnects observers, removes visibility/reduced-motion listeners, cancels camera work and removes the canvas. Vegetation decode timers and image references are cleared on unmount.

The new suite measures requests and animation callbacks, verifies the same canvas survives repeated navigation, tests zero pending RAFs while inactive, simulates tab visibility, checks unchanged surface revisions, exercises cache queue suspension/disposal and metadata Retry, and proves a delayed vegetation image cannot overwrite a newer month. Existing suites verify URL history, exact source pixels, graphics recovery, keyboard controls and independent startup/weather/radar/map errors.

Regenerated offline HTML: **2,996,187 bytes**, under the unchanged 3,000,000-byte cap (2,830 bytes above the previous edition). Embedded real-image data URIs remain **583,548 bytes**. Offline suites passed with zero external requests. No data refresh, scientific data changes, imagery degradation or new dependencies.

Limits/manual follow-up: active WebGL rendering remains continuous for responsive interaction; bounded caches intentionally retain memory for reuse. Already-started small requests/initialization may finish while inactive, but cannot update superseded views. Visibility tests dispatch controlled visibility events rather than operating-system backgrounding. Check real tab switching, prolonged playback and GPU/memory behavior on target mobile devices and additional browsers; no hardware-wide FPS or energy claim is made.


## Independent startup data loading

Verified on 14 November 2026 with installed Chrome against production preview (5175); globe graphics checks use Vite (5174). **43 unit tests**, TypeScript, production build, and **114 browser groups** passed: startup 13, general 15, selections 9, accessibility 6, weather 6, radar evidence 8, detailed map 9, site timeline 12, satellite 19, globe display 17. The startup suite includes deliberately failed HTTP responses, malformed JSON structures, independently delayed responses, scoped retries, empty catalogs, and missing embedded data.

| Root dataset | Dependency and failure behavior |
| --- | --- |
| sites.json | Required configuration for Story/site lists, Sites, and Globe. A missing, invalid or empty catalog has a dedicated status and Retry; no default site is invented. Media, search, Data and method, and CSV controls remain usable. |
| enso.json | Independent NOAA context on Story and Globe. On failure, ocean numbers/plots are unavailable with Retry; conceptual explanations, radar, site weather and vegetation remain usable. |
| evidence.json | Independent preview summaries on Story, Globe, Media and Method. Failed summaries show a scoped status and existing unavailable previews; per-site evidence still loads separately. Missing catalog counts are unknown, not zero. |
| news.json | Independent Media archive, headline search and reporting markers. Failure removes the unavailable archive/markers with scoped Retry; manual text analysis, site search and the rest of the application remain usable. |
| sources.json | Independent downloadable source index in Method. Failure disables that download with scoped Retry; method explanations, CSV and the separately loaded method.json ledger are unaffected. |

The five root requests start concurrently, without an all-or-nothing barrier. Each has loading, ready, empty and error states. Root JSON successes and in-flight requests are shared within the current application session; rejected requests (including schema failures) are evicted. Retry clears only its dataset, bypasses both the root cache and browser HTTP cache, and preserves the route. Request generations and effect cleanup ignore superseded completions. Late optional arrivals do not reset route focus or the selected evidence. Per-site, weather, imagery, map and API request safeguards remain separate and unchanged.

The regenerated offline edition is **2,993,357 bytes**, below the 3,000,000-byte budget. General, startup, weather, radar, sharing and satellite checks cover embedded data and zero external requests. A separate startup check removes the embedded news file, verifies the local failure, restores it and retries without a network request. No scientific data files, dates or imagery values changed; no dependencies were added.

Remaining limits: absent site configuration still prevents site-driven pages from rendering; failed datasets cannot be recovered until their files/connection are available. The root cache is session-local, not a persistent offline cache. Lazy modules, imagery, per-site evidence, and detailed method records retain their existing independent failure behavior. Real hosted connection loss/timeouts, deployed caching rules and additional browsers should still receive manual checks.


Checked on 14 November 2026 using Windows, Node 25.6.1, Python 3.13.4 and installed Chrome. The project requires Node >=22.12.

## Shareable Sites and Globe selections

Verified on 14 November 2026. **37 Node tests**, TypeScript and the production build passed. The new selection suite passed **9 browser groups including offline**. Existing suites passed **15 general page groups**, **9 site-map groups**, **8 radar-evidence groups**, **6 weather groups**, **12 site-timeline groups**, **17 globe-display groups**, and **19 satellite groups**. Globe-display runs on Vite port 5174 because it imports source modules; other suites ran against production preview on 5175. The satellite route assertion now verifies the globe route and selected-site parameter rather than requiring a parameter-free hash.

URL selection state stays inside existing hash routes. Sites saves source, supported channel, comparison display, selected date or before/after dates. Globe saves mode, selected site, radar date and vegetation month independently. Exact UTC acquisition timestamps are retained when copied from regional views. Legacy aliases remain supported. See [the sharing guide](SHARING.md) for examples and parameter rules.

Focused checks cover direct links, refresh, Back/Forward, invalid/default values, unavailable acquisition dates, missing vegetation months, out-of-archive radar dates, copied Sites/Globe URLs, clipboard failure/manual fallback, same-source no-op clicks, and page navigation. Date changes do not refetch site evidence/weather JSON. Sliders/playback replace history entries, discrete changes add entries, and external navigation pauses playback. Locating a place while already on Globe preserves its mode and dates. Valid absent records remain selected without substitute imagery; unsupported source/view combinations retain requested dates.

Both themes and 390px layouts were checked by existing suites. The share action stays within the globe heading, with feedback outside the fixed grid flow. A focused spacing/viewport assertion and the original satellite bottom-sheet bound both pass. Screenshots were reviewed after correcting the initial grid displacement. Radar pixel preservation, graphics recovery, map synchronization, exact-day optical rules and weather Retry remain covered by their existing suites. No saved scientific data changed.

The regenerated offline edition is **2,984,982 bytes**, below the unchanged 3 MB limit. Embedded real-image data URIs remain **583,548 bytes**. Offline selection, general, radar, weather and satellite checks passed with zero external requests. Offline fragments restore local selections within the embedded subset; Copy link is disabled for the local edition and does not claim file paths are transferable.

Reproduce with PREVIEW_URL=http://127.0.0.1:5175 and CHECK_OFFLINE=1: npm run test:selections. Reports/screenshots are under ignored .artifacts/. Clipboard success and denial were controlled in automation; actual deployed-browser clipboard permissions, physical phones, Safari/Firefox and screen-reader speech still need manual checks. Links identify selections in the current edition, not immutable dataset versions. Camera orientation, imported/private observations, detailed-map controls and playback state are not shared. Backend/Python tests were not rerun because those implementations were unchanged.

## Detailed site map synchronization

Verified on 14 November 2026 against the production preview in installed Chrome. **31 Node tests**, TypeScript checking and the production build passed. **9 focused site-map browser groups**, **15 general page groups including offline**, **8 radar-evidence groups**, **6 weather groups**, and **12 site-timeline groups** passed. The general browser suite recorded zero console/application errors. Focused map checks recorded zero uncaught application errors and explicitly check MapLibre source errors; intentional request failures exercise recovery.

The map receives the selected record, channel, matching catalog and available context layers. Playback, date and channel updates reuse the canvas and retain user camera controls. The map follows After in a comparison. Site changes retain the open-map preference and clear prior site evidence while loading. Pending radar/optical requests are aborted, and late responses cannot restore old layers or dates. Readiness waits for MapLibre source loading, not just image decoding.

GIBS images use their saved EPSG:4326 WMS request bounds. Regional HH/HV quicklooks are not draped over study boxes: their image-to-ground transform is unavailable. Exact acquisition IDs select catalog footprint polygons, with clear geometric-reference labels and a Fit selected footprint action. Mosaic pixels never inherit catalog lineage from a same-date scene. No currently saved site has additional raster context layers; eligible future layers must have valid bounds, spatial relevance, attribution and an exact date or explicit static-reference status.

Optical context is optional and requests only the selected real record's validated UTC calendar day. The interface labels it a MODIS Terra daily mosaic and links the exact NASA GIBS request. Contributing pixel acquisition times are unverified; same-day mosaics are not assumed simultaneous with radar. Missing dates, simulations, failed/empty responses and superseded requests never trigger a runtime-relative date or replacement observation. Focused optical success/failure/empty tests use controlled image fixtures and do not certify live provider coverage on every date.

Desktop and 390px light/dark screenshots were reviewed, including actual radar rendering and the regional footprint. Unit tests cover all four sites' saved georeferencing/footprints, date validation (including timezone offsets), missing metadata, context-layer filtering and simulation. Browser checks cover map-radar Retry, optical Retry, stale requests, playback, exact identity matching, site switching and camera/canvas preservation.

The regenerated standalone edition is **2,977,869 bytes**, below the unchanged 3 MB limit; embedded real-image data URIs remain **583,548 bytes**. General, radar and weather offline checks passed with zero external requests. Detailed MapLibre maps remain intentionally unavailable offline, preserving the existing edition's behavior.

Reproduce the new suite with PREVIEW_URL=http://127.0.0.1:5175 and npm run test:site-map against production preview. Other browser suites retain their existing environment settings. Reports/screenshots are under ignored .artifacts/. Saved scientific data and processing/backend implementations were unchanged; Python/API tests were not rerun. Physical phones, Safari/Firefox, screen-reader speech and exhaustive live optical availability remain unverified.

## Radar interpretation and geometric coverage explanations

Verified on 14 November 2026 in installed Chrome against the production preview. **26 Node tests**, TypeScript and the production build passed. **8 focused radar-evidence browser groups**, **12 existing site-timeline groups**, **6 weather groups**, and **15 general page groups including offline** passed. No uncaught application errors were recorded. The general suite recorded no console errors; the focused suites intentionally fail requests to test recovery.

The focused suite checks mosaic versus acquisition labels, channel/date/site/request-bound metadata, explicit unavailable lineage, regional before/after metadata, known mismatches and missing values, geometric overlap, distinct empty-preview/catalog/browse states, comparison image failure and Retry, unchanged saved-date counts for unsaved selections, and both themes at desktop and 390px phone width. Metadata screenshots were visually reviewed. Weather Retry and stale-response protection remain covered by the unchanged weather suite.

Coverage percentages display existing bboxCoverageFraction values only: footprint intersection divided by the whole study box, calculated by the catalog pipeline in longitude/latitude coordinates. This is geometric overlap, not equal-area observed ground area or valid radar pixel coverage. No catalog metadata are assigned to GIBS pixels from a matching date. No calibrated measurements or causal conclusions are added; saved evidence files are unchanged.

The regenerated standalone edition is **2,976,313 bytes**, under the unchanged 3 MB cap. Repeated long provenance strings are encoded once and reconstructed before startup; the packaging script asserts exact equality with the previous JSON serialization. All record content and embedded images are retained. Embedded real-image data URIs remain **583,548 bytes**. Offline radar and weather tests, plus the general standalone check, passed with zero external requests.

Reproduce with PREVIEW_URL=http://127.0.0.1:5175 against production preview: npm run test:radar-evidence, npm run test:weather, and npm run test:browser (CHECK_OFFLINE=1 includes the standalone checks). Set SITE_TIMELINE_TEST_URL to the same URL for npm run test:site-timeline. Reports and screenshots are in ignored .artifacts/.

Physical phones, Safari/Firefox and screen-reader speech remain untested. Python/API tests were not rerun because no scientific processing or backend implementation changed. Actual mosaic lineage, calibrated pixel coverage and independent change validation remain unavailable.

## Weather baseline comparison and request recovery

Verified on 14 November 2026 against the production preview in installed Chrome. All **20 Node tests**, TypeScript checking and the production build passed. **6 focused weather browser groups**, **15 general browser groups including offline**, and **12 site timeline browser groups** passed. No uncaught application errors were recorded; the general suite also recorded zero console errors. The weather suite intentionally returns an HTTP 503 to exercise recovery.

Weather checks cover same-calendar-month baseline joins, zero values, signed rainfall/temperature departures, missing and incomplete observations, invalid day counts, leap years, missing baselines, stable 2025/2026 chart scales, independent radar loading, failed requests, weather-only Retry, and out-of-order site responses. Desktop (1440px) and phone (390px) screenshots in both themes were reviewed. These remain browser emulation checks, not physical-phone or screen-reader certification.

The existing charts, radar controls, source information and comparison table remain. Baselines use saved 1991-2020 monthly means; departures are observed minus baseline, without statistical significance or causal attribution. Temperature retains the mean of daily high/low midpoints. All saved source data are unchanged.

The regenerated offline edition is **2,999,629 bytes**, within the existing 3 MB limit, with **583,548 bytes** of embedded real-image data URIs. Focused weather and general offline checks passed with zero external requests. The standalone file is very close to its size budget; future additions should account for that limit.

Reproduce with a production preview on port 5175 and PREVIEW_URL=http://127.0.0.1:5175: run npm run test:weather and npm run test:browser with CHECK_OFFLINE=1. Run npm run test:site-timeline with SITE_TIMELINE_TEST_URL=http://127.0.0.1:5175. Reports and screenshots are under ignored .artifacts/. Python/API tests were not rerun because those implementations were unchanged.

## Current revision: global story and dated image playback

The production build, TypeScript and **15 Node tests** passed. **63 browser checks** passed: 15 general page checks, 17 globe display checks, 12 site timeline checks and 19 satellite checks. All four reports contain no application/console errors. Python code was unchanged and **Python tests were not rerun this turn**; earlier results below are historical.

Checks cover the global plain-language story, readable headlines and cohesive methods flow with expandable technical records; all four full-image site timelines; exact dates and fixed bounds; explicit gaps; discrete playback, keyboard control, loading/failure recovery and preserved before/after comparison. Globe checks cover visible radar/month controls, annual comparisons, synchronized playback controls, real NDVI changes, missing months and graphics recovery. The original typography, rounded controls and light/dark themes remain. Desktop and mobile screenshots were reviewed; Story's four lazy images decoded when scrolled into view.

| Current measurement | Result |
| --- | ---: |
| Production Story resource response bodies | 324,350 bytes |
| Offline HTML | 2,992,188 bytes (<3 MB) |
| Embedded image data URIs | 583,548 bytes (<1 MB) |
| Globe engine/controller/manifest/frame requests on Story | 0 |
| Maximum concurrent image requests, including site crops | 3 |
| Offline external requests | 0 |

The site archive has **57 saved actual NASA frames**: Luzon 12, Angat 12, Dadu 22 and Piura 11. Images progress by observation date without invented intermediate frames. Changing radar appearance is not a measurement of land motion, water level or classified water area.

Reports: `.artifacts/revision-browser-report.json`, `globe-display-report.json`, `site-timeline-report.json` and `satellite-check-report.json`. Reproduce with `npm run test:globe-display` on Vite port 5174; run the site, satellite and general suites against production preview port 5175 using `PREVIEW_URL=http://127.0.0.1:5175`. Set `CHECK_OFFLINE=1` for the general standalone check. Physical-phone performance, Safari/Firefox and screen-reader speech remain untested.

## Previous revision: satellite Earth and calendar land correction

Final checks passed: **15 globe display checks**, **19 satellite acceptance checks**, **14 existing browser checks**, **15 Node tests**, **15 Python science/data tests**, TypeScript, offline packaging and the production build. Browser reports contain zero application or console errors. Python emitted dependency deprecation warnings but all tests passed.

The display checks exercise a full optical Earth with NASA GIBS unavailable, exact preservation of 1,057 opaque radar pixels, both original themes, genuine fuller-coverage selection, radar gaps, complete-month ERA5/NOAA alignment, actual monthly land-image changes, changing conceptual land drawings, April 2025's missing vegetation image, November's incomplete weather data, stale-request isolation, calendar playback, exact month-end radar routing, WebGL-to-Canvas recovery and 390px touch layouts. Desktop and mobile screenshots were visually inspected. HTML markers are readable and respect globe occlusion.

Production Story resource bodies: **481,706 bytes**, with no globe engine/controller/manifest/frame requests on Story. Offline HTML: **2,992,384 bytes**; embedded image data URIs: **583,548 bytes**. The standalone edition displays three radar dates, two real monthly vegetation images and the historical optical Earth with **zero external requests**. Unembedded months clear their overlay explicitly.

Reproduce with `npm run test:globe-display` against Vite on 5174, and `npm run test:satellite` against the production preview on 5175. Existing page regressions use `PREVIEW_URL=http://127.0.0.1:5175` and `CHECK_OFFLINE=1`. Reports/screenshots are ignored under `.artifacts/`.

Physical phone frame rate/memory, Safari/Firefox and screen-reader speech remain untested. Mobile checks are Chrome emulation. Calibrated SAR land-change measurements and causal El Nino attribution remain unavailable; no such claim is made from these visualizations.

## Previous revision: globe design and display correction

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

### Accessibility and timeline usability (2026-11-14)

- Site timelines retain every sampled date in a horizontally scrollable, labeled strip and a native date select. Available and unsaved dates stay distinct. Month buttons include the year and completeness in their accessible names.
- Search has an explicit dialog name; native modal focus, result arrows, Escape and focus return remain intact. Headline analysis results use polite atomic status regions. Vegetation loading updates are muted during monthly playback.
- Chart/catalog/method/import tables have captions and column headers; chart and weather tables also identify date/month row headers. Wide scientific-table regions support keyboard scrolling. Monthly rainfall departures have an expandable table, including unavailable observations.
- Validation: 38 unit tests; TypeScript and production build; accessibility (6 groups), general browser (15), site timeline (12), weather (6), radar evidence (8), selections (9), detailed map (9), satellite (19), and globe display (17) browser groups passed. General, weather, radar, selections and satellite suites checked the regenerated offline edition, including zero external requests. Final general offline isolation was rerun after regeneration.
- Reflow checked at 1280, 640 and 320 CSS pixels (200%/400% equivalent layout widths), plus existing 390px light/dark checks. This is not a claim of actual browser-zoom or screen-reader testing. Screenshots are generated under ignored .artifacts.
- Offline HTML: 2,989,669 bytes, below the 3,000,000-byte budget. No new dependencies or scientific values.
- Manual follow-up: actual 200%/400% browser zoom, NVDA/VoiceOver reading order and live-region speech, keyboard map/globe use, touch scrolling, and focus visibility in both themes. Canvas/WebGL imagery still needs its accompanying controls and textual evidence; full screen-reader compatibility is not certified.
