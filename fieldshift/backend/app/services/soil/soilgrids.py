"""Suelo estimado con SoilGrids v2.0 (ISRIC, 250 m, CC BY 4.0): arcilla, arena, limo y carbono orgánico de 0 a 30 cm.

Es una ESTIMACIÓN de un modelo global (aprendizaje automático sobre perfiles de suelo): no se mide desde satélite y
puede errar en el lote. El análisis de laboratorio y lo que carga el productor tienen prioridad.

Orden: caché -> SoilGrids en vivo (API REST de ISRIC, "beta / fair use") -> muestra simulada rotulada -> vacío con aviso.
Si el equipo consigue la Carta de Suelos de INTA, se puede sumar como fuente con prioridad (misma interfaz).
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from app.models.enums import DataStatus, Level, SoilTexture
from app.schemas.regions import SoilEstimate
from app.services.power.service import Cooldown
from app.utils.exceptions import UpstreamError

logger = logging.getLogger("fieldshift.soil")

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOURCE = "SoilGrids v2.0 (ISRIC), CC BY 4.0"
DEPTHS = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15)]  # promedio ponderado por espesor: 0-30 cm
PROPS = ["clay", "sand", "silt", "soc"]
VAN_BEMMELEN = 1.724  # materia orgánica = carbono orgánico x 1,724 (supuesto clásico)
OM_LOW, OM_HIGH = 1.0, 2.5  # % de materia orgánica: < 1 baja, 1 a 2,5 media, > 2,5 alta (supuesto a validar)
SAMPLE_MAX_DEG = 0.5

USDA_TO_FS = {
    "arenoso": SoilTexture.ARENOSA, "areno franco": SoilTexture.ARENOSA, "franco arenoso": SoilTexture.FRANCO_ARENOSA,
    "franco": SoilTexture.FRANCA, "franco limoso": SoilTexture.FRANCO_LIMOSA, "limoso": SoilTexture.FRANCO_LIMOSA,
    "franco arcillo arenoso": SoilTexture.FRANCO_ARCILLOSA, "franco arcilloso": SoilTexture.FRANCO_ARCILLOSA,
    "franco arcillo limoso": SoilTexture.FRANCO_ARCILLOSA, "arcillo arenoso": SoilTexture.ARCILLOSA,
    "arcillo limoso": SoilTexture.ARCILLOSA, "arcilloso": SoilTexture.ARCILLOSA,
}

Fetcher = Callable[[float, float], dict]


def usda_texture(sand: float, silt: float, clay: float) -> str:
    """Triángulo textural del USDA (NRCS). Porcentajes que suman ~100."""
    if silt + 1.5 * clay < 15:
        return "arenoso"
    if silt + 2 * clay < 30:
        return "areno franco"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "franco arenoso"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "franco"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "franco limoso"
    if silt >= 80 and clay < 12:
        return "limoso"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "franco arcillo arenoso"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "franco arcilloso"
    if 27 <= clay < 40 and sand <= 20:
        return "franco arcillo limoso"
    if clay >= 35 and sand > 45:
        return "arcillo arenoso"
    if clay >= 40 and silt >= 40:
        return "arcillo limoso"
    return "arcilloso"


def om_level(om_pct: float | None) -> Level | None:
    if om_pct is None:
        return None
    return Level.BAJO if om_pct < OM_LOW else Level.MEDIO if om_pct <= OM_HIGH else Level.ALTO


def parse_soilgrids(raw: dict) -> dict[str, float | None]:
    """Respuesta de /properties/query -> % de arcilla, arena y limo, y carbono orgánico en g/kg (0-30 cm)."""
    out: dict[str, float | None] = {}
    layers = {layer["name"]: layer for layer in raw.get("properties", {}).get("layers", [])}
    for prop in PROPS:
        layer = layers.get(prop)
        if not layer:
            out[prop] = None
            continue
        d = layer.get("unit_measure", {}).get("d_factor", 10) or 10
        by_depth = {x["label"]: (x.get("values") or {}).get("mean") for x in layer.get("depths", [])}
        vals = [(by_depth.get(lbl), w) for lbl, w in DEPTHS]
        if any(v is None for v, _ in vals):
            out[prop] = None  # agua, zona urbana o sin dato
            continue
        out[prop] = sum(v / d * w for v, w in vals) / sum(w for _, w in vals)
    return out  # clay/sand/silt en %, soc en g/kg


def http_fetcher(timeout_s: float = 20.0, transport=None) -> Fetcher:
    def fetch(lat: float, lon: float) -> dict:
        import httpx

        params = [("lon", round(lon, 5)), ("lat", round(lat, 5)), ("value", "mean")]
        params += [("property", p) for p in PROPS] + [("depth", d) for d, _ in DEPTHS]
        try:
            with httpx.Client(timeout=timeout_s, transport=transport) as c:
                r = c.get(URL, params=params)
        except httpx.HTTPError as exc:
            raise UpstreamError(f"SoilGrids no respondió ({exc.__class__.__name__}).") from None
        if r.status_code >= 400:
            raise UpstreamError(f"SoilGrids respondió {r.status_code}.")
        return r.json()

    return fetch


def build_estimate(values: dict, origin: DataStatus, source: str, retrieved_at: datetime | None, note: str) -> SoilEstimate:
    clay, sand, silt, soc = (values.get(k) for k in ("clay", "sand", "silt", "soc"))
    usda = usda_texture(sand, silt, clay) if None not in (clay, sand, silt) else None
    om = round(soc / 10 * VAN_BEMMELEN, 2) if soc is not None else None  # g/kg -> % de C -> % de MO
    return SoilEstimate(
        source=source, resolution="250 m", depth="0-30 cm", origin=origin, origin_label=origin.origin_label,
        retrieved_at=retrieved_at, clay_pct=None if clay is None else round(clay, 1), sand_pct=None if sand is None else round(sand, 1),
        silt_pct=None if silt is None else round(silt, 1), texture_usda=usda, texture=USDA_TO_FS.get(usda) if usda else None,
        organic_matter_pct=om, organic_matter=om_level(om), note=note,
    )


#: Aviso cuando SoilGrids no tiene suelo en el punto (agua, zona urbana o roca).
NO_SOIL = "SoilGrids no tiene datos de suelo en este punto (agua, zona urbana o roca): se deja vacío."

NOTE = ("Suelo ESTIMADO con un mapa global de 250 m: puede no coincidir con tu lote. Si tenés análisis de laboratorio o "
        "conocés tu suelo, cargalo: siempre tiene prioridad.")


class SoilProvider:
    def __init__(self, cache_dir: Path, sample_file: Path | None, fetcher: Fetcher | None = None,
                 cooldown: Cooldown | None = None, now: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> None:
        self.cache_dir = cache_dir
        self.sample_file = sample_file
        self.fetcher = fetcher
        self.cooldown = cooldown
        self.now = now

    def _path(self, lat: float, lon: float) -> Path:
        return self.cache_dir / f"soilgrids_{hashlib.sha256(f'{lat:.4f}|{lon:.4f}'.encode()).hexdigest()[:16]}.json"

    def estimate(self, lat: float, lon: float) -> tuple[SoilEstimate | None, list[str]]:
        path = self._path(lat, lon)
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if cached.get("empty"):  # ya se sabe que acá no hay suelo: no se vuelve a preguntar (SoilGrids tarda)
                return None, [NO_SOIL]
            return build_estimate(cached["values"], DataStatus.CACHED, SOURCE, datetime.fromisoformat(cached["at"]), NOTE), []
        except (OSError, json.JSONDecodeError, KeyError):
            pass
        reason = None
        if self.fetcher is None:
            reason = "SoilGrids no está configurado"
        elif self.cooldown and self.cooldown.active(self.now()):
            reason = "SoilGrids falló hace poco; se vuelve a probar después"
        else:
            try:
                values = parse_soilgrids(self.fetcher(lat, lon))
                if self.cooldown:
                    self.cooldown.reset()
                empty = all(values.get(k) is None for k in PROPS)
                try:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    path.write_text(json.dumps({"values": values, "at": self.now().isoformat(), "empty": empty}), encoding="utf-8")
                except OSError as exc:
                    logger.warning("No se pudo guardar el suelo en caché: %s", exc)
                if empty:
                    return None, [NO_SOIL]
                return build_estimate(values, DataStatus.LIVE, SOURCE, self.now(), NOTE), []
            except UpstreamError as exc:
                reason = exc.message
                if self.cooldown:
                    self.cooldown.fail(self.now())

        site = self._sample(lat, lon)
        if site:
            est = build_estimate(site, DataStatus.SAMPLE, "MUESTRA SIMULADA (formato de SoilGrids)", None,
                                 "DATO DE MUESTRA: no es una estimación real de tu lote. " + NOTE)
            return est, [f"Suelo: {reason}.", f"Se usa un suelo de MUESTRA SIMULADA del sitio '{site['site_id']}'."]
        return None, [f"Suelo: {reason}. No se estimó el suelo: cargalo vos o pedí un análisis."]

    def _sample(self, lat: float, lon: float) -> dict | None:
        if not self.sample_file or not self.sample_file.exists():
            return None
        sites = json.loads(self.sample_file.read_text(encoding="utf-8"))["sites"]
        best = min(sites, key=lambda s: (s["lat"] - lat) ** 2 + (s["lon"] - lon) ** 2)
        return best if math.hypot(best["lat"] - lat, best["lon"] - lon) <= SAMPLE_MAX_DEG else None
