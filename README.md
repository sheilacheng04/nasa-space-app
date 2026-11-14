# The Two-Faced Pacific

**Explore how changes in the Pacific connect to rainfall, water, farms and communities.**

Built for NASA Space Apps 2026, *Dancing with the SARs*. This interactive website explains the science in plain language and lets you compare real satellite images over time.

SAR means **synthetic aperture radar**: a way of making images using microwave echoes. **NISAR** is a joint NASA and Indian Space Research Organisation (ISRO) satellite mission that uses this technology to observe Earth.

## Try it

- **Online:** [Open the website](https://two-faced-pacific-nisar-field-journal.moltenbasket4.chatgpt.site). Access currently requires permission from the owner.
- **Offline:** download this repository, then double-click [el-nino-app.html](el-nino-app.html). No installation or internet connection is needed. It contains a smaller selection of images than the online version. On GitHub, download the file rather than opening its code preview.

## What you can explore

| Page | What to do |
| --- | --- |
| **Story** | Learn how ocean conditions can affect rainfall and why radar helps us observe land. |
| **Sites** | Choose a study area, play dated radar images, or compare two dates. Explore rainfall and possible explanations. |
| **Globe** | Rotate Earth, play radar observations by date, or follow monthly vegetation changes. |
| **Media** | Read source-linked headlines about climate and its human impacts. |
| **Data and method** | Learn where the evidence comes from, how to compare it fairly, and what it can tell us. |

The study areas are Central Luzon and Angat reservoir in the Philippines, Dadu in Pakistan, and Lower Piura in Peru. They are local examples of questions that matter around the world.

## Run it on your computer

You need **Node.js 22.12 or newer**, which includes npm. Download or clone the repository and open a terminal in its folder:

```sh
npm ci
npm run dev:frontend
```

Open the local address printed in the terminal. Press **Ctrl+C** to stop the server.

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is blocked.

**Python, API keys and a database are not needed to run the main website.** It includes saved data. Python is used for optional data processing and backend features.

## Build and check

```sh
npm test
npm run build
```

The build creates `dist/`. Upload that folder to a static web host to serve the website.

To regenerate the downloadable offline edition, run `npm run demo`. This extra step also needs Python and the data-processing dependencies described in the [data pipeline guide](docs/DATA_PIPELINE.md). Edit the source in `src/`; the offline HTML is generated from it.

Browser checks, setup details and recorded results are in the [validation report](docs/VALIDATION.md).

## Share an evidence view

Choose a view on Sites or Globe, then press **Copy link**. The link restores its relevant source, channel, site and date selections. Missing imagery remains unavailable. If copying is blocked, a selectable link appears. Local offline-file links cannot be shared across devices. See the [sharing guide](docs/SHARING.md) for URL examples and navigation behavior.

## Understand the images

- **Radar:** real NISAR preview images from NASA/ISRO, distributed through ASF and NASA GIBS. Sites includes 57 saved images across the four study areas. Their colors represent radar reflections, not natural-color photographs.
- **Vegetation:** 21 saved monthly MODIS images show vegetation greenness between January 2025 and October 2026. These are a separate satellite record, not NISAR measurements.
- **Weather and ocean context:** NOAA ocean records and ERA5 weather estimates help explore possible explanations for changes on land.
- **Earth background:** the natural-color globe uses historical Blue Marble imagery from 2004 as a reference. It is not a live satellite feed.

Missing dates are shown as gaps. The ocean animation and land-response drawings are labeled conceptual illustrations.

**A changing image is a starting point for investigation.** It does not, on its own, prove a change in water level, crop health or land motion, or show that El Nino caused an event. Calibrated water-area and radar-change measurements are not yet available in this project.

See [data status and limitations](docs/DATA_STATUS.md) for the full record. The saved edition was reviewed on **14 November 2026**; data do not refresh automatically.

## Find your way around the repository

| Location | Purpose |
| --- | --- |
| `src/` | Website source: React, TypeScript, JavaScript and CSS |
| `public/data/` | Saved images, data and source records |
| `scripts/` | Data preparation, offline packaging and checks |
| `tests/` | Automated tests |
| `backend/` | Optional Python API and account services |
| `docs/` | Technical guides and validation records |
| `submission/` | Presentation materials for the challenge |
| `el-nino-app.html` | Generated, self-contained offline edition |

### Why the language chart previously showed mostly HTML

The offline edition bundles the application code, images and data into one large HTML file. GitHub counts code by file size, so this generated file dominated the chart.

[.gitattributes](.gitattributes) marks **only that generated bundle** as `linguist-generated`, using [GitHub's documented setting](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github). The source files, including the real `index.html`, keep their normal classification. The offline download still works. GitHub recalculates the chart after the change reaches the default branch; the update may take some time.

## Contributor guides

- [Refresh data or process scientific radar products](docs/DATA_PIPELINE.md)
- [Optional backend setup](docs/FULLSTACK.md)
- [Validation and browser checks](docs/VALIDATION.md)
- [Assumptions and limitations](docs/ASSUMPTIONS.md)
- [Data credits](DATA_CREDITS.md)

## Credits and license

Data and imagery come from NASA/ISRO, ASF DAAC, NASA GIBS, MODIS, NOAA, ECMWF ERA5 via Open-Meteo, GDELT and the linked publishers. See [data credits](DATA_CREDITS.md) for attribution.

The software is MIT-licensed. Data and imagery retain their providers' terms.

Startup loads the site catalog independently from NOAA context, preview summaries, news and the source index. Optional failures have scoped Retry actions; Media and Data and method also work when the site catalog is unavailable. See [startup dependencies and failure validation](docs/VALIDATION.md#independent-startup-data-loading).
