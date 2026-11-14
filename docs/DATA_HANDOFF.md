# Dataset handoff

The UI consumes prepared observations. Scientific inputs still need quality review. Do not replace pending manifests with invented measurements.

## Supply

- Original NISAR L2 GCOV HDF5 or calibrated Sentinel-1 RTC GeoTIFFs, with original filenames and download metadata.
- Two or more comparable acquisitions per Philippine site; preferably three dates for time series.
- Source URL, UTC acquisition time, sensor, track/direction, frequency group, polarizations, maturity and composite release ID (CRID).
- Quality information and exact mask meanings. GCOV requires reviewed `validMaskValues`; zero is not assumed valid.
- Field, reservoir-level, irrigation, planting or rainfall records, with dates, units and provenance.
- A genuine local account and a photograph with date, location, photographer and permission.

Do not attach passwords or API keys.

## Study rectangles

Bounds are `[west, south, east, north]` in WGS84. They are study rectangles, not official reservoir/administrative polygons. Adjust `public/data/sites.json` before processing if needed.

| ID | Center (longitude, latitude) | Bounds |
| --- | --- | --- |
| `luzon` | 120.90, 15.50 | 120.65, 15.20, 121.15, 15.80 |
| `angat` | 121.16, 14.91 | 121.08, 14.84, 121.24, 15.00 |
| `dadu` | 67.80, 26.70 | 67.60, 26.50, 68.00, 26.90 |

## GCOV manifest

Copy `scripts/manifest.example.json`. Paths resolve relative to the manifest. Dates there are examples, not claims about supplied files. Replace track/CRID placeholders, confirm maturity and fill valid mask codes from the specification and file attributes. `inspect_gcov.py` prints metadata without reading full scenes.

The reader uses covariance diagonals, coordinate arrays, pixel spacing, CRS, masks and number of looks. It rejects missing metadata, unsupported orientation and empty valid areas. Comparability still needs scientific review.

## Sentinel-1 RTC entry

```json
{
  "id": "sentinel-before",
  "date": "2022-08-01",
  "sensor": "Sentinel-1 RTC",
  "track": "ACTUAL_TRACK",
  "direction": "ASCENDING",
  "frequency": "C",
  "maturity": "reviewed",
  "processingVersion": "ACTUAL_WORKFLOW_VERSION",
  "sourceUrl": "https://search.asf.alaska.edu/",
  "kind": "rtc",
  "units": "linear_power",
  "channels": {"VV": "before_VV.tif", "VH": "before_VH.tif"}
}
```

Units must be `linear_power` or `dB`. GRD, amplitude and arbitrary brightness are not calibrated power. Apply source nodata and layover/shadow masks before RTC import. Interferometric displacement is not a backscatter product.

## OPERA water entry

Use `kind: water`, `path`, `band`, `waterClasses`, `validClasses` and explicit acquisition metadata. Select class codes from the actual product version and confidence masks. No default codes are guessed. Water extent remains separate from dB change.

## Browser package

`prepare_radar.py` writes `public/data/observations/<siteId>.json`:

- `schemaVersion: 1`, status, retrieval time, site ID and processing record.
- `acquisitions[]`: identity/geometry, WGS84 image bounds, channel PNG/COG assets, means where applicable, coverage and hashes.
- `comparisons[]`: before/after IDs, channel, paired-valid change assets, mean difference and coverage.
- `contextLayers[]`: optional image, bounds, source URL, date, attribution and legend.

Assets use local `data/` paths. Grayscale spans −35 to 0 dB; differences span −6 to +6 dB. Transparency means missing data. Display clipping does not alter COG values. The HH/HV composite uses fixed stretches and a ratio; it is false color.

Site means summarize valid pixels. Compare coverage and spatial patterns before interpreting change. No significance test, speckle uncertainty estimate, validated crop classifier, causal attribution or operational alert is claimed.
