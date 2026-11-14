"""Análisis climático sobre la serie diaria normalizada (funciones puras, sin red).

Umbrales y criterios son SUPUESTOS documentados en docs/assumptions.md.
"""

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

HEAT_THRESHOLD_C = 35.0  # Tmax > umbral = día caluroso (supuesto a validar)
Z_THRESHOLD = 1.0  # |z| >= 1: año seco/húmedo/con estrés térmico (supuesto)
MAX_MISSING_MONTH_PCT = 20.0  # mes no válido si faltan más días de lluvia (supuesto)
MAX_MISSING_YEAR_PCT = 5.0  # año incompleto si faltan más días de lluvia (supuesto)
MIN_YEARS_TREND = 5
P_SIGNIFICANCE = 0.05

SEASONS = {  # hemisferio sur
    "verano": (12, 1, 2),
    "otoño": (3, 4, 5),
    "invierno": (6, 7, 8),
    "primavera": (9, 10, 11),
}


def _f(x) -> float | None:
    """float redondeado o None si es NaN."""
    if x is None or (isinstance(x, float) and math.isnan(x)) or pd.isna(x):
        return None
    return round(float(x), 2)


def monthly_table(df: pd.DataFrame, heat_threshold: float = HEAT_THRESHOLD_C) -> pd.DataFrame:
    """Una fila por (año, mes). df debe tener T2M, T2M_MAX, T2M_MIN, PRECTOTCORR y ET0."""
    g = df.groupby([df.index.year.rename("year"), df.index.month.rename("month")])
    out = pd.DataFrame(
        {
            "days": g.size(),
            "missing_precip": g["PRECTOTCORR"].apply(lambda s: int(s.isna().sum())),
            "precip_mm": g["PRECTOTCORR"].sum(min_count=1),
            "t2m_mean": g["T2M"].mean(),
            "tmax_mean": g["T2M_MAX"].mean(),
            "tmin_mean": g["T2M_MIN"].mean(),
            "heat_days": g["T2M_MAX"].apply(lambda s: int((s > heat_threshold).sum())),
            "et0_mm": g["ET0"].sum(min_count=1),
        }
    )
    out["valid"] = out["missing_precip"] / out["days"] * 100 <= MAX_MISSING_MONTH_PCT
    out.loc[~out["valid"], ["precip_mm"]] = np.nan
    out["balance_mm"] = out["precip_mm"] - out["et0_mm"]
    return out


def monthly_climatology(monthly: pd.DataFrame) -> pd.DataFrame:
    valid = monthly[monthly["valid"]]
    clim = valid.groupby(level="month")[["precip_mm", "t2m_mean", "tmax_mean", "tmin_mean", "heat_days", "et0_mm"]].mean()
    clim["years"] = valid.groupby(level="month").size()
    return clim


def seasonal_climatology(monthly: pd.DataFrame) -> list[dict]:
    m = monthly[monthly["valid"]].reset_index()
    # diciembre se asigna al verano del año siguiente
    m["season_year"] = np.where(m["month"] == 12, m["year"] + 1, m["year"])
    result = []
    for name, months in SEASONS.items():
        sub = m[m["month"].isin(months)]
        per_year = sub.groupby("season_year").agg(
            n=("month", "size"), precip=("precip_mm", "sum"), heat=("heat_days", "sum"), t=("t2m_mean", "mean")
        )
        per_year = per_year[per_year["n"] == 3]  # solo estaciones completas
        result.append(
            {
                "season": name,
                "months": list(months),
                "precip_mm": _f(per_year["precip"].mean()),
                "t2m_mean": _f(per_year["t"].mean()),
                "heat_days": _f(per_year["heat"].mean()),
                "years": int(len(per_year)),
            }
        )
    return result


def annual_table(df: pd.DataFrame, heat_threshold: float = HEAT_THRESHOLD_C) -> pd.DataFrame:
    g = df.groupby(df.index.year.rename("year"))
    out = pd.DataFrame(
        {
            "days": g.size(),
            "missing_precip": g["PRECTOTCORR"].apply(lambda s: int(s.isna().sum())),
            "precip_mm": g["PRECTOTCORR"].sum(min_count=1),
            "t2m_mean": g["T2M"].mean(),
            "tmax_max": g["T2M_MAX"].max(),
            "tmin_min": g["T2M_MIN"].min(),
            "heat_days": g["T2M_MAX"].apply(lambda s: int((s > heat_threshold).sum())),
            "et0_mm": g["ET0"].sum(min_count=1),
        }
    )
    days_in_year = pd.Series([366 if pd.Timestamp(y, 1, 1).is_leap_year else 365 for y in out.index], index=out.index)
    invalid_months = (~monthly_table(df, heat_threshold)["valid"]).groupby(level="year").sum()
    out["complete"] = (
        (out["days"] == days_in_year)
        & (out["missing_precip"] / out["days"] * 100 <= MAX_MISSING_YEAR_PCT)
        & (invalid_months.reindex(out.index, fill_value=0) == 0)
    )
    return out


def annual_deficit(monthly: pd.DataFrame) -> pd.Series:
    """Déficit hídrico climático anual: suma de max(0, ET0 - P) mensual (mm)."""
    deficit = (monthly["et0_mm"] - monthly["precip_mm"]).clip(lower=0)
    return deficit.groupby(level="year").sum(min_count=1)


def classify_years(annual: pd.DataFrame) -> pd.DataFrame:
    """Seco/húmedo por z-score de la lluvia anual y estrés térmico por z-score de días calurosos.

    Solo años completos. Relativo al propio período pedido (no a una normal climática oficial).
    """
    out = annual.copy()
    out["precip_anomaly_pct"] = np.nan
    out["classification"] = None
    out["heat_stress"] = False
    comp = out[out["complete"]]
    if len(comp) < 3:
        return out
    mean_p, sd_p = comp["precip_mm"].mean(), comp["precip_mm"].std(ddof=1)
    mean_h, sd_h = comp["heat_days"].mean(), comp["heat_days"].std(ddof=1)
    idx = comp.index
    out.loc[idx, "precip_anomaly_pct"] = (comp["precip_mm"] - mean_p) / mean_p * 100
    z_p = (comp["precip_mm"] - mean_p) / sd_p if sd_p > 0 else comp["precip_mm"] * 0
    out.loc[idx, "classification"] = np.where(z_p <= -Z_THRESHOLD, "seco", np.where(z_p >= Z_THRESHOLD, "húmedo", "normal"))
    if sd_h > 0:
        z_h = (comp["heat_days"] - mean_h) / sd_h
        out.loc[idx, "heat_stress"] = (z_h >= Z_THRESHOLD) & (comp["heat_days"] > 0)
    return out


@dataclass
class Trend:
    slope_per_decade: float | None
    kendall_tau: float | None
    p_value: float | None
    significant: bool
    n_years: int


def mann_kendall_sen(values: pd.Series) -> Trend:
    """Tendencia monotónica: pendiente de Sen + test de Mann-Kendall (aprox. normal, sin corrección por empates)."""
    s = values.dropna()
    x = np.asarray(s.index, dtype=float)
    y = s.to_numpy(dtype=float)
    n = len(y)
    if n < MIN_YEARS_TREND:
        return Trend(None, None, None, False, n)
    slopes, S = [], 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            slopes.append((y[j] - y[i]) / (x[j] - x[i]))
            S += int(np.sign(y[j] - y[i]))
    var_s = n * (n - 1) * (2 * n + 5) / 18
    z = (S - 1) / math.sqrt(var_s) if S > 0 else (S + 1) / math.sqrt(var_s) if S < 0 else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))  # bilateral
    tau = S / (n * (n - 1) / 2)
    return Trend(round(float(np.median(slopes)) * 10, 2), round(tau, 3), round(p, 4), p < P_SIGNIFICANCE, n)


def coefficient_of_variation(values: pd.Series) -> float | None:
    v = values.dropna()
    if len(v) < 3 or v.mean() == 0:
        return None
    return round(float(v.std(ddof=1) / v.mean() * 100), 1)


def heat_frequency_by_month(df: pd.DataFrame, heat_threshold: float = HEAT_THRESHOLD_C) -> list[float | None]:
    """% de días con Tmax > umbral, por mes calendario (1..12)."""
    tmax = df["T2M_MAX"].dropna()
    freq = (tmax > heat_threshold).groupby(tmax.index.month).mean() * 100
    return [_f(freq.get(m)) for m in range(1, 13)]
