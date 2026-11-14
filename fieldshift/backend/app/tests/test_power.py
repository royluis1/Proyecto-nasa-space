"""NASA POWER: parseo, -999, unidades, caché, fallback, ET0 y análisis. No necesitan red ni FastAPI."""

import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

from app.models.enums import DataStatus
from app.schemas.climate import ClimateSummaryRequest
from app.services import climate_analysis as ca
from app.services.et0 import compute_et0
from app.services.power.cache import CacheEntry, PowerCache, make_key
from app.services.power.parser import parse_power_json
from app.services.power.sample import SampleProvider
from app.services.power.service import Cooldown, PowerService, resolve_parameters
from app.services.power.units import normalize_units
from app.tests.fixtures import power_response
from app.utils.exceptions import NoDataError, UpstreamError

SAMPLE_CSV = Path(__file__).resolve().parents[3] / "data" / "samples" / "power_sample_san_luis.csv"
PARAMS = resolve_parameters(None)
NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)


# ---------- validación del request ----------

def test_request_valido_por_coordenadas():
    r = ClimateSummaryRequest(latitude=-33.851234, longitude=-65.2, start_date="2015-01-01", end_date="2025-12-31")
    assert r.latitude == -33.8512 and r.community == "AG"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"latitude": 95, "longitude": 0},
        {"latitude": -33, "longitude": 200},
        {"latitude": -33},  # falta longitud
        {},  # ni coordenadas ni field_id
    ],
)
def test_request_coordenadas_invalidas(kwargs):
    with pytest.raises(ValidationError):
        ClimateSummaryRequest(start_date="2015-01-01", end_date="2016-01-01", **kwargs)


@pytest.mark.parametrize(
    "start,end", [("2020-01-02", "2020-01-01"), ("1975-01-01", "1980-01-01"), ("2020-01-01", "2099-01-01")]
)
def test_request_fechas_invalidas(start, end):
    with pytest.raises(ValidationError):
        ClimateSummaryRequest(latitude=-33, longitude=-65, start_date=start, end_date=end)


def test_request_parametro_desconocido():
    with pytest.raises(ValidationError):
        ClimateSummaryRequest(latitude=-33, longitude=-65, start_date="2020-01-01", end_date="2020-12-31", parameters=["NO_EXISTE"])


def test_parametros_basicos_siempre_incluidos():
    assert resolve_parameters(["RH2M"])[:4] == ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR"]
    assert len(resolve_parameters(None)) == 8


# ---------- parseo y -999 ----------

def test_parseo_basico():
    parsed = parse_power_json(power_response(), PARAMS)
    assert len(parsed.df) == 10
    assert parsed.df.index[0] == pd.Timestamp("2015-01-01")
    assert parsed.units["T2M"] == "C"
    assert parsed.elevation_m == pytest.approx(512.3)


def test_menos_999_es_faltante():
    raw = power_response(fill_at={"PRECTOTCORR": ["20150103", "20150104"], "T2M": ["20150105"]})
    parsed = parse_power_json(raw, PARAMS)
    assert parsed.missing["PRECTOTCORR"] == 2 and parsed.missing["T2M"] == 1
    assert parsed.df["PRECTOTCORR"].isna().sum() == 2
    assert (parsed.df.fillna(0) > -999).all().all()


def test_parametro_ausente_genera_advertencia():
    raw = power_response()
    del raw["properties"]["parameter"]["PS"]
    parsed = parse_power_json(raw, PARAMS)
    assert parsed.df["PS"].isna().all()
    assert any("PS" in w for w in parsed.warnings)


@pytest.mark.parametrize("raw", [{}, {"properties": {}}, {"properties": {"parameter": {}}}, None])
def test_respuesta_malformada(raw):
    with pytest.raises(UpstreamError):
        parse_power_json(raw, PARAMS)


# ---------- unidades ----------

def test_conversion_de_unidades():
    df = pd.DataFrame({"ALLSKY_SFC_SW_DWN": [5.0], "PS": [950.0], "T2M": [293.15]})
    out, units, warnings = normalize_units(df, {"ALLSKY_SFC_SW_DWN": "kW-hr/m^2/day", "PS": "hPa", "T2M": "K"})
    assert out["ALLSKY_SFC_SW_DWN"][0] == pytest.approx(18.0)
    assert out["PS"][0] == pytest.approx(95.0)
    assert out["T2M"][0] == pytest.approx(20.0)
    assert units["PS"] == "kPa" and not warnings


def test_unidad_desconocida_avisa():
    _, _, warnings = normalize_units(pd.DataFrame({"PS": [1.0]}), {"PS": "psi"})
    assert warnings


# ---------- caché ----------

def test_clave_de_cache_redondea_y_ordena():
    a = make_key(-33.851, -65.2001, ["T2M", "PS"], date(2020, 1, 1), date(2020, 12, 31), "AG")
    b = make_key(-33.849, -65.1999, ["PS", "T2M"], date(2020, 1, 1), date(2020, 12, 31), "AG")
    c = make_key(-33.85, -65.2, ["PS", "T2M"], date(2020, 1, 1), date(2021, 12, 31), "AG")
    assert a == b != c


def test_vigencia_de_cache():
    old = NOW - timedelta(days=10)
    assert CacheEntry({}, old, date(2020, 12, 31)).is_fresh(NOW, 24)  # histórico: no vence
    assert not CacheEntry({}, old, date(2026, 11, 10)).is_fresh(NOW, 24)  # reciente y viejo
    assert CacheEntry({}, NOW - timedelta(hours=2), date(2026, 11, 10)).is_fresh(NOW, 24)


def test_cache_persiste_en_disco(tmp_path):
    PowerCache(tmp_path, 24).put("k", {"a": 1}, date(2020, 1, 1), NOW)
    entry = PowerCache(tmp_path, 24).get("k")  # instancia nueva: lee de disco
    assert entry and entry.raw == {"a": 1}


# ---------- servicio y fallback ----------

class FakeFetcher:
    def __init__(self, raw=None, error=None):
        self.raw, self.error, self.calls = raw, error, 0

    def __call__(self, *args):
        self.calls += 1
        if self.error:
            raise self.error
        return self.raw


def _service(tmp_path, fetcher, sample_path=SAMPLE_CSV):
    return PowerService(fetcher, PowerCache(tmp_path, 24), SampleProvider(sample_path), now=lambda: NOW)


def test_en_vivo_y_despues_cacheado(tmp_path):
    fetcher = FakeFetcher(raw=power_response())
    svc = _service(tmp_path, fetcher)
    first = svc.get_daily(-33.85, -65.2, date(2015, 1, 1), date(2015, 1, 10), PARAMS)
    second = svc.get_daily(-33.85, -65.2, date(2015, 1, 1), date(2015, 1, 10), PARAMS)
    assert first.status == DataStatus.LIVE and first.status.origin_label == "DATO NASA EN VIVO"
    assert second.status == DataStatus.CACHED and second.status.origin_label == "DATO CACHEADO"
    assert fetcher.calls == 1


def test_fallback_a_cache_vencida(tmp_path):
    cache = PowerCache(tmp_path, 24)
    key = make_key(-33.85, -65.2, PARAMS, date(2026, 11, 1), date(2026, 11, 10), "AG")
    cache.put(key, power_response("2026-11-01", "2026-11-10"), date(2026, 11, 10), NOW - timedelta(days=3))
    svc = PowerService(FakeFetcher(error=UpstreamError("caído")), cache, SampleProvider(SAMPLE_CSV), now=lambda: NOW)
    data = svc.get_daily(-33.85, -65.2, date(2026, 11, 1), date(2026, 11, 10), PARAMS)
    assert data.status == DataStatus.CACHED
    assert any("cacheados" in w for w in data.warnings)


def test_fallback_a_muestra(tmp_path):
    svc = _service(tmp_path, FakeFetcher(error=UpstreamError("caído")))
    data = svc.get_daily(-33.80, -65.25, date(2018, 1, 1), date(2019, 12, 31), PARAMS)
    assert data.status == DataStatus.SAMPLE and data.status.origin_label == "DATO DE MUESTRA"
    assert data.sample_site == "campo-este"
    assert len(data.df) == 730
    assert any("SIMULADOS" in w for w in data.warnings)


def test_sin_muestra_cercana_da_503(tmp_path):
    svc = _service(tmp_path, FakeFetcher(error=UpstreamError("caído")))
    with pytest.raises(NoDataError):
        svc.get_daily(-34.6, -58.4, date(2018, 1, 1), date(2018, 12, 31), PARAMS)  # Buenos Aires


def test_respuesta_invalida_no_se_cachea(tmp_path):
    svc = _service(tmp_path, FakeFetcher(raw={"basura": True}))
    data = svc.get_daily(-33.85, -65.2, date(2018, 1, 1), date(2018, 1, 31), PARAMS)
    assert data.status == DataStatus.SAMPLE
    assert not list(tmp_path.glob("power_*.json"))


def test_tras_una_falla_no_reintenta_en_vivo_durante_el_enfriamiento(tmp_path):
    clock = {"now": NOW}
    fetcher = FakeFetcher(error=UpstreamError("caído"))
    cooldown = Cooldown(300)
    svc = PowerService(fetcher, PowerCache(tmp_path, 24), SampleProvider(SAMPLE_CSV), now=lambda: clock["now"], cooldown=cooldown)
    args = (-33.85, -65.2, date(2018, 1, 1), date(2018, 1, 31), PARAMS)
    assert svc.get_daily(*args).status == DataStatus.SAMPLE and fetcher.calls == 1
    second = svc.get_daily(*args)
    assert fetcher.calls == 1 and second.status == DataStatus.SAMPLE
    assert any("se vuelve a probar" in w for w in second.warnings)
    clock["now"] = NOW + timedelta(seconds=301)
    fetcher.error, fetcher.raw = None, power_response("2018-01-01", "2018-01-31")
    assert svc.get_daily(*args).status == DataStatus.LIVE and fetcher.calls == 2
    assert not cooldown.active(clock["now"])


# ---------- ET0 ----------

def test_et0_ejemplo_fao56():
    """FAO-56, ejemplo 18 (Bruselas, 6 de julio): ET0 = 3.9 mm/día.
    Con humedad media (en lugar de RHmax/RHmin) el resultado baja apenas."""
    idx = pd.DatetimeIndex([pd.Timestamp("2021-07-06")])
    df = pd.DataFrame(
        {"T2M": [16.9], "T2M_MAX": [21.5], "T2M_MIN": [12.3], "RH2M": [73.5], "WS2M": [2.078],
         "ALLSKY_SFC_SW_DWN": [22.07], "PS": [100.1]}, index=idx,
    )
    et0, method = compute_et0(df, 50.80)
    assert method.iloc[0] == "PM"
    assert et0.iloc[0] == pytest.approx(3.9, abs=0.25)


def test_et0_usa_hargreaves_si_faltan_datos():
    idx = pd.date_range("2021-01-01", periods=2)
    df = pd.DataFrame(
        {"T2M": [25, 25], "T2M_MAX": [32, 32], "T2M_MIN": [18, 18], "RH2M": [60, np.nan],
         "WS2M": [3, 3], "ALLSKY_SFC_SW_DWN": [25, 25], "PS": [95, 95]}, index=idx, dtype=float,
    )
    et0, method = compute_et0(df, -33.85)
    assert list(method) == ["PM", "HG"]
    assert et0.notna().all() and (et0 > 3).all()


# ---------- resúmenes y tendencias ----------

def _synthetic(years=10, precip=2.0, tmax=30.0) -> pd.DataFrame:
    idx = pd.date_range("2010-01-01", f"{2010 + years - 1}-12-31", freq="D")
    df = pd.DataFrame(
        {"T2M": 20.0, "T2M_MAX": tmax, "T2M_MIN": 10.0, "PRECTOTCORR": precip, "ET0": 3.0}, index=idx
    )
    return df


def test_resumen_mensual_y_anual():
    df = _synthetic(years=2)
    monthly = ca.monthly_table(df)
    assert monthly.loc[(2010, 1), "precip_mm"] == pytest.approx(62.0)
    assert monthly.loc[(2010, 2), "et0_mm"] == pytest.approx(84.0)
    annual = ca.annual_table(df)
    assert annual.loc[2010, "precip_mm"] == pytest.approx(730.0)
    assert annual["complete"].all()


def test_dias_calurosos():
    df = _synthetic(years=1)
    df.loc["2010-01-01":"2010-01-05", "T2M_MAX"] = 38.0
    assert ca.monthly_table(df).loc[(2010, 1), "heat_days"] == 5
    assert ca.heat_frequency_by_month(df)[0] == pytest.approx(5 / 31 * 100, abs=0.01)


def test_mes_con_muchos_faltantes_no_es_valido():
    df = _synthetic(years=1)
    df.loc["2010-03-01":"2010-03-10", "PRECTOTCORR"] = np.nan  # 10/31 = 32 %
    monthly = ca.monthly_table(df)
    assert not monthly.loc[(2010, 3), "valid"] and math.isnan(monthly.loc[(2010, 3), "precip_mm"])
    assert not ca.annual_table(df).loc[2010, "complete"]


def test_clasificacion_de_anos():
    annual = pd.DataFrame(
        {"precip_mm": [700, 710, 690, 400, 1000, 705, 695], "heat_days": [5, 5, 5, 5, 5, 5, 30], "complete": True},
        index=range(2015, 2022),
    )
    out = ca.classify_years(annual)
    assert out.loc[2018, "classification"] == "seco"
    assert out.loc[2019, "classification"] == "húmedo"
    assert out.loc[2015, "classification"] == "normal"
    assert bool(out.loc[2021, "heat_stress"]) and not bool(out.loc[2015, "heat_stress"])


def test_tendencia_creciente_significativa():
    s = pd.Series([500 + 10 * i for i in range(10)], index=range(2015, 2025), dtype=float)
    t = ca.mann_kendall_sen(s)
    assert t.slope_per_decade == pytest.approx(100.0)
    assert t.kendall_tau == 1.0 and t.significant


def test_tendencia_plana_no_significativa():
    s = pd.Series([600, 610, 590, 605, 595, 600, 608, 592], index=range(2015, 2023), dtype=float)
    assert not ca.mann_kendall_sen(s).significant


def test_tendencia_con_pocos_anos():
    t = ca.mann_kendall_sen(pd.Series([1.0, 2.0, 3.0], index=[2020, 2021, 2022]))
    assert t.slope_per_decade is None and t.n_years == 3


def test_coeficiente_de_variacion():
    assert ca.coefficient_of_variation(pd.Series([100.0, 100.0, 100.0])) == 0.0
    assert ca.coefficient_of_variation(pd.Series([1.0, 2.0])) is None


def test_muestra_es_plausible():
    """Chequeo de cordura de los datos simulados."""
    data = pd.read_csv(SAMPLE_CSV)
    assert set(data["site_id"]) == {"campo-este", "campo-centro", "campo-conlara"}
    assert (data["T2M_MAX"] >= data["T2M_MIN"]).all()
    annual = data.assign(y=data["date"].str[:4]).groupby(["site_id", "y"])["PRECTOTCORR"].sum()
    assert annual.groupby("site_id").count().min() >= 10
    assert 400 < annual.mean() < 900
