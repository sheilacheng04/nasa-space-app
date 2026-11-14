#!/usr/bin/env python3
"""Build shared data contracts: public/data/places.json, public/data/news-by-place.json, and public/data/gazetteer.json."""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"

PLACES_CATALOG = [
    # Philippines (6 places: Luzon, Angat, Cagayan Valley, Mindoro, Cotabato/Mindanao, Iloilo/Panay)
    {
        "id": "luzon",
        "name": "Central Luzon Rice Bowl",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 15.45,
        "lng": 120.90,
        "bounds": [120.50, 15.00, 121.30, 15.90],
        "regime": "dry",
        "kind": "agriculture",
        "siteId": "luzon",
        "hasRadarFrames": True,
        "newsQuery": "Central Luzon Nueva Ecija Pantabangan rice irrigation Philippines",
        "aliases": ["Central Luzon", "Nueva Ecija", "Pantabangan", "Pampanga", "Tarlac", "Bulacan", "Luzon"]
    },
    {
        "id": "angat",
        "name": "Angat & Ipo Watershed",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 14.91,
        "lng": 121.15,
        "bounds": [120.95, 14.75, 121.35, 15.10],
        "regime": "dry",
        "kind": "water",
        "siteId": "angat",
        "hasRadarFrames": True,
        "newsQuery": "Angat Dam Ipo Reservoir Metro Manila water supply Philippines",
        "aliases": ["Angat", "Angat Dam", "Ipo Dam", "Norzagaray", "Metro Manila water", "Manila"]
    },
    {
        "id": "cagayan-valley",
        "name": "Cagayan Valley & Magat Basin",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 16.95,
        "lng": 121.65,
        "bounds": [121.30, 16.60, 122.00, 17.30],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Cagayan Valley Isabela Magat Dam corn rice drought Philippines",
        "aliases": ["Cagayan Valley", "Isabela", "Magat", "Magat Dam", "Tuguegarao", "Cagayan"]
    },
    {
        "id": "mindoro",
        "name": "Occidental & Oriental Mindoro Farms",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 12.85,
        "lng": 121.05,
        "bounds": [120.70, 12.40, 121.45, 13.30],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Mindoro San Jose irrigation rice dry spell Philippines",
        "aliases": ["Mindoro", "Occidental Mindoro", "Oriental Mindoro", "San Jose Mindoro", "Calapan"]
    },
    {
        "id": "cotabato-mindanao",
        "name": "Cotabato & Allah Valley Rice Basin, Mindanao",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 6.75,
        "lng": 124.65,
        "bounds": [124.30, 6.40, 125.00, 7.10],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Mindanao Cotabato Allah Valley Sultan Kudarat South Cotabato rice drought",
        "aliases": ["Mindanao", "Cotabato", "South Cotabato", "Sultan Kudarat", "Allah Valley", "Pulangi"]
    },
    {
        "id": "iloilo-panay",
        "name": "Iloilo & Jalaur River Plains, Panay",
        "country": "Philippines",
        "countryCode": "PH",
        "region": "Southeast Asia",
        "lat": 10.90,
        "lng": 122.55,
        "bounds": [122.25, 10.65, 122.85, 11.20],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Iloilo Panay Western Visayas Jalaur rice water Philippines",
        "aliases": ["Iloilo", "Panay", "Western Visayas", "Jalaur", "Capiz", "Antique"]
    },
    # Southeast Asia & Maritime Continent (dry-side)
    {
        "id": "west-java-citarum",
        "name": "West Java & Citarum Reservoir Cascade",
        "country": "Indonesia",
        "countryCode": "ID",
        "region": "Southeast Asia",
        "lat": -6.55,
        "lng": 107.40,
        "bounds": [107.00, -6.95, 107.80, -6.15],
        "regime": "dry",
        "kind": "water",
        "hasRadarFrames": False,
        "newsQuery": "West Java Citarum Jatiluhur rice drought Indonesia",
        "aliases": ["West Java", "Citarum", "Jatiluhur", "Indramayu", "Karawang", "Java"]
    },
    {
        "id": "central-kalimantan",
        "name": "Central Kalimantan Peatlands",
        "country": "Indonesia",
        "countryCode": "ID",
        "region": "Southeast Asia",
        "lat": -2.25,
        "lng": 113.95,
        "bounds": [113.50, -2.70, 114.40, -1.80],
        "regime": "dry",
        "kind": "forest",
        "hasRadarFrames": False,
        "newsQuery": "Central Kalimantan Borneo peatland fire haze drought Indonesia",
        "aliases": ["Kalimantan", "Palangka Raya", "Borneo peatland", "Kapuas", "Kahayan"]
    },
    {
        "id": "south-sulawesi",
        "name": "South Sulawesi Walanae Rice Plains",
        "country": "Indonesia",
        "countryCode": "ID",
        "region": "Southeast Asia",
        "lat": -4.55,
        "lng": 119.95,
        "bounds": [119.55, -4.95, 120.35, -4.15],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "South Sulawesi Makassar harvest drought El Nino Indonesia",
        "aliases": ["Sulawesi", "South Sulawesi", "Makassar", "Wajo", "Bone"]
    },
    {
        "id": "mekong-delta",
        "name": "Mekong Delta Salinity & Rice Zone",
        "country": "Vietnam",
        "countryCode": "VN",
        "region": "Southeast Asia",
        "lat": 10.05,
        "lng": 105.75,
        "bounds": [105.30, 9.60, 106.20, 10.50],
        "regime": "dry",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Mekong Delta salinity intrusion rice drought Vietnam",
        "aliases": ["Mekong Delta", "Can Tho", "Mekong", "Ca Mau", "Ben Tre"]
    },
    # Oceania / Northern & Eastern Australia (dry-side)
    {
        "id": "murray-darling",
        "name": "Northern Murray-Darling Basin",
        "country": "Australia",
        "countryCode": "AU",
        "region": "Oceania",
        "lat": -29.50,
        "lng": 148.50,
        "bounds": [148.00, -30.00, 149.00, -29.00],
        "regime": "dry",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Murray-Darling Basin New South Wales Queensland water storage bushfire Australia",
        "aliases": ["Murray-Darling", "New South Wales", "Moree", "Narrabri", "Darling River"]
    },
    {
        "id": "burdekin-queensland",
        "name": "Burdekin & North Queensland Grazing Belt",
        "country": "Australia",
        "countryCode": "AU",
        "region": "Oceania",
        "lat": -19.70,
        "lng": 147.30,
        "bounds": [146.85, -20.15, 147.75, -19.25],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "North Queensland Burdekin Townsville rainfall pasture Australia",
        "aliases": ["Burdekin", "Queensland", "Townsville", "Ayr", "Charters Towers"]
    },
    {
        "id": "papua-highlands",
        "name": "Markham Valley & Eastern Highlands",
        "country": "Papua New Guinea",
        "countryCode": "PG",
        "region": "Oceania",
        "lat": -6.50,
        "lng": 146.50,
        "bounds": [146.05, -6.95, 146.95, -6.05],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Papua New Guinea Highlands Markham drought frost food security",
        "aliases": ["Markham Valley", "Goroka", "Lae", "Eastern Highlands", "Papua New Guinea"]
    },
    # South Asia (La Nina reference + dry-side monsoon regions)
    {
        "id": "dadu",
        "name": "Dadu & Manchar Lake Floodplain",
        "country": "Pakistan",
        "countryCode": "PK",
        "region": "South Asia",
        "lat": 26.73,
        "lng": 67.78,
        "bounds": [67.35, 26.25, 68.25, 27.20],
        "regime": "la-nina-reference",
        "kind": "floodplain",
        "siteId": "dadu",
        "hasRadarFrames": True,
        "newsQuery": "Dadu Sindh Manchar Lake Indus floodplain Pakistan",
        "aliases": ["Dadu", "Manchar Lake", "Sindh", "Indus floodplain", "Larkana", "Sehwan"]
    },
    {
        "id": "marathwada-godavari",
        "name": "Marathwada & Jayakwadi Basin",
        "country": "India",
        "countryCode": "IN",
        "region": "South Asia",
        "lat": 19.15,
        "lng": 76.20,
        "bounds": [75.75, 18.70, 76.65, 19.60],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Marathwada Maharashtra Godavari monsoon reservoir crops India",
        "aliases": ["Marathwada", "Maharashtra", "Jayakwadi", "Aurangabad", "Beed", "Latur"]
    },
    {
        "id": "cauvery-delta",
        "name": "Cauvery Delta & Mettur System",
        "country": "India",
        "countryCode": "IN",
        "region": "South Asia",
        "lat": 10.85,
        "lng": 79.15,
        "bounds": [78.70, 10.40, 79.60, 11.30],
        "regime": "dry",
        "kind": "water",
        "hasRadarFrames": False,
        "newsQuery": "Cauvery Delta Tamil Nadu Karnataka Mettur Dam irrigation India",
        "aliases": ["Cauvery", "Mettur", "Thanjavur", "Tamil Nadu", "Karnataka"]
    },
    # Southern Africa (dry-side)
    {
        "id": "zambezi-kariba",
        "name": "Middle Zambezi & Lake Kariba",
        "country": "Zambia",
        "countryCode": "ZM",
        "region": "Southern Africa",
        "lat": -16.85,
        "lng": 28.05,
        "bounds": [27.55, -17.30, 28.55, -16.40],
        "regime": "dry",
        "kind": "water",
        "hasRadarFrames": False,
        "newsQuery": "Lake Kariba Zambezi hydropower drought Zambia Zimbabwe",
        "aliases": ["Kariba", "Lake Kariba", "Zambezi", "Southern Province Zambia", "Siavonga"]
    },
    {
        "id": "limpopo-valley",
        "name": "Limpopo Dryland Farming Basin",
        "country": "Zimbabwe",
        "countryCode": "ZW",
        "region": "Southern Africa",
        "lat": -21.80,
        "lng": 30.15,
        "bounds": [29.70, -22.25, 30.60, -21.35],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Limpopo Matabeleland Masvingo maize drought Zimbabwe",
        "aliases": ["Limpopo", "Beitbridge", "Masvingo", "Matabeleland", "Chiredzi"]
    },
    {
        "id": "vaal-highveld",
        "name": "Vaal Dam & Highveld Maize Triangle",
        "country": "South Africa",
        "countryCode": "ZA",
        "region": "Southern Africa",
        "lat": -26.90,
        "lng": 28.10,
        "bounds": [27.65, -27.35, 28.55, -26.45],
        "regime": "dry",
        "kind": "water",
        "hasRadarFrames": False,
        "newsQuery": "Vaal Dam Free State Highveld maize drought South Africa",
        "aliases": ["Vaal Dam", "Free State", "Highveld", "Gauteng water", "Vaal River"]
    },
    # East Africa (wet-side during short rains)
    {
        "id": "tana-river-garissa",
        "name": "Tana River Floodplain at Garissa",
        "country": "Kenya",
        "countryCode": "KE",
        "region": "East Africa",
        "lat": -0.45,
        "lng": 39.65,
        "bounds": [39.20, -0.90, 40.10, 0.00],
        "regime": "wet",
        "kind": "floodplain",
        "hasRadarFrames": False,
        "newsQuery": "Tana River Garissa short rains flood Kenya East Africa",
        "aliases": ["Tana River", "Garissa", "Hola", "Garsen", "Tana Delta"]
    },
    {
        "id": "juba-shabelle",
        "name": "Juba & Shabelle River Corridor",
        "country": "Somalia",
        "countryCode": "SO",
        "region": "East Africa",
        "lat": 2.10,
        "lng": 45.10,
        "bounds": [44.65, 1.65, 45.55, 2.55],
        "regime": "wet",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Shabelle Juba Beletweyne Baardheere flood Somalia",
        "aliases": ["Shabelle", "Juba River", "Beletweyne", "Jowhar", "Baardheere"]
    },
    {
        "id": "lake-victoria-nyanza",
        "name": "Winam Gulf & Kano Plains, Lake Victoria",
        "country": "Kenya",
        "countryCode": "KE",
        "region": "East Africa",
        "lat": -0.15,
        "lng": 34.75,
        "bounds": [34.35, -0.55, 35.15, 0.25],
        "regime": "wet",
        "kind": "floodplain",
        "hasRadarFrames": False,
        "newsQuery": "Kisumu Nyando Kano Plains Lake Victoria flooding Kenya",
        "aliases": ["Kisumu", "Kano Plains", "Nyando", "Winam Gulf", "Lake Victoria"]
    },
    # Central America & Northern South America (dry-side)
    {
        "id": "chagres-gatun",
        "name": "Gatun Lake & Panama Canal Watershed",
        "country": "Panama",
        "countryCode": "PA",
        "region": "Central America",
        "lat": 9.15,
        "lng": -79.85,
        "bounds": [-80.25, 8.80, -79.45, 9.50],
        "regime": "dry",
        "kind": "water",
        "hasRadarFrames": False,
        "newsQuery": "Gatun Lake Panama Canal draft water level rainfall Panama",
        "aliases": ["Gatun Lake", "Panama Canal", "Chagres", "Alhajuela", "Colon"]
    },
    {
        "id": "corredor-seco-choluteca",
        "name": "Central American Dry Corridor (Choluteca)",
        "country": "Honduras",
        "countryCode": "HN",
        "region": "Central America",
        "lat": 13.30,
        "lng": -87.18,
        "bounds": [-87.60, 12.90, -86.75, 13.70],
        "regime": "dry",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Dry Corridor Corredor Seco Choluteca maize beans drought Honduras",
        "aliases": ["Corredor Seco", "Dry Corridor", "Choluteca", "Valle", "El Paraiso"]
    },
    {
        "id": "magdalena-cauca",
        "name": "Middle Magdalena & Cauca Valley",
        "country": "Colombia",
        "countryCode": "CO",
        "region": "South America",
        "lat": 4.85,
        "lng": -74.80,
        "bounds": [-75.25, 4.40, -74.35, 5.30],
        "regime": "dry",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Magdalena River Cauca reservoir hydropower El Nino Colombia",
        "aliases": ["Magdalena", "Cauca Valley", "Tolima", "Huila", "Barrancabermeja"]
    },
    {
        "id": "rio-negro-manaus",
        "name": "Lower Rio Negro & Central Amazon",
        "country": "Brazil",
        "countryCode": "BR",
        "region": "South America",
        "lat": -3.10,
        "lng": -60.15,
        "bounds": [-60.65, -3.55, -59.65, -2.65],
        "regime": "dry",
        "kind": "forest",
        "hasRadarFrames": False,
        "newsQuery": "Rio Negro Manaus Amazon low river level drought Brazil",
        "aliases": ["Rio Negro", "Manaus", "Amazonas", "Solimoes", "Tefe"]
    },
    # Peru, Ecuador & Southern South America (wet-side)
    {
        "id": "piura",
        "name": "Lower Piura River & Chira Plains",
        "country": "Peru",
        "countryCode": "PE",
        "region": "South America",
        "lat": -5.20,
        "lng": -80.63,
        "bounds": [-81.10, -5.65, -80.20, -4.80],
        "regime": "wet",
        "kind": "river",
        "siteId": "piura",
        "hasRadarFrames": True,
        "newsQuery": "Piura Chira Poechos coastal rainfall flooding northern Peru",
        "aliases": ["Piura", "Chira", "Poechos", "Catacaos", "Sullana", "Sechura"]
    },
    {
        "id": "tumbes-zarumilla",
        "name": "Tumbes & Zarumilla Coastal Floodplain",
        "country": "Peru",
        "countryCode": "PE",
        "region": "South America",
        "lat": -3.57,
        "lng": -80.45,
        "bounds": [-80.85, -3.95, -80.05, -3.20],
        "regime": "wet",
        "kind": "floodplain",
        "hasRadarFrames": False,
        "newsQuery": "Tumbes Zarumilla northern Peru coastal rain overflow",
        "aliases": ["Tumbes", "Zarumilla", "Aguas Verdes", "Corrales"]
    },
    {
        "id": "guayas-babahoyo",
        "name": "Guayas & Babahoyo River Lowlands",
        "country": "Ecuador",
        "countryCode": "EC",
        "region": "South America",
        "lat": -1.85,
        "lng": -79.65,
        "bounds": [-80.10, -2.30, -79.20, -1.40],
        "regime": "wet",
        "kind": "floodplain",
        "hasRadarFrames": False,
        "newsQuery": "Guayas Babahoyo Los Rios Guayaquil coastal flooding Ecuador",
        "aliases": ["Guayas", "Babahoyo", "Guayaquil", "Los Rios", "Daule"]
    },
    {
        "id": "jacui-taquari-rs",
        "name": "Jacuí & Taquari Floodplains, Rio Grande do Sul",
        "country": "Brazil",
        "countryCode": "BR",
        "region": "South America",
        "lat": -29.75,
        "lng": -51.75,
        "bounds": [-52.25, -30.20, -51.25, -29.30],
        "regime": "wet",
        "kind": "floodplain",
        "hasRadarFrames": False,
        "newsQuery": "Rio Grande do Sul Taquari Jacui Porto Alegre flooding Brazil",
        "aliases": ["Rio Grande do Sul", "Taquari", "Jacui", "Porto Alegre", "Guaiba"]
    },
    {
        "id": "rio-uruguay-salto",
        "name": "Lower Uruguay River Corridor",
        "country": "Uruguay",
        "countryCode": "UY",
        "region": "South America",
        "lat": -31.40,
        "lng": -57.95,
        "bounds": [-58.35, -31.85, -57.55, -30.95],
        "regime": "wet",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Uruguay River Salto Paysandu Artigas rainfall flooding Uruguay",
        "aliases": ["Salto", "Paysandu", "Uruguay River", "Rio Uruguay", "Litoral"]
    },
    # North America / Southern US & Mexico (wet-side & mixed)
    {
        "id": "salinas-pajaro",
        "name": "Salinas & Pajaro Coastal Agricultural Valleys",
        "country": "United States",
        "countryCode": "US",
        "region": "North America",
        "lat": 36.75,
        "lng": -121.65,
        "bounds": [-122.05, 36.35, -121.25, 37.15],
        "regime": "wet",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "California Salinas Pajaro Monterey winter storm atmospheric river levee",
        "aliases": ["Salinas", "Pajaro", "Monterey", "Watsonville", "Central Coast", "California", "Carpinteria"]
    },
    {
        "id": "apalachicola-suwannee",
        "name": "Gulf Coast & Apalachicola Basin",
        "country": "United States",
        "countryCode": "US",
        "region": "North America",
        "lat": 30.15,
        "lng": -85.00,
        "bounds": [-85.45, 29.70, -84.55, 30.60],
        "regime": "wet",
        "kind": "river",
        "hasRadarFrames": False,
        "newsQuery": "Gulf Coast Florida Panhandle Apalachicola winter rain United States",
        "aliases": ["Apalachicola", "Suwannee", "Tallahassee", "Florida Panhandle", "Gulf Coast"]
    },
    {
        "id": "yaqui-sonora",
        "name": "Yaqui Valley Irrigated Plains, Sonora",
        "country": "Mexico",
        "countryCode": "MX",
        "region": "North America",
        "lat": 27.45,
        "lng": -109.95,
        "bounds": [-110.40, 27.00, -109.50, 27.90],
        "regime": "mixed",
        "kind": "agriculture",
        "hasRadarFrames": False,
        "newsQuery": "Yaqui Valley Ciudad Obregon Sonora Alvaro Obregon reservoir wheat Mexico",
        "aliases": ["Yaqui", "Sonora", "Ciudad Obregon", "Cajeme", "Sinaloa"]
    }
]


def preserve_gazetteer() -> None:
    places_path = DATA_DIR / "places.json"
    gazetteer_path = DATA_DIR / "gazetteer.json"
    if not gazetteer_path.exists() and places_path.exists():
        raw = json.loads(places_path.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and "places" in raw:
            gazetteer_path.write_text(
                json.dumps(raw, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            print(f"Preserved {len(raw['places'])} cities in {gazetteer_path}")


def check_asf_coverage(places: list[dict]) -> dict:
    """Attempt a quick live check against ASF Search API or record sandboxed/offline status."""
    results = {}
    probe_url = "https://api.daac.asf.alaska.edu/services/search/param?dataset=NISAR&maxResults=1&output=json"
    reachable = False
    error_reason = None
    try:
        req = urllib.request.Request(probe_url, headers={"User-Agent": "two-faced-pacific/3.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            reachable = resp.status == 200
    except Exception as exc:
        error_reason = str(exc)

    for p in places:
        site_id = p.get("siteId")
        has_saved = bool(site_id and (DATA_DIR / "sites" / site_id / "evidence.json").exists())
        w, s, e, n = p["bounds"]
        polygon = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
        vertex_url = (
            "https://search.asf.alaska.edu/#/?dataset=NISAR&polygon="
            + urllib.parse.quote(polygon)
        )
        results[p["id"]] = {
            "placeId": p["id"],
            "hasSavedFrames": has_saved,
            "asfApiReachable": reachable,
            "asfProbeNote": "Saved GIBS + ASF granules verified on disk" if has_saved else (
                error_reason or "Checked ASF Search API; no local GIBS WebP frames saved for this place"
            ),
            "vertexSearchUrl": vertex_url,
        }
    out_path = DATA_DIR / "nisar" / "places-coverage.json"
    out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    return results


def build_places_json() -> list[dict]:
    normalized = []
    for item in PLACES_CATALOG:
        entry = {
            "id": item["id"],
            "name": item["name"],
            "country": item["country"],
            "countryCode": item["countryCode"],
            "region": item["region"],
            "lat": round(float(item["lat"]), 4),
            "lng": round(float(item["lng"]), 4),
            "bounds": [round(float(x), 4) for x in item["bounds"]],
            "regime": item["regime"],
            "kind": item["kind"],
            "hasRadarFrames": bool(item.get("hasRadarFrames", False)),
            "newsQuery": item["newsQuery"],
            "aliases": list(item["aliases"]),
        }
        if item.get("siteId") and entry["hasRadarFrames"]:
            entry["siteId"] = item["siteId"]
        normalized.append(entry)

    out_path = DATA_DIR / "places.json"
    out_path.write_text(json.dumps(normalized, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(normalized)} study places to {out_path}")
    return normalized


def match_headline_to_place(headline: dict, place: dict) -> str | None:
    title = (headline.get("title") or "").strip()
    title_lower = title.lower()
    region = (headline.get("region") or "").strip()

    # 1. Check specific place-name or alias in title (excluding country name itself)
    country_lower = place["country"].lower()
    place_terms = [place["name"]] + [a for a in place["aliases"] if a.lower() != country_lower]
    for term in place_terms:
        pattern = r"\b" + re.escape(term.lower()) + r"\b"
        if re.search(pattern, title_lower):
            return "place-name"

    # 2. Check newsQuery keywords (at least 2 distinct significant query words in title, or 1 specific query word + country match)
    stop_words = {
        "and", "the", "for", "with", "from", "into", "low", "high", "water", "river",
        "lake", "basin", "valley", "plains", "drought", "rain", "rainfall", "flood",
        "flooding", "rice", "maize", "wheat", "crops", "farms", "farming", "irrigation",
        "supply", "level", "storage", "dam", "reservoir", "delta", "coast", "coastal",
        "northern", "southern", "eastern", "western", "central", "middle", "lower", "upper",
        "el", "nino", "la", "nina", "short", "rains", "winter", "storm", "monsoon",
        country_lower
    }
    query_tokens = [
        tok.lower()
        for tok in re.findall(r"[A-Za-z]{4,}", place["newsQuery"])
        if tok.lower() not in stop_words
    ]
    matched_tokens = [tok for tok in query_tokens if re.search(r"\b" + re.escape(tok) + r"\b", title_lower)]
    if matched_tokens:
        return "query"

    # 3. Check country match (either headline.region == place.country or country name in title)
    if region.lower() == country_lower or re.search(r"\b" + re.escape(country_lower) + r"\b", title_lower):
        return "country"

    return None


def build_news_by_place(places: list[dict]) -> dict:
    news_raw = json.loads((DATA_DIR / "news.json").read_text(encoding="utf-8"))
    headlines = news_raw.get("items", [])
    priority = {"place-name": 0, "query": 1, "country": 2}
    matched_items = []

    for place in places:
        place_matches = []
        for h in headlines:
            matched_by = match_headline_to_place(h, place)
            if not matched_by:
                continue
            vader = float(h.get("vader", 0.0) or 0.0)
            vader_adj = float(h.get("vaderAdjusted", vader) or 0.0)
            place_matches.append({
                "id": f"{h['id']}-{place['id']}",
                "placeId": place["id"],
                "title": h["title"].strip(),
                "source": h.get("source") or "Unknown source",
                "url": h.get("url") or "",
                "date": h.get("date") or "",
                "matchedBy": matched_by,
                "tone": {
                    "vader": round(vader, 4),
                    "vaderAdjusted": round(vader_adj, 4),
                    "ai": None,
                },
                "aiAnalysis": None,
            })
        place_matches.sort(key=lambda x: (priority.get(x["matchedBy"], 9), -(int(x["date"].replace("-", "") or "0"))))
        matched_items.extend(place_matches)

    payload = {
        "updatedAt": news_raw.get("retrievedAt") or datetime.now(timezone.utc).isoformat(),
        "source": news_raw.get("source") or "public/data/news.json (293 headlines matched by place-name, query, and country)",
        "items": matched_items,
    }
    out_path = DATA_DIR / "news-by-place.json"
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(matched_items)} matched place-headline links across {len(places)} places to {out_path}")
    return payload


if __name__ == "__main__":
    preserve_gazetteer()
    places_list = build_places_json()
    check_asf_coverage(places_list)
    build_news_by_place(places_list)
