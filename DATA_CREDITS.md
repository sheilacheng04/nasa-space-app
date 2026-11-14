# Data credits

Code licensing does not replace dataset licenses. Sources were reviewed on **13 November 2026**; actual retrieval times are stored with each downloaded snapshot.

| Data | Source and attribution | Use here |
| --- | --- | --- |
| ENSO advisory / ONI | [NOAA Climate Prediction Center](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml); [ONI text](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt) | Dated advisory and separately stored historical ONI. Weekly Niño 3.4, ONI and RONI are not interchangeable. |
| NISAR GCOV browse | NASA–ISRO NISAR, distributed by [ASF DAAC](https://nisar-docs.asf.alaska.edu/); NASA Earthdata | Real regional HH quicklooks for three areas. Original scene identifiers, catalog responses and download URLs are stored in `data/browse/` and observation manifests. No calibrated measurements are derived from browse pixels. |
| Daily weather | [Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), ECMWF ERA5; CC BY 4.0 via Open-Meteo | 60-day temperature and precipitation snapshots, clearly identified as reanalysis. [Free API terms](https://open-meteo.com/en/terms) restrict use and request volume. |
| Optical context | [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/), MODIS Terra corrected reflectance | User-requested dated optical imagery. Respect underlying product attribution. |
| Locator boundaries | [Natural Earth](https://www.naturalearthdata.com/), redistributed by [world-atlas 2.0.2](https://github.com/topojson/world-atlas) | Public-domain Natural Earth geography; world-atlas redistribution under ISC. Copy of ISC license in `public/data/WORLD_ATLAS_LICENSE.txt`. Boundaries are small-scale context, not authoritative local geometry. |
| Place search | [Photon](https://github.com/komoot/photon), © OpenStreetMap contributors, ODbL | Explicit optional geocoding, maximum five results. Public service is best effort. |
| News | Original prototype archive; source publishers retain rights. [GDELT DOC](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) supplies optional headline discovery. | Headline/source-link metadata only; article bodies are not copied. Imported claims and links require verification. |
| Sentiment | Hutto, C.J. & Gilbert, E. (2014), VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text. [Upstream](https://github.com/cjhutto/vaderSentiment), MIT | Raw VADER and an explicitly separate project lexicon adjustment. Not a validated measure of climate impact or public sentiment. |
| Demonstration graphics | The Two-Faced Pacific contributors | Code-generated conceptual SVGs and invented test data, labeled directly on the graphics. MIT. |

## Prepared integrations, inputs still pending

- [Sentinel-1 / ASF](https://www.earthdata.nasa.gov/centers/asf-daac/data-access-tools): acknowledge Copernicus Sentinel data and the RTC processing service used.
- [OPERA DSWx-S1](https://podaac.jpl.nasa.gov/dataset/OPERA_L3_DSWX-S1_V1): cite the exact collection/version and relevant NASA/JPL product citation when used. Categorical water, not backscatter.
- [ESA WorldCover](https://esa-worldcover.org/en/data-access): CC BY 4.0; retain the exact product-year attribution and citation. Different-year algorithms can produce apparent change.
- [WorldPop](https://www.worldpop.org/): record the actual population product, year, citation and license; do not assume all datasets have identical terms.
- [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM): retain the license and attribution accompanying the selected release. It is a digital surface model.

No team photograph or firsthand narrative is supplied. Obtain permission and add a credit before publishing a real photograph. No NASA logo is used and no endorsement is implied.

## Restored globe and animations

The 909 place coordinates in `public/data/places.json` are retained from the user-supplied original HTML and are geographic locators, not verified scientific observations. Globe climate colors, country heights, arcs, and animated ocean/pattern diagrams are clearly labeled conceptual illustrations. Dated satellite views use NASA GIBS MODIS Terra corrected-reflectance imagery and retain on-screen attribution.
