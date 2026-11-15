"""Modo estricto (FIELDSHIFT_STRICT_NASA): con una API de la NASA caída NO se devuelven muestras simuladas."""

from datetime import date
from pathlib import Path

import pytest

from app.models.enums import DataStatus
from app.services.power.cache import PowerCache
from app.services.power.sample import SampleProvider
from app.services.power.service import PowerService
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteProvider
from app.services.terrain.service import TerrainProvider
from app.utils.exceptions import NoDataError

SAMPLES = Path(__file__).resolve().parents[3] / "data" / "samples"
LAT, LON = -33.3, -66.3  # San Luis, cerca de los sitios de muestra
START, END = date(2020, 1, 1), date(2020, 1, 31)
PARAMS = ["T2M", "PRECTOTCORR"]


def _failing(*_):
    from app.utils.exceptions import UpstreamError

    raise UpstreamError("sin red (test)")


def _power(tmp_path, strict):
    return PowerService(_failing, PowerCache(tmp_path, 24), SampleProvider(SAMPLES / "power_sample_san_luis.csv"), strict=strict)


def test_power_no_estricto_usa_muestra(tmp_path):
    data = _power(tmp_path, strict=False).get_daily(LAT, LON, START, END, PARAMS)
    assert data.status == DataStatus.SAMPLE  # sin estricto, cae a la muestra simulada


def test_power_estricto_no_usa_muestra(tmp_path):
    with pytest.raises(NoDataError) as exc:
        _power(tmp_path, strict=True).get_daily(LAT, LON, START, END, PARAMS)
    assert "estricto" in str(exc.value).lower()


def test_terreno_estricto_no_usa_muestra(tmp_path):
    # Sin credenciales de Earthdata (session_factory=None) y en estricto: no hay muestra de relieve.
    terrain = TerrainProvider(tmp_path / "srtm", SAMPLES / "srtm_sample_san_luis.json", None, strict=True)
    with pytest.raises(NoDataError):
        terrain.get(LAT, LON, 300.0)
    # Sin estricto sí devuelve la muestra simulada.
    ok = TerrainProvider(tmp_path / "srtm2", SAMPLES / "srtm_sample_san_luis.json", None, strict=False)
    summary, _ = ok.get(LAT, LON, 300.0)
    assert summary.origin == DataStatus.SAMPLE


def test_satelite_estricto_no_usa_muestra(tmp_path):
    samples = {"SPL4SMGP_rootzone": SAMPLES / "smap_sample_san_luis.csv"}
    product = PRODUCTS["SPL4SMGP_rootzone"]
    strict = SatelliteProvider(tmp_path / "a", samples, None, strict=True)
    with pytest.raises(NoDataError):
        strict.get(product, LAT, LON, START, END)
    lax = SatelliteProvider(tmp_path / "b", samples, None, strict=False)
    assert lax.get(product, LAT, LON, START, END).status == DataStatus.SAMPLE
