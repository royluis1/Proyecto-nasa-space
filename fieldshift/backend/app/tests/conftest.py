from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@pytest.fixture
def repo():
    from app.services.repository import Repository

    return Repository(DATA_DIR)


SAMPLE_CSV = Path(__file__).resolve().parents[3] / "data" / "samples" / "power_sample_san_luis.csv"


@pytest.fixture
def offline_power(tmp_path):
    """Servicio POWER sin red: el fetcher siempre falla, así se usa la muestra."""
    from app.services.power.cache import PowerCache
    from app.services.power.sample import SampleProvider
    from app.services.power.service import PowerService
    from app.utils.exceptions import UpstreamError

    def failing(*_):
        raise UpstreamError("sin red (test)")

    return PowerService(failing, PowerCache(tmp_path, 24), SampleProvider(SAMPLE_CSV))


SAMPLES_DIR = SAMPLE_CSV.parent


@pytest.fixture
def satellite_provider(tmp_path):
    """Proveedor satelital sin credenciales, con caché en un directorio temporal y las muestras del repo."""
    from app.services.satellite.provider import SatelliteProvider

    return SatelliteProvider(
        tmp_path / "appeears",
        {
            "SPL4SMGP_rootzone": SAMPLES_DIR / "smap_sample_san_luis.csv",
            "SPL4SMGP_surface": SAMPLES_DIR / "smap_sample_san_luis.csv",
            "SPL3SMP_E": SAMPLES_DIR / "smap_l3_sample_san_luis.csv",
            "MOD13Q1": SAMPLES_DIR / "ndvi_sample_san_luis.csv",
        },
    )


@pytest.fixture
def satellite_service(repo, satellite_provider):
    from app.services.satellite.service import SatelliteService

    return SatelliteService(repo, satellite_provider)


@pytest.fixture
def terrain_provider(tmp_path):
    """Relieve sin credenciales de Earthdata: usa la muestra del repo."""
    from app.services.terrain.service import TerrainProvider

    return TerrainProvider(tmp_path / "srtm", SAMPLES_DIR / "srtm_sample_san_luis.json")


@pytest.fixture
def forecast_service():
    """Pronóstico sin red: Open-Meteo no configurado (los tests que lo necesitan usan uno simulado)."""
    from app.services.forecast.open_meteo import ForecastService

    return ForecastService(None)


@pytest.fixture
def soil_provider(tmp_path):
    """Suelo sin red: SoilGrids no configurado, usa la muestra rotulada del repo."""
    from app.services.soil.soilgrids import SoilProvider

    return SoilProvider(tmp_path / "soil", SAMPLES_DIR / "soil_sample_san_luis.json")


@pytest.fixture
def client(repo, offline_power, satellite_provider, terrain_provider, forecast_service, soil_provider):
    """Cliente de la API con repositorio nuevo y POWER sin red, por test."""
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from app.api.deps import (
        get_forecast_service,
        get_power_service,
        get_repository,
        get_satellite_provider,
        get_soil_provider,
        get_terrain_provider,
    )
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_power_service] = lambda: offline_power
    app.dependency_overrides[get_satellite_provider] = lambda: satellite_provider
    app.dependency_overrides[get_terrain_provider] = lambda: terrain_provider
    app.dependency_overrides[get_forecast_service] = lambda: forecast_service
    app.dependency_overrides[get_soil_provider] = lambda: soil_provider
    return TestClient(app)


@pytest.fixture
def rotation_service(repo, offline_power):
    from app.services.engine.service import RotationService

    return RotationService(repo, offline_power, "https://power.larc.nasa.gov/api/temporal/daily/point")


@pytest.fixture
def crops(repo):
    return repo.crops


@pytest.fixture
def climate():
    """Clima sintético tipo este de San Luis: ~700 mm de lluvia concentrada en verano, ET0 ~1380 mm."""
    from app.tests.helpers import make_climate

    return make_climate()
