"""Obtención de series SMAP y MODIS con respaldo.

Orden: CSV cargado por el usuario -> caché local -> AppEEARS en vivo -> muestra -> error 503.

AppEEARS es asincrónico. La primera consulta con credenciales crea la tarea y responde con la
muestra (con aviso); las siguientes revisan la tarea y, cuando termina, descargan el CSV, lo
guardan en caché y lo usan. Sin credenciales, se salta el paso en vivo.
"""

import hashlib
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from app.models.enums import DataStatus
from app.services.satellite.parsers import ParsedSeries, parse_csv
from app.services.satellite.products import Product
from app.utils.exceptions import NoDataError, UpstreamError

logger = logging.getLogger("fieldshift.satellite")

SAMPLE_MAX_DISTANCE_DEG = 1.0


@dataclass
class SatelliteData:
    series: ParsedSeries
    status: DataStatus
    retrieved_at: datetime
    sample_site: str | None = None
    task_id: str | None = None
    warnings: list[str] = field(default_factory=list)


def cache_key(product: Product, lat: float, lon: float, start: date, end: date) -> str:
    payload = f"{product.appeears_id}|{product.layer}|{lat:.3f}|{lon:.3f}|{start}|{end}"
    return hashlib.sha256(payload.encode()).hexdigest()[:20]


class SatelliteProvider:
    def __init__(
        self,
        cache_dir: Path,
        samples: dict[str, Path],
        client_factory: Callable[[], object] | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self.cache_dir = cache_dir
        self.samples = samples  # clave de producto -> CSV de muestra
        self.client_factory = client_factory
        self.now = now

    # --- caché en disco ---
    def _csv_path(self, key: str) -> Path:
        return self.cache_dir / f"appeears_{key}.csv"

    def _tasks_path(self) -> Path:
        return self.cache_dir / "appeears_tasks.json"

    def _tasks(self) -> dict:
        try:
            return json.loads(self._tasks_path().read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_tasks(self, tasks: dict) -> None:
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._tasks_path().write_text(json.dumps(tasks, indent=1), encoding="utf-8")
        except OSError as exc:
            logger.warning("No se pudo guardar el registro de tareas: %s", exc)

    # --- cascada ---
    def get(
        self, product: Product, lat: float, lon: float, start: date, end: date, csv_text: str | None = None
    ) -> SatelliteData:
        if csv_text:
            series = parse_csv(csv_text, product, lat, lon)
            return SatelliteData(
                self._clip(series, start, end), DataStatus.UPLOADED, self.now(), warnings=list(series.warnings)
            )

        key = cache_key(product, lat, lon, start, end)
        cached = self._csv_path(key)
        if cached.exists():
            series = parse_csv(cached.read_text(encoding="utf-8"), product, lat, lon)
            fetched = datetime.fromtimestamp(cached.stat().st_mtime, tz=timezone.utc)
            return SatelliteData(
                self._clip(series, start, end), DataStatus.CACHED, fetched, warnings=list(series.warnings)
            )

        warnings: list[str] = []
        task_id = None
        if self.client_factory is not None:
            try:
                live = self._live(product, key, lat, lon, start, end)
                if isinstance(live, SatelliteData):
                    return live
                task_id, message = live
                warnings.append(message)
            except UpstreamError as exc:
                logger.warning("AppEEARS no disponible: %s", exc.message)
                warnings.append(f"AppEEARS no disponible ({exc.message}).")
        else:
            warnings.append("Sin credenciales de AppEEARS: no se consultaron datos en vivo.")

        sample = self._sample(product, lat, lon, start, end)
        if sample is not None:
            sample.task_id = task_id
            sample.warnings = [*warnings, *sample.warnings]
            return sample
        raise NoDataError(
            f"No hay datos de {product.name} para esta ubicación: cargá un CSV de AppEEARS o configurá las credenciales.",
            {"warnings": warnings},
        )

    def _live(self, product: Product, key: str, lat: float, lon: float, start: date, end: date):
        client = self.client_factory()
        tasks = self._tasks()
        task_id = tasks.get(key)
        if task_id is None:
            layers = [product.layer] + ([product.qa_layer] if product.qa_layer else [])
            task_id = client.submit_point_task(f"fieldshift-{key}", product.appeears_id, layers, lat, lon, start, end)
            tasks[key] = task_id
            self._save_tasks(tasks)
            return task_id, (
                f"Se pidió la extracción a AppEEARS (tarea {task_id}); suele tardar de minutos a horas. "
                "Mientras tanto se usan datos de muestra."
            )
        status = client.task_status(task_id)
        if status == "done":
            text = client.download_csv(task_id, product.layer)
            series = parse_csv(text, product, lat, lon)  # se valida antes de guardar
            try:
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                self._csv_path(key).write_text(text, encoding="utf-8")
            except OSError as exc:
                logger.warning("No se pudo guardar la caché satelital: %s", exc)
            tasks.pop(key, None)
            self._save_tasks(tasks)
            return SatelliteData(
                self._clip(series, start, end),
                DataStatus.LIVE,
                self.now(),
                task_id=task_id,
                warnings=list(series.warnings),
            )
        if status == "error":
            tasks.pop(key, None)
            self._save_tasks(tasks)
            raise UpstreamError(f"la tarea {task_id} terminó con error")
        return (
            task_id,
            f"La extracción de AppEEARS (tarea {task_id}) sigue en proceso ({status}): se usan datos de muestra.",
        )

    def _sample(self, product: Product, lat: float, lon: float, start: date, end: date) -> SatelliteData | None:
        path = self.samples.get(product.key)
        if path is None or not path.exists():
            return None
        text = path.read_text(encoding="utf-8")
        sites = pd.read_csv(path, usecols=["ID", "Latitude", "Longitude"], comment="#").drop_duplicates("ID")
        dist = np.hypot(sites["Latitude"] - lat, sites["Longitude"] - lon)
        if dist.min() > SAMPLE_MAX_DISTANCE_DEG:
            return None
        site = sites.loc[dist.idxmin()]
        series = parse_csv(text, product, float(site["Latitude"]), float(site["Longitude"]))
        try:
            clipped = self._clip(series, start, end)
        except NoDataError:
            return None
        warning = (
            f"Se usan DATOS DE MUESTRA SIMULADOS de {product.variable} del sitio '{site['ID']}' "
            f"({site['Latitude']}, {site['Longitude']}); no son observaciones de tus coordenadas."
        )
        return SatelliteData(
            clipped, DataStatus.SAMPLE, self.now(), sample_site=str(site["ID"]), warnings=[warning, *series.warnings]
        )

    @staticmethod
    def _clip(series: ParsedSeries, start: date, end: date) -> ParsedSeries:
        df = series.df
        series.df = df[(df.index >= pd.Timestamp(start)) & (df.index <= pd.Timestamp(end))]
        if series.df["value"].notna().sum() == 0:
            raise NoDataError("La serie no tiene datos válidos en el período pedido.")
        return series
