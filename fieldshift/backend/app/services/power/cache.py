"""Caché de respuestas crudas de POWER: memoria + disco (JSON).

Vencimiento:
- Pedidos cuyo fin es anterior a hoy - 30 días: no vencen (los datos históricos no cambian).
- Pedidos recientes: vencen a las `ttl_hours`.
Una entrada vencida no se borra: sirve de respaldo si POWER no responde.
"""

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger("fieldshift.cache")

PARSER_VERSION = 1
HISTORICAL_LAG_DAYS = 30
KEY_DECIMALS = 2  # ~1 km: más fino que la grilla de POWER (~50 km)


@dataclass
class CacheEntry:
    raw: dict
    fetched_at: datetime
    end: date

    def is_fresh(self, now: datetime, ttl_hours: int) -> bool:
        if self.end <= now.date() - timedelta(days=HISTORICAL_LAG_DAYS):
            return True
        return now - self.fetched_at < timedelta(hours=ttl_hours)


def make_key(lat: float, lon: float, params: list[str], start: date, end: date, community: str) -> str:
    payload = {
        "lat": round(lat, KEY_DECIMALS),
        "lon": round(lon, KEY_DECIMALS),
        "params": sorted(params),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "community": community,
        "v": PARSER_VERSION,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]


class PowerCache:
    def __init__(self, directory: Path, ttl_hours: int) -> None:
        self.dir = directory
        self.ttl_hours = ttl_hours
        self._memory: dict[str, CacheEntry] = {}

    def _path(self, key: str) -> Path:
        return self.dir / f"power_{key}.json"

    def get(self, key: str) -> CacheEntry | None:
        if key in self._memory:
            return self._memory[key]
        path = self._path(key)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            entry = CacheEntry(
                raw=data["raw"],
                fetched_at=datetime.fromisoformat(data["fetched_at"]),
                end=date.fromisoformat(data["end"]),
            )
        except (OSError, ValueError, KeyError) as exc:
            logger.warning("caché ilegible, se ignora: %s (%s)", path.name, exc)
            return None
        self._memory[key] = entry
        return entry

    def put(self, key: str, raw: dict, end: date, fetched_at: datetime | None = None) -> CacheEntry:
        entry = CacheEntry(raw=raw, fetched_at=fetched_at or datetime.now(timezone.utc), end=end)
        self._memory[key] = entry
        try:
            self.dir.mkdir(parents=True, exist_ok=True)
            tmp = self._path(key).with_suffix(".tmp")
            tmp.write_text(
                json.dumps({"raw": raw, "fetched_at": entry.fetched_at.isoformat(), "end": end.isoformat()}),
                encoding="utf-8",
            )
            os.replace(tmp, self._path(key))  # escritura atómica
        except OSError as exc:
            logger.warning("no se pudo escribir la caché en disco: %s", exc)
        return entry
