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


@pytest.fixture
def client(repo, offline_power):
    """Cliente de la API con repositorio nuevo y POWER sin red, por test."""
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from app.api.deps import get_power_service, get_repository
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_power_service] = lambda: offline_power
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
