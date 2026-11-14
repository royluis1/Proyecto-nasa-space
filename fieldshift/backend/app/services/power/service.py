"""Orquestación de NASA POWER con fallback.

Orden: caché vigente -> POWER en vivo -> caché vencida -> muestra simulada -> error 503.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

import pandas as pd

from app.models.enums import DataStatus
from app.services.power.cache import PowerCache, make_key
from app.services.power.parser import parse_power_json
from app.services.power.sample import SampleProvider
from app.services.power.units import normalize_units
from app.utils.exceptions import NoDataError, UpstreamError

logger = logging.getLogger("fieldshift.power")

# Siempre se piden: sin ellos no hay resumen ni ET0.
CORE_PARAMETERS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR"]
DEFAULT_PARAMETERS = [*CORE_PARAMETERS, "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PS"]

Fetcher = Callable[[float, float, date, date, list[str], str], dict]


@dataclass
class ClimateData:
    df: pd.DataFrame
    units: dict[str, str]
    longnames: dict[str, str]
    missing: dict[str, int]
    status: DataStatus
    retrieved_at: datetime
    elevation_m: float | None = None
    sample_site: str | None = None
    warnings: list[str] = field(default_factory=list)


def resolve_parameters(requested: list[str] | None) -> list[str]:
    params = list(DEFAULT_PARAMETERS if not requested else requested)
    for p in reversed(CORE_PARAMETERS):
        if p not in params:
            params.insert(0, p)
    return list(dict.fromkeys(params))


class Cooldown:
    """Después de una falla de NASA POWER, no reintentar en vivo durante un rato.

    Sin esto, cada pedido espera todos los reintentos (varios segundos) antes de usar la caché o la muestra.
    Se comparte entre pedidos (una instancia por proceso).
    """

    def __init__(self, seconds: float) -> None:
        self.seconds = seconds
        self.failed_at: datetime | None = None

    def active(self, now: datetime) -> bool:
        return self.failed_at is not None and (now - self.failed_at).total_seconds() < self.seconds

    def fail(self, now: datetime) -> None:
        self.failed_at = now

    def reset(self) -> None:
        self.failed_at = None


class PowerService:
    def __init__(
        self,
        fetcher: Fetcher,
        cache: PowerCache,
        samples: SampleProvider,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        cooldown: Cooldown | None = None,
    ) -> None:
        self.fetcher = fetcher
        self.cache = cache
        self.samples = samples
        self.now = now
        self.cooldown = cooldown

    def get_daily(
        self, lat: float, lon: float, start: date, end: date, params: list[str], community: str = "AG"
    ) -> ClimateData:
        key = make_key(lat, lon, params, start, end, community)
        entry = self.cache.get(key)

        if entry and entry.is_fresh(self.now(), self.cache.ttl_hours):
            return self._from_raw(entry.raw, params, DataStatus.CACHED, entry.fetched_at, [])

        if self.cooldown and self.cooldown.active(self.now()):
            reason = f"falló hace menos de {self.cooldown.seconds / 60:.0f} min; se vuelve a probar después"
        else:
            try:
                raw = self.fetcher(lat, lon, start, end, params, community)
                result = self._from_raw(raw, params, DataStatus.LIVE, self.now(), [])
                self.cache.put(key, raw, end, result.retrieved_at)  # se guarda solo si se pudo parsear
                if self.cooldown:
                    self.cooldown.reset()
                return result
            except UpstreamError as exc:
                logger.warning("POWER no disponible: %s", exc.message)
                reason = exc.message
                if self.cooldown:
                    self.cooldown.fail(self.now())

        if entry:
            return self._from_raw(
                entry.raw, params, DataStatus.CACHED, entry.fetched_at,
                [f"NASA POWER no respondió ({reason}). Se usan datos cacheados del {entry.fetched_at:%Y-%m-%d}."],
            )

        sample = self.samples.get(lat, lon, start, end, params)
        if sample:
            warnings = [
                f"NASA POWER no respondió ({reason}).",
                f"Se usan DATOS DE MUESTRA SIMULADOS del sitio '{sample.site_id}' "
                f"({sample.site_lat}, {sample.site_lon}); no son observaciones de tus coordenadas.",
            ]
            if sample.df.index.min() > pd.Timestamp(start) or sample.df.index.max() < pd.Timestamp(end):
                warnings.append(
                    f"La muestra solo cubre {sample.df.index.min():%Y-%m-%d} a {sample.df.index.max():%Y-%m-%d}."
                )
            return ClimateData(
                df=sample.df,
                units=self.samples.units(params),
                longnames={p: p for p in params},
                missing={p: int(sample.df[p].isna().sum()) for p in params},
                status=DataStatus.SAMPLE,
                retrieved_at=self.now(),
                sample_site=sample.site_id,
                warnings=warnings,
            )

        raise NoDataError(
            "No hay datos climáticos: NASA POWER no respondió y no hay caché ni muestra para esta ubicación.",
            {"motivo": reason},
        )

    @staticmethod
    def _from_raw(raw: dict, params: list[str], status: DataStatus, at: datetime, warnings: list[str]) -> ClimateData:
        parsed = parse_power_json(raw, params)
        df, units, unit_warnings = normalize_units(parsed.df, parsed.units)
        return ClimateData(
            df=df[params],
            units={p: units[p] for p in params},
            longnames={p: parsed.longnames.get(p, p) for p in params},
            missing={p: parsed.missing.get(p, 0) for p in params},
            status=status,
            retrieved_at=at,
            elevation_m=parsed.elevation_m,
            warnings=[*warnings, *parsed.warnings, *unit_warnings],
        )
