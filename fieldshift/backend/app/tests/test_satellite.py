"""SMAP y MODIS NDVI: parseo, métricas, faltantes, respaldo, conector AppEEARS, motor y API."""

import json
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
import pytest

from app.models.enums import DataStatus, Level
from app.services.satellite import soil_moisture as smm
from app.services.satellite import vegetation as veg
from app.services.satellite.parsers import parse_csv
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteData, SatelliteProvider, cache_key
from app.utils.exceptions import InvalidInputError, NoDataError, UpstreamError

SMAP = PRODUCTS["SPL4SMGP_rootzone"]
NDVI = PRODUCTS["MOD13Q1"]
NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def data_from(df: pd.DataFrame, status=DataStatus.UPLOADED) -> SatelliteData:
    from app.services.satellite.parsers import ParsedSeries

    return SatelliteData(ParsedSeries(df=df, format="simple"), status, NOW)


def smap_series(start="2016-01-01", end="2025-12-31", base=0.15, amp=0.04, trend_per_year=0.0, dry=None, seed=1):
    """Humedad diaria con estacionalidad (húmeda en verano) y, opcional, un período seco."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, end, freq="D")
    doy = idx.day_of_year.to_numpy()
    years = (idx.year - idx.year[0]).to_numpy()
    v = base + amp * np.cos(2 * np.pi * (doy - 15) / 365) + trend_per_year * years + rng.normal(0, 0.003, len(idx))
    s = pd.Series(v, index=idx)
    if dry:
        a, b, delta = dry
        s[a:b] -= delta
    return pd.DataFrame({"value": s})


# --- parseo ---

APPEEARS_NDVI = """ID,Latitude,Longitude,Date,MODIS_Tile,MOD13Q1_061__250m_16_days_NDVI,MOD13Q1_061__250m_16_days_pixel_reliability
lote,-33.85,-65.2,2024-01-01,h12v12,7500,0
lote,-33.85,-65.2,2024-01-17,h12v12,7000,1
lote,-33.85,-65.2,2024-02-02,h12v12,1500,3
lote,-33.85,-65.2,2024-02-18,h12v12,-3000,-1
lote,-33.85,-65.2,2024-03-05,h12v12,6000,2
"""


def test_parsea_csv_de_appeears_ndvi_con_escala_y_calidad():
    p = parse_csv(APPEEARS_NDVI, NDVI)
    assert p.format == "appeears" and p.scaled and p.site_id == "lote"
    v = p.df["value"]
    assert v["2024-01-01"] == pytest.approx(0.75) and v["2024-01-17"] == pytest.approx(0.70)
    assert v[["2024-02-02", "2024-02-18", "2024-03-05"]].isna().all()  # nube, relleno, nieve
    assert p.bad_quality == 2 and p.fill_or_range == 1


def test_parsea_csv_simple_ya_escalado():
    p = parse_csv("date,value,qa\n2024-01-01,0.61,0\n2024-01-17,0.55,0\n", NDVI)
    assert p.format == "simple" and not p.scaled
    assert p.df["value"].tolist() == [0.61, 0.55]


def test_ndvi_sin_capa_de_calidad_avisa():
    p = parse_csv("date,value\n2024-01-01,0.61\n", NDVI)
    assert any("calidad" in w for w in p.warnings)


def test_smap_subdiario_se_promedia_por_dia_y_relleno_es_faltante():
    csv = (
        "ID,Latitude,Longitude,Date,SPL4SMGP_008_Geophysical_Data_sm_rootzone\n"
        "p,-33.8,-65.2,2024-01-01T01:30:00,0.20\np,-33.8,-65.2,2024-01-01T04:30:00,0.22\n"
        "p,-33.8,-65.2,2024-01-02T01:30:00,-9999\np,-33.8,-65.2,2024-01-03T01:30:00,1.5\n"
    )
    p = parse_csv(csv, SMAP)
    assert p.df["value"]["2024-01-01"] == pytest.approx(0.21)
    assert p.df["value"][["2024-01-02", "2024-01-03"]].isna().all()
    assert p.fill_or_range == 2


def test_csv_con_varios_puntos_elige_el_mas_cercano():
    csv = "ID,Latitude,Longitude,Date,value\na,-33.85,-65.20,2024-01-01,0.10\nb,-32.45,-65.25,2024-01-01,0.30\n"
    assert parse_csv(csv, SMAP, -32.4, -65.2).df["value"].iloc[0] == 0.30
    with pytest.raises(InvalidInputError, match="coordenadas"):
        parse_csv(csv, SMAP)
    with pytest.raises(InvalidInputError, match="cerca"):
        parse_csv(csv, SMAP, -20.0, -60.0)


@pytest.mark.parametrize(
    "csv,match",
    [
        ("fecha_rara,otra\n1,2\n", "columna"),
        ("date,value\n2024-01-01,-9999\n", "ningún valor válido"),
        ("", "leer"),
    ],
)
def test_csv_invalidos(csv, match):
    with pytest.raises(InvalidInputError, match=match):
        parse_csv(csv, SMAP)


def test_las_muestras_del_repo_usan_el_formato_de_appeears(satellite_provider):
    for product in (SMAP, NDVI):
        d = satellite_provider.get(product, -33.85, -65.2, date(2016, 1, 1), date(2025, 12, 31))
        assert d.status == DataStatus.SAMPLE and d.series.format == "appeears"


# --- métricas SMAP ---


def test_smap_detecta_sequia_meses_bajos_y_meses_secos():
    df = smap_series(dry=("2022-10-01", "2023-01-31", 0.05))
    s = smm.summarize(data_from(df), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31))
    drought = {(m.year, m.month) for m in s.monthly if m.drought}
    assert {(2022, 11), (2022, 12)} <= drought
    assert any(e.start <= "2022-11" and e.end >= "2022-12" for e in s.drought_events)
    assert 0 < s.drought_frequency_pct < 20
    assert set(s.typically_dry_months) <= {5, 6, 7, 8, 9}  # invierno, por la estacionalidad sintética
    assert s.low_moisture_months and all(m.low for m in s.low_moisture_months)
    assert s.trace.status == DataStatus.UPLOADED and s.quality.valid_pct > 99


def test_smap_tendencia():
    sube = smm.summarize(
        data_from(smap_series(trend_per_year=0.004)), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31)
    )
    assert sube.trend.significant and sube.trend.slope_per_decade == pytest.approx(0.04, abs=0.005)
    plano = smm.summarize(data_from(smap_series()), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31))
    assert abs(plano.trend.slope_per_decade) < 0.005


def test_smap_estres_hidrico_relativo():
    seco = smap_series(dry=("2025-10-01", "2025-12-31", 0.05))
    s = smm.summarize(data_from(seco), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31))
    ws = s.water_stress
    assert ws.anomaly_pct < -20 and ws.percentile == 0 and ws.level == Level.ALTO and ws.stress_index == 1
    normal = smm.summarize(data_from(smap_series()), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31))
    assert normal.water_stress.level != Level.ALTO


def test_smap_meses_con_pocos_datos_no_se_usan():
    df = smap_series()
    df.loc["2020-03-05":"2020-03-31", "value"] = np.nan  # quedan 4 días: mes inválido
    s = smm.summarize(data_from(df), SMAP, -33.8, -65.2, date(2016, 1, 1), date(2025, 12, 31))
    march = next(m for m in s.monthly if (m.year, m.month) == (2020, 3))
    assert march.mean is None and not march.drought
    assert s.quality.missing_or_fill >= 27


def test_smap_serie_corta_no_rompe():
    df = pd.DataFrame({"value": [0.21, 0.20, np.nan]}, index=pd.date_range("2024-01-01", periods=3))
    s = smm.summarize(data_from(df), SMAP, -33.8, -65.2, date(2024, 1, 1), date(2024, 1, 3), include_series=True)
    assert s.mean == pytest.approx(0.205) and s.drought_frequency_pct is None and s.trend.slope_per_decade is None
    assert len(s.series) == 3


# --- métricas NDVI ---


def bump(x, length):
    return float(np.sin(np.pi * x / length) ** 2) if 0 <= x <= length else 0.0


def ndvi_series(campaigns=10, double=False, decline=0.0, gaps=None, seed=3):
    """Compuestos de 16 días desde julio de 2015: un cultivo de verano por campaña (o dos con double=True)."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2015-07-01", periods=23 * campaigns, freq="16D")
    vals = []
    for i, d in enumerate(dates):
        k = i // 23
        doy = d.day_of_year
        summer = 0.65 * bump((doy - 330) % 365, 165)  # de diciembre a mayo, pico en febrero
        winter = 0.45 * bump((doy - 150) % 365, 150) if double else 0  # de junio a octubre, pico en agosto
        vals.append(0.17 + (max(summer, winter)) * (1 - decline * k) + rng.normal(0, 0.01))
    s = pd.Series(vals, index=dates)
    for g in gaps or []:
        s.iloc[g] = np.nan
    return pd.DataFrame({"value": s})


def ndvi_summary(df, start=date(2015, 7, 1), end=date(2025, 6, 30), threshold=0.3):
    return veg.summarize(data_from(df), NDVI, -33.8, -65.2, start, end, threshold, include_series=True)


def test_ndvi_barbechos_cobertura_y_campanias():
    v = ndvi_summary(ndvi_series())
    assert 0.2 < v.mean_ndvi < 0.6
    assert v.fallow_periods and all(p.days >= 32 and p.mean_ndvi < 0.3 for p in v.fallow_periods)
    assert 0.3 < v.bare_soil_fraction < 0.8
    assert len([c for c in v.campaigns if c.complete]) == 10
    assert all(c.growth_cycles == 1 for c in v.campaigns if c.complete)
    assert v.campaigns[0].campaign == "2015/16"


def test_ndvi_doble_cultivo_tiene_dos_ciclos_y_menos_barbecho():
    simple, doble = ndvi_summary(ndvi_series()), ndvi_summary(ndvi_series(double=True))
    assert all(c.growth_cycles == 2 for c in doble.campaigns if c.complete)
    assert doble.bare_soil_fraction < simple.bare_soil_fraction
    assert doble.cover_fraction_mean > simple.cover_fraction_mean


def test_cobertura_vegetal_gutman_ignatov():
    fc = veg.cover_fraction(pd.Series([0.1, 0.15, 0.5, 0.85, 0.95]))
    assert fc.tolist() == pytest.approx([0, 0, 0.5, 1, 1])


def test_ndvi_tendencia_de_biomasa_en_baja():
    v = ndvi_summary(ndvi_series(decline=0.04))
    assert v.biomass_trend.significant and v.biomass_trend_pct_per_decade < -20
    complete = [c for c in v.campaigns if c.complete]
    assert v.best_campaign == "2015/16" and v.worst_campaign == "2024/25"
    assert complete[0].anomaly_pct > 0 > complete[-1].anomaly_pct
    assert v.campaigns[-1].anomaly_pct is None  # la campaña incompleta no se compara


def test_ndvi_interpola_un_hueco_aislado_y_no_los_largos():
    v = ndvi_summary(ndvi_series(gaps=[30, 60, 61, 62]))
    points = {p.date: p for p in v.series}
    d30 = pd.Timestamp("2015-07-01") + pd.Timedelta(days=16 * 30)
    assert points[d30.date()].interpolated and points[d30.date()].ndvi is not None
    d61 = pd.Timestamp("2015-07-01") + pd.Timedelta(days=16 * 61)
    assert points[d61.date()].ndvi is None
    assert v.quality.valid == 230 - 4


def test_ndvi_campania_con_pocos_datos_no_es_completa():
    v = ndvi_summary(ndvi_series(gaps=list(range(0, 8))))
    assert not v.campaigns[0].complete and v.campaigns[0].anomaly_pct is None


# --- respaldo (fallback) y conector AppEEARS ---


class FakeClient:
    def __init__(self, status="pending", csv=APPEEARS_NDVI, fail=False):
        self.status, self.csv, self.fail, self.submitted = status, csv, fail, []

    def submit_point_task(self, name, appeears_id, layers, lat, lon, start, end):
        if self.fail:
            raise UpstreamError("503")
        self.submitted.append((appeears_id, layers))
        return "task-123"

    def task_status(self, task_id):
        return self.status

    def download_csv(self, task_id, layer_hint):
        return self.csv


def provider(tmp_path, client=None, samples=True):
    from app.tests.conftest import SAMPLES_DIR

    paths = {
        "MOD13Q1": SAMPLES_DIR / "ndvi_sample_san_luis.csv",
        "SPL4SMGP_rootzone": SAMPLES_DIR / "smap_sample_san_luis.csv",
    }
    return SatelliteProvider(tmp_path, paths if samples else {}, (lambda: client) if client else None, now=lambda: NOW)


PERIOD = (date(2024, 1, 1), date(2024, 3, 31))


def test_fallback_sin_credenciales_usa_la_muestra(tmp_path):
    d = provider(tmp_path).get(NDVI, -33.85, -65.2, *PERIOD)
    assert d.status == DataStatus.SAMPLE and d.sample_site == "campo-este"
    assert any("Sin credenciales" in w for w in d.warnings) and any("SIMULADOS" in w for w in d.warnings)


def test_fallback_fuera_del_radio_de_muestra_da_503(tmp_path):
    with pytest.raises(NoDataError):
        provider(tmp_path).get(NDVI, -24.0, -60.0, *PERIOD)


def test_csv_cargado_tiene_prioridad(tmp_path):
    d = provider(tmp_path).get(NDVI, -33.85, -65.2, *PERIOD, csv_text=APPEEARS_NDVI)
    assert d.status == DataStatus.UPLOADED


def test_appeears_asincronico_pide_espera_descarga_y_cachea(tmp_path):
    client = FakeClient(status="pending")
    p = provider(tmp_path, client)
    first = p.get(NDVI, -33.85, -65.2, *PERIOD)
    assert first.status == DataStatus.SAMPLE and first.task_id == "task-123"
    assert client.submitted == [("MOD13Q1.061", ["_250m_16_days_NDVI", "_250m_16_days_pixel_reliability"])]
    assert any("tarea task-123" in w for w in first.warnings)
    second = p.get(NDVI, -33.85, -65.2, *PERIOD)  # sigue en proceso: no se pide de nuevo
    assert second.status == DataStatus.SAMPLE and len(client.submitted) == 1
    client.status = "done"
    live = p.get(NDVI, -33.85, -65.2, *PERIOD)
    assert live.status == DataStatus.LIVE and live.series.format == "appeears"
    cached = p.get(NDVI, -33.85, -65.2, *PERIOD)
    assert cached.status == DataStatus.CACHED
    key = cache_key(NDVI, -33.85, -65.2, *PERIOD)
    assert (tmp_path / f"appeears_{key}.csv").exists()
    assert json.loads((tmp_path / "appeears_tasks.json").read_text()) == {}


def test_appeears_con_error_cae_a_la_muestra(tmp_path):
    d = provider(tmp_path, FakeClient(fail=True)).get(NDVI, -33.85, -65.2, *PERIOD)
    assert d.status == DataStatus.SAMPLE and any("AppEEARS no disponible" in w for w in d.warnings)


def test_appeears_tarea_con_error_se_olvida(tmp_path):
    client = FakeClient(status="pending")
    p = provider(tmp_path, client)
    p.get(NDVI, -33.85, -65.2, *PERIOD)
    client.status = "error"
    d = p.get(NDVI, -33.85, -65.2, *PERIOD)
    assert d.status == DataStatus.SAMPLE and any("error" in w for w in d.warnings)
    assert json.loads((tmp_path / "appeears_tasks.json").read_text()) == {}


def test_cliente_appeears_formato_de_pedidos():
    httpx = pytest.importorskip("httpx")
    from app.services.satellite.appeears import AppEEARSClient

    seen = []

    def handler(request):
        seen.append((request.method, request.url.path, request.headers.get("authorization"), request.content))
        if request.url.path.endswith("/login"):
            return httpx.Response(200, json={"token": "tok"})
        if request.url.path.endswith("/task"):
            return httpx.Response(202, json={"task_id": "t1"})
        if request.url.path.endswith("/task/t1"):
            return httpx.Response(200, json={"status": "done"})
        if request.url.path.endswith("/bundle/t1"):
            return httpx.Response(
                200,
                json={
                    "files": [
                        {"file_id": "f1", "file_name": "MOD13Q1-061-results.csv"},
                        {"file_id": "f2", "file_name": "README.md"},
                    ]
                },
            )
        if request.url.path.endswith("/bundle/t1/f1"):
            return httpx.Response(200, text=APPEEARS_NDVI)
        return httpx.Response(404)

    c = AppEEARSClient("https://x/api", username="u", password="p", transport=httpx.MockTransport(handler))
    assert (
        c.submit_point_task(
            "n", "MOD13Q1.061", ["_250m_16_days_NDVI"], -33.85, -65.2, date(2024, 1, 1), date(2024, 3, 31)
        )
        == "t1"
    )
    body = json.loads(seen[1][3])
    assert body["task_type"] == "point" and body["params"]["dates"] == [
        {"startDate": "01-01-2024", "endDate": "03-31-2024"}
    ]
    assert body["params"]["coordinates"][0]["latitude"] == -33.85 and seen[1][2] == "Bearer tok"
    assert c.task_status("t1") == "done"
    assert c.download_csv("t1", "_250m_16_days_NDVI") == APPEEARS_NDVI


def test_cliente_appeears_errores_http():
    httpx = pytest.importorskip("httpx")
    from app.services.satellite.appeears import AppEEARSClient

    c = AppEEARSClient("https://x/api", token="t", transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(UpstreamError, match="500"):
        c.task_status("t1")
    with pytest.raises(UpstreamError, match="credenciales"):
        AppEEARSClient("https://x/api", transport=httpx.MockTransport(lambda r: httpx.Response(200))).task_status("t")


# --- integración con el motor ---


def test_servicio_arma_las_entradas_del_motor(satellite_service):
    from app.schemas.satellite import SoilMoistureRequest, VegetationRequest
    from app.services.satellite.service import soil_moisture_input, vegetation_input

    sm, _ = satellite_service.soil_moisture(SoilMoistureRequest(field_id="campo-centro"))
    v, _ = satellite_service.vegetation(VegetationRequest(field_id="campo-centro"))
    smi, vi = soil_moisture_input(sm), vegetation_input(v)
    assert smi.product == "SMAP_L4" and smi.origin == DataStatus.SAMPLE and smi.drought_frequency_pct is not None
    assert vi.product == "MOD13Q1" and 0 <= vi.bare_soil_fraction <= 1 and vi.cover_fraction is not None
    assert sm.trace.label.value == "modelado" and v.trace.label.value == "observado"
    for trace in (sm.trace, v.trace):  # trazabilidad completa
        assert trace.source and trace.product and trace.period_start and trace.retrieved_at and trace.spatial_resolution
        assert trace.status_label == "DATO DE MUESTRA" and trace.limitations and trace.citation


def test_motor_usa_frecuencia_de_sequias_smap(repo):
    from app.schemas.rotation import SoilMoistureInput
    from app.tests.test_engine import engine

    def r_of(result, strategy="actual"):
        ev = next(e for e in result.evaluations if e.rotation.strategy.value == strategy)
        return ev.score.components[2].value

    normal = engine(repo, soil_moisture=SoilMoistureInput(product="SMAP_L4", anomaly_pct=0, drought_frequency_pct=15))
    sequia = engine(repo, soil_moisture=SoilMoistureInput(product="SMAP_L4", anomaly_pct=0, drought_frequency_pct=36))
    assert r_of(sequia) < r_of(normal)


def test_motor_usa_tendencia_y_cobertura_ndvi_en_la_actual(repo):
    from app.schemas.rotation import VegetationInput
    from app.tests.test_engine import engine

    base = VegetationInput(bare_soil_fraction=0.5, cover_fraction=0.3)
    baja = base.model_copy(update={"biomass_trend_pct_per_decade": -30, "trend_significant": True})

    def s_of(result, strategy):
        ev = next(e for e in result.evaluations if e.rotation.strategy.value == strategy)
        return ev.score.components[1]

    r0, r1 = engine(repo, vegetation=base), engine(repo, vegetation=baja)
    assert s_of(r1, "actual").value < s_of(r0, "actual").value
    assert "Tendencia de biomasa en baja (NDVI)" in [d.factor for d in s_of(r1, "actual").drivers]
    assert s_of(r1, "agua").value == s_of(r0, "agua").value  # solo la actual: el NDVI observa el manejo real


def test_motor_baja_confianza_con_satelite_de_muestra(repo):
    from app.schemas.rotation import SoilMoistureInput
    from app.tests.test_engine import engine

    r = engine(repo, soil_moisture=SoilMoistureInput(product="SMAP_L4", anomaly_pct=0, origin=DataStatus.SAMPLE))
    assert any("muestra simulada" in reason and "SMAP" in reason for reason in r.confidence_reasons)


# --- API ---


def test_api_soil_moisture(client):
    body = client.post("/soil-moisture", json={"field_id": "campo-centro", "include_series": True}).json()
    d = body["data"]
    assert body["meta"]["origin_label"] == "DATO DE MUESTRA" and body["meta"]["data_status"] == "sample"
    assert d["trace"]["product"].startswith("SPL4SMGP.008") and d["trace"]["status"] == "sample"
    for key in (
        "mean",
        "drought_frequency_pct",
        "low_moisture_months",
        "trend",
        "water_stress",
        "typically_dry_months",
    ):
        assert key in d
    assert len(d["series"]) > 3000
    assert any("SIMULADOS" in w for w in body["meta"]["warnings"])


def test_api_vegetation_index(client):
    body = client.post("/vegetation-index", json={"field_id": "campo-este"}).json()
    d = body["data"]
    assert d["trace"]["product"].startswith("MOD13Q1.061") and d["trace"]["spatial_resolution"] == "250 m"
    for key in ("mean_ndvi", "cover_fraction_mean", "fallow_periods", "biomass_trend", "campaigns"):
        assert key in d
    assert len(d["campaigns"]) >= 9 and d["series"] is None


def test_api_csv_cargado_y_errores(client):
    csv = "date,value\n2024-01-01,0.21\n2024-01-02,0.20\n2024-01-03,-9999\n"
    req = {
        "latitude": -33.85,
        "longitude": -65.2,
        "start_date": "2024-01-01",
        "end_date": "2024-01-03",
        "csv_content": csv,
    }
    body = client.post("/soil-moisture", json=req).json()
    assert body["meta"]["data_status"] == "uploaded" and body["data"]["quality"]["valid"] == 2
    from app.tests.test_api import assert_error

    assert_error(client.post("/soil-moisture", json={"latitude": -24.0, "longitude": -60.0}), 503, "NO_DATA_AVAILABLE")
    assert_error(client.post("/soil-moisture", json={**req, "csv_content": "x,y\n1,2\n"}), 400, "INVALID_INPUT")
    assert_error(client.post("/vegetation-index", json={"field_id": "nada"}), 404, "FIELD_NOT_FOUND")
    assert_error(client.post("/soil-moisture", json={"latitude": 95, "longitude": 0}), 422, "VALIDATION_ERROR")
    old = {"latitude": -33.85, "longitude": -65.2, "start_date": "2010-01-01", "end_date": "2014-12-31"}
    assert_error(client.post("/soil-moisture", json=old), 400, "INVALID_INPUT")


def test_api_compare_usa_smap_y_ndvi_automaticamente(client):
    data = client.post("/rotations/compare", json={"field_id": "campo-centro"}).json()["data"]
    assert data["inputs"]["soil_moisture"]["origin"] == "sample" and data["inputs"]["vegetation"]["origin"] == "sample"
    assert {"smap", "modis-ndvi"} <= {s["id"] for s in data["sources"]}
    sin = client.post("/rotations/compare", json={"field_id": "campo-centro", "use_satellite": False}).json()["data"]
    assert sin["inputs"]["soil_moisture"] is None and sin["inputs"]["vegetation"] is None
