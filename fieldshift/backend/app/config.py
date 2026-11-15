"""Configuración de AgroOrbit, leída de variables de entorno (prefijo FIELDSHIFT_) o de .env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parents[1]


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
    retry_backoff_s: float = Field(default=1.0, ge=0, le=30, description="Base del backoff exponencial.")

    cache_ttl_hours: int = Field(default=24, ge=0)
    power_cooldown_s: float = Field(default=300, ge=0, le=3600, description="Tras una falla de POWER, segundos sin reintentar en vivo.")
    cache_dir: Path = REPO_ROOT / "data" / "cache"
    sample_data_dir: Path | None = None
    nasa_samples_dir: Path = REPO_ROOT / "data" / "samples"
    power_sample_file: str = "power_sample_san_luis.csv"
    # CSV reales descargados de NASA POWER: respaldo si la API no responde (antes de la muestra simulada)
    power_fallback_files: list[str] = ["power_campo1.csv"]

    cors_origins: list[str] = ["http://localhost:3000"]

    # Ciudades y pueblos de Argentina (IGN/BAHRA): ver scripts/build_localities.py
    localities_file: str = "localidades_ar.json"
    smap_sample_file: str = "smap_sample_san_luis.csv"
    ndvi_sample_file: str = "ndvi_sample_san_luis.csv"

    # AppEEARS (NASA LP DAAC). Con token o con usuario y contraseña de Earthdata se piden extracciones en vivo.
    appeears_base_url: str = "https://appeears.earthdatacloud.nasa.gov/api"
    appeears_token: SecretStr | None = None
    appeears_username: str | None = None
    appeears_password: SecretStr | None = None

    # Earthdata Login (SRTM y otros archivos protegidos). Si faltan, se usan los de AppEEARS (misma cuenta).
    earthdata_token: SecretStr | None = None
    earthdata_username: str | None = None
    earthdata_password: SecretStr | None = None
    # Pronóstico (Open-Meteo, no es NASA). Gratis sin clave para uso no comercial; con plan comercial:
    # FIELDSHIFT_OPEN_METEO_URL=https://customer-api.open-meteo.com/v1/forecast y FIELDSHIFT_OPEN_METEO_API_KEY.
    open_meteo_enabled: bool = True
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_api_key: SecretStr | None = None
    # Suelo estimado (SoilGrids de ISRIC). Sin red: muestra simulada rotulada; si no hay, queda vacío con aviso.
    soilgrids_enabled: bool = True
    soil_sample_file: str = "soil_sample_san_luis.json"
    srtm_product: Literal["SRTMGL1", "SRTMGL3"] = "SRTMGL1"
    srtm_sample_file: str = "srtm_sample_san_luis.json"
    llm_enabled: bool = False
    llm_api_key: SecretStr | None = None

    @property
    def data_dir(self) -> Path:
        """Carpeta de datos de muestra; por defecto, app/data."""
        return self.sample_data_dir or APP_DIR / "data"


@lru_cache
def get_settings() -> Settings:
    return Settings()
