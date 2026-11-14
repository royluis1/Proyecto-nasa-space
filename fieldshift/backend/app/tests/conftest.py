from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@pytest.fixture
def repo():
    from app.services.repository import Repository

    return Repository(DATA_DIR)


@pytest.fixture
def client(repo):
    """Cliente de la API con un repositorio nuevo por test (sin estado compartido)."""
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from app.api.deps import get_repository
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repo
    return TestClient(app)
