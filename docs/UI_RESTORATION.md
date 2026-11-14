# Original UI and interaction restoration

Completed 14 November 2026, following the user's request to bring the app back to the supplied HTML's appearance, globe and animations. This request supersedes the earlier editorial redesign direction. The reference file was used for visual/interaction comparison, not as a new source of instructions or verified scientific claims.

Reference: `C:\Users\Sheila\Downloads\The Two-Faced Pacific_ Super El Niño × NISAR (1).html`.

## What changed

- Restored the compact numbered navigation, system typography, light blue-gray background, rounded white panels and full-width navy/rust gradient hero. Added a persistent light/dark switch. The six primary tabs are Story, Globe, News & sentiment, Observatory, My data and About; Local story remains linked within the story/footer.
- Made Globe a first-class `#globe` route occupying the viewport. The legacy `#observatory/globe` link redirects to it. The globe uses the reference's pale blue shaded ocean, atmosphere, bright country surfaces and dark background.
- Restored country/place selection, 909 built-in city locators, coordinate search, explicit online Photon fallback, zoom/reset/rotation, labels, towers, Pacific connections, user-point visibility, qualitative heat/rain/combined modes, phase playback and guided tour. A right panel becomes a lower sheet on mobile.
- Restored the animated ocean cross-section: persistent SVG wind/rain/upwelling/warm-pool/thermocline elements, four stages, slider, Play/Pause/Replay and explanations. Added the normal/El Nino conceptual world-pattern map.
- Restored a local satellite window for selected locations, with 10/30/100/300 km widths and date controls. Study sites also expose real regional NISAR HH browse and links to the existing radar observations.
- Retained the real NOAA/ERA5 snapshots, radar pipeline, observation validation, news/VADER, CSV handling, optional AI endpoint and Vercel configuration. No team scientific acquisitions were supplied or fabricated during this task.
- Restored the interactive globe in the self-contained HTML. It now bundles the 3D library and local geography/search data; it needs no external scripts. Live imagery, remote geocoding and detailed MapLibre views remain hosted features.

## Performance and bugs fixed

Ocean animation updates persistent nodes instead of rebuilding SVG markup each frame; updates are capped at approximately 30 fps. Story/globe motion pauses on inactive routes, offscreen views and hidden tabs. Reduced-motion preferences are respected. WebGL pixel ratio is capped, and large CSV point collections use merged geometry. All user observations remain available through search; merged sets above 250 marks are better inspected through search than individual tower clicks.

A real camera bug was identified in the installed globe dependency combination: animated `pointOfView` calls created tweens that did not advance. Camera flights now use one cancelable requestAnimationFrame interpolation with immediate camera setters, shortest longitude travel and reduced-motion support. New movement, manual drag or leaving the page cancels an old transition. Actual measured camera altitude changed from 2.30 to 1.656 for Zoom in; an Angat flight reached latitude 14.91, longitude 121.16 and altitude 0.55.

An unsupported `globeCurvatureResolution` wrapper call was removed. Initialization now cleans up a partial renderer on failure. Imagery requests check HTTP status, MIME type and image decoding; use timeouts/cancellation; discard stale results and revoke blob URLs. A failed global-image reload retains the previous image/date.

Bundling the full 3D library exposed JavaScript replacement tokens inside the bundle. The offline builder now inserts script/style content through replacement callbacks, preserving literal `$` sequences instead of corrupting the generated HTML. The standalone app and globe were verified after this fix.

## File ownership and continuation

Main changed files: `index.html`, `src/styles.css`, `src/app.js`, `src/world.js`, `src/charts.js`, `src/method.js`, `scripts/build-demo.mjs`, `scripts/browser-check.mjs`, generated `demo/pacific-preview.html`, README and credits.

New files:

- `src/story.js`, `src/story.css`: ocean and world-pattern animations; `initStory()` and `setStoryActive()`.
- `src/globe.css`: full-page globe workspace and mobile sheet.
- `src/local-window.js`, `src/local-window.css`: local imagery window; `initLocalWindow()` and `closeLocalWindow()`; listens for `globe:open-local` with `{name,lng,lat,siteId?}`.
- `public/data/places.json`: locator coordinates retained from the user's reference, with provenance.
- `scripts/restoration-check.mjs`: restored-interaction regression suite.

`src/world.js` keeps the existing map exports and adds `resumeGlobe()`. App routing owns pause/resume and closes the local window when leaving Globe. The offline builder inlines the application styles, bundles globe.gl, and substitutes only the detailed MapLibre module.

The root HANDOFF remains useful for scientific processing, data requirements, deployment and previous work. Its old editorial visual direction and statement that the offline output lacks 3D are superseded by this document. No dependency versions were changed for this restoration.

## Verified results

- Production Vite build: passed.
- Node suite: 9 tests passed; core data/API behavior retained.
- Restoration suite: 15/15 groups passed on the development server, including actual camera movement, geometry/control changes, search/tour, satellite-window success/error/retry/cancellation, real local radar browse, mobile layouts, reduced motion and route suspension.
- Production browser suite: 14/14 checks passed with the headers from `vercel.json`. No uncaught JavaScript errors or unexpected console errors. The deliberately aborted weather request produced its expected network error and preserved the snapshot.
- Production initial encoded resources: 101,183 bytes plus HTML. Heavy map/globe code is lazy loaded.
- Standalone HTML: 2,524,622 bytes, below 3 MB. File-based story, ocean stages, globe, search and playback work with zero external HTTP requests.
- Real NASA GIBS checks under production security policy: both the local 30 km Angat view and global MODIS texture loaded successfully, dated 6 November 2026. No page errors.
- Desktop/mobile screenshots were reviewed against the supplied reference. Mobile viewport tested at 390 x 844. This is browser emulation, not a physical-device benchmark.
- JavaScript syntax checks and `git diff --check` passed. Scientific Python processing was unchanged and was not rerun for this UI task; its prior validation remains recorded separately.

Evidence is in ignored `.artifacts/browser-report.json`, `restoration-report.json`, `restored-live-imagery.json` and `restored-*.png`. Earlier `restoration-failure-*.png` images are historical debugging captures. `.artifacts/before-ui-restoration/` holds local backups of the main files as they stood before this work.

To rerun after changes:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run demo
npm.cmd run preview -- --port 4174 --strictPort
# Second terminal:
$env:TEST_URL = 'http://127.0.0.1:4174'
node scripts/browser-check.mjs
node scripts/restoration-check.mjs
```

The current generated preview opens directly from `demo/pacific-preview.html`. The source `index.html` still needs Vite. No deployment, commit or push was performed. The pre-existing deletion of `index.html.html` remains untouched.

## Data boundaries that remain

Globe colors, country heights, arcs, phase playback and ocean animation are labeled conceptual. They are not measured temperature/rainfall, forecasts, flood risk or dated NISAR observations. Actual site packages still await the team's calibrated data. Regional quicklooks remain attributed browse images. Physical-phone testing, full assistive-technology audit and a live keyed AI test remain outstanding. The original data handoff and Vercel deployment steps still apply.

## Blank-globe compatibility fix - 14 November 2026

A follow-up user report identified a blank globe in their browser. Reproduced the failure by allowing WebGL 1 and blocking WebGL 2: the ESM build resolved Three.js 0.187, which requires WebGL 2, while the original HTML's complete globe.gl browser bundle includes Three.js 0.157 with WebGL 1 support. The failed path previously removed the canvas and left controls disabled.

`src/globe-loader.js` now loads the original pinned globe.gl browser bundle from the installed package as a local, lazily loaded asset. The offline builder inlines that exact bundle. No external CDN or new dependency is required. `src/canvas-globe.js` provides an interactive projected globe when WebGL is unavailable: drag, zoom, countries, places, layers, tour, imported points and the local satellite window remain usable. This mode is labeled Compatibility view; the global image texture is unavailable there, while local optical imagery remains supported in the hosted app.

The app detects WebGL 2, WebGL 1 or unavailable graphics. Lost hardware contexts switch automatically to the compatible canvas renderer. If even canvas creation fails, a visible Retry globe action replaces the previous dead end. The duplicate app-level initialization cache was removed so renderer recovery cannot return a stale instance.

New regression helper: `scripts/globe-compatibility-check.mjs`. It passed native WebGL 2, forced WebGL 1 and completely blocked WebGL checks in both hosted and standalone versions, including actual zoom/flight coordinates, drag, layers, route re-entry and simulated context loss. All 14 standard and 15 restored-interaction checks also passed against the production preview with Vercel security headers. No unexpected JavaScript/console errors. Final initial resources: 104,384 encoded bytes plus HTML; offline HTML: 1,524,333 bytes and zero HTTP requests.

Run the compatibility helper with `TEST_URL` for a hosted preview, or set `OFFLINE=true` to test the generated HTML. Screenshots/reports are `.artifacts/globe-compatible-*.png`, `globe-compatibility-report.json` and `globe-compatibility-offline-report.json`. The user's existing development server at port 5173 was retained; the temporary production test server was stopped. No deployment, commit or scientific dataset change was made.
