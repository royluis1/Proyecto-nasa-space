"""Genera MUESTRAS SIMULADAS (no son observaciones) con el formato de AppEEARS para los 3 campos de ejemplo:
- data/samples/hls_sectors_sample_san_luis.csv: NDVI de Landsat HLS L30 en los 9 sectores de cada lote (un sector más
  débil y uno con más suelo desnudo, para que la demo muestre diferencias).
- data/samples/ecostress_sample_san_luis.csv: temperatura de superficie (LST, K) e índice de estrés evaporativo (ESI).
Uso (desde fieldshift/): python scripts/generate_hls_eco_samples.py
"""

import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.services.satellite.sectors import sector_points  # noqa: E402

FIELDS = json.loads((ROOT / "backend" / "app" / "data" / "fields.json").read_text(encoding="utf-8"))
START, END = date(2022, 1, 1), date(2026, 11, 14)
HEADER = "# MUESTRA SIMULADA con formato de AppEEARS: no son observaciones. Ver scripts/generate_hls_eco_samples.py\n"


def ndvi_season(d: date) -> float:
    # cultivo de verano: pico en ene-feb, barbecho invernal
    return 0.42 + 0.27 * math.cos((d.timetuple().tm_yday - 35) / 365 * 2 * math.pi)


def main() -> None:
    rng = np.random.default_rng(7)
    rows = ["ID,Latitude,Longitude,Date,HLSL30_VI_020_NDVI"]
    eco = ["ID,Latitude,Longitude,Date,ECO_L2T_LSTE_002_LST,ECO_L2T_LSTE_002_cloud,ECO_L4T_ESI_002_ESI,ECO_L4T_ESI_002_cloud"]
    for f in FIELDS:
        lat, lon = f["location"]["lat"], f["location"]["lon"]
        pts = sector_points(lat, lon, f["area_ha"])
        weak, bare = pts[-1].id, pts[2].id  # sureste más débil, noreste con más suelo desnudo
        d = START
        while d <= END:
            for p in pts:
                v = ndvi_season(d) * (0.82 if p.id == weak else 1.0) + rng.normal(0, 0.03)
                if p.id == bare and d.month in (5, 6, 7, 8, 9):
                    v -= 0.12
                cloudy = rng.random() < 0.25
                rows.append(f"{f['id']}-{p.id},{p.lat},{p.lon},{d},{-19999 if cloudy else int(round(max(-0.1, v) * 10000))}")
            d += timedelta(days=8)
        d = START
        while d <= END:
            doy = d.timetuple().tm_yday
            lst_c = 30 + 13 * math.cos((doy - 20) / 365 * 2 * math.pi) + rng.normal(0, 5)
            esi = min(1, max(0, 0.5 + 0.18 * math.cos((doy - 200) / 365 * 2 * math.pi) + rng.normal(0, 0.08)))
            cloud = int(rng.random() < 0.2)
            eco.append(f"{f['id']}-lote,{lat},{lon},{d},{lst_c + 273.15:.2f},{cloud},{esi:.3f},{cloud}")
            d += timedelta(days=int(rng.integers(1, 6)))
    for name, lines in (("hls_sectors_sample_san_luis.csv", rows), ("ecostress_sample_san_luis.csv", eco)):
        path = ROOT / "data" / "samples" / name
        path.write_text(HEADER + "\n".join(lines) + "\n", encoding="utf-8")
        print(f"{path.relative_to(ROOT)}: {len(lines) - 1} filas, {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
