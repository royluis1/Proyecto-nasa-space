"""Tests del bloque de calendario, escenarios y reporte."""

import csv
import io

import pytest

from app.models.enums import Level, RiskKind
from app.schemas.priority import Priorities
from app.schemas.rotation import (
    P_LIMITED,
    RotationScore,
    ScenarioInput,
    SoilMoistureInput,
    VegetationInput,
)
from app.services.engine import parameters as P
from app.services.engine.calendar import build_calendar
from app.services.engine.context import apply_scenario, soil_from_field
from app.services.engine.engine import EngineRequest, run
from app.services.engine.scenarios import PRESETS, PRESETS_BY_ID, resilience
from app.services.engine.timeline import build_timeline
from app.services.engine.water import water_balance
from app.tests.helpers import make_climate, make_field, rot

SOJA_MAIZ = rot(("soja", 1, 11, 4), ("maiz", 2, 10, 3))


def engine(repo, scenario=None, field=None):
    field = field or make_field()
    req = EngineRequest(
        field=field, climate=make_climate(), priorities=Priorities(), scenario=scenario,
        declared_actual=rot(("soja", 1, 11, 4), ("maiz", 2, 10, 3), rid=f"{field.id}-actual"),
    )
    return run(req, repo.crops, repo.templates)


def total_of(result, strategy="actual"):
    return next(ev.score.total for ev in result.evaluations if ev.rotation.strategy.value == strategy)


# --- escenarios predefinidos ---


def test_hay_12_escenarios_predefinidos_con_los_pedidos():
    ids = [p.scenario.id for p in PRESETS]
    assert ids == ["base", "anio-seco", "lluvias-intensas", "olas-calor", "lluvia-10", "lluvia-20", "lluvia-30",
                   "temp-1", "temp-2", "sin-riego", "riego-limitado", "riego-disponible"]
    assert PRESETS_BY_ID["lluvia-30"].scenario.rain_delta_pct == -30
    assert PRESETS_BY_ID["temp-2"].scenario.temp_delta_c == 2
    assert all(p.help for p in PRESETS)


def test_riego_limitado_es_el_mismo_en_esquema_y_motor():
    assert P_LIMITED == P.LIMITED_IRRIGATION_SHARE


@pytest.mark.parametrize(
    "level, field_irrigated, share",
    [("lote", False, 0.0), ("lote", True, 1.0), ("sin_riego", True, 0.0), ("limitado", False, 0.5), ("disponible", False, 1.0)],
)
def test_nivel_de_riego(level, field_irrigated, share):
    assert ScenarioInput(irrigation_level=level).irrigation_share(field_irrigated) == share


def test_irrigation_true_sigue_valiendo_como_riego_disponible():
    assert ScenarioInput(irrigation=True).irrigation_share(False) == 1.0


def test_ola_de_calor_solo_cambia_el_verano():
    base = make_climate()
    hot = apply_scenario(base, ScenarioInput(heat_wave=True))
    for m in range(12):
        if m + 1 in P.HEAT_WAVE_MONTHS:
            assert hot.heat_freq[m] > base.heat_freq[m] and hot.et0[m] > base.et0[m]
        else:
            assert hot.heat_freq[m] == base.heat_freq[m] and hot.et0[m] == base.et0[m]
    assert hot.precip == base.precip


def test_lluvias_intensas_suman_lluvia_que_en_parte_escurre(crops):
    base = make_climate()
    wet = apply_scenario(base, ScenarioInput(heavy_rain=True))
    assert wet.annual_precip > base.annual_precip
    assert wet.erosion_factor == P.HEAVY_RAIN_EROSION
    jan_rain, jan_extra = wet.useful_rain(0)
    assert jan_rain == pytest.approx(base.precip[0])
    assert jan_extra == pytest.approx(P.HEAVY_RAIN_INFILTRATION * base.precip[0] * (P.HEAVY_RAIN_FACTOR - 1))
    # sin escurrimiento, la misma lluvia extra cubriría más demanda
    soil = soil_from_field(make_field())
    cal = build_calendar(SOJA_MAIZ, crops)
    plain = apply_scenario(base, ScenarioInput(rain_delta_pct=0))
    assert water_balance(cal, wet, soil, False).coverage >= water_balance(cal, plain, soil, False).coverage


def test_lluvias_intensas_marcan_erosion_hidrica_en_rotaciones_con_suelo_desnudo(repo):
    r = engine(repo, ScenarioInput(heavy_rain=True))
    actual = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "actual")
    assert any(f.kind == RiskKind.EROSION and "lluvias intensas" in f.message for f in actual.risk_flags)


# --- recálculo del motor ---


def test_menos_lluvia_baja_el_puntaje(repo):
    totals = [total_of(engine(repo, ScenarioInput(rain_delta_pct=d))) for d in (0, -10, -20, -30)]
    assert totals == sorted(totals, reverse=True) and totals[0] > totals[-1]


def test_mas_temperatura_baja_el_puntaje(repo):
    totals = [total_of(engine(repo, ScenarioInput(temp_delta_c=t))) for t in (0, 1, 2)]
    assert totals[0] >= totals[1] >= totals[2] and totals[0] > totals[2]


def test_riego_disponible_mejor_que_limitado_mejor_que_sin_riego(repo):
    def water(level):
        r = engine(repo, ScenarioInput(irrigation_level=level))
        ev = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "actual")
        return next(c.value for c in ev.score.components if c.key.value == "A"), r

    none, _ = water("sin_riego")
    limited, r_lim = water("limitado")
    full, _ = water("disponible")
    assert none < limited < full
    assert any("riego limitado" in w for w in r_lim.warnings)


def test_sin_riego_en_un_lote_regado_avisa_y_evalua_en_secano(repo):
    r = engine(repo, ScenarioInput(irrigation_level="sin_riego"), field=make_field(irrigated=True))
    assert any("sin riego" in w.lower() for w in r.warnings)
    assert r.inputs.irrigated is False


def test_explicacion_y_supuestos_cambian_con_el_escenario(repo):
    hot = engine(repo, ScenarioInput(id="x", name="Calor", heat_wave=True))
    ev = hot.evaluations[0]
    assert any("Ola de calor" in a for a in ev.recommendation.assumptions)
    assert any("ola de calor" in t for t in ev.recommendation.evidence.nasa_data)


# --- resistencia ---


def _score(rid, rank, total):
    return RotationScore(rotation_id=rid, rank=rank, total=total, components=[])


def test_resistencia_prefiere_la_que_nunca_cae_al_fondo():
    results = [
        ("base", [_score("a", 1, 80), _score("b", 2, 75)]),
        ("seco", [_score("b", 1, 70), _score("a", 2, 50)]),
    ]
    out = resilience(results)
    a, b = {r.rotation_id: r for r in out}["a"], {r.rotation_id: r for r in out}["b"]
    assert out[0].rotation_id == "b"  # mismo peor puesto (2), pero su peor puntaje es mayor
    assert a.max_drop == 30 and a.worst_scenario_id == "seco" and a.wins == 1
    assert b.mean_total == 72.5 and b.max_drop == 5


# --- calendario ---


def timeline(crops, rotation=SOJA_MAIZ, scenario=None, n=3, sm=None, veg=None, irrigated=False, share=1.0):
    climate = apply_scenario(make_climate(), scenario)
    return build_timeline(rotation, crops, climate, soil_from_field(make_field()), irrigated, share, n, 2027, sm, veg)


@pytest.mark.parametrize("n", [2, 3, 4])
def test_calendario_de_n_campanias_de_julio_a_junio(crops, n):
    tl = timeline(crops, n=n)
    assert [c.label for c in tl.campaigns] == [f"{2027 + i}/{str(2028 + i)[-2:]}" for i in range(n)]
    for c in tl.campaigns:
        assert len(c.months) == 12
        assert c.months[0].month == 7 and c.months[-1].month == 6
        assert c.months[0].year == 2026 + c.index and c.months[-1].year == 2027 + c.index
    assert [m.index for c in tl.campaigns for m in c.months] == list(range(12 * n))


def test_calendario_marca_etapas_cobertura_y_riesgos(crops):
    tl = timeline(crops)
    months = tl.campaigns[0].months
    by_label = {m.label: m for m in months}
    soja = by_label["nov 2027"]
    assert soja.crop_id == "soja" and soja.stage == "siembra" and soja.cover == "cultivo" and not soja.bare_soil
    assert by_label["ene 2028"].stage == "desarrollo"
    assert by_label["abr 2028"].stage == "cosecha"
    fallow = [m for m in months if m.crop_id is None]
    assert fallow and all(m.stage == "barbecho" and m.heat_risk is None and m.water_risk is None for m in fallow)
    assert all(m.cover in ("rastrojo", "desnudo") for m in fallow)
    assert all(m.heat_risk is not None and m.water_risk is not None for m in months if m.crop_id)
    stats = tl.campaigns[0]
    assert stats.covered_months == sum(1 for m in months if m.crop_id)
    assert stats.bare_months == sum(1 for m in months if m.bare_soil)


def test_calendario_recomienda_cobertura_en_barbechos_largos(crops):
    tl = timeline(crops)
    assert any(a.kind == "cobertura" for a in tl.advice)


def test_ola_de_calor_sube_el_riesgo_termico(crops):
    base = timeline(crops)
    hot = timeline(crops, scenario=ScenarioInput(heat_wave=True, temp_delta_c=2))
    count = lambda tl: sum(c.heat_risk_months for c in tl.campaigns)
    order = {None: -1, Level.BAJO: 0, Level.MEDIO: 1, Level.ALTO: 2}
    level = lambda tl: sum(order[m.heat_risk] for c in tl.campaigns for m in c.months)
    assert level(hot) > level(base) and count(hot) >= count(base)


def test_riego_baja_el_riesgo_hidrico(crops):
    order = {None: 0, Level.BAJO: 0, Level.MEDIO: 1, Level.ALTO: 2}
    dry = timeline(crops, scenario=ScenarioInput(rain_delta_pct=-30))
    wet = timeline(crops, scenario=ScenarioInput(rain_delta_pct=-30), irrigated=True)
    level = lambda tl: sum(order[m.water_risk] for c in tl.campaigns for m in c.months)
    assert level(wet) < level(dry)


def test_smap_seco_sube_el_riesgo_hidrico_del_arranque(crops):
    sm = SoilMoistureInput(product="SMAP_L4", anomaly_pct=-40)
    plain, dry = timeline(crops), timeline(crops, sm=sm)
    order = {None: 0, Level.BAJO: 0, Level.MEDIO: 1, Level.ALTO: 2}
    first = lambda tl: sum(order[m.water_risk] for m in tl.campaigns[0].months[:6])
    later = lambda tl: [m.water_risk for m in tl.campaigns[1].months]
    assert first(dry) > first(plain)
    assert later(dry) == later(plain)
    assert any(a.kind == "siembra" and "SMAP" in a.text for a in dry.advice)
    assert any("SMAP L4" in d for d in dry.data_used)


def test_ndvi_se_compara_con_lo_observado(crops):
    veg = VegetationInput(bare_soil_fraction=0.6)
    tl = timeline(crops, veg=veg)
    assert any(a.kind == "datos" and "MODIS NDVI" in a.text for a in tl.advice)
    assert not any("MODIS NDVI" in a.text for a in timeline(crops).advice)


def test_consejos_repetidos_se_juntan_por_campania(crops):
    one_year = rot(("maiz", 1, 10, 3))
    tl = timeline(crops, rotation=one_year, n=4, scenario=ScenarioInput(heat_wave=True, temp_delta_c=2))
    texts = [a.text for a in tl.advice]
    assert len(texts) == len(set(texts))
    heat = [a for a in tl.advice if a.kind == "calor"]
    assert heat and heat[0].campaigns == [1, 2, 3, 4]


# --- API ---


def test_api_presets(client):
    r = client.get("/scenarios/presets")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 12 and {d["group"] for d in data} == {"clima", "eventos", "lluvia", "temperatura", "riego"}


def test_api_escenarios_recalculan_riesgos_y_explicaciones(client):
    presets = client.get("/scenarios/presets").json()["data"]
    body = {"field_id": "campo-este", "scenarios": [p["scenario"] for p in presets]}
    data = client.post("/scenarios", json=body).json()["data"]
    assert len(data) == 12
    for res in data:
        assert res["ranking"] and len(res["rotations"]) == len(res["ranking"])
        assert all(n["why"] and n["summary"] for n in res["rotations"])
    totals = {res["scenario"]["id"]: res["ranking"][0]["total"] for res in data}
    assert totals["lluvia-30"] < totals["base"] < totals["riego-disponible"]


def test_api_calendario(client):
    r = client.post("/calendar", json={"field_id": "campo-este", "campaigns": 4, "first_campaign_year": 2030})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert len(d["campaigns"]) == 4 and d["campaigns"][0]["label"] == "2030/31"
    assert d["is_recommended"] and d["advice"][0]["kind"] == "rotacion"
    assert any("NASA POWER" in x for x in d["data_used"])
    actual = client.post("/calendar", json={"field_id": "campo-este", "rotation_id": "campo-este-actual", "campaigns": 2})
    assert actual.status_code == 200 and not actual.json()["data"]["is_recommended"]


@pytest.mark.parametrize("campaigns", [1, 5])
def test_api_calendario_valida_campanias(client, campaigns):
    assert client.post("/calendar", json={"field_id": "campo-este", "campaigns": campaigns}).status_code == 422


def test_api_calendario_rotacion_inexistente(client):
    r = client.post("/calendar", json={"field_id": "campo-este", "rotation_id": "no-existe"})
    assert r.status_code == 404


def test_api_reporte_completo(client):
    data = client.get("/export/report", params={"field_id": "campo-este"}).json()["data"]
    for key in ("generated_at", "field", "priorities", "weights", "climate", "ranking", "recommendation",
                "assumptions", "sources", "warnings", "disclaimer"):
        assert data[key] is not None, key
    assert data["resilience"] == []


def test_api_reporte_con_escenario_y_resistencia(client):
    body = {"field_id": "campo-este", "priorities": {"water": 10, "soil": 2, "risk": 5, "income": 1, "sustainability": 3},
            "scenario": {"id": "lluvia-20", "name": "Lluvia -20 %", "rain_delta_pct": -20},
            "scenario_ids": ["base", "anio-seco", "lluvia-30"]}
    data = client.post("/export/report", json=body).json()["data"]
    assert data["scenario"]["id"] == "lluvia-20" and data["climate"]["scenario"] == "Lluvia -20 %"
    assert data["priorities"]["water"] == 10
    assert len(data["resilience"]) == len(data["ranking"])
    assert {r["worst_scenario"] for r in data["resilience"]} <= {"Año normal", "Año seco", "Lluvia -30 %"}


def test_api_reporte_csv_por_secciones(client):
    r = client.post("/export/report", json={"field_id": "campo-este", "format": "csv", "scenario_ids": ["base", "anio-seco"]})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.text.lstrip("﻿")
    rows = list(csv.reader(io.StringIO(text)))
    sections = {row[0] for row in rows if row}
    for s in ("campo", "prioridades", "pesos", "clima", "recomendacion", "supuesto", "fuente", "advertencia", "resistencia_rotacion"):
        assert s in sections, s
    assert any(row[:1] == ["# Generado"] for row in rows)
