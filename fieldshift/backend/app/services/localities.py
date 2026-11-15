"""Ciudades y pueblos de Argentina: buscar por nombre y encontrar el más cercano a un punto.

Sirve para que el usuario elija su localidad por nombre (más simple que marcarla en el mapa) y para
decir "tu huerta está en X" a partir de las coordenadas del campo.

Datos: IGN, capa Localidad BAHRA (ver scripts/build_localities.py). Es un punto por asentamiento,
no su límite: la distancia es al centro de la localidad.
"""

from __future__ import annotations

import json
import math
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

KM_PER_DEG = 111.32
#: Más lejos que esto, no se considera que el campo "esté en" esa localidad.
MAX_NEAR_KM = 60.0


def normalize(text: str) -> str:
    """Minúsculas y sin tildes, para buscar 'Justo Daract' escribiendo 'justo daract' o 'DARACT'."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


@dataclass(frozen=True)
class Locality:
    nombre: str
    provincia: str
    departamento: str
    tipo: str
    lat: float
    lon: float
    orden: int
    _search: str

    @property
    def label(self) -> str:
        return f"{self.nombre}, {self.provincia}"


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia aproximada (equirectangular local). Error < 1 % en decenas de km, suficiente acá."""
    dlat = (lat2 - lat1) * KM_PER_DEG
    dlon = (lon2 - lon1) * KM_PER_DEG * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dlat, dlon)


class LocalityIndex:
    """Lista de localidades en memoria. Son ~3.500: alcanza con recorrerlas."""

    def __init__(self, localities: list[Locality], source: dict | None = None) -> None:
        self.localities = localities
        self.source = source or {}

    @classmethod
    def from_file(cls, path: Path) -> LocalityIndex:
        doc = json.loads(path.read_text(encoding="utf-8"))
        rows = [
            Locality(
                nombre=r["nombre"],
                provincia=r["provincia"],
                departamento=r.get("departamento", ""),
                tipo=r.get("tipo", ""),
                lat=float(r["lat"]),
                lon=float(r["lon"]),
                orden=int(r.get("orden", 5)),
                _search=normalize(f"{r['nombre']} {r['provincia']}"),
            )
            for r in doc.get("localities", [])
        ]
        return cls(rows, doc.get("source"))

    def search(self, query: str, limit: int = 10, provincia: str | None = None, prefer: str | None = None) -> list[Locality]:
        """Busca por nombre. Primero las que empiezan igual, después las que lo contienen.
        En los empates van primero las de la provincia preferida (la región de la app), sin esconder las demás."""
        q = normalize(query.strip())
        if not q:
            return []
        prov = normalize(provincia) if provincia else None
        pref = normalize(prefer) if prefer else None
        hits: list[tuple[int, int, int, str, Locality]] = []
        for loc in self.localities:
            if prov and normalize(loc.provincia) != prov:
                continue
            name = normalize(loc.nombre)
            if name.startswith(q):
                rank = 0
            elif q in name:
                rank = 1
            elif q in loc._search:
                rank = 2
            else:
                continue
            preferred = 0 if pref and normalize(loc.provincia) == pref else 1
            hits.append((rank, preferred, loc.orden, name, loc))
        hits.sort(key=lambda h: (h[0], h[1], h[2], h[3]))
        return [h[4] for h in hits[:limit]]

    def nearest(self, lat: float, lon: float, max_km: float = MAX_NEAR_KM) -> tuple[Locality, float] | None:
        """Localidad más cercana al punto, o None si no hay ninguna dentro de max_km."""
        best: tuple[Locality, float] | None = None
        for loc in self.localities:
            # Descarte rápido por latitud antes de calcular la distancia completa.
            if abs(loc.lat - lat) * KM_PER_DEG > max_km:
                continue
            d = _distance_km(lat, lon, loc.lat, loc.lon)
            if d <= max_km and (best is None or d < best[1]):
                best = (loc, d)
        return best

    def provinces(self) -> list[str]:
        return sorted({loc.provincia for loc in self.localities})


@lru_cache(maxsize=4)
def load_index(path: Path) -> LocalityIndex:
    if not path.exists():
        return LocalityIndex([], None)
    return LocalityIndex.from_file(path)
