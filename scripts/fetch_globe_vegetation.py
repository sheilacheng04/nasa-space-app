#!/usr/bin/env python3
"""Cache NASA GIBS monthly MODIS NDVI for the globe, retaining source alpha.

Run from any directory with the project's Python environment. No API key or
Earthdata credentials are used. Only advertised monthly dates are requested.
Outputs are visualization pixels, never quantitative science measurements.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import requests
import truststore
from PIL import Image

truststore.inject_into_ssl()
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "globe"
FRAMES = OUTPUT / "vegetation"
LAYER = "MODIS_Terra_L3_NDVI_Monthly"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
DOMAIN_URL = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi"
    "?SERVICE=WMTS&REQUEST=DescribeDomains&VERSION=1.0.0"
    f"&LAYER={LAYER}&TILEMATRIXSET=1km&TIME=all"
)
LEGEND_URL = "https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.svg"
LEGEND_PNG_URL = "https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.png"
COLORMAP_URL = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml"
WIDTH, HEIGHT = 1024, 512


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def fetch(url: str) -> requests.Response:
    response = requests.get(
        url,
        headers={"Origin": "https://example.com", "User-Agent": "LandSignals-NASA-GIBS-asset-cache/1.0"},
        timeout=(10, 45),
    )
    response.raise_for_status()
    return response


def months(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current = date(current.year + (current.month == 12), current.month % 12 + 1, 1)


def parse_month(value: str) -> date:
    parsed = date.fromisoformat(value)
    if parsed.day != 1:
        raise argparse.ArgumentTypeError("Use the first day of a month: YYYY-MM-01")
    return parsed


def advertised_months(domain: str) -> set[str]:
    result: set[str] = set()
    for period in domain.split(","):
        parts = period.strip().split("/")
        if len(parts) == 1:
            result.add(parts[0][:10])
        elif len(parts) == 3 and parts[2] == "P1M":
            result.update(item.isoformat() for item in months(date.fromisoformat(parts[0][:10]), date.fromisoformat(parts[1][:10])))
        else:
            raise ValueError(f"Unexpected monthly time domain: {period}")
    return result


def source_url(day: str) -> str:
    params = {
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.1.1",
        "LAYERS": LAYER, "STYLES": "", "FORMAT": "image/png", "TRANSPARENT": "TRUE",
        "SRS": "EPSG:4326", "BBOX": "-180,-90,180,90",
        "WIDTH": str(WIDTH), "HEIGHT": str(HEIGHT), "TIME": day,
    }
    return requests.Request("GET", WMS, params=params).prepare().url


def frame_record(month: date, advertised: set[str]) -> dict:
    day = month.isoformat()
    record = {
        "date": day, "label": month.strftime("%b %Y"), "status": "unavailable",
        "url": None, "sourceUrl": source_url(day), "advertised": day in advertised,
        "width": WIDTH, "height": HEIGHT, "nonTransparentPixels": None,
        "bytes": 0, "sha256": None, "httpStatus": None,
    }
    if day not in advertised:
        record["reason"] = "Month is absent from the official GIBS full time domain; no image was requested or substituted."
        return record
    try:
        response = fetch(record["sourceUrl"])
        record.update({
            "sourceUrl": response.url, "retrievedAt": timestamp(),
            "httpStatus": response.status_code, "sourceBytes": len(response.content),
            "sourceSha256": digest(response.content),
            "corsAllowOrigin": response.headers.get("Access-Control-Allow-Origin"),
            "contentType": response.headers.get("Content-Type"),
        })
        original = Image.open(io.BytesIO(response.content))
        if original.format != "PNG" or original.size != (WIDTH, HEIGHT):
            raise ValueError(f"Expected {WIDTH}x{HEIGHT} PNG; got {original.format} {original.size}")
        rgba = original.convert("RGBA")
        alpha = rgba.getchannel("A")
        visible = WIDTH * HEIGHT - alpha.histogram()[0]
        record.update({
            "nonTransparentPixels": visible, "transparentPixels": WIDTH * HEIGHT - visible,
            "alphaMin": alpha.getextrema()[0], "alphaMax": alpha.getextrema()[1],
        })
        if not visible:
            record["reason"] = "Advertised month returned a fully transparent visualization; no image is displayed."
            return record
        encoded = io.BytesIO()
        rgba.save(encoded, format="WEBP", lossless=True, quality=100, method=6, exact=True)
        content = encoded.getvalue()
        decoded = Image.open(io.BytesIO(content)).convert("RGBA")
        if decoded.tobytes() != rgba.tobytes():
            raise ValueError("Lossless WebP RGBA round-trip verification failed")
        target = FRAMES / f"{day}.webp"
        target.write_bytes(content)
        record.update({
            "status": "available", "url": f"data/globe/vegetation/{day}.webp",
            "bytes": len(content), "sha256": digest(content), "losslessRgbaVerified": True,
        })
        if day in {"2026-09-01", "2026-10-01"}:
            offline = rgba.resize((384, 192), Image.Resampling.NEAREST)
            offline_buffer = io.BytesIO()
            offline.save(offline_buffer, format="WEBP", lossless=True, quality=100, method=6, exact=True)
            offline_bytes = offline_buffer.getvalue()
            if Image.open(io.BytesIO(offline_bytes)).convert("RGBA").tobytes() != offline.tobytes():
                raise ValueError("Offline WebP RGBA round-trip verification failed")
            (FRAMES / f"{day}-offline.webp").write_bytes(offline_bytes)
            record["offlineUrl"] = f"data/globe/vegetation/{day}-offline.webp"
            record["offline"] = {
                "width": 384, "height": 192, "bytes": len(offline_bytes),
                "sha256": digest(offline_bytes), "resampling": "nearest",
                "losslessRgbaVerified": True,
                "note": "Downsampled display preview; nearest-neighbor selection retains source colors and alpha.",
            }
        if len(content) > 200000:
            record["sizeNote"] = "Preserved lossless RGBA even though this frame exceeds the approximate 200 KB target."
    except Exception as error:
        record["status"] = "error"
        record["reason"] = f"{type(error).__name__}: {error}"
        if isinstance(error, requests.HTTPError) and error.response is not None:
            record["httpStatus"] = error.response.status_code
    return record


def static_svg(content: bytes) -> bytes:
    """Keep NASA's visual legend but remove script/event behavior for static use."""
    svg = ET.fromstring(content)
    if svg.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError("Legend response is not an SVG")
    for parent in svg.iter():
        for child in list(parent):
            if child.tag.rsplit("}", 1)[-1] == "script":
                parent.remove(child)
        for name in list(parent.attrib):
            if name.rsplit("}", 1)[-1].lower().startswith("on"):
                del parent.attrib[name]
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    return ET.tostring(svg, encoding="utf-8", xml_declaration=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=parse_month, default=date(2025, 1, 1))
    parser.add_argument("--end", type=parse_month, default=date(2026, 10, 1))
    parser.add_argument("--workers", type=int, choices=range(1, 4), default=3)
    args = parser.parse_args()
    if args.start > args.end:
        parser.error("--start must be at or before --end")
    domain_response = fetch(DOMAIN_URL)
    domain_xml = ET.fromstring(domain_response.content)
    domain_text = domain_xml.findtext(".//DimensionDomain/Domain")
    if not domain_text:
        raise ValueError("Official full time-domain response has no Domain")
    advertised = advertised_months(domain_text)
    legend_response = fetch(LEGEND_URL)
    legend_png_response = fetch(LEGEND_PNG_URL)
    legend_png = Image.open(io.BytesIO(legend_png_response.content))
    if legend_png.format != "PNG":
        raise ValueError("Official static legend response is not a PNG")
    legend_png.load()
    colormap_response = fetch(COLORMAP_URL)
    cmap = ET.fromstring(colormap_response.content)
    continuous = next((item for item in cmap.iter("Legend") if item.get("type") == "continuous"), None)
    if continuous is None:
        raise ValueError("Official NDVI colormap has no continuous legend")
    FRAMES.mkdir(parents=True, exist_ok=True)
    (FRAMES / "domain.xml").write_bytes(domain_response.content)
    (FRAMES / "colormap.xml").write_bytes(colormap_response.content)
    legend_bytes = static_svg(legend_response.content)
    (FRAMES / "legend.svg").write_bytes(legend_bytes)
    (FRAMES / "legend.png").write_bytes(legend_png_response.content)
    records = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        tasks = {pool.submit(frame_record, month, advertised): month for month in months(args.start, args.end)}
        for future in as_completed(tasks):
            record = future.result()
            records.append(record)
            print(json.dumps({key: record.get(key) for key in ("date", "status", "bytes", "nonTransparentPixels", "reason")}), flush=True)
    records.sort(key=lambda item: item["date"])
    manifest = {
        "schemaVersion": 1, "layerId": LAYER,
        "title": "Observed vegetation greenness - MODIS Terra monthly NDVI",
        "units": "NDVI (dimensionless)", "temporalResolution": "monthly composite",
        "dateMeaning": "The first day identifies the composite month; it is not a single observation date.",
        "retrievedAt": timestamp(), "range": {"start": args.start.isoformat(), "end": args.end.isoformat()},
        "source": {
            "provider": "NASA Global Imagery Browse Services (GIBS)", "instrument": "MODIS", "platform": "Terra",
            "product": "MOD13A3 monthly vegetation indices", "sourceResolutionMeters": 1000,
            "wmsEndpoint": WMS, "domainUrl": DOMAIN_URL, "fullTimeDomain": domain_text,
            "domainArtifact": "data/globe/vegetation/domain.xml", "domainSha256": digest(domain_response.content),
            "projection": "EPSG:4326", "bbox": [-180, -90, 180, 90],
            "imageryApiDocumentation": "https://nasa-gibs.github.io/gibs-api-docs/access-basics/",
            "productDocumentation": "https://modis.gsfc.nasa.gov/data/dataprod/mod13.php",
            "productUserGuide": "https://modis-land.gsfc.nasa.gov/pdf/MOD13_User_Guide_V61.pdf",
            "interpretationDocumentation": "https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/",
            "seasonalityDocumentation": "https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology",
            "acknowledgmentGuidance": "https://nasa-gibs.github.io/gibs-api-docs/",
        },
        "credit": "NASA GIBS / ESDIS; MODIS Terra vegetation indices",
        "transparencyNote": "Transparent areas include fill OR low/nonpositive NDVI (values below 0.0001 in the official GIBS colormap); transparency does not universally mean no observation.",
        "legend": {
            "url": "data/globe/vegetation/legend.svg", "sourceUrl": LEGEND_URL,
            "pngUrl": "data/globe/vegetation/legend.png", "pngSourceUrl": LEGEND_PNG_URL,
            "pngSha256": digest(legend_png_response.content), "pngBytes": len(legend_png_response.content),
            "pngWidth": legend_png.width, "pngHeight": legend_png.height,
            "sourceSha256": digest(legend_response.content), "sha256": digest(legend_bytes),
            "colormapUrl": COLORMAP_URL, "colormapArtifact": "data/globe/vegetation/colormap.xml",
            "colormapSha256": digest(colormap_response.content),
            "type": continuous.get("type"), "minLabel": continuous.get("minLabel"), "maxLabel": continuous.get("maxLabel"),
            "transformation": "Official visual legend preserved; script elements and event attributes removed for static display.",
            "meaning": "Official GIBS continuous NDVI color scale. Low positive values are pale/brown; higher values are green. Do not relabel colors as health, drought, water, or crop yield.",
            "transparency": "The official colormap makes fill and NDVI values below 0.0001 transparent. Transparent pixels are not all missing observations. Nontransparent counts describe displayed pixels, not valid Earth area.",
        },
        "interpretation": [
            "NDVI is a spectral vegetation index derived from red and near-infrared reflectance; it represents vegetation greenness, not a direct measurement of crop yield or water availability.",
            "Seasonal vegetation cycles, land cover, clouds, snow, atmospheric effects and compositing influence the display. A changing color alone does not establish vegetation damage, drought or an ENSO cause.",
            "These 1024-by-512 global images are downsampled browse visualizations. They do not resolve individual farms and must not be read as quantitative pixel measurements.",
            "Missing months are explicit and are never interpolated, replaced with another month, or converted into simulated observations.",
            "Interpretation is a communication limit for this app; use the original science data and quality flags for quantitative analysis.",
        ],
        "frames": records,
        "counts": {state: sum(item["status"] == state for item in records) for state in ("available", "unavailable", "error")},
    }
    (OUTPUT / "vegetation.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(OUTPUT / "vegetation.json"), "counts": manifest["counts"], "totalFrameBytes": sum(item["bytes"] for item in records)}), flush=True)
    return 1 if manifest["counts"]["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
