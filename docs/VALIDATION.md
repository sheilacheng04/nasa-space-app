# Validation record

Checked on 13 November 2026 using Windows, Node 25.6.1, Python 3.13.4 and installed Chrome. The project declares Node >=22.12.

## Passed

- Production Vite build, including the separately bundled MapLibre 6 worker.
- Nine Node tests: CSV quoting/validation/limits, safe URLs, compatible comparisons, observation schema, local sentiment and AI method/origin/configuration handling.
- Four Python tests: power-to-dB conversion, invalid-pixel handling, GCOV HDF5 mask/channel reading with a synthetic fixture, and an end-to-end calibrated RTC fixture producing valid COGs and the expected 3.0103 dB change.
- Fourteen browser checks: story, real browse/pending states, swipe, change/polarization controls, invalid dates, geographic map/worker, news, CSV persistence/errors, keyboard search, 3D globe/tour, local/method routes, 390 px mobile layout, failed-weather fallback and the self-contained preview.
- Production browser checks were run with the security headers from `vercel.json` applied by the preview server.
- Standalone HTML opens from disk and makes zero network requests.
- Successful browser fetches under those security headers: Open-Meteo ERA5 JSON, Photon JSON and NASA GIBS PNG. GIBS initially returned a service exception; a subsequent request succeeded. The actual optical-layer control also loaded MODIS imagery dated 6 November 2026. The application checks content type and handles either result.
- Dependency audit after updating MapLibre and Vite: zero reported npm vulnerabilities.
- `git diff --check` passed. The pre-existing deletion of `index.html.html` was left unchanged.

## Size and console

The browser recorded 81,884 bytes of encoded first-route resources, plus the HTML document. Heavy map/globe code and regional browse images are lazy loaded. The generated self-contained demo is approximately 378 KB. Both are below the 3 MB first-load budget.

No uncaught JavaScript errors or unexpected console errors occurred in the final suite. The deliberately aborted weather request generated the expected browser `net::ERR_FAILED` entry; the UI retained the saved snapshot and displayed its failure message. An earlier MapLibre worker error was fixed and verified by waiting for the rendered map to become idle, rather than checking only for a canvas.

Screenshots and detailed reports are in `.artifacts/` (ignored by Git). They include desktop and mobile Story and Observatory views. Python emitted a transitive affine/rasterio deprecation warning; calculations and output checks passed.

## Still requires real-world verification

- Scientific interpretation and calibration checks on the team's actual NISAR files. Synthetic numerical fixtures test software behavior, not the validity of a scientific finding.
- Independent field validation, water-level/operations records, uncertainty estimates and causal attribution.
- The optional keyed Anthropic endpoint, the Claude preview capability, and a real Vercel deployment. No provider key was supplied and no production deployment was performed.
- Physical mid-range phone performance, assistive-technology testing, and a full independent WCAG audit. Keyboard flows, contrast choices, reduced motion and mobile sizing are implemented, but browser emulation is not a substitute for those audits.
- WorldCover, WorldPop and Copernicus DEM overlays with real local source rasters. Their importer is implemented, but these inputs remain absent.
- Fresh GDELT news: the service returned HTTP 429, and the original 43-item archive was retained. Headlines have real upstream VADER scores; their claims and links are not independently reverified.

## UI restoration - 14 November 2026

The original-style UI and interactions were restored at the user's request. See [UI_RESTORATION.md](UI_RESTORATION.md) for the updated implementation and evidence. The final production build passed, all 15 restored-interaction groups passed, and all 14 production browser checks passed, including the now fully interactive offline 3D globe with zero HTTP requests. Initial production resources measured 101,183 encoded bytes plus HTML; standalone output is 2,524,622 bytes. Real local and global NASA GIBS imagery loaded successfully under production security headers. Actual camera movement was verified after replacing an inactive library tween with cancelable camera animation. No unexpected JavaScript/console errors remain in the final suites. Python scientific processing was unchanged.

## Blank-globe compatibility fix - 14 November 2026

A follow-up user report identified a blank globe in their browser. Reproduced the failure by allowing WebGL 1 and blocking WebGL 2: the ESM build resolved Three.js 0.187, which requires WebGL 2, while the original HTML's complete globe.gl browser bundle includes Three.js 0.157 with WebGL 1 support. The failed path previously removed the canvas and left controls disabled.

`src/globe-loader.js` now loads the original pinned globe.gl browser bundle from the installed package as a local, lazily loaded asset. The offline builder inlines that exact bundle. No external CDN or new dependency is required. `src/canvas-globe.js` provides an interactive projected globe when WebGL is unavailable: drag, zoom, countries, places, layers, tour, imported points and the local satellite window remain usable. This mode is labeled Compatibility view; the global image texture is unavailable there, while local optical imagery remains supported in the hosted app.

The app detects WebGL 2, WebGL 1 or unavailable graphics. Lost hardware contexts switch automatically to the compatible canvas renderer. If even canvas creation fails, a visible Retry globe action replaces the previous dead end. The duplicate app-level initialization cache was removed so renderer recovery cannot return a stale instance.

New regression helper: `scripts/globe-compatibility-check.mjs`. It passed native WebGL 2, forced WebGL 1 and completely blocked WebGL checks in both hosted and standalone versions, including actual zoom/flight coordinates, drag, layers, route re-entry and simulated context loss. All 14 standard and 15 restored-interaction checks also passed against the production preview with Vercel security headers. No unexpected JavaScript/console errors. Final initial resources: 104,384 encoded bytes plus HTML; offline HTML: 1,524,333 bytes and zero HTTP requests.

Run the compatibility helper with `TEST_URL` for a hosted preview, or set `OFFLINE=true` to test the generated HTML. Screenshots/reports are `.artifacts/globe-compatible-*.png`, `globe-compatibility-report.json` and `globe-compatibility-offline-report.json`. The user's existing development server at port 5173 was retained; the temporary production test server was stopped. No deployment, commit or scientific dataset change was made.
