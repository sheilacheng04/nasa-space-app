# Automated Usability & Task Flow Verification (`docs/USABILITY_TEST.md`)

This document records the six automated user task flows, the dismissable 3-step first-visit guide, and the before/after visual verification captured across all five pages (`Story`, `Sites`, `Globe`, `Media`, `Data and method`) in both Light and Dark themes at desktop (`1280px`) and mobile (`390px`) widths.

---

## 1. Automated Task Flows (`scripts/ux-task-flows-check.mjs`)

Every core visitor task flow is verified in headless Chromium via `node scripts/ux-task-flows-check.mjs` and asserted to complete in **5 clicks/actions or fewer**:

| Flow # | Task Description | Route Path | Clicks / Actions | Budget | Result |
|---|---|---|---|---|---|
| **Flow 1** | **Understand what El Niño is and how the Pacific shifts** — Open Story, jump via the sticky chapter bar to `#ocean`, and open an inline `GlossaryTerm` popover (`Niño 3.4` / `ONI`). | `#story` → `#ocean` | **2 clicks** | `<= 5` | **PASS** |
| **Flow 2** | **Compare a dry-side and a wet-side place** — Navigate from Story to Sites (`Angat, Philippines` dry-side reservoir) and switch the primary site selector (`#site-select`) to `Piura, Peru` (eastern Pacific wet-side flood plain). | `#story` → `#sites/angat` → `#sites/piura` | **2 clicks** | `<= 5` | **PASS** |
| **Flow 3** | **Play the Angat radar timeline, pause on a date, and read the maturity and coverage** — Open `#sites/angat`, press Play (`#site-play`), pause on a dated frame, and read `"Frame X of 24"`, the progress bar, and the maturity badge (`Provisional` / `Beta`). | `#sites/angat` | **2 clicks** | `<= 5` | **PASS** |
| **Flow 4** | **Focus on the Philippines, pick Central Luzon, and see its radar and local news** — From the Philippines Focus section on Story (`#philippines-focus`), select `Central Luzon` (`#sites/luzon`) and inspect its 20 saved NISAR radar frames alongside `"News about Central Luzon"` (`PlaceNewsPanel`). | `#story#philippines-focus` → `#sites/luzon` | **1 click** | `<= 5` | **PASS** |
| **Flow 5** | **Check what the site can and cannot conclude from the radar** — Navigate to `5 · Data and method` (`#method`) and jump to `4. Scientific limits` (`#method/limits`) to read the explicit table of what radar, vegetation, and weather records can and cannot prove. | `#story` → `#method` → `#method/limits` | **2 clicks** | `<= 5` | **PASS** |
| **Flow 6** | **Use it on a 390 px phone and with keyboard only** — At `390×844` mobile viewport, activate `.skip-link` with `Enter` to focus `#main`, press `Ctrl+K` to open `#search-dialog`, close with `Escape`, and verify zero horizontal overflow (`scrollWidth <= innerWidth + 1`). | `#sites/angat` (`390px`) | **3 key actions** | `<= 5` | **PASS** |

---

## 2. First-Visit Orientation & Feature Verification

In addition to the six task flows, `scripts/ux-task-flows-check.mjs` verifies:
- **Dismissable 3-Step First-Visit Guide (`FirstVisitGuide.tsx`)**: Appears automatically on `#story` when `localStorage.getItem('pacific-first-visit-guide-dismissed-v1')` is unset, dismisses cleanly when `#dismiss-guide` is clicked, and reopens on any page when the header `?` button (`#open-guide`) is clicked.
- **34 Global Study Places & Explicit Non-Radar Notice (`Task C2`)**: Selecting any of the 30 global places without saved WebP radar frames (e.g., `cagayan-valley`) displays `"Radar frames not saved for this place"` with a direct ASF Vertex polygon search link and zero placeholder images.
- **Local News & Empty-Headline Fallback (`Task E`)**: Picking a place displays `"News about <Place>"` from `public/data/news-by-place.json` with the wording-tone caveat, or `"No saved headlines for this place yet"` plus a disabled `"Search live"` button (e.g., `tumbes`).
- **Globe Status Strip, Philippines Preset & Local GIBS Map Handoff (`Tasks C3, D, F3`)**: Verifies `[data-testid="globe-status-strip"]`, `#globe-ph-preset`, `#open-local-map-btn` (`#globe-local-map-overlay`), and `#back-to-globe-btn`.
- **Media & Regional Overview Dashboard (`Task E / Media`)**: Verifies `[data-testid="media-dashboard"]` KPI cards, tone distribution bar, and regional breakdown cards.

---

## 3. Before & After Visual Comparison (`docs/ux/before/` vs. `docs/ux/after/`)

All 20 viewport/theme combinations were captured before and after the UX/UI improvements while preserving the exact visual identity (system fonts, `--blue` and `--orange` palette, rounded cards, light/dark themes, and 5-page navigation order):

| Route | Theme | Width | Before Screenshot | After Screenshot | Key UX Improvements Visible |
|---|---|---|---|---|---|
| **Story** (`#story`) | Light | `1280px` | `docs/ux/before/story-light-1280px.png` | `docs/ux/after/story-light-1280px.png` | 3-step first-visit guide, sticky chapter progress bar, 1-sentence page purpose, inline `GlossaryTerm` popovers, regional NISAR autoplay player, Philippines Focus section, Regional Impact summary, and eager-decoded site thumbnails. |
| **Story** (`#story`) | Dark | `1280px` | `docs/ux/before/story-dark-1280px.png` | `docs/ux/after/story-dark-1280px.png` | Dark palette contrast preserved; immediate `.pattern-effects` canvas rendering (`opacity: .72`). |
| **Story** (`#story`) | Light | `390px` | `docs/ux/before/story-light-390px.png` | `docs/ux/after/story-light-390px.png` | Responsive single-column stacking with zero horizontal overflow. |
| **Story** (`#story`) | Dark | `390px` | `docs/ux/before/story-dark-390px.png` | `docs/ux/after/story-dark-390px.png` | Mobile dark theme layout and sticky chapter bar. |
| **Sites** (`#sites/angat`) | Light | `1280px` | `docs/ux/before/sites-light-1280px.png` | `docs/ux/after/sites-light-1280px.png` | `Sites › Angat › Date` breadcrumb, 4-radar-site + 34-global-place pickers, bidirectional cross-page links, `"Frame X of 24"` + progress bar + maturity badge, standard `FigureCaption`, and `PlaceNewsPanel`. |
| **Sites** (`#sites/angat`) | Dark | `1280px` | `docs/ux/before/sites-dark-1280px.png` | `docs/ux/after/sites-dark-1280px.png` | Dark theme radar timeline, swipe comparator, and local news panel. |
| **Sites** (`#sites/angat`) | Light | `390px` | `docs/ux/before/sites-light-390px.png` | `docs/ux/after/sites-light-390px.png` | Mobile breadcrumb, stacked site pickers, and responsive radar stage. |
| **Sites** (`#sites/angat`) | Dark | `390px` | `docs/ux/before/sites-dark-390px.png` | `docs/ux/after/sites-dark-390px.png` | Mobile dark theme radar timeline and ERA5 weather charts. |
| **Globe** (`#globe`) | Light | `1280px` | `docs/ux/before/globe-light-1280px.png` | `docs/ux/after/globe-light-1280px.png` | Uncluttered 3D globe with status strip (Mode, Layer, Date, Place, Reset view, Philippines focus, Guided tour, Local GIBS map handoff) and `PlaceNewsPanel`. |
| **Globe** (`#globe`) | Dark | `1280px` | `docs/ux/before/globe-dark-1280px.png` | `docs/ux/after/globe-dark-1280px.png` | Dark theme 3D globe and playback sheet. |
| **Globe** (`#globe`) | Light | `390px` | `docs/ux/before/globe-light-390px.png` | `docs/ux/after/globe-light-390px.png` | Mobile grid layout preserved (`sheet.bottom <= 845px`). |
| **Globe** (`#globe`) | Dark | `390px` | `docs/ux/before/globe-dark-390px.png` | `docs/ux/after/globe-dark-390px.png` | Mobile dark theme globe and bottom playback sheet. |
| **Media** (`#media`) | Light | `1280px` | `docs/ux/before/media-light-1280px.png` | `docs/ux/after/media-light-1280px.png` | New **Media & Regional Overview Dashboard** (KPI cards, visual tone distribution bar, regional breakdown cards) and local place news inspector above the 293-headline archive. |
| **Media** (`#media`) | Dark | `1280px` | `docs/ux/before/media-dark-1280px.png` | `docs/ux/after/media-dark-1280px.png` | Dark theme Media dashboard and tone bar. |
| **Media** (`#media`) | Light | `390px` | `docs/ux/before/media-light-390px.png` | `docs/ux/after/media-light-390px.png` | Responsive mobile Media dashboard and headline cards. |
| **Media** (`#media`) | Dark | `390px` | `docs/ux/before/media-dark-390px.png` | `docs/ux/after/media-dark-390px.png` | Mobile dark theme Media view. |
| **Method** (`#method`) | Light | `1280px` | `docs/ux/before/method-light-1280px.png` | `docs/ux/after/method-light-1280px.png` | Plain-language lead copy (Flesch >= 60), 5 visual data source cards, inline `GlossaryTerm` popovers, expandable technical ledgers, and removal of the confusing CSV upload block. |
| **Method** (`#method`) | Dark | `1280px` | `docs/ux/before/method-dark-1280px.png` | `docs/ux/after/method-dark-1280px.png` | Dark theme Method source cards and glossary. |
| **Method** (`#method`) | Light | `390px` | `docs/ux/before/method-light-390px.png` | `docs/ux/after/method-light-390px.png` | Mobile Method layout with scrollable tables inside progressive disclosure. |
| **Method** (`#method`) | Dark | `390px` | `docs/ux/before/method-dark-390px.png` | `docs/ux/after/method-dark-390px.png` | Mobile dark theme Method layout. |
