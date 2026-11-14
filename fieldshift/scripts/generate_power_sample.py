"""Genera data/samples/power_sample_san_luis.csv: datos climáticos diarios SIMULADOS.

NO son observaciones. Imitan la forma de NASA POWER (mismas columnas y unidades)
con valores plausibles para tres sitios de San Luis, para que la app funcione sin red.
Las normales mensuales usadas son aproximadas (⚠️ no verificadas) y se eligieron
solo para que la muestra sea creíble en el demo.

Uso:  python scripts/generate_power_sample.py
"""

import math
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "data" / "samples" / "power_sample_san_luis.csv"
START, END = "2015-01-01", "2025-12-31"
SEED = 2026

# Normales aproximadas (Este de San Luis) — ⚠️ ilustrativas
PRECIP = [110, 95, 95, 45, 20, 8, 8, 10, 30, 65, 90, 110]  # mm/mes
TMAX = [31, 29.5, 27, 23, 19, 15.5, 15, 18, 21, 24.5, 28, 30.5]
TMIN = [16.5, 15.5, 13.5, 9, 5, 1.5, 0.5, 2, 5, 9.5, 12.5, 15.5]
RH = [62, 66, 70, 70, 68, 65, 58, 52, 50, 52, 55, 58]
WIND = [2.8, 2.6, 2.4, 2.3, 2.4, 2.6, 2.9, 3.3, 3.6, 3.5, 3.3, 3.0]

SITES = [
    # id, lat, lon, factor de lluvia, delta Tmax, delta Tmin, presión base kPa
    ("campo-este", -33.85, -65.20, 1.00, 0.0, 0.0, 95.4),
    ("campo-centro", -33.55, -66.20, 0.80, 0.6, -0.6, 92.9),
    ("campo-conlara", -32.45, -65.25, 0.88, -0.4, -0.5, 93.8),
]


def _daily_climatology(monthly: list[float], dates: pd.DatetimeIndex) -> np.ndarray:
    """Interpola valores mensuales (centrados el día 15) a valores diarios suaves."""
    doy = dates.dayofyear.to_numpy()
    centers = np.array([15 + 30.4 * i for i in range(12)])
    x = np.concatenate([centers - 365, centers, centers + 365])
    y = np.tile(monthly, 3)
    return np.interp(doy, x, y)


def _ra(lat: float, doy: np.ndarray) -> np.ndarray:
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    return (24 * 60 / np.pi) * 0.082 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))


def simulate(site, rng: np.random.Generator) -> pd.DataFrame:
    sid, lat, lon, pfac, dtx, dtn, ps0 = site
    dates = pd.date_range(START, END, freq="D")
    n = len(dates)
    month = dates.month.to_numpy() - 1
    days_in_month = dates.days_in_month.to_numpy()

    # Lluvia: factor anual (años secos/húmedos) * ocurrencia y montos por mes
    years = dates.year.to_numpy()
    year_factor = {y: float(np.clip(rng.lognormal(0, 0.22), 0.5, 1.6)) for y in np.unique(years)}
    yf = np.array([year_factor[y] for y in years])
    monthly_mm = np.array(PRECIP)[month] * pfac * yf
    mean_event = np.where(np.isin(month, [4, 5, 6, 7]), 6.0, 13.0)
    p_rain = np.clip(monthly_mm / (days_in_month * mean_event), 0.02, 0.6)
    rain_day = rng.random(n) < p_rain
    shape = 0.8
    amount = rng.gamma(shape, (monthly_mm / (days_in_month * p_rain)) / shape)
    precip = np.where(rain_day, amount, 0.0)

    # Temperatura: climatología diaria + anomalía AR(1) + leve tendencia + enfriamiento en días de lluvia
    anom = np.zeros(n)
    for i in range(1, n):
        anom[i] = 0.7 * anom[i - 1] + rng.normal(0, 2.2)
    trend = (np.arange(n) / 365.25) * 0.02
    tmax = _daily_climatology(TMAX, dates) + dtx + anom + trend - np.where(rain_day, 2.5, 0)
    tmin = _daily_climatology(TMIN, dates) + dtn + 0.6 * anom + trend + rng.normal(0, 1.5, n)
    tmin = np.minimum(tmin, tmax - 3)
    t2m = (tmax + tmin) / 2

    rh = np.clip(_daily_climatology(RH, dates) + np.where(rain_day, 12, 0) + rng.normal(0, 6, n), 15, 98)
    wind = np.clip(_daily_climatology(WIND, dates) * rng.gamma(8, 1 / 8, n), 0.3, 12)
    ra = _ra(lat, dates.dayofyear.to_numpy())
    frac = np.clip(np.where(rain_day, 0.35, 0.65) + rng.normal(0, 0.06, n), 0.15, 0.78)
    rad = ra * frac
    ps = ps0 + rng.normal(0, 0.35, n)

    return pd.DataFrame(
        {
            "site_id": sid,
            "lat": lat,
            "lon": lon,
            "date": dates.strftime("%Y-%m-%d"),
            "T2M": t2m.round(2),
            "T2M_MAX": tmax.round(2),
            "T2M_MIN": tmin.round(2),
            "PRECTOTCORR": precip.round(2),
            "RH2M": rh.round(2),
            "WS2M": wind.round(2),
            "ALLSKY_SFC_SW_DWN": rad.round(2),
            "PS": ps.round(2),
        }
    )


def main() -> None:
    rng = np.random.default_rng(SEED)
    df = pd.concat([simulate(s, rng) for s in SITES], ignore_index=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"{OUT} · {len(df)} filas")
    annual = df.assign(year=df["date"].str[:4]).groupby(["site_id", "year"])["PRECTOTCORR"].sum().groupby("site_id").mean()
    print("Lluvia anual media simulada (mm):", annual.round(0).to_dict())


if __name__ == "__main__":
    main()
