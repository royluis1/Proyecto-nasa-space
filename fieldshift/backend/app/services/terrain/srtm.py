"""SRTM: lectura de baldosas .hgt y cálculo de elevación y pendiente (funciones puras, solo numpy).

Formato .hgt (NASA SRTM v3, SRTMGL1 / SRTMGL3): matriz cuadrada de enteros de 16 bits con signo, big-endian,
de 3601 x 3601 (1 segundo de arco, ~30 m) o 1201 x 1201 (3 segundos, ~90 m). La primera fila es el borde
norte y la primera columna el borde oeste. El nombre (por ejemplo S34W066) es la esquina SUROESTE.
Sin dato = -32768.
"""

from __future__ import annotations

import io
import math
import zipfile
from dataclasses import dataclass

import numpy as np

VOID = -32768
M_PER_DEG_LAT = 111_320.0
SMOOTH = 1  # media móvil de 3 x 3 antes de la pendiente: atenúa el ruido de SRTM (varios metros), que infla la pendiente en llanuras


def smooth(z: np.ndarray, k: int = SMOOTH) -> np.ndarray:
    """Media móvil (2k+1) x (2k+1); en los bordes de la ventana, NaN (se descartan)."""
    if k == 0:
        return z
    n = 2 * k + 1
    out = np.full(z.shape, np.nan)
    acc = np.zeros((z.shape[0] - 2 * k, z.shape[1] - 2 * k))
    for di in range(n):
        for dj in range(n):
            acc = acc + z[di : di + acc.shape[0], dj : dj + acc.shape[1]]
    out[k:-k, k:-k] = acc / (n * n)
    return out


def tile_name(lat: float, lon: float) -> str:
    """Baldosa que contiene el punto. -33.85, -65.2 -> S34W066."""
    la, lo = math.floor(lat), math.floor(lon)
    return f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"


def tile_origin(name: str) -> tuple[int, int]:
    """Esquina suroeste (lat, lon) de una baldosa."""
    lat = int(name[1:3]) * (1 if name[0] == "N" else -1)
    lon = int(name[4:7]) * (1 if name[3] == "E" else -1)
    return lat, lon


def read_hgt(data: bytes) -> np.ndarray:
    """Matriz de elevación en metros (float, NaN sin dato) a partir del contenido de un .hgt."""
    n = int(round(math.sqrt(len(data) // 2)))
    if n * n * 2 != len(data) or n not in (1201, 3601):
        raise ValueError(f"El archivo no es un .hgt de SRTM válido ({len(data)} bytes).")
    arr = np.frombuffer(data, dtype=">i2").reshape(n, n).astype(float)
    arr[arr == VOID] = np.nan
    return arr


def read_hgt_zip(blob: bytes) -> np.ndarray:
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".hgt")]
        if not names:
            raise ValueError("El zip de SRTM no contiene un archivo .hgt.")
        return read_hgt(z.read(names[0]))


@dataclass(frozen=True)
class TerrainStats:
    elevation_mean_m: float
    elevation_min_m: float
    elevation_max_m: float
    slope_mean_pct: float
    slope_p90_pct: float
    slope_max_pct: float
    pixels: int
    void_fraction: float
    resolution_m: float
    clipped: bool  # la ventana tocó el borde de la baldosa


def _point_in_polygon(lons: np.ndarray, lats: np.ndarray, ring: list[tuple[float, float]]) -> np.ndarray:
    """Ray casting vectorizado. ring = [(lon, lat), ...]."""
    inside = np.zeros(lons.shape, dtype=bool)
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        cond = (y1 > lats) != (y2 > lats)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_cross = (x2 - x1) * (lats - y1) / (y2 - y1) + x1
        inside ^= cond & (lons < x_cross)
    return inside


def terrain_stats(
    dem: np.ndarray,
    tile: str,
    lat: float,
    lon: float,
    radius_m: float,
    ring: list[tuple[float, float]] | None = None,
) -> TerrainStats:
    """Elevación y pendiente (método de Horn) en un círculo de `radius_m` alrededor del punto o dentro del polígono."""
    n = dem.shape[0]
    step = 1.0 / (n - 1)  # grados por píxel
    lat0, lon0 = tile_origin(tile)
    top = lat0 + 1
    dy = M_PER_DEG_LAT * step
    dx = M_PER_DEG_LAT * math.cos(math.radians(lat)) * step

    if ring:
        lats_r = [p[1] for p in ring]
        lons_r = [p[0] for p in ring]
        r0, r1 = (top - max(lats_r)) / step, (top - min(lats_r)) / step
        c0, c1 = (min(lons_r) - lon0) / step, (max(lons_r) - lon0) / step
    else:
        row, col = (top - lat) / step, (lon - lon0) / step
        r0, r1 = row - radius_m / dy, row + radius_m / dy
        c0, c1 = col - radius_m / dx, col + radius_m / dx
    pad = 1 + SMOOTH  # un píxel para Horn y los del suavizado
    i0, i1 = math.floor(r0) - pad, math.ceil(r1) + pad
    j0, j1 = math.floor(c0) - pad, math.ceil(c1) + pad
    clipped = i0 < 0 or j0 < 0 or i1 > n - 1 or j1 > n - 1
    i0, j0, i1, j1 = max(0, i0), max(0, j0), min(n - 1, i1), min(n - 1, j1)
    if i1 - i0 < 2 or j1 - j0 < 2:
        raise ValueError("La zona es demasiado chica o está fuera de la baldosa de SRTM.")
    z = smooth(dem[i0 : i1 + 1, j0 : j1 + 1])

    # Horn (3x3) sobre el interior
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * dy)
    slope = 100 * np.hypot(dzdx, dzdy)
    elev = z[1:-1, 1:-1]

    rows = np.arange(i0 + 1, i1)[:, None]
    cols = np.arange(j0 + 1, j1)[None, :]
    plat = top - rows * step
    plon = lon0 + cols * step
    if ring:
        mask = _point_in_polygon(np.broadcast_to(plon, slope.shape), np.broadcast_to(plat, slope.shape), ring)
    else:
        mask = ((plat - lat) * M_PER_DEG_LAT) ** 2 + ((plon - lon) * M_PER_DEG_LAT * math.cos(math.radians(lat))) ** 2 <= radius_m**2
    if not mask.any():  # polígono más chico que un píxel: el píxel más cercano
        mask = np.zeros(slope.shape, dtype=bool)
        mask[slope.shape[0] // 2, slope.shape[1] // 2] = True
    total = int(mask.sum())
    s = slope[mask]
    e = elev[mask]
    valid = ~np.isnan(s) & ~np.isnan(e)
    void = 1 - valid.sum() / total
    if valid.sum() == 0 or void > 0.5:
        raise ValueError("SRTM no tiene datos suficientes en la zona del lote (vacíos del radar).")
    s, e = s[valid], e[valid]
    return TerrainStats(
        elevation_mean_m=round(float(e.mean()), 1),
        elevation_min_m=round(float(e.min()), 1),
        elevation_max_m=round(float(e.max()), 1),
        slope_mean_pct=round(float(s.mean()), 2),
        slope_p90_pct=round(float(np.percentile(s, 90)), 2),
        slope_max_pct=round(float(s.max()), 2),
        pixels=int(valid.sum()),
        void_fraction=round(float(void), 3),
        resolution_m=round(dy, 1),
        clipped=clipped,
    )


def slope_class(pct: float) -> str:
    """Clases de pendiente (orientativas, en %)."""
    if pct < 1:
        return "plano"
    if pct < 3:
        return "suave"
    if pct < 8:
        return "moderada"
    return "fuerte"
