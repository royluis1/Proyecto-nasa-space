"""Convierte GeoTIFF de AppEEARS (pedidos de área) en un CSV simple `date,value,qa` para la API.

AppEEARS entrega un GeoTIFF por capa y por fecha, con la fecha en el nombre (`doyAAAADDD`), por ejemplo:
    MOD13Q1.061__250m_16_days_NDVI_doy2024017_aid0001.tif
    MOD13Q1.061__250m_16_days_pixel_reliability_doy2024017_aid0001.tif

El script toma el valor en el punto del lote (o el promedio de los píxeles dentro de un radio) y,
si se indica, la capa de calidad del mismo día. Los valores se escriben SIN escalar: la API aplica
el factor de escala y descarta relleno y mala calidad.

Requiere rasterio (no es dependencia del backend):  pip install rasterio

Uso:
    python scripts/geotiff_to_csv.py --values "descargas/*_NDVI_doy*.tif" --qa "descargas/*_pixel_reliability_doy*.tif" \\
        --lat -33.85 --lon -65.2 --radius-m 300 --out ndvi_lote.csv
Después:  POST /vegetation-index con el contenido del CSV en `csv_content`.
"""

import argparse
import csv
import glob
import math
import re
import sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

DOY = re.compile(r"doy(\d{4})(\d{3})")


def date_from_name(path: str) -> date:
    m = DOY.search(Path(path).name)
    if not m:
        raise ValueError(f"No encuentro la fecha (doyAAAADDD) en el nombre: {path}")
    return date(int(m.group(1)), 1, 1) + timedelta(days=int(m.group(2)) - 1)


def sample(path: str, lat: float, lon: float, radius_m: float, reducer: str = "mean") -> float | None:
    import numpy as np
    import rasterio
    from rasterio.warp import transform

    with rasterio.open(path) as src:
        xs, ys = transform("EPSG:4326", src.crs, [lon], [lat])
        row, col = src.index(xs[0], ys[0])
        if radius_m <= 0:
            if not (0 <= row < src.height and 0 <= col < src.width):
                return None
            value = src.read(1, window=((row, row + 1), (col, col + 1)))[0, 0]
            return None if src.nodata is not None and value == src.nodata else float(value)
        # tamaño de píxel en metros (aprox. si la grilla está en grados)
        px = abs(src.transform.a) * (111_320 * math.cos(math.radians(lat)) if src.crs.is_geographic else 1)
        py = abs(src.transform.e) * (111_320 if src.crs.is_geographic else 1)
        nx, ny = max(0, int(radius_m // px)), max(0, int(radius_m // py))
        r0, r1 = max(0, row - ny), min(src.height, row + ny + 1)
        c0, c1 = max(0, col - nx), min(src.width, col + nx + 1)
        if r0 >= r1 or c0 >= c1:
            return None
        block = src.read(1, window=((r0, r1), (c0, c1))).astype("float64")
        rr, cc = np.mgrid[r0:r1, c0:c1]
        inside = ((rr - row) * py) ** 2 + ((cc - col) * px) ** 2 <= radius_m**2
        valid = inside & (block != src.nodata if src.nodata is not None else True)
        if not valid.any():
            return None
        if reducer == "mode":
            return float(Counter(block[valid].tolist()).most_common(1)[0][0])
        return float(block[valid].mean())


def convert(values_glob: str, qa_glob: str | None, lat: float, lon: float, radius_m: float, out: str) -> int:
    files = sorted(glob.glob(values_glob))
    if not files:
        raise SystemExit(f"No hay archivos que coincidan con {values_glob}")
    qa_by_date = {date_from_name(p): p for p in sorted(glob.glob(qa_glob))} if qa_glob else {}
    rows = []
    for path in files:
        d = date_from_name(path)
        value = sample(path, lat, lon, radius_m)
        qa = sample(qa_by_date[d], lat, lon, radius_m, reducer="mode") if d in qa_by_date else None
        rows.append((d.isoformat(), "" if value is None else round(value, 6), "" if qa is None else int(qa)))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "value"] + (["qa"] if qa_glob else []))
        for d, v, q in sorted(rows):
            w.writerow([d, v] + ([q] if qa_glob else []))
    return len(rows)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--values", required=True, help="Patrón de los GeoTIFF de la variable (NDVI o humedad).")
    p.add_argument("--qa", help="Patrón de los GeoTIFF de calidad (opcional).")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument(
        "--radius-m", type=float, default=0, help="Promediar los píxeles dentro de este radio (0 = un píxel)."
    )
    p.add_argument("--out", required=True)
    a = p.parse_args(argv)
    n = convert(a.values, a.qa, a.lat, a.lon, a.radius_m, a.out)
    print(f"{n} fechas escritas en {a.out}")


if __name__ == "__main__":
    sys.exit(main())
