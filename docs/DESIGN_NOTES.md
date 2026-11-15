# Design refinement · 15 November 2026

## Baseline audit

The original orange/blue identity, rounded controls, system fonts, light/dark palettes, navigation and five-page structure are retained. The baseline includes the pre-existing uncommitted Sites and editorial changes.

- Spacing: repeated 12–26 px paddings lack a clear rhythm; the chapter bar has excessive blank space and a fixed sticky offset.
- Hierarchy: the Story headline strands “land?” on desktop; three adjacent hero controls compete. Other page titles use unrelated sizes, and Sites puts its explanation before its title.
- Alignment: the mark is undersized beside the name; page introductions and the Globe use different gutters and alignments.
- Elevation: most cards are visually equal; isolated black shadows are heavier in dark mode. Scientific imagery needs a clear, quiet frame.
- Controls: button heights range from 20 to 44 px; selected orange controls sometimes inherit blue link text. Focus rings are inconsistent on Globe.
- Icons: search and study markers use different sizes and stroke widths; the theme glyph depends on the platform font.
- Charts: keep scientific colors and all legends, scales and values intact; improve the surrounding card, tick-label readability and caption spacing.
- Dark mode: broad hero colors and translucent space overlays are hardcoded separately; text and overlays should use opaque theme surfaces. Small orange labels need the existing accessible accent.
- Motion: the pre-existing star pattern is static and unrelated to camera movement. Background motion needs a separate lifecycle and a pause control, without adding work to timeline playback.

## Decisions

Use shared spacing, type, radius, elevation and 150/300/600 ms motion tokens. Keep one hero pattern: eyebrow, balanced title, existing explanation, primary action. Preserve existing secondary destinations as quiet links. Text-heavy reading sections use solid card surfaces. Background contours and space scenery are decorative, not satellite observations. No satellite sprite is added.

The procedural controller owns one canvas, moves it to the current introduction or globe stage, caps drawing at 30 fps and DPR at 2, and suspends when its host is offscreen or the tab is hidden. Media and Method remain static. Reduced motion draws a static frame. Slow drawing reduces detail. Mobile/low-core devices start with fewer lines and stars. The footer preference is stored locally; it does not control scientific timeline playback.

Overlapping radar pins now show one unobscured 44 px target at its actual geographic position, with the selected site taking priority. All four sites remain in the existing place list. No coordinates move. The ocean chart uses a labeled group so its source links remain independently accessible. Selected playback controls change foreground and fill together, avoiding a low-contrast interval during transitions.

## Alternative headlines (proposals only)

1. A changing Pacific. A closer look at land.
2. What does a warmer Pacific leave behind?
3. Follow the Pacific, from ocean to everyday life.

The live headline remains “When the Pacific warms, what changes on land?”

## Validation and screenshot pairs

Screenshots use the same installed Chrome, 900 px viewport height, reduced motion and controlled unavailability of optional live GIBS requests. Files are full-page captures at 390 and 1280 px in both themes. The default Globe route remains the existing Concept globe; exact radar pixels and the separate monthly vegetation view are checked by the display and satellite suites.

| Page | Theme / width | Before | After |
| --- | --- | --- | --- |
| Story | Light / 390 | [Before](design/before/story-light-390px.png) | [After](design/after/story-light-390px.png) |
| Story | Dark / 390 | [Before](design/before/story-dark-390px.png) | [After](design/after/story-dark-390px.png) |
| Story | Light / 1280 | [Before](design/before/story-light-1280px.png) | [After](design/after/story-light-1280px.png) |
| Story | Dark / 1280 | [Before](design/before/story-dark-1280px.png) | [After](design/after/story-dark-1280px.png) |
| Sites | Light / 390 | [Before](design/before/sites-light-390px.png) | [After](design/after/sites-light-390px.png) |
| Sites | Dark / 390 | [Before](design/before/sites-dark-390px.png) | [After](design/after/sites-dark-390px.png) |
| Sites | Light / 1280 | [Before](design/before/sites-light-1280px.png) | [After](design/after/sites-light-1280px.png) |
| Sites | Dark / 1280 | [Before](design/before/sites-dark-1280px.png) | [After](design/after/sites-dark-1280px.png) |
| Globe | Light / 390 | [Before](design/before/globe-light-390px.png) | [After](design/after/globe-light-390px.png) |
| Globe | Dark / 390 | [Before](design/before/globe-dark-390px.png) | [After](design/after/globe-dark-390px.png) |
| Globe | Light / 1280 | [Before](design/before/globe-light-1280px.png) | [After](design/after/globe-light-1280px.png) |
| Globe | Dark / 1280 | [Before](design/before/globe-dark-1280px.png) | [After](design/after/globe-dark-1280px.png) |
| Media | Light / 390 | [Before](design/before/media-light-390px.png) | [After](design/after/media-light-390px.png) |
| Media | Dark / 390 | [Before](design/before/media-dark-390px.png) | [After](design/after/media-dark-390px.png) |
| Media | Light / 1280 | [Before](design/before/media-light-1280px.png) | [After](design/after/media-light-1280px.png) |
| Media | Dark / 1280 | [Before](design/before/media-dark-1280px.png) | [After](design/after/media-dark-1280px.png) |
| Method | Light / 390 | [Before](design/before/method-light-390px.png) | [After](design/after/method-light-390px.png) |
| Method | Dark / 390 | [Before](design/before/method-dark-390px.png) | [After](design/after/method-dark-390px.png) |
| Method | Light / 1280 | [Before](design/before/method-light-1280px.png) | [After](design/after/method-light-1280px.png) |
| Method | Dark / 1280 | [Before](design/before/method-dark-1280px.png) | [After](design/after/method-dark-1280px.png) |

## Validation scope

The 55 Node tests, TypeScript/production build, and all four requested browser suites pass. The design suite checks 60 page/theme/viewport combinations (320, 390, 768, 1280, 1920 and 844 × 390 landscape), 20 standard axe scans plus 8 additional observational Globe scans, remembered pause/resume, reduced motion, simulated tab visibility and actual offscreen suspension. Separate compact controls, selects, range controls and disclosures have 44 px minimum targets; inline glossary terms retain their text-flow exception. Text links inside prose retain normal inline layout.

The controller is **2,736 bytes gzipped from source**, below the approximately 10 KB cap. Below-fold Story comparison images are decoded only as their section approaches the viewport, preserving their full original pixels and captions and keeping the documented hosted initial-load budget. The generated offline file is **2,979,134 bytes** against the unchanged 3,000,000 byte budget. Real embedded image data URIs remain **583,548 bytes**. General and satellite browser tests observe **zero external requests** from the file edition. `.gitattributes`, `vercel.json`, the scientific data files, image pixels, captions and scientific claims are unchanged. The exact-date NASA link is available inside Playback help using the existing saved source URL.

The old tests assumed a single Story image, default radar Globe mode, an older thumbnail width, always-open playback controls, and source-mode buttons already absent from the working Sites page. Tests now verify both Story dates, select radar mode explicitly, use the current 224 px offline thumbnail contract, open the existing disclosures, and clear the session decode cache before controlled failure injection. Sites remains the existing GIBS-only interface; regional/simulation selectors have not been reintroduced or source-selection behavior changed. Radar playback, missing dates, image failures, retry, exact pixels, camera state and compatibility recovery remain tested. Mobile radar controls can flow vertically to keep all controls reachable at 44 px; the date controls stay beside their image.

Lighthouse and frame timings are recorded in `design/*-lighthouse.json`, `design/*-metrics.json` and `design/autoplay-performance.json`. Lighthouse uses the default simulated mobile profile and cold storage, three runs per revision. Frame measurements use an unthrottled 1280 × 900 Chrome window on this machine's approximately 120 Hz display. They measure browser animation scheduling, not physical GPU output. No hardware-wide energy or real-phone performance claim is made.

Axe reports no automatic violations; its incomplete findings on scientific SVG/canvas content remain recorded in [the accessibility report](design/accessibility.json). Theme text colors are checked numerically against all four base surfaces in [the palette report](design/palette-contrast.json). The globe source/status text has a solid space surface, and its evidence overlays have solid theme card backgrounds. Scientific image palettes and existing diagram colors remain intact. Raw accent combinations below 4.5:1 in the palette report are not universal small-text pairings; the large hero accent uses the large-text criterion, while small body/link text uses its tested opaque theme surfaces. Screen-reader speech and physical-device testing remain manual follow-up.

## Reproduce the design checks

Run `npm ci`, `npm test`, `npm run build` and `npm run demo`. The source preview is Vite on 5174; the production preview is Vite preview on 5175. No package manifest or lockfile dependency changes are required. Audit-only tools were installed into ignored `.artifacts/`:

```powershell
npm install --prefix .artifacts/design-tools --no-save --package-lock=false axe-core@4.14.0 lighthouse@13.6.0
node scripts/design-browser-check.mjs
node scripts/design-capture.mjs after
node scripts/design-performance-check.mjs
node scripts/design-lighthouse.mjs after
```

Run performance commands individually, without other browser suites in progress. `design-capture.mjs before` and `design-lighthouse.mjs before` capture an unmodified baseline; do not overwrite the saved baseline after making changes. The temporary audit tools are not included in the app or offline edition.

## Measured before/after results

Lighthouse mobile medians across three cold runs:

| Category | Before | After |
| --- | ---: | ---: |
| Performance | 95 | 96 |
| Accessibility | 97 | 100 |
| Best practices | 100 | 100 |
| SEO | 92 | 91 |

Performance changes by 1 point(s), within the maximum 5-point regression allowance. Measured cumulative layout shift decreases from 0.079 to 0.000. Full run scores and timings are retained rather than selecting the best run.

| Route | RAF rate before / after (Hz) | p95 frame interval before / after (ms) |
| --- | ---: | ---: |
| story | 120.0 / 119.7 | 8.6 / 8.5 |
| sites/angat | 120.0 / 120.0 | 8.6 / 8.5 |
| globe | 119.2 / 119.3 | 8.6 / 8.5 |

The separate eight-second autoplay check advances across 5 selected dates including the loop restart, with p95 8.8 ms and maximum 33.4 ms. Sites background work suspends automatically while its introduction is offscreen. Active decorative drawing averages 0.08 ms on Story and 0.10 ms on Globe in the recorded sample, below the 4 ms adaptive reduction threshold.

Final uncompressed startup responses: **1,591,804 bytes**, no heavy globe/map assets. Final generated offline HTML: **2,979,134 bytes**; zero external requests. The consolidated results are in [validation-summary.json](design/validation-summary.json).


Orange gradient follow-up: strengthened the existing Story hero glow toward its right edge (18% orange tint in light mode, 34% in dark mode), using the original orange token. Build and the CSS color guard passed; four theme/viewport checks found no hero axe violations, horizontal overflow or offline external requests. Story after-screenshots were refreshed. The full-audit Lighthouse/frame measurements above predate this CSS-only tuning.

## Assumptions

- This is a local source update; no hosted deployment or scientific data refresh is requested.
- The current accessible orange override and existing blue are the authoritative brand colors.
- Existing captions, caveats and explanatory sentences are preserved, including their current wording limits.
- Audit utilities may be installed temporarily under ignored `.artifacts/`; no runtime dependencies are added.
- Headless local measurements establish a reproducible comparison, not real-phone GPU or battery performance.
