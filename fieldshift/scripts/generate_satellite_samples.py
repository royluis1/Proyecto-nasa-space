"""Genera muestras SIMULADAS de SMAP y MODIS NDVI con el formato de AppEEARS.

NO son observaciones. Sirven para que la app funcione sin red y para probar el parser con el
mismo formato que entrega AppEEARS (extracción por punto, CSV).

- SMAP L4 (zona de raíces y superficie): balance de agua diario alimentado por la lluvia de
  data/samples/power_sample_san_luis.csv (también simulada) y una ET0 de Hargreaves.
- MODIS NDVI (MOD13Q1, compuestos de 16 días): fenología de la rotación actual declarada de cada
  campo, con picos que dependen de la lluvia de la campaña, malezas en los barbechos lluviosos,
  nubes, datos marginales y faltantes. Campo Centro tiene una caída lenta de biomasa (degradación).

Uso:  python scripts/generate_satellite_samples.py
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "data" / "samples"
POWER = SAMPLES / "power_sample_san_luis.csv"
ROTATIONS = ROOT / "backend" / "app" / "data" / "rotations.json"
SEED = 2027
SMAP_START = "2015-03-31"
END = "2025-12-31"

# Suelo del píxel de 9 km: punto de marchitez y capacidad de campo (m³/m³), agua útil de la zona de raíces (mm).
SOILS = {"campo-este": (0.07, 0.23, 130), "campo-centro": (0.05, 0.17, 80), "campo-conlara": (0.09, 0.27, 155)}
PEAK = {"maiz": 0.82, "soja": 0.80, "sorgo": 0.78, "girasol": 0.70, "trigo": 0.72, "avena": 0.66}
RESIDUE = {"maiz": 0.06, "sorgo": 0.06, "trigo": 0.04, "avena": 0.03}  # rastrojo que sostiene algo de NDVI
DEGRADATION = {"campo-centro": -0.012}  # cambio relativo del pico por año


def hargreaves(df: pd.DataFrame, lat: float) -> pd.Series:
    doy = df.index.day_of_year.to_numpy()
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    delta = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(-np.tan(phi) * np.tan(delta))
    ra = 24 * 60 / np.pi * 0.082 * dr * (ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws))
    tmean, tmax, tmin = df["T2M"], df["T2M_MAX"], df["T2M_MIN"]
    return 0.0023 * 0.408 * ra * (tmean + 17.8) * np.sqrt((tmax - tmin).clip(lower=0))


def smap(site: str, lat: float, lon: float, clim: pd.DataFrame, rng) -> pd.DataFrame:
    wp, fc, taw = SOILS[site]
    df = clim.loc[SMAP_START:END]
    et0 = hargreaves(df, lat)
    rz, sf = 0.5, 0.5  # fracción de agua útil: zona de raíces y capa superficial (25 mm)
    rows, noise_rz, noise_sf = [], 0.0, 0.0
    for d, p, e in zip(df.index, df["PRECTOTCORR"].to_numpy(), et0.to_numpy()):
        infil = p * (0.85 if p < 30 else 0.65)
        sf = min(1.0, sf + infil / 25)
        sf = max(0.0, sf - e * 0.9 * min(1, sf / 0.6) / 25)
        rz = min(1.0, rz + infil * 0.8 / taw)
        rz = max(0.0, rz - e * 0.55 * min(1.0, rz / 0.55) / taw)
        noise_rz = 0.95 * noise_rz + rng.normal(0, 0.004)
        noise_sf = 0.7 * noise_sf + rng.normal(0, 0.01)
        rows.append(
            (
                site,
                lat,
                lon,
                d.date().isoformat(),
                round(float(np.clip(wp + (fc - wp) * rz + noise_rz, 0.02, 0.5)), 4),
                round(float(np.clip(wp + (fc - wp) * sf + noise_sf, 0.02, 0.5)), 4),
            )
        )
    out = pd.DataFrame(
        rows,
        columns=[
            "ID",
            "Latitude",
            "Longitude",
            "Date",
            "SPL4SMGP_008_Geophysical_Data_sm_rootzone",
            "SPL4SMGP_008_Geophysical_Data_sm_surface",
        ],
    )
    gaps = rng.random(len(out)) < 0.004  # sin dato del modelo
    out.loc[gaps, ["SPL4SMGP_008_Geophysical_Data_sm_rootzone", "SPL4SMGP_008_Geophysical_Data_sm_surface"]] = -9999.0
    return out


def crop_calendar(rotation: dict, years: range) -> list[tuple[str, pd.Timestamp, pd.Timestamp]]:
    out = []
    for y in years:
        for st in rotation["steps"]:
            if (y - 2015) % rotation["duration_years"] != st["year"] - 1:
                continue
            start = pd.Timestamp(y, st["start_month"], 10)
            end_year = y + (1 if st["end_month"] < st["start_month"] else 0)
            end = pd.Timestamp(end_year, st["end_month"], 20)
            out.append((st["crop_id"], start, end))
    return out


def ndvi(site: str, lat: float, lon: float, clim: pd.DataFrame, rotation: dict, rng) -> pd.DataFrame:
    rain = clim["PRECTOTCORR"]
    campaign_rain = rain.groupby([d.year if d.month >= 7 else d.year - 1 for d in rain.index]).sum()
    mean_rain = campaign_rain.mean()
    dates = [pd.Timestamp(y, 1, 1) + pd.Timedelta(days=16 * k) for y in range(2015, 2026) for k in range(23)]
    cal = crop_calendar(rotation, range(2014, 2026))
    rows = []
    for d in dates:
        camp = d.year if d.month >= 7 else d.year - 1
        water = float(np.clip(campaign_rain.get(camp, mean_rain) / mean_rain, 0.55, 1.15))
        trend = 1 + DEGRADATION.get(site, 0.0) * (d.year - 2015)
        value = 0.17 + 0.02 * math.sin(2 * math.pi * (d.day_of_year - 30) / 365)  # suelo y rastrojo
        last_end = max((e for c, s, e in cal if e <= d), default=None)
        if last_end is not None:
            crop = next(c for c, s, e in cal if e == last_end)
            value += RESIDUE.get(crop, 0.0) * math.exp(-(d - last_end).days / 120)
        for crop, s, e in cal:
            if s <= d <= e:
                phase = (d - s).days / max(1, (e - s).days)
                value = max(
                    value, 0.2 + (PEAK[crop] * water * trend - 0.2) * math.sin(math.pi * min(1, phase * 1.1)) ** 1.5
                )
        recent_rain = rain.loc[d - pd.Timedelta(days=30) : d].sum()
        if value < 0.3 and recent_rain > 60:
            value += 0.06  # malezas en barbecho después de lluvias
        value = float(np.clip(value + rng.normal(0, 0.025), -0.1, 0.95))
        summer = d.month in (12, 1, 2, 3)
        r = rng.random()
        reliability = 3 if r < (0.12 if summer else 0.05) else 1 if r < 0.25 else 0
        raw = int(round(value * 10000))
        if reliability == 3:
            raw = int(round(min(value, 0.2) * 10000 * rng.uniform(0.3, 0.9)))  # la nube baja el NDVI
        if rng.random() < 0.01:
            raw, reliability = -3000, -1
        rows.append((site, lat, lon, d.date().isoformat(), raw, reliability))
    return pd.DataFrame(
        rows,
        columns=[
            "ID",
            "Latitude",
            "Longitude",
            "Date",
            "MOD13Q1_061__250m_16_days_NDVI",
            "MOD13Q1_061__250m_16_days_pixel_reliability",
        ],
    )


def main() -> None:
    rng = np.random.default_rng(SEED)
    power = pd.read_csv(POWER, parse_dates=["date"])
    rotations = {r["field_id"]: r for r in json.loads(ROTATIONS.read_text(encoding="utf-8"))}
    smap_parts, ndvi_parts = [], []
    for site, g in power.groupby("site_id", sort=False):
        lat, lon = float(g["lat"].iloc[0]), float(g["lon"].iloc[0])
        clim = g.set_index("date").sort_index()
        smap_parts.append(smap(site, lat, lon, clim, rng))
        ndvi_parts.append(ndvi(site, lat, lon, clim, rotations[site], rng))
    header = (
        "# MUESTRA SIMULADA con formato de AppEEARS (no son observaciones). Ver scripts/generate_satellite_samples.py\n"
    )
    for name, parts in (("smap_sample_san_luis.csv", smap_parts), ("ndvi_sample_san_luis.csv", ndvi_parts)):
        path = SAMPLES / name
        path.write_text(header + pd.concat(parts).to_csv(index=False), encoding="utf-8")
        print(f"{path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
