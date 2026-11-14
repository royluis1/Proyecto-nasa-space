"""Configuración de FieldShift, leída de variables de entorno (prefijo FIELDSHIFT_) o de .env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FIELDSHIFT_",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,  # variables vacías en .env = usar el valor por defecto
        extra="ignore",
    )

    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"
    app_version: str = "0.1.0"

    power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    power_community: str = "AG"

    request_timeout_s: float = Field(default=30.0, gt=0, le=120)
    max_retries: int = Field(default=3, ge=0, le=10)

    cache_ttl_hours: int = Field(default=24, ge=0)
    cache_dir: Path = Path("./cache")
    sample_data_dir: Path | None = None

    cors_origins: list[str] = ["http://localhost:3000"]

    earthdata_token: SecretStr | None = None
    llm_enabled: bool = False
    llm_api_key: SecretStr | None = None

    @property
    def data_dir(self) -> Path:
        """Carpeta de datos de muestra; por defecto, app/data."""
        return self.sample_data_dir or APP_DIR / "data"


@lru_cache
def get_settings() -> Settings:
    return Settings()
