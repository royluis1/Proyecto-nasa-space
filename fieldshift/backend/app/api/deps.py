from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.config import get_settings
from app.services.engine.service import RotationService
from app.services.power.cache import PowerCache
from app.services.power.sample import SampleProvider
from app.services.power.service import PowerService
from app.services.repository import Repository
from app.services.satellite.provider import SatelliteProvider
from app.services.satellite.service import SatelliteService


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


@lru_cache
def get_satellite_provider() -> SatelliteProvider:
    s = get_settings()
    factory = None
    if s.appeears_token or (s.appeears_username and s.appeears_password):
        from app.services.satellite.appeears import AppEEARSClient

        def factory() -> AppEEARSClient:
            return AppEEARSClient(
                s.appeears_base_url,
                token=s.appeears_token.get_secret_value() if s.appeears_token else None,
                username=s.appeears_username,
                password=s.appeears_password.get_secret_value() if s.appeears_password else None,
                timeout_s=s.request_timeout_s,
            )

    samples = {
        **{k: s.nasa_samples_dir / s.smap_sample_file for k in ("SPL4SMGP_rootzone", "SPL4SMGP_surface")},
        **{k: s.nasa_samples_dir / s.ndvi_sample_file for k in ("MOD13Q1",)},
    }
    return SatelliteProvider(s.cache_dir / "appeears", samples, factory)


def get_satellite_service(
    repo: Repository = Depends(get_repository), provider: SatelliteProvider = Depends(get_satellite_provider)
) -> SatelliteService:
    return SatelliteService(repo, provider)


def get_rotation_service(
    repo: Repository = Depends(get_repository),
    power: PowerService = Depends(get_power_service),
    satellite: SatelliteService = Depends(get_satellite_service),
) -> RotationService:
    return RotationService(repo, power, get_settings().power_base_url, satellite)
