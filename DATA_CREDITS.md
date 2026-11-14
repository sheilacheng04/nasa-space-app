# Data credits
Software is MIT licensed; external data are not relicensed.

- NASA/ISRO NISAR, distributed by ASF DAAC: GCOV catalog metadata, acquisition footprints and regional HH/HV browse. [Guide](https://nisar-docs.asf.alaska.edu/) and [source inventory](public/data/inventory.json). PROVISIONAL pairs use P05023; VALIDATED catalog records use P05036. All browse is downsampled and not calibrated.
- NASA GIBS: real daily false-color NISAR mosaics. [Capabilities](public/data/gibs-capabilities.json) and per-site manifests retain complete GetMap URLs and parameters. Pixel-level maturity/CRID are unavailable.
- NOAA CPC: [weekly Niño SST](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for), [ONI](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt). Ocean context, not NISAR observations.
- Open-Meteo and ECMWF ERA5: [historical API](https://open-meteo.com/en/docs/historical-weather-api), point reanalysis for 2025–2026 and baseline 1991–2020. Values can be revised.
- GDELT DOC 2.0 plus the supplied 43-item archive: headline discovery, per-item publisher links, raw/adjusted VADER. Publisher rights remain with each source. No full articles are redistributed.
- Natural Earth world geometry via world-atlas/topojson: public-domain outlines; bundled license in public/data/WORLD_ATLAS_LICENSE.txt. Geographic context, not a radar product.
- NASA GIBS MODIS optical imagery is optional, requested on demand and labeled optical, not SAR.
- OPERA DSWx-S1, ESA WorldCover, WorldPop, Copernicus DEM, SME2 and GUNW are methods/future references; they are not displayed as measured results.

## Exact accessible citation guidance
> NISAR follows NASA’s standard Data Use and Citation Guidance.

[ASF citation guidance](https://nisar-docs.asf.alaska.edu/data-use-citation-guidance/). Dataset-specific recommended wording: **not available**. Linked NASA guidance and DOI landing pages returned 403, while CMR supplied the verified DOI identifiers:
- BETA: 10.5067/NIL2GCOV-B1
- PROVISIONAL: 10.5067/NIL2GCOV-P1
- VALIDATED: 10.5067/NIL2GCOV-V1

No substitute citation has been represented as NASA's wording. Exact access outcomes and retrieval dates: [DATA_STATUS](docs/DATA_STATUS.md).

Local personal writing and photograph: not yet supplied. No personal experience or image credit has been invented.
