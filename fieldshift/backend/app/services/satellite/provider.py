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
from app.utils.exceptions import InvalidInputError, NoDataError, UpstreamError
from app.i18n import tr

logger = logging.getLogger("fieldshift.satellite")

SAMPLE_MAX_DISTANCE_DEG = 1.0
POINT_MATCH_DEG = 0.005  # ~500 m: en pedidos de varios puntos, cada serie tiene que ser de ese punto


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


@dataclass
class MultiPointData:
    """Series de varios puntos pedidos juntos (por ejemplo, los sectores de un lote)."""

    series: dict[str, ParsedSeries]  # id del punto -> serie
    status: DataStatus
    retrieved_at: datetime
    task_id: str | None = None
    warnings: list[str] = field(default_factory=list)


def multi_key(product: Product, points: list[tuple[str, float, float]], start: date, end: date) -> str:
    payload = f"{product.appeears_id}|{product.layer}|" + ";".join(f"{i}:{a:.5f}:{b:.5f}" for i, a, b in points) + f"|{start}|{end}"
    return "multi_" + hashlib.sha256(payload.encode()).hexdigest()[:20]


class SatelliteProvider:
    def __init__(
        self,
        cache_dir: Path,
        samples: dict[str, Path],
        client_factory: Callable[[], object] | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        strict: bool = False,
    ) -> None:
        self.cache_dir = cache_dir
        self.samples = samples  # clave de producto -> CSV de muestra
        self.client_factory = client_factory
        self.now = now
        self.strict = strict  # modo estricto: no usar muestras SIMULADAS de satélite

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
                warnings.append(tr(f"AppEEARS no disponible ({exc.message}).", f"AppEEARS unavailable ({exc.message})."))
        else:
            warnings.append(tr("Sin credenciales de AppEEARS: no se consultaron datos en vivo.", "No AppEEARS credentials: no live data was queried."))

        sample = None if self.strict else self._sample(product, lat, lon, start, end)
        if sample is not None:
            sample.task_id = task_id
            sample.warnings = [*warnings, *sample.warnings]
            return sample
        raise NoDataError(
            tr(f"No hay datos de {product.name} para esta ubicación: cargá un CSV de AppEEARS o configurá las credenciales.", f"There is no {product.name} data for this location: upload an AppEEARS CSV or set up the credentials."),
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
                tr(f"Se pidió la extracción a AppEEARS (tarea {task_id}); suele tardar de minutos a horas. "
                   "Mientras tanto se usan datos de muestra.",
                   f"Extraction was requested from AppEEARS (task {task_id}); it usually takes minutes to hours. "
                   "Meanwhile sample data is used.")
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
            raise UpstreamError(tr(f"la tarea {task_id} terminó con error", f"task {task_id} ended with an error"))
        return (
            task_id,
            tr(f"La extracción de AppEEARS (tarea {task_id}) sigue en proceso ({status}): se usan datos de muestra.", f"The AppEEARS extraction (task {task_id}) is still in progress ({status}): sample data is used."),
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
            tr(f"Se usan DATOS DE MUESTRA SIMULADOS de {product.variable} del sitio '{site['ID']}' ", f"Using SIMULATED SAMPLE DATA of {product.variable} from site '{site['ID']}' ")
            + f"({site['Latitude']}, {site['Longitude']})" + tr("; no son observaciones de tus coordenadas.", "; these are not observations of your coordinates.")
        )
        return SatelliteData(
            clipped, DataStatus.SAMPLE, self.now(), sample_site=str(site["ID"]), warnings=[warning, *series.warnings]
        )

    @staticmethod
    def _clip(series: ParsedSeries, start: date, end: date) -> ParsedSeries:
        df = series.df
        series.df = df[(df.index >= pd.Timestamp(start)) & (df.index <= pd.Timestamp(end))]
        if series.df["value"].notna().sum() == 0:
            raise NoDataError(tr("La serie no tiene datos válidos en el período pedido.", "The series has no valid data in the requested period."))
        return series

    # --- varios puntos en una tarea ---
    def _parse_points(self, text: str, product: Product, points, start: date, end: date) -> dict[str, ParsedSeries]:
        out = {}
        for pid, lat, lon in points:
            try:
                ser = parse_csv(text, product, lat, lon)
                if ser.site_lat is not None and np.hypot(ser.site_lat - lat, ser.site_lon - lon) > POINT_MATCH_DEG:
                    continue  # el punto del archivo no es este (otro lote): no se usa
                out[pid] = self._clip(ser, start, end)
            except (NoDataError, InvalidInputError):
                continue
        if not out:
            raise NoDataError(tr(f"No hay datos válidos de {product.name} en los puntos pedidos.", f"There is no valid {product.name} data at the requested points."))
        return out

    def get_points(self, product: Product, points: list[tuple[str, float, float]], start: date, end: date) -> MultiPointData:
        """Caché -> AppEEARS (una tarea con todos los puntos, asincrónica) -> muestra simulada del sitio."""
        key = multi_key(product, points, start, end)
        cached = self._csv_path(key)
        if cached.exists():
            series = self._parse_points(cached.read_text(encoding="utf-8"), product, points, start, end)
            return MultiPointData(series, DataStatus.CACHED, datetime.fromtimestamp(cached.stat().st_mtime, tz=timezone.utc))
        warnings: list[str] = []
        task_id = None
        if self.client_factory is not None:
            try:
                client = self.client_factory()
                tasks = self._tasks()
                task_id = tasks.get(key)
                if task_id is None:
                    layers = [product.layer] + ([product.qa_layer] if product.qa_layer else [])
                    task_id = client.submit_point_task(f"fieldshift-{key}", product.appeears_id, layers, points[0][1],
                                                       points[0][2], start, end, points=points)
                    tasks[key] = task_id
                    self._save_tasks(tasks)
                    warnings.append(tr(f"Se pidió la extracción a AppEEARS (tarea {task_id}); suele tardar de minutos a horas. "
                                       "Mientras tanto se usan datos de muestra.",
                                       f"Extraction was requested from AppEEARS (task {task_id}); it usually takes minutes to hours. "
                                       "Meanwhile sample data is used."))
                else:
                    status = client.task_status(task_id)
                    if status == "done":
                        text = client.download_csv(task_id, product.layer)
                        series = self._parse_points(text, product, points, start, end)
                        self.cache_dir.mkdir(parents=True, exist_ok=True)
                        cached.write_text(text, encoding="utf-8")
                        tasks.pop(key, None)
                        self._save_tasks(tasks)
                        return MultiPointData(series, DataStatus.LIVE, self.now(), task_id=task_id)
                    if status == "error":
                        tasks.pop(key, None)
                        self._save_tasks(tasks)
                        raise UpstreamError(tr(f"la tarea {task_id} terminó con error", f"task {task_id} ended with an error"))
                    warnings.append(tr(f"La extracción de AppEEARS (tarea {task_id}) sigue en proceso ({status}): se usan datos de muestra.", f"The AppEEARS extraction (task {task_id}) is still in progress ({status}): sample data is used."))
            except (UpstreamError, OSError) as exc:
                msg = getattr(exc, "message", str(exc))
                logger.warning("AppEEARS no disponible: %s", msg)
                warnings.append(tr(f"AppEEARS no disponible ({msg}).", f"AppEEARS unavailable ({msg})."))
        else:
            warnings.append(tr("Sin credenciales de AppEEARS: no se consultaron datos en vivo.", "No AppEEARS credentials: no live data was queried."))

        path = None if self.strict else self.samples.get(product.key)
        if path is not None and path.exists():
            try:
                series = self._parse_points(path.read_text(encoding="utf-8"), product, points, start, end)
                warnings.append(tr(f"Se usan DATOS DE MUESTRA SIMULADOS de {product.variable}: no son observaciones de tu lote.", f"Using SIMULATED SAMPLE DATA of {product.variable}: these are not observations of your field."))
                return MultiPointData(series, DataStatus.SAMPLE, self.now(), task_id=task_id, warnings=warnings)
            except NoDataError:
                pass
        raise NoDataError(tr(f"No hay datos de {product.name} para esta ubicación.", f"There is no {product.name} data for this location."), {"warnings": warnings})
