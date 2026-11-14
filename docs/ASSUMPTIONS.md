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
- The personal paragraph and photo remain clearly marked author slots.
- The self-contained file includes a bounded real-image subset and the last 60 daily weather rows; complete monthly comparisons remain embedded.
- Hosted static pages work without accounts. Existing server features are optional and must be explicitly enabled/configured.

- The Satellite add-on supersedes the Globe page only; the other pages keep their restored design.
- "First public data to latest" means the earliest and latest dates advertised by the selected production GIBS layer.
- Daily mosaics replace the absent rolling 12-day layer. January-June has real advertised frames.
- Release-window context is separate from unavailable pixel maturity, acquisition time and CRID.
- Browse overviews preserve the existing Concept camera and offline budget; they are not full-resolution GCOV science.
