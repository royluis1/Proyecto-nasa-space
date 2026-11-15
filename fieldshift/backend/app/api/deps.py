from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.config import get_settings
from app.services.engine.service import RotationService
from app.services.power.cache import PowerCache
from app.services.power.sample import SampleProvider
from app.services.earthdata.session import credentials_from_settings
from app.services.early_warning import EarlyWarningService
from app.services.regions.repository import RegionRepository
from app.services.soil.soilgrids import SoilProvider
from app.services.soil.soilgrids import http_fetcher as soilgrids_fetcher
from app.services.forecast.open_meteo import ForecastService, http_fetcher
from app.services.power.file_source import PowerFileProvider
from app.services.power.service import Cooldown, PowerService
from app.services.terrain.service import TerrainProvider
from app.services.localities import LocalityIndex, load_index
from app.services.repository import Repository
from app.services.satellite.provider import SatelliteProvider
from app.services.satellite.service import SatelliteService


@lru_cache
def _repository_for(data_dir: Path) -> Repository:
    return Repository(data_dir)


def get_repository() -> Repository:
    return _repository_for(get_settings().data_dir)


@lru_cache
@lru_cache
def _power_cooldown(seconds: float) -> Cooldown:
    return Cooldown(seconds)  # una por proceso: se comparte entre pedidos


def get_power_service() -> PowerService:
    from app.services.power.client import PowerClient  # importa httpx solo al usarse

    s = get_settings()
    client = PowerClient(s.power_base_url, s.request_timeout_s, s.max_retries, s.retry_backoff_s)
    return PowerService(
        fetcher=client.fetch,
        cache=PowerCache(s.cache_dir, s.cache_ttl_hours),
        samples=SampleProvider(s.nasa_samples_dir / s.power_sample_file),
        cooldown=_power_cooldown(s.power_cooldown_s),
        files=_power_files(tuple(s.power_fallback_files), s.nasa_samples_dir),
    )


@lru_cache
def _power_files(names: tuple[str, ...], folder) -> PowerFileProvider:
    return PowerFileProvider([folder / n for n in names])  # se lee una vez por proceso


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
        "SPL3SMP_E": s.nasa_samples_dir / "smap_l3_sample_san_luis.csv",
        "HLSL30_VI": s.nasa_samples_dir / "hls_sectors_sample_san_luis.csv",
        "ECO_L2T_LSTE": s.nasa_samples_dir / "ecostress_sample_san_luis.csv",
        "ECO_L4T_ESI": s.nasa_samples_dir / "ecostress_sample_san_luis.csv",
    }
    return SatelliteProvider(s.cache_dir / "appeears", samples, factory)


def get_satellite_service(
    repo: Repository = Depends(get_repository), provider: SatelliteProvider = Depends(get_satellite_provider)
) -> SatelliteService:
    return SatelliteService(repo, provider)


@lru_cache
def get_terrain_provider() -> TerrainProvider:
    s = get_settings()
    creds = credentials_from_settings(s)
    factory = None
    if creds.configured:
        from app.services.earthdata.session import EarthdataSession

        def factory() -> EarthdataSession:
            return EarthdataSession(creds, timeout_s=max(60.0, s.request_timeout_s))

    return TerrainProvider(
        s.cache_dir / "srtm", s.nasa_samples_dir / s.srtm_sample_file, factory, s.srtm_product, Cooldown(s.power_cooldown_s)
    )


def get_rotation_service(
    repo: Repository = Depends(get_repository),
    power: PowerService = Depends(get_power_service),
    satellite: SatelliteService = Depends(get_satellite_service),
    terrain: TerrainProvider = Depends(get_terrain_provider),
) -> RotationService:
    return RotationService(repo, power, get_settings().power_base_url, satellite, terrain)


@lru_cache
def get_forecast_service() -> ForecastService:
    s = get_settings()
    key = s.open_meteo_api_key.get_secret_value() if s.open_meteo_api_key else None
    fetcher = http_fetcher(s.open_meteo_url, key, s.request_timeout_s) if s.open_meteo_enabled else None
    return ForecastService(fetcher, Cooldown(s.power_cooldown_s))  # una por proceso: guarda el pronóstico 3 h


def get_early_warning_service(
    repo: Repository = Depends(get_repository),
    power: PowerService = Depends(get_power_service),
    forecast: ForecastService = Depends(get_forecast_service),
    satellite: SatelliteService = Depends(get_satellite_service),
) -> EarlyWarningService:
    return EarlyWarningService(repo, power, forecast, satellite)


@lru_cache
def get_soil_provider() -> SoilProvider:
    s = get_settings()
    fetcher = soilgrids_fetcher(s.soilgrids_timeout_s) if s.soilgrids_enabled else None
    return SoilProvider(s.cache_dir / "soil", s.nasa_samples_dir / s.soil_sample_file, fetcher, Cooldown(s.soilgrids_cooldown_s))


_REGIONS: dict[tuple, RegionRepository] = {}


def get_region_repository(repo: Repository = Depends(get_repository)) -> RegionRepository:
    """Una por carpeta de datos y catálogo: los GeoJSON se leen una sola vez."""
    key = (get_settings().nasa_samples_dir, id(repo.crops))
    if key not in _REGIONS:
        _REGIONS[key] = RegionRepository(get_settings().nasa_samples_dir, repo.crops)
    return _REGIONS[key]


def get_locality_index() -> LocalityIndex:
    """Ciudades y pueblos del IGN. Se leen una sola vez por archivo."""
    return load_index(get_settings().nasa_samples_dir / get_settings().localities_file)
