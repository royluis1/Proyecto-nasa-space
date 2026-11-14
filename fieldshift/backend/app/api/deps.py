from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.services.power.cache import PowerCache
from app.services.power.sample import SampleProvider
from app.services.power.service import PowerService
from app.services.repository import Repository


@lru_cache
def _repository_for(data_dir: Path) -> Repository:
    return Repository(data_dir)


def get_repository() -> Repository:
    return _repository_for(get_settings().data_dir)


@lru_cache
def get_power_service() -> PowerService:
    from app.services.power.client import PowerClient  # importa httpx solo al usarse

    s = get_settings()
    client = PowerClient(s.power_base_url, s.request_timeout_s, s.max_retries, s.retry_backoff_s)
    return PowerService(
        fetcher=client.fetch,
        cache=PowerCache(s.cache_dir, s.cache_ttl_hours),
        samples=SampleProvider(s.nasa_samples_dir / s.power_sample_file),
    )
