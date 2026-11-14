"""Zonas climáticas de San Luis derivadas de NASA POWER (índice de aridez de la UNEP).

Método (ver docs/zonas_y_perfil.md y docs/assumptions.md):
1. Grilla de celdas de NASA POWER (meteorología MERRA-2: 0,5° de latitud x 0,625° de longitud, ~55 km), recortada a la
   provincia (límites de data/samples/provincias_argentina.geojson).
2. Para el centro de cada celda: datos diarios 2015-2025 de POWER (comunidad AG) -> por año: lluvia, ET0 FAO-56
   Penman-Monteith, déficit (ET0 - lluvia), días con Tmax > 35 °C y días con Tmin <= 2 °C.
3. Índice de aridez = lluvia / ET0 (promedio del período) y clase UNEP: árida < 0,20 <= semiárida < 0,50 <=
   subhúmeda seca < 0,65 <= subhúmeda húmeda o más. También la clase de cada año, para medir cuánto cambia.
4. Zonas = unión de las celdas de la misma clase.

NO son zonas agroecológicas oficiales (INTA): son zonas climáticas derivadas de NASA POWER.

Uso (desde fieldshift/, necesita shapely e internet para --live):
    python scripts/build_zones.py --live      # consulta POWER: ~25 pedidos, uno cada 2 s, con caché para retomar
    python scripts/build_zones.py --sample    # sin red: MUESTRA SIMULADA rotulada (para demo y tests)
"""

import argparse
import json
import math
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.regions.zoning import COLD_C, HOT_C, LABELS, summarize  # noqa: E402

PROVINCES = ROOT / "data" / "samples" / "provincias_argentina.geojson"
OUT_LIVE = ROOT / "data" / "samples" / "zonas_san_luis.geojson"
OUT_SAMPLE = ROOT / "data" / "samples" / "zonas_san_luis_muestra.geojson"
CACHE = ROOT / "data" / "cache" / "zones"
DLAT, DLON = 0.5, 0.625  # grilla de MERRA-2 en POWER
PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PS"]


def cells_for(province) -> list[dict]:
    minx, miny, maxx, maxy = province.bounds
    lats = np.arange(math.floor(miny / DLAT) * DLAT, maxy + DLAT, DLAT)
    lons = np.arange(math.floor(minx / DLON) * DLON, maxx + DLON, DLON)
    out = []
    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            cell = box(lo - DLON / 2, la - DLAT / 2, lo + DLON / 2, la + DLAT / 2)
            clip = cell.intersection(province)
            if clip.is_empty or clip.area < 1e-4:
                continue
            out.append({"id": f"r{i:02d}c{j:02d}", "lat": round(float(la), 4), "lon": round(float(lo), 4), "geom": clip})
    return out


def yearly_live(lat: float, lon: float, start: int, end: int, sleep_s: float) -> list[dict]:
    from app.services.et0 import compute_et0
    from app.services.power.client import PowerClient
    from app.services.power.parser import parse_power_json
    from app.services.power.units import normalize_units

    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"power_{lat:.3f}_{lon:.3f}_{start}_{end}.json"
    if path.exists():
        raw = json.loads(path.read_text())
    else:
        client = PowerClient("https://power.larc.nasa.gov/api/temporal/daily/point", 60, 3, 2)
        raw = client.fetch(lat, lon, date(start, 1, 1), date(end, 12, 31), PARAMS, "AG")
        path.write_text(json.dumps(raw))
        time.sleep(sleep_s)  # POWER pide no saturar el servicio con pedidos seguidos
    parsed = parse_power_json(raw, PARAMS)
    df, _, _ = normalize_units(parsed.df, parsed.units)
    df["ET0"], _ = compute_et0(df, lat)
    rows = []
    for y, g in df.groupby(df.index.year):
        if len(g) < 360 or g["PRECTOTCORR"].isna().mean() > 0.05 or g["ET0"].isna().mean() > 0.05:
            continue  # año incompleto
        rows.append({
            "year": int(y), "precip": float(g["PRECTOTCORR"].sum()), "et0": float(g["ET0"].sum()),
            "hot": int((g["T2M_MAX"] > HOT_C).sum()), "cold": int((g["T2M_MIN"] <= COLD_C).sum()),
        })
    return rows


def yearly_sample(lat: float, lon: float, start: int, end: int) -> list[dict]:
    """MUESTRA SIMULADA: gradiente plausible (más lluvia al este y al norte) con variación entre años. NO son datos."""
    rng = np.random.default_rng(int(abs(lat * 1000) + abs(lon * 100)))
    p_mean = 760 - 175 * (-65.0 - lon) + 25 * (lat + 34)
    e_mean = 1300 + 45 * (-65.0 - lon) + 25 * (lat + 34)
    rows = []
    for y in range(start, end + 1):
        rows.append({
            "year": y, "precip": float(max(150, p_mean * (1 + rng.normal(0, 0.22)))), "et0": float(e_mean * (1 + rng.normal(0, 0.04))),
            "hot": int(max(0, 22 + 9 * (-65.0 - lon) + 4 * (lat + 34) + rng.normal(0, 6))),
            "cold": int(max(0, 30 + 8 * (-34 - lat) + 6 * (-65.0 - lon) + rng.normal(0, 6))),
        })
    return rows


def km2(geom, lat: float) -> float:
    return geom.area * 111.32**2 * math.cos(math.radians(lat))


def main() -> None:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--live", action="store_true")
    mode.add_argument("--sample", action="store_true")
    ap.add_argument("--province", default="san-luis")
    ap.add_argument("--start", type=int, default=2015)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--sleep", type=float, default=2.0)
    a = ap.parse_args()

    provinces = json.loads(PROVINCES.read_text(encoding="utf-8"))
    feat = next(f for f in provinces["features"] if f["properties"]["id"] == a.province)
    province = shape(feat["geometry"])
    cells = cells_for(province)
    print(f"{len(cells)} celdas de POWER en {feat['properties']['name']}")

    cell_feats, by_class = [], {}
    for n, c in enumerate(cells, 1):
        rows = yearly_live(c["lat"], c["lon"], a.start, a.end, a.sleep) if a.live else yearly_sample(c["lat"], c["lon"], a.start, a.end)
        if not rows:
            print(f"  {c['id']}: sin años completos, se omite")
            continue
        s = summarize(rows)
        zone_id = f"{a.province}-{s['zone_class']}"
        props = {"kind": "cell", "cell_id": f"{a.province}-{c['id']}", "zone_id": zone_id, "zone_label": LABELS[s["zone_class"]],
                 "center_lat": c["lat"], "center_lon": c["lon"], "area_km2": round(km2(c["geom"], c["lat"])), **s}
        cell_feats.append({"type": "Feature", "properties": props, "geometry": mapping(c["geom"])})
        by_class.setdefault(s["zone_class"], []).append((c, props))
        if a.live:
            print(f"  {n}/{len(cells)} {c['id']}: {s['zone_class']} (índice {s['aridity_index']})")

    zone_feats = []
    for cls, items in sorted(by_class.items()):
        geom = unary_union([c["geom"] for c, _ in items])
        weights = np.array([p["area_km2"] for _, p in items], dtype=float)

        def wmean(key: str, nd: int = 0):
            v = np.array([p[key] for _, p in items], dtype=float)
            return round(float((v * weights).sum() / weights.sum()), nd) if weights.sum() else None

        zone_feats.append({
            "type": "Feature",
            "properties": {
                "kind": "zone", "zone_id": f"{a.province}-{cls}", "zone_class": cls, "zone_label": LABELS[cls],
                "province_id": a.province, "cells": len(items), "area_km2": round(float(weights.sum())),
                "precip_mm": wmean("precip_mm"), "et0_mm": wmean("et0_mm"), "deficit_mm": wmean("deficit_mm"),
                "aridity_index": wmean("aridity_index", 3), "aridity_min": min(p["aridity_index"] for _, p in items),
                "aridity_max": max(p["aridity_index"] for _, p in items), "hot_days": wmean("hot_days", 1),
                "frost_days": wmean("frost_days", 1), "precip_cv_pct": wmean("precip_cv_pct", 1),
                "years_other_class_pct": wmean("years_other_class_pct", 1),
            },
            "geometry": mapping(geom),
        })

    origin = "live" if a.live else "sample"
    fc = {
        "type": "FeatureCollection",
        "fieldshift": {
            "layer": "zonas_climaticas",
            "province_id": a.province,
            "title": "Zonas climáticas derivadas de NASA POWER (índice de aridez UNEP)",
            "origin": origin,
            "source": "NASA POWER, datos diarios, comunidad AG (MERRA-2 / CERES)" if a.live else "MUESTRA SIMULADA: no son datos de NASA POWER",
            "period": f"{a.start}-{a.end}",
            "cell_size_deg": [DLAT, DLON],
            "method": "Índice de aridez = lluvia / ET0 (FAO-56 Penman-Monteith) por celda de POWER; clases UNEP.",
            "thresholds": {"arido": "< 0,20", "semiarido": "0,20 a 0,50", "subhumedo_seco": "0,50 a 0,65", "humedo": ">= 0,65"},
            "hot_day_c": HOT_C, "cold_day_c": COLD_C,
            "boundaries": provinces["fieldshift"]["source"],
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "warning": None if a.live else "DATO DE MUESTRA: zonas simuladas para demostración. Correr scripts/build_zones.py --live con internet.",
        },
        "features": zone_feats + cell_feats,
    }
    out = OUT_LIVE if a.live else OUT_SAMPLE
    rounded = json.loads(json.dumps(fc, ensure_ascii=False), parse_float=lambda x: round(float(x), 4))
    out.write_text(json.dumps(rounded, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(zone_feats)} zonas, {len(cell_feats)} celdas, {out.stat().st_size // 1024} KB")
    for z in zone_feats:
        p = z["properties"]
        print(f"  {p['zone_label']}: {p['cells']} celdas, lluvia {p['precip_mm']} mm, índice {p['aridity_index']}")


if __name__ == "__main__":
    main()
