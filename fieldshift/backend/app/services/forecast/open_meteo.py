"""Pronóstico diario de Open-Meteo (https://open-meteo.com).

No es un producto de la NASA: se usa solo para la lluvia y temperaturas FUTURAS y se aclara en pantalla.
API gratuita sin clave para uso no comercial; para un cliente comercial, Open-Meteo pide un plan con
clave (FIELDSHIFT_OPEN_METEO_API_KEY y la URL customer-api.open-meteo.com).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from app.schemas.forecast import Forecast, ForecastDay, SourceInfo
from app.services.power.service import Cooldown
from app.utils.exceptions import NoDataError, UpstreamError

logger = logging.getLogger("fieldshift.forecast")

DAILY = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "et0_fao_evapotranspiration",
    "wind_speed_10m_max",
]
SOURCE_NAME = "Open-Meteo (pronóstico; no es un dato de la NASA)"

Fetcher = Callable[[float, float, int], dict]


def http_fetcher(base_url: str, api_key: str | None, timeout_s: float, transport=None) -> Fetcher:
    def fetch(lat: float, lon: float, days: int) -> dict:
        import httpx

        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "daily": ",".join(DAILY),
            "timezone": "auto",
            "forecast_days": days,
        }
        if api_key:
            params["apikey"] = api_key
        try:
            with httpx.Client(timeout=timeout_s, transport=transport) as c:
                r = c.get(base_url, params=params)
        except httpx.HTTPError as exc:
            raise UpstreamError(f"Open-Meteo no respondió ({exc.__class__.__name__}).") from None
        if r.status_code >= 400:
            reason = ""
            try:
                reason = f": {r.json().get('reason', '')}"
            except ValueError:
                pass
            raise UpstreamError(f"Open-Meteo respondió {r.status_code}{reason}.")
        return r.json()

    return fetch


def parse(raw: dict, retrieved_at: datetime) -> Forecast:
    daily = raw.get("daily") or {}
    times = daily.get("time") or []
    if not times:
        raise UpstreamError("Open-Meteo devolvió una respuesta sin datos diarios.")

    def col(name: str) -> list:
        values = daily.get(name) or [None] * len(times)
        return [None if v is None else float(v) for v in values]

    tmax, tmin, rain, prob, et0, wind = (col(n) for n in DAILY)
    days = [
        ForecastDay(date=date.fromisoformat(t), tmax_c=tmax[i], tmin_c=tmin[i], precip_mm=rain[i],
                    precip_probability_pct=prob[i], et0_mm=et0[i], wind_max_kmh=wind[i])
        for i, t in enumerate(times)
    ]
    return Forecast(
        latitude=float(raw.get("latitude", 0)),
        longitude=float(raw.get("longitude", 0)),
        timezone=raw.get("timezone"),
        days=days,
        source=SourceInfo(name=SOURCE_NAME, is_nasa=False, kind="pronóstico", retrieved_at=retrieved_at,
                          detail="Modelos meteorológicos combinados, celdas de 1 a 11 km según la zona."),
    )


class ForecastService:
    """Pronóstico con caché en memoria (3 h) y enfriamiento ante fallas. Sin respaldo inventado: si falla, se avisa."""

    TTL = timedelta(hours=3)

    def __init__(self, fetcher: Fetcher | None, cooldown: Cooldown | None = None,
                 now: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> None:
        self.fetcher = fetcher
        self.cooldown = cooldown
        self.now = now
        self._cache: dict[tuple, tuple[datetime, Forecast]] = {}

    def get(self, lat: float, lon: float, days: int = 10) -> Forecast:
        key = (round(lat, 3), round(lon, 3), days)
        hit = self._cache.get(key)
        if hit and self.now() - hit[0] < self.TTL:
            return hit[1]
        if self.fetcher is None:
            raise NoDataError("Pronóstico no disponible: el servidor no tiene configurado Open-Meteo.")
        if self.cooldown and self.cooldown.active(self.now()):
            raise NoDataError("Pronóstico no disponible por un rato: Open-Meteo falló hace poco.")
        try:
            fc = parse(self.fetcher(lat, lon, days), self.now())
        except UpstreamError as exc:
            if self.cooldown:
                self.cooldown.fail(self.now())
            logger.warning("Open-Meteo no disponible: %s", exc.message)
            raise NoDataError(f"Pronóstico no disponible: {exc.message}") from None
        if self.cooldown:
            self.cooldown.reset()
        self._cache[key] = (self.now(), fc)
        return fc
