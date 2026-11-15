"""Suelo de un punto, o de sus alrededores si en el punto no hay suelo agrícola.

En el centro de un pueblo SoilGrids no tiene suelo (es zona urbana). Cuando el productor elige su ciudad, el punto cae
justo ahí. En ese caso se prueba a 3 km (norte, sur, este, oeste) y se usa el primero con datos, aclarándolo siempre:
es el suelo de los alrededores, no el del punto exacto. Lo usan el formulario (antes de guardar) y el perfil automático
(al guardar), así lo que se ve es lo que se guarda.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.schemas.regions import SoilEstimate
from app.services.soil.soilgrids import SoilProvider

NEAR_KM = 3.0
#: Se corta en el primero con datos (casi siempre el primero): SoilGrids tarda, no conviene pedir de más.
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))
KM_PER_DEG = 111.32


@dataclass(frozen=True)
class NearbySoil:
    estimate: SoilEstimate | None
    warnings: list[str]
    lat: float
    lon: float
    distance_km: float
    note: str | None


def _offset(lat: float, lon: float, d_north: int, d_east: int, km: float) -> tuple[float, float]:
    dlat = d_north * km / KM_PER_DEG
    dlon = d_east * km / (KM_PER_DEG * math.cos(math.radians(lat)))
    return round(lat + dlat, 4), round(lon + dlon, 4)


def surroundings_note(km: float = NEAR_KM) -> str:
    return (
        f"En el punto elegido no hay suelo agrícola (zona urbana, agua o roca): es el suelo de los alrededores, "
        f"a unos {km:.0f} km. Mové el punto a tu campo para afinarlo."
    )


def estimate_nearby(soil: SoilProvider, lat: float, lon: float, surroundings: bool = True) -> NearbySoil:
    estimate, warnings = soil.estimate(lat, lon)
    if estimate is not None or not surroundings:
        return NearbySoil(estimate, warnings, lat, lon, 0.0, None)
    for d_north, d_east in DIRECTIONS:
        near_lat, near_lon = _offset(lat, lon, d_north, d_east, NEAR_KM)
        near, near_warnings = soil.estimate(near_lat, near_lon)
        if near is not None:
            note = surroundings_note()
            return NearbySoil(near, [note, *near_warnings], near_lat, near_lon, NEAR_KM, note)
    return NearbySoil(None, warnings, lat, lon, 0.0, None)
