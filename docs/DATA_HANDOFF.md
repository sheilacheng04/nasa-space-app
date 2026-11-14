# Scientific data handoff
The authoritative scene inventory is [data/inventory.json](../data/inventory.json). All four sites have real catalog coverage, and each selected pair stays in one PROVISIONAL track/frame/direction/CRID cohort.

Run the pipeline in [README](../README.md). Authenticate only through EARTHDATA_USERNAME and EARTHDATA_PASSWORD. Inspect the actual HDF5 datasets and mask flags before setting unitsAndMasksReviewed in a processing manifest. Never derive quantitative products from browse PNGs.

Current calibrated series have n = 0. Harmony extraction, thresholds, OPERA agreement and WorldCover class means remain untested on real data. [DATA_STATUS](DATA_STATUS.md) records the evidence and every unavailable step.
