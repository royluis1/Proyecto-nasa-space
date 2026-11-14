"""Evapotranspiración de referencia (ET0) diaria, FAO-56 (Allen et al., 1998).

- Método principal: Penman-Monteith (ec. 6), con T2M, T2M_MAX, T2M_MIN, RH2M, WS2M,
  ALLSKY_SFC_SW_DWN y PS de POWER. G = 0 a escala diaria.
- Respaldo por día: Hargreaves (ec. 52) si falta algún dato de Penman-Monteith.
Resultado: ESTIMADO (calculado a partir de datos regionales de POWER).
"""

import numpy as np
import pandas as pd

SIGMA = 4.903e-9  # constante de Stefan-Boltzmann, MJ K-4 m-2 día-1


def _svp(t: pd.Series) -> pd.Series:
    """Presión de vapor de saturación (kPa), ec. 11."""
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def extraterrestrial_radiation(lat_deg: float, doy: pd.Series) -> pd.Series:
    """Ra (MJ m-2 día-1), ec. 21."""
    phi = np.deg2rad(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    delta = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1, 1))
    return (24 * 60 / np.pi) * 0.0820 * dr * (
        ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws)
    )


def _elevation_from_pressure(ps_kpa: pd.Series) -> pd.Series:
    """Despeja z de la ec. 7: P = 101.3 ((293 - 0.0065 z) / 293)^5.26."""
    return (293 - 293 * (ps_kpa / 101.3) ** (1 / 5.26)) / 0.0065


def hargreaves(tmean: pd.Series, tmax: pd.Series, tmin: pd.Series, ra: pd.Series) -> pd.Series:
    """ET0 Hargreaves (mm/día), ec. 52."""
    return 0.0023 * (tmean + 17.8) * np.sqrt((tmax - tmin).clip(lower=0)) * 0.408 * ra


def penman_monteith(df: pd.DataFrame, ra: pd.Series) -> pd.Series:
    t, tmax, tmin = df["T2M"], df["T2M_MAX"], df["T2M_MIN"]
    rh, u2, rs, ps = df["RH2M"], df["WS2M"], df["ALLSKY_SFC_SW_DWN"], df["PS"]

    delta = 4098 * _svp(t) / (t + 237.3) ** 2  # ec. 13
    gamma = 0.000665 * ps  # ec. 8
    es = (_svp(tmax) + _svp(tmin)) / 2  # ec. 12
    ea = rh / 100 * es  # ec. 19 (con humedad relativa media)

    z = _elevation_from_pressure(ps)
    rso = (0.75 + 2e-5 * z) * ra  # ec. 37
    rns = 0.77 * rs  # ec. 38, albedo 0.23
    ratio = (rs / rso).clip(upper=1.0)
    rnl = SIGMA * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (0.34 - 0.14 * np.sqrt(ea.clip(lower=0))) * (
        1.35 * ratio - 0.35
    )  # ec. 39
    rn = rns - rnl

    num = 0.408 * delta * rn + gamma * (900 / (t + 273)) * u2 * (es - ea)
    den = delta + gamma * (1 + 0.34 * u2)
    return num / den


def compute_et0(df: pd.DataFrame, lat_deg: float) -> tuple[pd.Series, pd.Series]:
    """Devuelve (ET0 mm/día, método por día: 'PM', 'HG' o None)."""
    doy = pd.Series(df.index.day_of_year, index=df.index, dtype="float64")
    ra = extraterrestrial_radiation(lat_deg, doy)

    pm_cols = ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PS"]
    hg_cols = ["T2M", "T2M_MAX", "T2M_MIN"]

    et0 = pd.Series(np.nan, index=df.index)
    method = pd.Series(None, index=df.index, dtype="object")

    if all(c in df.columns for c in pm_cols):
        pm_ok = df[pm_cols].notna().all(axis=1)
        et0[pm_ok] = penman_monteith(df[pm_ok], ra[pm_ok])
        method[pm_ok] = "PM"
    else:
        pm_ok = pd.Series(False, index=df.index)

    hg_ok = ~pm_ok & df[hg_cols].notna().all(axis=1)
    et0[hg_ok] = hargreaves(df.loc[hg_ok, "T2M"], df.loc[hg_ok, "T2M_MAX"], df.loc[hg_ok, "T2M_MIN"], ra[hg_ok])
    method[hg_ok] = "HG"

    return et0.clip(lower=0), method
