"""Geometría mínima en Python puro (sin PostGIS ni shapely en el servidor): punto en polígono y distancia a un borde.

Coordenadas GeoJSON [lon, lat] en WGS84. Las distancias usan una proyección equirectangular local: error < 1 % a
escala de decenas de km, suficiente para los umbrales de transición (25 km).
"""

from __future__ import annotations

import math

KM_PER_DEG = 111.32


def _in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > lat) != (y2 > lat):
            x = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < x:
                inside = not inside
    return inside


def _polygons(geometry: dict) -> list[list]:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError(f"Geometría no admitida: {geometry['type']}")


def contains(geometry: dict, lat: float, lon: float) -> bool:
    """Punto dentro de un Polygon o MultiPolygon (respeta agujeros)."""
    for poly in _polygons(geometry):
        if _in_ring(lon, lat, poly[0]) and not any(_in_ring(lon, lat, hole) for hole in poly[1:]):
            return True
    return False


def _seg_dist_km(lat: float, lon: float, a: list, b: list) -> float:
    kx = KM_PER_DEG * math.cos(math.radians(lat))
    ax, ay = (a[0] - lon) * kx, (a[1] - lat) * KM_PER_DEG
    bx, by = (b[0] - lon) * kx, (b[1] - lat) * KM_PER_DEG
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / L))
    return math.hypot(ax + t * dx, ay + t * dy)


def distance_km(geometry: dict, lat: float, lon: float) -> float:
    """Distancia del punto al polígono (0 si está adentro), en km."""
    if contains(geometry, lat, lon):
        return 0.0
    best = math.inf
    for poly in _polygons(geometry):
        for ring in poly:
            for i in range(len(ring) - 1):
                best = min(best, _seg_dist_km(lat, lon, ring[i], ring[i + 1]))
    return best


def bbox(geometry: dict) -> tuple[float, float, float, float]:
    xs, ys = [], []
    for poly in _polygons(geometry):
        for x, y, *_ in poly[0]:
            xs.append(x)
            ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)
