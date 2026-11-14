from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.services.repository import Repository


@lru_cache
def _repository_for(data_dir: Path) -> Repository:
    return Repository(data_dir)


def get_repository() -> Repository:
    return _repository_for(get_settings().data_dir)
