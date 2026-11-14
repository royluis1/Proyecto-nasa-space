"""Archivos CSV descargados de NASA POWER (por ejemplo `campo1.csv`) como respaldo real cuando la API no responde.

Formato de POWER ("Single Point", CSV):

    -BEGIN HEADER-
    NASA/POWER Source Native Resolution Daily Data
    Location: latitude  -33.9265   longitude -65.0721
    elevation from MERRA-2: Average for 0.5 x 0.625 degree lat/lon region = 367.34 meters
    The value for missing source data ...: -999
    ...
    -END HEADER-
    YEAR,DOY,T2M,T2M_MAX,...
    2015,1,17.8,23.64,...

-999 (o el valor que indique el encabezado) es dato faltante: se trata como "sin dato".
A diferencia de la muestra simulada, son datos reales de NASA POWER (modelados), descargados antes.
"""

from __future__ import annotations

import io
import math
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

MAX_DISTANCE_DEG = 1.0


@dataclass
class PowerFile:
    path: Path
    lat: float
    lon: float
    elevation_m: float | None
    df: pd.DataFrame  # índice: fecha; columnas: parámetros de POWER

    @property
    def name(self) -> str:
        return self.path.name


def _pressure_kpa(z: float) -> float:
    """FAO-56, ec. 7: presión atmosférica según la altura."""
    return 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26


def read_power_csv(path: Path) -> PowerFile:
    text = path.read_text(encoding="utf-8", errors="replace")
    header, sep, body = text.partition("-END HEADER-")
    if not sep:
        header, body = "", text
    loc = re.search(r"latitude\s+(-?\d+(?:\.\d+)?)\s+longitude\s+(-?\d+(?:\.\d+)?)", header)
    if not loc:
        raise ValueError(f"{path.name}: el encabezado no indica la ubicación (latitude/longitude).")
    elev = re.search(r"=\s*(-?\d+(?:\.\d+)?)\s*meters", header)
    fill_m = re.search(r"range:\s*(-?\d+(?:\.\d+)?)", header)
    fill = float(fill_m.group(1)) if fill_m else -999.0

    df = pd.read_csv(io.StringIO(body.strip()))
    if {"YEAR", "DOY"} <= set(df.columns):
        dates = pd.to_datetime(df["YEAR"].astype(int).astype(str), format="%Y") + pd.to_timedelta(df["DOY"].astype(int) - 1, unit="D")
        df = df.drop(columns=["YEAR", "DOY"])
    elif {"YEAR", "MO", "DY"} <= set(df.columns):
        dates = pd.to_datetime(dict(year=df["YEAR"], month=df["MO"], day=df["DY"]))
        df = df.drop(columns=["YEAR", "MO", "DY"])
    else:
        raise ValueError(f"{path.name}: faltan las columnas de fecha (YEAR y DOY, o YEAR, MO y DY).")
    df.index = pd.DatetimeIndex(dates, name="date")
    df = df.apply(pd.to_numeric, errors="coerce").astype("float64")
    df = df.mask((df == fill) | (df <= -999))  # -999 = sin dato
    elevation = float(elev.group(1)) if elev else None
    if "PS" not in df.columns and elevation is not None:
        df["PS"] = _pressure_kpa(elevation)  # para ET0 Penman-Monteith (el archivo no trae presión)
    return PowerFile(path, float(loc.group(1)), float(loc.group(2)), elevation, df.sort_index())


class PowerFileProvider:
    """Busca, entre los CSV de POWER disponibles, el más cercano al punto (a menos de 1°)."""

    def __init__(self, paths: list[Path]) -> None:
        self.paths = paths
        self._files: list[PowerFile] | None = None

    def _load(self) -> list[PowerFile]:
        if self._files is None:
            files = []
            for p in self.paths:
                if p.exists():
                    try:
                        files.append(read_power_csv(p))
                    except (ValueError, OSError, pd.errors.ParserError):
                        continue
            self._files = files
        return self._files

    def get(self, lat: float, lon: float, start: date, end: date, params: list[str]) -> tuple[PowerFile, pd.DataFrame] | None:
        files = self._load()
        if not files:
            return None
        best = min(files, key=lambda f: math.hypot(f.lat - lat, f.lon - lon))
        if math.hypot(best.lat - lat, best.lon - lon) > MAX_DISTANCE_DEG:
            return None
        rows = best.df.loc[pd.Timestamp(start) : pd.Timestamp(end)]
        if rows.empty:
            return None
        out = rows.reindex(columns=params)
        return best, out
