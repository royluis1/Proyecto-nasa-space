"""Parseo de la respuesta JSON de NASA POWER.

Estructura esperada (⚠️ validar contra una respuesta real y guardarla como fixture):
{
  "geometry": {"coordinates": [lon, lat, elevación]},
  "properties": {"parameter": {"T2M": {"20150101": 24.1, ...}, ...}},
  "header": {"fill_value": -999.0, ...},
  "parameters": {"T2M": {"units": "C", "longname": "..."}, ...},
  "messages": [...]
}
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app.utils.exceptions import UpstreamError

DEFAULT_FILL_VALUE = -999.0


@dataclass
class ParsedPower:
    df: pd.DataFrame  # índice: fecha diaria; columnas: parámetros (NaN = faltante)
    units: dict[str, str]
    longnames: dict[str, str]
    missing: dict[str, int]  # cantidad de valores faltantes (-999) por parámetro
    elevation_m: float | None = None
    messages: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_power_json(raw: dict, requested: list[str]) -> ParsedPower:
    try:
        series_by_param: dict = raw["properties"]["parameter"]
    except (KeyError, TypeError):
        raise UpstreamError("NASA POWER devolvió una respuesta con formato inesperado.") from None
    if not isinstance(series_by_param, dict) or not series_by_param:
        raise UpstreamError("NASA POWER no devolvió parámetros.")

    header = raw.get("header") or {}
    fill = float(header.get("fill_value", DEFAULT_FILL_VALUE))

    columns: dict[str, pd.Series] = {}
    for code, values in series_by_param.items():
        if not isinstance(values, dict):
            continue
        s = pd.Series(values, dtype="float64")
        s.index = pd.to_datetime(s.index, format="%Y%m%d")
        # El fill_value (-999) y cualquier valor <= -999 son dato faltante.
        s = s.mask((s == fill) | (s <= DEFAULT_FILL_VALUE))
        columns[code] = s

    df = pd.DataFrame(columns).sort_index()
    df.index.name = "date"

    warnings: list[str] = []
    absent = [p for p in requested if p not in df.columns]
    if absent:
        warnings.append(f"NASA POWER no devolvió: {', '.join(absent)}.")
        for p in absent:
            df[p] = np.nan

    meta = raw.get("parameters") or {}
    units = {p: str((meta.get(p) or {}).get("units", "")) for p in df.columns}
    longnames = {p: str((meta.get(p) or {}).get("longname", p)) for p in df.columns}
    missing = {p: int(df[p].isna().sum()) for p in df.columns}

    coords = (raw.get("geometry") or {}).get("coordinates") or []
    elevation = float(coords[2]) if len(coords) >= 3 and coords[2] is not None else None
    messages = [str(m) for m in raw.get("messages") or []]

    return ParsedPower(df, units, longnames, missing, elevation, messages, warnings)
