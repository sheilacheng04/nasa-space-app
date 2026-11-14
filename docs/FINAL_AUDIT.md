# Final submission audit

Audited 14 November 2026 on Windows. This is an automated integration/accessibility/regression audit with a targeted source and screenshot review. It is not WCAG certification or a manual screen-reader assessment.

## Issues found and fixed

No critical or high-severity frontend failure was found in the tested paths. One optional-backend validation issue remains unresolved (see below). Severity below describes the reproduced pre-fix behavior.

| Severity | Issue | Small correction and regression evidence |
| --- | --- | --- |
| Medium / unresolved verification | Optional backend tests cannot collect because the local Python environment cannot import ArgsKwargs from pydantic_core._pydantic_core. | npm.cmd run test:api failed before tests ran. No backend code or dependencies were changed. Static/offline operation is unaffected; repair the optional Python environment and rerun before enabling its services. |
| Medium | Skip to content changed the fragment to #main, which the router treated as Story, losing the current evidence route. | Focus main directly while preserving the URL; keyboard Enter and route preservation tested in all four environments. |
| Medium | A failed detailed method ledger had no scoped Retry and its old error could remain after a subsequent successful navigation/load. | Separate loading/error/ready state, Retry detailed source records, validation of ledger containers and reuse of a successful record. Retry/error clearing and navigation reuse tested in all four environments. |
| Medium | A failed per-site evidence file displayed unknown catalog/series counts as zero and recovery required leaving the site. | Unknown counts now say not available; Retry radar evidence reloads only that file. Weather stays loaded. Genuine numeric zero remains zero. Tested in all four environments. |
| Low | Arrow Up from the search input selected the penultimate result instead of the final result. | Correct the initial index while preserving wrapped result navigation. Tested with Enter, Ctrl+K, arrows, Escape and focus restoration. |
| Low | The collection/DOI table caption literally displayed undefined. | Replace with NISAR collection identifiers and dataset DOIs; captions and column headers checked. |
| Low | Imported CSV tables lacked an explicit named, keyboard-focusable scrolling region. | Add region name and tabindex; focus and Arrow Right scroll tested at 320 px in all four environments. |

No dependencies were added, no source datasets changed, no data-refresh pipeline ran, and imagery was not degraded. Changes are confined to App.tsx, Search.tsx, DataPage.tsx, MethodPage.tsx, SitesPage.tsx, the audit test/script entry, documentation and regenerated offline HTML.

## Browser environments actually tested

| Environment | Reported version | Coverage type | Result |
| --- | --- | --- | --- |
| Chrome | 157.0.8103.51 | Installed browser, automated headless | 13 passed; MapLibre initialized; Globe webgl2; offline external requests 0 |
| Edge | 157.0.4341.46 | Installed browser, automated headless | 13 passed; MapLibre initialized; Globe webgl2; offline external requests 0 |
| Firefox | 142.0.1 | Playwright-managed Firefox engine, automated headless | 13 passed; MapLibre initialized; Globe webgl2; offline external requests 0 |
| WebKit | 26.0 | Playwright-managed WebKit engine; not native Safari | 13 passed; MapLibre initialized; Globe webgl2; offline external requests 0 |

Chrome/Edge are installed browser binaries driven headlessly by Playwright. Firefox and WebKit are isolated Playwright test-engine downloads in ignored .artifacts/playwright-browsers. No native Safari/macOS/iOS browser or physical device was tested. Initial audit-harness issues (assumed global/site date equivalence, a selector label, case sensitivity, focus-visible heuristics on noninteractive main, and premature map readiness) were corrected; they were not counted as application compatibility failures.

The shared journey checks Story/NOAA and partial startup, news and weather scoped Retry, exact-date selection, refresh and Back/Forward, clipboard feedback with a mock, search keyboard controls, HH/HV comparison, unavailable observations, selected-evidence map and failed exact-date optical requests, ledger retries, CSV zero/persistence, restored Globe mode/month/date/imported point, inactive rendering, themes and offline behavior. Each engine initialized MapLibre and the WebGL2 Globe. Expected 503 console messages come from intentional outage fixtures; no unexpected console errors or uncaught page exceptions were observed.

## Accessibility and responsive coverage

- Keyboard primary navigation, skip link, modal accessible name/input label, reverse/wrapped search arrows, Ctrl+K, Escape and focus return passed.
- Native timeline/date/channel/comparison controls and missing-date states remain covered. Existing tests check touch targets, month accessible names and selected state, reduced motion, playback announcements and Retry/Copy feedback.
- Table captions and scoped column/date headers, chart alternatives and the named CSV scrolling region were checked. Live-region DOM behavior was tested; actual synthesized speech was not.
- Automated reflow passed at 1280, 640 and 320 CSS px in each engine, plus the existing 390 px light/dark suite. The 640/320 widths approximate 200%/400% layout reflow; they are not actual browser zoom. Firefox and WebKit 320 px screenshots were visually reviewed. Header navigation retains its existing horizontal scrolling at narrow widths.

## Scientific-integrity regression checks

Browse remains visual inspection, not calibrated backscatter or quantitative change. Catalog overlap retains its study-box denominator and longitude/latitude geometric limitation; it is not valid-pixel coverage or observed ground area. Missing observations, unsaved imagery, failed requests and unavailable measurements remain distinct. Requested unavailable dates stay selected without substitute observations. Regional comparisons expose available track/frame/maturity/CRID and unverified calibration/geometry limits. Optical requests use only the selected UTC day and do not establish simultaneous observation or directly comparable measurements. Conceptual/simulated views remain labeled; no measured reservoir level, flood extent, crop damage, soil moisture, land motion or ENSO attribution claim was added. Saved data are unchanged. All existing scientific tests and source-pixel checks passed.

## Validation and offline budget

- npm.cmd test: 43 passed.
- npm.cmd run typecheck: passed (also run by production build).
- npm.cmd run build: passed.
- Additional optional npm.cmd run test:api: **failed during collection**, with ImportError: cannot import name ArgsKwargs from pydantic_core._pydantic_core (unknown location). No backend assertions ran; this is an unresolved local Python/backend verification issue, not a passing test. Inspection found a CPython 3.15 binary (_pydantic_core.cp315-win_amd64.pyd) in the environment used by the Python 3.13 test runner. Restore a consistent interpreter/package environment before rerunning; no Python package was installed or changed during this audit.
- Existing browser suites: 123 passed groups across general 15, selections 9, startup 13, accessibility 6, weather 6, radar evidence 8, site map 9, site timeline 12, satellite 19, globe display 17 and globe performance 9.
- New npm.cmd run test:audit: 52 passed groups (13 per browser environment).
- npm.cmd run demo: passed. Final el-nino-app.html is **2,997,271 bytes**, **2,729 bytes** below the 3,000,000-byte limit. Embedded real-image data URIs remain 583,548 bytes. File-based offline Sites and vegetation passed in all four environments with **zero external requests**. Existing broader offline suites also passed. Detailed MapLibre remains disabled offline, with its existing explanation; local file links are not advertised as cross-device sharing.
- The performance suite confirms lazy engine/assets, no duplicate requests during repeated navigation, bounded caches, suspended RAFs, visibility resumption, late-response guards and explicit teardown. It is not a hardware-wide memory/energy benchmark.

Raw browser details/screenshots are generated in ignored .artifacts/final-audit.json and .artifacts/final-audit-*.png.

## Reproducing the cross-browser audit

Use a production preview on 127.0.0.1:5175. Existing globe-display/performance checks additionally require Vite on 5174. The audit uses installed Windows Chrome/Edge when present and reports missing binaries as unavailable rather than claiming coverage. Install test engines separately; this does not add application dependencies:

~~~powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.artifacts/playwright-browsers'
node node_modules/playwright/cli.js install firefox webkit
npm.cmd run test:audit
~~~

PREVIEW_URL can select another hosted preview. AUDIT_BROWSERS can select comma-separated Chrome,Edge,Firefox,WebKit for a focused rerun. Browser results from that rerun cover only those selected environments.

## Recommended pre-submission manual checks

1. Native Safari on macOS/iOS and physical Android/iPhone: touch/scroll, native date/month controls, map gestures, Globe context recovery and memory under prolonged playback.
2. NVDA with Firefox/Chrome and VoiceOver with Safari: reading order, dialog trapping/return, timeline descriptions, table navigation and non-repetitive live-region speech. Full WCAG/screen-reader compatibility is not claimed.
3. Real 200%/400% browser zoom and increased OS/text sizes. CSS reflow coverage does not verify every native browser control at zoom.
4. Actual HTTPS deployment path: shared links, refresh/history, real clipboard permission/grants (automated copy uses a mock), offline file distribution and browser storage/privacy restrictions.
5. Real tab backgrounding, slow/interrupted connections and long sessions on target GPUs. Controlled visibility/network events do not exhaust OS or hardware behavior.
6. Repair the optional Python environment and rerun npm.cmd run test:api, then test authenticated account/private-save and optional live AI/provider flows against the intended configured backend and credentials. Static/offline tests do not establish production provider availability or independently verify news claims.
