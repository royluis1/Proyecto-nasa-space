"""Relieve del lote: caché -> SRTM en vivo (Earthdata Login) -> muestra simulada.

SRTM v3 (SRTMGL1, 30 m) se descarga de LP DAAC, que exige Earthdata Login. La URL de la baldosa se busca
en CMR (catálogo público de NASA); si CMR no responde, se arma con el patrón conocido de LP DAAC.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from app.models.enums import DataStatus
from app.schemas.terrain import TerrainSummary
from app.services.earthdata.session import EarthdataAuthError
from app.services.power.service import Cooldown
from app.services.terrain.srtm import read_hgt_zip, slope_class, terrain_stats, tile_name
from app.utils.exceptions import InvalidInputError, NoDataError, UpstreamError

logger = logging.getLogger("fieldshift.terrain")

CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"
LPDAAC_PATTERN = "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/{p}.003/{t}.{p}.hgt/{t}.{p}.hgt.zip"
SAMPLE_MAX_DEG = 1.0
LIMITATIONS = [
    "SRTM es del año 2000: no ve cambios posteriores (terrazas, canales, caminos).",
    "Resolución de ~30 m: no detecta microrrelieve, bajos chicos ni surcos.",
    "SRTM tiene un ruido de algunos metros: se suaviza con una media de 3 x 3 píxeles, pero en llanuras muy planas la pendiente puede salir algo más alta que la real.",
    "Es la superficie del radar: en montes o arboledas puede medir la copa y no el suelo.",
    "La pendiente informa sobre la erosión por agua; la erosión eólica, central en San Luis, depende sobre todo de la cobertura.",
]


def default_radius(area_ha: float | None) -> float:
    """Radio del círculo con la superficie del lote (si no hay polígono), entre 90 y 2000 m."""
    if not area_ha:
        return 300.0
    return max(90.0, min(2000.0, math.sqrt(area_ha * 10_000 / math.pi)))


def interpret(slope: float, p90: float) -> str:
    cls = slope_class(slope)
    base = {
        "plano": "Lote prácticamente plano: el riesgo de erosión por agua es bajo; puede haber encharcamiento en bajos.",
        "suave": "Pendiente suave: con lluvias intensas y suelo desnudo puede haber escurrimiento y erosión en surcos.",
        "moderada": "Pendiente moderada: conviene cobertura permanente, siembra en contorno o en curvas de nivel.",
        "fuerte": "Pendiente fuerte: alto riesgo de erosión por agua; requiere manejo conservacionista y validación técnica.",
    }[cls]
    if p90 >= 2 * max(slope, 0.5) and slope_class(p90) != cls:
        base += f" Hay sectores con más pendiente (el 10 % del lote supera el {p90:.1f} %)."
    return base


class TerrainProvider:
    def __init__(
        self,
        cache_dir: Path,
        sample_file: Path | None,
        session_factory: Callable[[], object] | None = None,
        product: str = "SRTMGL1",
        cooldown: Cooldown | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self.cache_dir = cache_dir
        self.sample_file = sample_file
        self.session_factory = session_factory
        self.product = product
        self.cooldown = cooldown
        self.now = now

    # --- caché ---
    def _summary_path(self, key: str) -> Path:
        return self.cache_dir / f"terrain_{key}.json"

    def _tile_path(self, tile: str) -> Path:
        return self.cache_dir / f"{tile}.{self.product}.hgt.zip"

    @staticmethod
    def _key(lat: float, lon: float, radius: float, ring) -> str:
        payload = f"{lat:.5f}|{lon:.5f}|{radius:.0f}|{json.dumps(ring) if ring else ''}"
        return hashlib.sha256(payload.encode()).hexdigest()[:20]

    def _read_cached(self, key: str) -> TerrainSummary | None:
        try:
            data = json.loads(self._summary_path(key).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        data.update(origin=DataStatus.CACHED, origin_label=DataStatus.CACHED.origin_label)
        return TerrainSummary(**data)

    def _write_cache(self, key: str, summary: TerrainSummary) -> None:
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._summary_path(key).write_text(summary.model_dump_json(), encoding="utf-8")
        except OSError as exc:
            logger.warning("No se pudo guardar el relieve en caché: %s", exc)

    # --- en vivo ---
    def _granule_url(self, session, tile: str, lat: float, lon: float) -> str:
        try:
            feed = session.get_json(
                CMR_GRANULES, {"short_name": self.product, "version": "003", "point": f"{lon},{lat}", "page_size": 5}
            )
            for entry in feed.get("feed", {}).get("entry", []):
                for link in entry.get("links", []):
                    href = link.get("href", "")
                    if href.startswith("https://") and href.endswith(".hgt.zip") and tile in href:
                        return href
        except UpstreamError as exc:
            logger.warning("CMR no respondió (%s): se usa la URL conocida de LP DAAC.", exc.message)
        return LPDAAC_PATTERN.format(p=self.product, t=tile)

    def _download_tile(self, tile: str, lat: float, lon: float) -> tuple[bytes, DataStatus]:
        path = self._tile_path(tile)
        if path.exists():
            return path.read_bytes(), DataStatus.CACHED
        session = self.session_factory()
        try:
            url = self._granule_url(session, tile, lat, lon)
            session.download(url, path, expect=(".zip",))
        finally:
            close = getattr(session, "close", None)
            if close:
                close()
        return path.read_bytes(), DataStatus.LIVE

    # --- muestra ---
    def _sample(self, lat: float, lon: float) -> dict | None:
        if not self.sample_file or not self.sample_file.exists():
            return None
        sites = json.loads(self.sample_file.read_text(encoding="utf-8"))["sites"]
        best = min(sites, key=lambda s: (s["lat"] - lat) ** 2 + (s["lon"] - lon) ** 2)
        if math.hypot(best["lat"] - lat, best["lon"] - lon) > SAMPLE_MAX_DEG:
            return None
        return best

    def get(
        self, lat: float, lon: float, radius_m: float, ring: list[tuple[float, float]] | None = None
    ) -> tuple[TerrainSummary, list[str]]:
        if not -60 <= lat <= 60:
            raise InvalidInputError("SRTM cubre de 60° S a 60° N.")
        key = self._key(lat, lon, radius_m, ring)
        cached = self._read_cached(key)
        if cached:
            return cached, []
        tile = tile_name(lat, lon)
        area = "polígono del lote" if ring else f"círculo de {radius_m:.0f} m de radio alrededor del punto"
        warnings: list[str] = []
        reason = None
        if self.session_factory is None:
            reason = "sin credenciales de Earthdata (FIELDSHIFT_EARTHDATA_USERNAME y _PASSWORD)"
        elif self.cooldown and self.cooldown.active(self.now()):
            reason = f"Earthdata falló hace menos de {self.cooldown.seconds / 60:.0f} min; se vuelve a probar después"
        else:
            try:
                blob, status = self._download_tile(tile, lat, lon)
                stats = terrain_stats(read_hgt_zip(blob), tile, lat, lon, radius_m, ring)
                if self.cooldown:
                    self.cooldown.reset()
                if stats.clipped:
                    warnings.append("La zona toca el borde de la baldosa de SRTM: se analizó solo la parte dentro de ella.")
                summary = TerrainSummary(
                    product=self.product, tile=tile, latitude=lat, longitude=lon, area=area,
                    elevation_mean_m=stats.elevation_mean_m, elevation_min_m=stats.elevation_min_m,
                    elevation_max_m=stats.elevation_max_m, slope_mean_pct=stats.slope_mean_pct,
                    slope_p90_pct=stats.slope_p90_pct, slope_max_pct=stats.slope_max_pct,
                    slope_class=slope_class(stats.slope_mean_pct), resolution_m=stats.resolution_m,
                    origin=status, origin_label=status.origin_label,
                    interpretation=interpret(stats.slope_mean_pct, stats.slope_p90_pct), limitations=LIMITATIONS,
                )
                self._write_cache(key, summary)
                return summary, warnings
            except EarthdataAuthError as exc:
                reason = exc.message  # credenciales: no tiene sentido reintentar enseguida
                if self.cooldown:
                    self.cooldown.fail(self.now())
            except (UpstreamError, ValueError, OSError) as exc:
                reason = getattr(exc, "message", None) or str(exc)
                logger.warning("SRTM no disponible: %s", reason)
                if self.cooldown:
                    self.cooldown.fail(self.now())

        site = self._sample(lat, lon)
        if site is None:
            raise NoDataError(f"No hay datos de relieve: SRTM no disponible ({reason}) y no hay muestra cerca.")
        warnings += [
            f"SRTM no disponible ({reason}).",
            f"Se usa un relieve de MUESTRA SIMULADA del sitio '{site['site_id']}': no es una medición de tu lote.",
        ]
        summary = TerrainSummary(
            product=self.product, tile=tile, latitude=lat, longitude=lon, area=area,
            elevation_mean_m=site["elevation_mean_m"], elevation_min_m=site["elevation_min_m"],
            elevation_max_m=site["elevation_max_m"], slope_mean_pct=site["slope_mean_pct"],
            slope_p90_pct=site["slope_p90_pct"], slope_max_pct=site["slope_max_pct"],
            slope_class=slope_class(site["slope_mean_pct"]), resolution_m=30.9,
            origin=DataStatus.SAMPLE, origin_label=DataStatus.SAMPLE.origin_label,
            interpretation=interpret(site["slope_mean_pct"], site["slope_p90_pct"]), limitations=LIMITATIONS,
        )
        return summary, warnings


def terrain_for_field(provider: TerrainProvider, field, radius_m: float | None = None) -> tuple[TerrainSummary, list[str]]:
    """Relieve de un lote: dentro de su polígono si lo tiene; si no, un círculo con su superficie."""
    ring = [tuple(p) for p in field.boundary.coordinates[0]] if getattr(field, "boundary", None) else None
    radius = radius_m or default_radius(field.area_ha)
    return provider.get(field.location.lat, field.location.lon, radius, ring)
