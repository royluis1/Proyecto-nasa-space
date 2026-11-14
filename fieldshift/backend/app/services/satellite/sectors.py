"""Vigor y suelo desnudo por sector del lote con Landsat (HLS L30 NDVI, 30 m) vía AppEEARS.

El lote se divide en una grilla de 3 x 3 sectores; el centro de cada sector es un punto (un píxel de 30 m) de una sola
tarea de AppEEARS. Con el polígono del lote se usan solo los sectores que caen adentro.
Umbrales (supuestos a validar, docs/assumptions.md): suelo desnudo NDVI < 0,3; sector "más débil" o "más vigoroso" si su
NDVI medio difiere un 10 % o más de la mediana del lote.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from datetime import date, timedelta

from app.schemas.regions import FieldSectors, Sector
from app.services.regions import geo
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteProvider

BARE_NDVI = 0.3
VIGOR_PCT = 10.0
YEARS = 2  # período analizado: los últimos 2 años
NAMES = [["Noroeste", "Norte", "Noreste"], ["Oeste", "Centro", "Este"], ["Suroeste", "Sur", "Sureste"]]
KM_PER_DEG = 111.32


@dataclass(frozen=True)
class SectorPoint:
    id: str
    name: str
    lat: float
    lon: float


def sector_points(lat: float, lon: float, area_ha: float, boundary: dict | None = None) -> list[SectorPoint]:
    """Centros de una grilla de 3 x 3 sobre el lote (o sobre el polígono, dejando los que caen adentro)."""
    if boundary:
        x0, y0, x1, y1 = geo.bbox(boundary)
    else:
        side_km = math.sqrt(area_ha / 100)  # lado de un cuadrado con la superficie del lote
        dy = side_km / 2 / KM_PER_DEG
        dx = side_km / 2 / (KM_PER_DEG * math.cos(math.radians(lat)))
        x0, y0, x1, y1 = lon - dx, lat - dy, lon + dx, lat + dy
    out = []
    for i in range(3):  # filas de norte a sur
        for j in range(3):
            plat = y1 - (i + 0.5) * (y1 - y0) / 3
            plon = x0 + (j + 0.5) * (x1 - x0) / 3
            if boundary and not geo.contains(boundary, plat, plon):
                continue
            out.append(SectorPoint(f"s{i * 3 + j + 1}", NAMES[i][j], round(plat, 5), round(plon, 5)))
    if not out:  # polígono muy angosto: al menos el punto del lote
        out.append(SectorPoint("s5", "Centro", round(lat, 5), round(lon, 5)))
    return out


def summarize_sectors(points: list[SectorPoint], series: dict[str, list[float]]) -> tuple[list[Sector], str | None, str | None, str]:
    rows = []
    for p in points:
        vals = [v for v in series.get(p.id, []) if v is not None and not math.isnan(v)]
        if not vals:
            rows.append(Sector(id=p.id, name=p.name, latitude=p.lat, longitude=p.lon, observations=0, mean_ndvi=None,
                               peak_ndvi=None, bare_pct=None, vs_field_pct=None, vigor=None))
            continue
        vals.sort()
        rows.append(Sector(
            id=p.id, name=p.name, latitude=p.lat, longitude=p.lon, observations=len(vals),
            mean_ndvi=round(statistics.fmean(vals), 3), peak_ndvi=round(vals[min(len(vals) - 1, int(0.9 * len(vals)))], 3),
            bare_pct=round(100 * sum(v < BARE_NDVI for v in vals) / len(vals), 1), vs_field_pct=None, vigor=None,
        ))
    valid = [r for r in rows if r.mean_ndvi is not None]
    if not valid:
        return rows, None, None, "No hay observaciones válidas de Landsat en los sectores del lote."
    med = statistics.median(r.mean_ndvi for r in valid)
    for r in valid:
        diff = round((r.mean_ndvi - med) / med * 100, 1) if med else 0.0
        r.vs_field_pct = diff
        r.vigor = "más débil" if diff <= -VIGOR_PCT else "más vigoroso" if diff >= VIGOR_PCT else "parecido"
    weakest = min(valid, key=lambda r: r.mean_ndvi)
    barest = max(valid, key=lambda r: r.bare_pct)
    if len(valid) == 1:
        reading = "Hay un solo punto con datos: no se pueden comparar sectores."
    elif weakest.vigor == "más débil":
        reading = (f"El sector {weakest.name} tuvo un {abs(weakest.vs_field_pct):.0f} % menos de verdor que la mediana del lote"
                   f"{f' y estuvo con poca vegetación el {barest.bare_pct:.0f} % del tiempo' if barest.id == weakest.id else ''}. "
                   "Conviene recorrerlo: puede haber manchones de suelo desnudo, erosión, compactación, sales o un bajo.")
    else:
        reading = "Los sectores del lote tuvieron un verdor parecido (diferencias de menos del 10 % contra la mediana)."
    return rows, weakest.id, barest.id, reading


def field_sectors(provider: SatelliteProvider, field, today: date | None = None) -> FieldSectors:
    product = PRODUCTS["HLSL30_VI"]
    today = today or date.today()
    end = today - timedelta(days=10)
    start = date(end.year - YEARS, end.month, 1)
    boundary = field.boundary.model_dump() if field.boundary else None
    pts = sector_points(field.location.lat, field.location.lon, field.area_ha, boundary)
    data = provider.get_points(product, [(p.id, p.lat, p.lon) for p in pts], start, end)
    series = {pid: list(s.df["value"]) for pid, s in data.series.items()}
    sectors, weakest, barest, reading = summarize_sectors(pts, series)
    return FieldSectors(
        field_id=field.id, product=product.appeears_id, resolution=product.spatial_resolution, period=f"{start} a {end}",
        bare_threshold=BARE_NDVI, sectors=sectors, weakest=weakest, barest=barest, reading=reading,
        method=("Grilla de 3 x 3 sectores sobre el lote; en cada centro, la serie de NDVI de Landsat (HLS L30, 30 m) de los "
                f"últimos {YEARS} años. Se compara el NDVI medio de cada sector con la mediana del lote."),
        origin=data.status, origin_label=data.status.origin_label, retrieved_at=data.retrieved_at, task_id=data.task_id,
        limitations=product.limitations, warnings=data.warnings,
    )
