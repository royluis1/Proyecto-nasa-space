"""Datos climáticos de MUESTRA para funcionar sin red.

El CSV es SIMULADO (ver scripts/generate_power_sample.py): tiene la forma de
POWER y valores plausibles para San Luis, pero no son observaciones.
Solo se usa si el punto pedido está a menos de MAX_DISTANCE_DEG de un sitio de muestra.
"""

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

from app.services.power.units import TARGET_UNITS

MAX_DISTANCE_DEG = 1.0


@dataclass
class SampleSeries:
    site_id: str
    site_lat: float
    site_lon: float
    df: pd.DataFrame


class SampleProvider:
    def __init__(self, csv_path: Path) -> None:
        self.path = csv_path
        self._data: pd.DataFrame | None = None

    def _load(self) -> pd.DataFrame | None:
        if self._data is None and self.path.exists():
            data = pd.read_csv(self.path, parse_dates=["date"])
            self._data = data
        return self._data

    def get(self, lat: float, lon: float, start: date, end: date, params: list[str]) -> SampleSeries | None:
        data = self._load()
        if data is None:
            return None
        sites = data[["site_id", "lat", "lon"]].drop_duplicates()
        dist = ((sites["lat"] - lat) ** 2 + (sites["lon"] - lon) ** 2) ** 0.5
        if dist.min() > MAX_DISTANCE_DEG:
            return None
        site = sites.loc[dist.idxmin()]
        rows = data[(data["site_id"] == site["site_id"])]
        rows = rows[(rows["date"] >= pd.Timestamp(start)) & (rows["date"] <= pd.Timestamp(end))]
        if rows.empty:
            return None
        df = rows.set_index("date").sort_index()
        df = df[[p for p in params if p in df.columns]].astype("float64")
        for p in params:
            if p not in df.columns:
                df[p] = float("nan")
        return SampleSeries(str(site["site_id"]), float(site["lat"]), float(site["lon"]), df)

    @staticmethod
    def units(params: list[str]) -> dict[str, str]:
        return {p: TARGET_UNITS.get(p, "") for p in params}
