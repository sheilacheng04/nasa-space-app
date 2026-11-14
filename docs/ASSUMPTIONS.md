# Assumptions
- The existing React/TypeScript project is the implementation base; the supplied 43 headlines are preserved. The superseded original prototype is retained in Git history.
- The review date is 14 November 2026. Source timestamps remain UTC. Weather ends 8 November to allow for ERA5 latency.
- Angat's supplied approximate center at 121.4 E is east of the actual dam/reservoir. The existing 121.08–121.24 E, 14.84–15.0 N box is retained. An NPC station specification supports 121.161194 E, 14.909611 N; this is a dam station, not a reservoir centroid.
- Luzon and Dadu use the wider requested boxes. Real footprint fractions are reported; an intersecting scene does not guarantee valid coverage of the full box.
- Lower Piura is added as a covered wet-side hypothesis. Its local seasonal timing must be tested; no 2026 flood or El Niño attribution is asserted.
- BETA remains historical context. All chosen baseline/event pairs are PROVISIONAL, same track/frame/direction/CRID. Dates identify observations, not a confirmed hydrologic event.
- The requested rolling GIBS layer is absent from current GetCapabilities. Daily imagery is used with explicit missing dates; no rolling product is fabricated.
- GIBS pixel lineage is unavailable. Its maturity/CRID badge says not available. Regional ASF quicklooks have known metadata but are not quantitative site clips.
- No Earthdata credentials are present. Calibrated science and independent OPERA validation are untested, not inferred from browse.
- The self-contained file includes a bounded real-image subset and the last 60 daily weather rows; complete monthly comparisons remain embedded.
- Hosted static pages work without accounts. Existing server features are optional and must be explicitly enabled/configured.

- The latest user correction keeps the original fonts, colors and rounded controls on every page, including Globe. Satellite functionality remains available.
- "First public data to latest" means the earliest and latest dates advertised by the selected production GIBS layer.
- Daily mosaics replace the absent rolling 12-day layer. January-June has real advertised frames.
- Release-window context is separate from unavailable pixel maturity, acquisition time and CRID.
- Browse overviews preserve the existing Concept camera and offline budget; they are not full-resolution GCOV science.

- The default satellite base is the saved historical NASA Blue Marble optical composite; it is explicitly separate from dated NISAR coverage. Natural Earth outlines are a secondary fallback only if the saved optical base cannot decode.
- Concept progression follows actual calendar months. MODIS NDVI is observed vegetation greenness; weather-driven soil/water drawings remain conceptual. Neither display establishes land damage or El Nino attribution.
- Missing MODIS months and incomplete weather months remain unknown. The two modes keep independent observation dates and the same camera.

- The global Story and headline framing explain the ocean–rainfall–land connection for readers without SAR training. Method separates each data source's role and keeps detailed processing and provenance expandable.
- Sites playback uses 57 actual saved NASA frames with fixed per-site bounds and exact dates. Gaps remain explicit, with no invented intermediate imagery or stale image under a new date. The original before/after comparison remains available.
- Globe radar dates and vegetation months progress independently through visible calendar controls. Real image changes are evidence to investigate; they are not measured land motion, water level, crop damage or proof of El Niño attribution.

## Prompt 1 UX, Shared Data Contracts & Simplification Assumptions (14 November 2026)
- **CSV Upload Removal**: Per explicit user instruction, the optional custom CSV upload panel (`#my-data` / `DataPage.tsx`) was removed from `App.tsx` and `MethodPage.tsx` so visitors are not confused by unverified local browser points mixed with curated satellite and climate records.
- **34 Global Study Places & Saved Radar Honesty**: Only the 4 original study sites (`luzon`, `angat`, `dadu`, `piura`) have saved WebP NISAR GIBS frames committed on disk (`57` frames total). In `public/data/places.json`, those 4 places set `hasRadarFrames: true` and carry `siteId`; the other 30 global places (including 4 additional Philippine places: `cagayan-valley`, `mindoro`, `cotabato-mindanao`, `iloilo-panay`) set `hasRadarFrames: false` and display `"Radar frames not saved for this place"` with a direct ASF Vertex polygon search URL (`public/data/nisar/places-coverage.json`). No placeholder or synthetic radar imagery is ever shown.
- **Local News Matching (`public/data/news-by-place.json`)**: Headlines from `public/data/news.json` (293 items) are matched to the 34 places in three explicit tiers: `"place-name"` (title contains place name or alias), `"query"` (same country + basin/hazard query term), and `"country"` (country-tagged reporting). Places with zero matches (such as `tumbes`) explicitly state `"No saved headlines for this place yet"` alongside a disabled `"Search live (coming next)"` button prepared for Prompt 2.
- **Autoplay & Reduced Motion**: Automatic progression of dated radar frames on Story and Sites starts when at least 50% visible in the viewport only when `prefers-reduced-motion: reduce` is not active, and immediately pauses on hover, focus, touch, or keyboard interaction.
- **URL Route Sharing**: Both `#sites/angat?date=2026-10-09` and `#/sites?place=angat&date=2026-10-09` (and `#/globe?place=angat&date=2026-10-09`) are supported by `src/selection-url.js` so existing links and new query-parameter links round-trip identically.
- **Offline Bundle Size Budget**: To keep `el-nino-app.html` under `3,000,000` bytes (`2,969,768` bytes) after adding `places.json`, `gazetteer.json` (909 Natural Earth cities), and `news-by-place.json`, `scripts/build-demo.mjs` encodes `news-by-place.json` items as compact `[newsId, placeId, matchedBy]` tuples reconstructed from `news.json` at load time and uses base36 string deduplication (`~<index>`).

