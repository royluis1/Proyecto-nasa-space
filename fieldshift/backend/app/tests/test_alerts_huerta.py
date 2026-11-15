"""Pronóstico (Open-Meteo, simulado sin red), alertas tempranas, panel de huerta y respaldo con campo1.csv."""

from datetime import date, datetime, timedelta, timezone

import pandas as pd
import pytest

from app.models.enums import DataStatus, Severity
from app.schemas.forecast import Forecast, ForecastDay, RainSummary, SourceInfo
from app.services.early_warning import EarlyWarningService, build_alerts, frost_stats, heat_stats, normal_rain
from app.services.forecast.open_meteo import ForecastService, http_fetcher, parse
from app.services.power.cache import PowerCache
from app.services.power.file_source import PowerFileProvider, read_power_csv
from app.services.power.sample import SampleProvider
from app.services.power.service import Cooldown, PowerService
from app.tests.conftest import SAMPLES_DIR
from app.utils.exceptions import NoDataError, UpstreamError

httpx = pytest.importorskip("httpx")

CAMPO1 = SAMPLES_DIR / "power_campo1.csv"
TODAY = date(2026, 11, 14)
NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)


def om_response(start=TODAY, n=10, tmin=None, tmax=None, rain=None, et0=None, wind=None):
    days = [(start + timedelta(days=i)).isoformat() for i in range(n)]
    return {
        "latitude": -33.9, "longitude": -65.07, "timezone": "America/Argentina/San_Luis",
        "daily_units": {"temperature_2m_max": "°C"},
        "daily": {
            "time": days,
            "temperature_2m_max": tmax or [28.0] * n,
            "temperature_2m_min": tmin or [12.0] * n,
            "precipitation_sum": rain or [0.0] * n,
            "precipitation_probability_max": [10] * n,
            "et0_fao_evapotranspiration": et0 or [5.0] * n,
            "wind_speed_10m_max": wind or [20.0] * n,
        },
    }


def fc(**kw) -> Forecast:
    return parse(om_response(**kw), NOW)


# ---------------------------------------------------------------- Open-Meteo


def test_parsea_el_pronostico_y_lo_marca_como_no_nasa():
    f = fc(tmin=[None] + [10.0] * 9)
    assert len(f.days) == 10 and f.days[0].tmin_c is None and f.days[1].et0_mm == 5.0
    assert f.source.is_nasa is False and f.source.kind == "pronóstico" and "no es" in f.source.name
    with pytest.raises(UpstreamError):
        parse({"daily": {}}, NOW)


def test_cliente_http_de_open_meteo_con_y_sin_clave():
    seen = []

    def handler(request):
        seen.append(request)
        if request.url.params.get("latitude") == "0.0":
            return httpx.Response(400, json={"error": True, "reason": "Latitude must be in range"})
        return httpx.Response(200, json=om_response())

    t = httpx.MockTransport(handler)
    raw = http_fetcher("https://api.open-meteo.com/v1/forecast", None, 5, t)(-33.9, -65.07, 10)
    assert raw["daily"]["time"][0] == TODAY.isoformat()
    q = seen[0].url.params
    assert q["forecast_days"] == "10" and "et0_fao_evapotranspiration" in q["daily"] and "apikey" not in q
    http_fetcher("https://customer-api.open-meteo.com/v1/forecast", "k-123", 5, t)(-33.9, -65.07, 7)
    assert seen[1].url.params["apikey"] == "k-123"
    with pytest.raises(UpstreamError, match="Latitude"):
        http_fetcher("https://x/forecast", None, 5, t)(0.0, 0.0, 7)


def test_servicio_de_pronostico_guarda_3_horas_y_espera_ante_fallas():
    clock = {"t": NOW}
    calls = []

    def ok(lat, lon, days):
        calls.append(1)
        return om_response(n=days)

    svc = ForecastService(ok, now=lambda: clock["t"])
    svc.get(-33.9, -65.07, 10)
    svc.get(-33.9, -65.07, 10)
    assert len(calls) == 1
    clock["t"] = NOW + timedelta(hours=4)
    svc.get(-33.9, -65.07, 10)
    assert len(calls) == 2

    def bad(*_):
        calls.append(1)
        raise UpstreamError("Open-Meteo no respondió (ConnectError).")

    down = ForecastService(bad, Cooldown(300), now=lambda: NOW)
    with pytest.raises(NoDataError, match="Pronóstico no disponible"):
        down.get(1, 1)
    with pytest.raises(NoDataError, match="falló hace poco"):
        down.get(1, 1)
    with pytest.raises(NoDataError, match="no tiene configurado"):
        ForecastService(None).get(1, 1)


# ---------------------------------------------------------------- alertas


def test_heladas_agrupadas_y_con_mensaje_segun_perfil():
    f = fc(tmin=[5, 1.5, -2, -1, 6, 1, 8, 9, 9, 9])
    h = build_alerts("huerta", f, None, None)
    a = build_alerts("agricultor", f, None, None)
    frosts = [x for x in h if x.kind == "helada"]
    assert [x.severity for x in frosts] == [Severity.ALTA, Severity.MEDIA]  # 15-17 (mín -2) y 19 (mín 1)
    assert frosts[0].start == date(2026, 11, 15) and frosts[0].end == date(2026, 11, 17) and "-2" in frosts[0].title
    assert "manta antihelada" in frosts[0].message
    assert "floración" in [x for x in a if x.kind == "helada"][0].message
    assert all("Open-Meteo" in x.source for x in frosts)


def test_calor_lluvia_intensa_y_viento():
    f = fc(tmax=[30, 36, 39, 30, 30, 30, 30, 30, 30, 30], rain=[0, 0, 0, 0, 55, 32, 0, 0, 0, 0], wind=[20] * 8 + [70, 80])
    al = build_alerts("agricultor", f, None, None)
    kinds = [x.kind for x in al]
    heat = next(x for x in al if x.kind == "calor")
    assert heat.severity == Severity.ALTA and "2 días" in heat.title
    rains = [x for x in al if x.kind == "lluvia_intensa"]
    assert [r.severity for r in rains] == [Severity.ALTA, Severity.MEDIA]
    assert kinds.count("viento") == 1
    # las graves primero
    sev = [x.severity for x in al]
    assert sev == sorted(sev, key=lambda s: {Severity.ALTA: 0, Severity.MEDIA: 1, Severity.INFO: 2}[s])


def test_falta_de_agua_con_litros_para_la_huerta_y_lluvia_pasada():
    f = fc(rain=[0.0] * 10, et0=[6.0] * 10)
    past = RainSummary(days=30, total_mm=10, normal_mm=60, pct_of_normal=17, start=date(2026, 10, 12), end=date(2026, 11, 10),
                       source=SourceInfo(name="NASA POWER", is_nasa=True, kind="modelado", retrieved_at=NOW))
    h = build_alerts("huerta", f, past, None)
    dry = next(x for x in h if x.kind == "falta_de_agua")
    assert dry.severity == Severity.ALTA and "42 litros por m²" in dry.message and "NASA POWER" in dry.source
    assert next(x for x in build_alerts("huerta", f, None, None) if x.kind == "falta_de_agua").severity == Severity.MEDIA
    # sin pronóstico, la lluvia pasada sola alcanza para avisar
    only_past = build_alerts("agricultor", None, past, None)
    assert only_past[0].kind == "falta_de_agua" and only_past[0].source == "NASA POWER"


def test_suelo_seco_por_smap_y_sin_alertas_con_buen_tiempo():
    assert build_alerts("agricultor", fc(rain=[3.0] * 10), None, -35)[0].kind == "suelo_seco"
    assert build_alerts("huerta", fc(rain=[3.0] * 10), None, -5) == []


# ---------------------------------------------------------------- estadísticas con campo1.csv (datos reales de POWER)


@pytest.fixture(scope="module")
def campo1():
    return read_power_csv(CAMPO1).df


def test_heladas_tipicas_de_san_luis(campo1):
    days, months, last, first = frost_stats(campo1.loc["2016":"2025"], -33.9)
    assert days and 5 < days < 80
    assert {6, 7} <= set(months) and 1 not in months
    last_month, first_month = int(last.split("/")[1]), int(first.split("/")[1])
    assert 8 <= last_month <= 11 and 3 <= first_month <= 6


def test_calor_y_lluvia_normal(campo1):
    hot, months = heat_stats(campo1.loc["2016":"2025"])
    assert hot and hot > 1 and 1 in months and 7 not in months
    n = normal_rain(campo1.loc["2016":"2025"], date(2026, 1, 1), date(2026, 1, 31))
    assert 40 < n < 200


# ---------------------------------------------------------------- servicio completo


def failing(*_):
    raise UpstreamError("sin red (test)")


@pytest.fixture
def ews(repo, tmp_path, satellite_provider):
    from app.services.satellite.service import SatelliteService

    power = PowerService(failing, PowerCache(tmp_path, 24), SampleProvider(SAMPLES_DIR / "power_sample_san_luis.csv"),
                         files=PowerFileProvider([CAMPO1]))
    forecast = ForecastService(lambda lat, lon, days: om_response(n=days, tmin=[-1.0] + [10.0] * (days - 1)), now=lambda: NOW)
    return EarlyWarningService(repo, power, forecast, SatelliteService(repo, satellite_provider), today=TODAY)


def test_panel_de_huerta_con_power_del_csv_y_pronostico(ews):
    p = ews.huerta(field_id="campo-este")
    power = p.sources[0]
    assert power.name == "NASA POWER" and power.kind == "modelado" and power.origin == DataStatus.UPLOADED
    assert power.retrieved_at is not None
    assert p.frost.last_frost_typical and 6 in p.frost.frost_months
    assert p.irrigation.weekly_l_per_m2 > 10 and p.irrigation.with_forecast_l_per_m2 is not None
    assert "1 mm = 1 litro" in p.irrigation.basis
    assert p.forecast and p.forecast.source.is_nasa is False
    assert p.alerts[0].kind == "helada" and "manta" in p.alerts[0].message
    # Escala huerta: nada de SMAP (9 km) ni MODIS (250 m); ninguna alerta de suelo seco satelital.
    assert not hasattr(p, "vegetation")
    assert all(a.kind != "suelo_seco" for a in p.alerts)
    assert p.tips and any("campo1.csv" in w for w in p.warnings)
    # "Qué sembrar este mes" sale del catálogo: en noviembre entran zapallito y poroto, con evidencia y sin "recomendado".
    sow_ids = {o.crop_id for o in p.sowing_now}
    assert {"zapallito", "poroto"} <= sow_ids
    assert all(o.evidence for o in p.sowing_now)
    assert any("NASA POWER" in e or "Catálogo" in e for o in p.sowing_now for e in o.evidence)
    src_names = {s.name for s in p.sources}
    assert "NASA POWER" in src_names
    assert not any(n in src_names for n in ("NASA SMAP", "NASA MODIS (NDVI)"))


def test_alertas_del_agricultor_y_lluvia_pasada(ews):
    r = ews.alerts("agricultor", field_id="campo-este")
    assert r.profile == "agricultor" and r.alerts[0].kind == "helada" and "floración" in r.alerts[0].message
    assert r.future_rain_mm == 0
    # campo1.csv llega al 31/10/2026: la lluvia "reciente" es la que haya hasta esa fecha
    assert r.past_rain is None or r.past_rain.end <= date(2026, 10, 31)


def test_sin_pronostico_igual_responde_y_avisa(repo, tmp_path):
    power = PowerService(failing, PowerCache(tmp_path, 24), SampleProvider(SAMPLES_DIR / "power_sample_san_luis.csv"),
                         files=PowerFileProvider([CAMPO1]))
    svc = EarlyWarningService(repo, power, ForecastService(None), None, today=date(2025, 12, 20))
    p = svc.huerta(lat=-33.9, lon=-65.07)
    assert p.forecast is None and p.irrigation.with_forecast_l_per_m2 is None
    assert p.past_rain is not None and p.past_rain.total_mm is not None  # dic 2025 está en el CSV
    assert any("Pronóstico no disponible" in w for w in p.warnings)


# ---------------------------------------------------------------- API


def test_api_huerta_alertas_y_pronostico(client):
    r = client.post("/huerta", json={"field_id": "campo-este"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["irrigation"]["weekly_l_per_m2"] >= 0 and d["frost"]["source"]["name"] == "NASA POWER"
    a = client.post("/alerts", json={"field_id": "campo-este", "profile": "huerta"})
    assert a.status_code == 200 and a.json()["data"]["profile"] == "huerta"
    assert client.post("/alerts", json={"profile": "huerta"}).status_code == 400
    assert client.post("/forecast", json={"field_id": "campo-este"}).status_code == 503  # sin Open-Meteo en los tests


def test_rotacion_de_huerta_por_familias(repo):
    from app.services.huerta_rotation import huerta_rotation

    g = huerta_rotation(repo.list_crops())
    ids = {grp.group_id for grp in g.groups}
    assert {"solanaceas", "leguminosas", "hojas", "raices", "aliaceas", "cucurbitaceas"} <= ids
    assert g.order and g.order[0] == "leguminosas"  # legumbres primero (fijan nitrógeno)
    assert "INTA Pro-Huerta" in g.source and g.rules
    sol = next(grp for grp in g.groups if grp.group_id == "solanaceas")
    assert "Tomate" in sol.crops and sol.return_interval_years and sol.return_interval_years >= 3
