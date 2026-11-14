"""Cliente HTTP de NASA POWER con timeout y reintentos con backoff exponencial."""

import logging
import random
import time
from collections.abc import Callable
from datetime import date

import httpx

from app.utils.exceptions import UpstreamError

logger = logging.getLogger("fieldshift.power")

RETRY_STATUS = {429, 500, 502, 503, 504}


class PowerClient:
    def __init__(
        self,
        base_url: str,
        timeout_s: float,
        max_retries: int,
        backoff_s: float,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = base_url
        self.max_retries = max_retries
        self.backoff_s = backoff_s
        self._sleep = sleep
        self._http = httpx.Client(timeout=httpx.Timeout(timeout_s, connect=min(10.0, timeout_s)), transport=transport)

    @staticmethod
    def build_params(lat: float, lon: float, start: date, end: date, params: list[str], community: str) -> dict:
        return {
            "parameters": ",".join(params),
            "community": community,
            "latitude": lat,
            "longitude": lon,
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        }

    def _wait(self, attempt: int) -> None:
        delay = self.backoff_s * (2**attempt) + random.uniform(0, self.backoff_s)
        self._sleep(delay)

    def fetch(self, lat: float, lon: float, start: date, end: date, params: list[str], community: str) -> dict:
        query = self.build_params(lat, lon, start, end, params, community)
        last_error = "sin respuesta"
        for attempt in range(self.max_retries + 1):
            try:
                resp = self._http.get(self.base_url, params=query)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = f"{type(exc).__name__}"
                logger.warning("POWER falló (intento %d): %s", attempt + 1, last_error)
            else:
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except ValueError:
                        raise UpstreamError("NASA POWER devolvió una respuesta que no es JSON.") from None
                if resp.status_code not in RETRY_STATUS:
                    raise UpstreamError(
                        f"NASA POWER rechazó el pedido (HTTP {resp.status_code}).", {"respuesta": resp.text[:500]}
                    )
                last_error = f"HTTP {resp.status_code}"
                logger.warning("POWER respondió %s (intento %d)", resp.status_code, attempt + 1)
            if attempt < self.max_retries:
                self._wait(attempt)
        raise UpstreamError(f"NASA POWER no respondió tras {self.max_retries + 1} intentos ({last_error}).")
