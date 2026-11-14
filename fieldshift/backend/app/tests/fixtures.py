"""Respuestas sintéticas con la forma de NASA POWER (⚠️ reemplazar por una real grabada)."""

import pandas as pd


def power_response(start: str = "2015-01-01", end: str = "2015-01-10", fill_at: dict | None = None,
                   units: dict | None = None, value: float = 20.0) -> dict:
    """Construye un JSON tipo POWER. fill_at = {"PRECTOTCORR": ["20150103"]} pone -999 en esas fechas."""
    dates = [d.strftime("%Y%m%d") for d in pd.date_range(start, end, freq="D")]
    base = {
        "T2M": value, "T2M_MAX": value + 7, "T2M_MIN": value - 7, "PRECTOTCORR": 2.0,
        "RH2M": 60.0, "WS2M": 3.0, "ALLSKY_SFC_SW_DWN": 22.0, "PS": 95.0,
    }
    default_units = {
        "T2M": "C", "T2M_MAX": "C", "T2M_MIN": "C", "PRECTOTCORR": "mm/day",
        "RH2M": "%", "WS2M": "m/s", "ALLSKY_SFC_SW_DWN": "MJ/m^2/day", "PS": "kPa",
    }
    units = {**default_units, **(units or {})}
    fill_at = fill_at or {}
    parameter = {p: {d: (-999.0 if d in fill_at.get(p, []) else v) for d in dates} for p, v in base.items()}
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [-65.2, -33.85, 512.3]},
        "properties": {"parameter": parameter},
        "header": {"fill_value": -999.0, "start": dates[0], "end": dates[-1]},
        "messages": [],
        "parameters": {p: {"units": u, "longname": p} for p, u in units.items()},
    }
