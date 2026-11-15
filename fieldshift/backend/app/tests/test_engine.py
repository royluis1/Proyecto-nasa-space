"""Tests del motor completo (engine.run) y del servicio con la muestra de NASA POWER."""

import pytest

from app.models.constants import DISCLAIMER
from app.models.enums import Confidence
from app.schemas.priority import Priorities
from app.schemas.rotation import CompareRequest, ScenarioInput, SoilMoistureInput, VegetationInput
from app.services.engine.engine import EngineRequest, run
from app.tests.helpers import make_climate, make_field, rot
from app.utils.exceptions import InvalidInputError

ALL = {"actual", "conservadora", "diversificada", "agua", "suelo", "rentabilidad", "mixta"}


def engine(repo, **kw):
    field = kw.pop("field", make_field())
    declared = kw.pop("declared", rot(("soja", 1, 11, 4), ("maiz", 2, 10, 3), rid=f"{field.id}-actual"))
    req = EngineRequest(
        field=field,
        climate=kw.pop("climate", make_climate()),
        priorities=kw.pop("priorities", Priorities()),
        declared_actual=declared,
        **kw,
    )
    return run(req, repo.crops, repo.templates)


def test_compara_las_7_estrategias_con_la_actual(repo):
    r = engine(repo)
    strategies = {ev.rotation.strategy.value for ev in r.evaluations}
    assert strategies == ALL
    assert len(r.ranking) >= 3
    assert [s.rank for s in r.ranking] == list(range(1, len(r.ranking) + 1))
    totals = [s.total for s in r.ranking]
    assert totals == sorted(totals, reverse=True)
    assert r.recommended_rotation_id == r.ranking[0].rotation_id


def test_cada_rotacion_tiene_todas_las_salidas(repo):
    r = engine(repo)
    for ev in r.evaluations:
        p, s, rec = ev.profile, ev.score, ev.recommendation
        # rotación
        assert p.sequence and p.duration_years and p.water_demand_mm_year > 0
        assert p.benefits is not None and p.risks is not None and p.justification is not None
        assert p.soil_impact and p.erosion_impact and p.biodiversity_impact
        assert p.relative_income and p.implementation_complexity
        # puntaje
        assert 0 <= s.uncertainty_low <= s.total <= s.uncertainty_high <= 100
        assert [c.key.value for c in s.components] == ["A", "S", "R", "I", "E"]
        assert sum(c.weight for c in s.components) == pytest.approx(1, abs=0.01)
        assert all(0 <= c.value <= 100 and c.drivers for c in s.components)
        # explicación y advertencias obligatorias
        assert len(rec.why) > 80
        assert rec.assumptions and rec.uncertainties and rec.risks
        assert rec.requires_agronomist and "agrónomo" in rec.validation_note
        assert rec.disclaimer == DISCLAIMER
        ev_ = rec.evidence
        assert ev_.nasa_data and ev_.local_soil and ev_.producer and ev_.needs_validation
        assert ev.source_ids and "nasa-power" in ev.source_ids and ev.assumption_ids
        assert ev.confidence in Confidence
    assert r.assumptions and r.sources and r.disclaimer == DISCLAIMER


def test_explicacion_de_la_recomendada(repo):
    r = engine(repo)
    best = r.evaluations[0]
    assert best.score.rank == 1
    if best.rotation.strategy.value != "actual":
        assert best.recommendation.why.startswith("Esta rotación se recomienda porque")
    actual = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "actual")
    assert "línea base" in actual.recommendation.why


def test_textos_con_coma_decimal(repo):
    r = engine(repo)
    import re

    for ev in r.evaluations:
        assert not re.search(r"\d\.\d", ev.recommendation.why), ev.recommendation.why


def test_prioridad_agua_favorece_rotaciones_de_menor_demanda(repo):
    agua = engine(repo, priorities=Priorities(water=10, soil=0, risk=0, income=0, sustainability=0))
    suelo = engine(repo, priorities=Priorities(water=0, soil=10, risk=0, income=0, sustainability=0))
    demand = {ev.rotation.id: ev.profile.water_demand_mm_year for ev in agua.evaluations}
    assert demand[agua.recommended_rotation_id] <= sorted(demand.values())[1]  # entre las dos de menor demanda
    assert agua.recommended_rotation_id != suelo.recommended_rotation_id


def test_mixta_elige_la_mejor_variante_segun_prioridades(repo):
    r = engine(repo)
    mixta = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "mixta")
    assert mixta.rotation.id.endswith("-mixta")
    assert any("mejor de" in rule for rule in mixta.rotation.rule_ids)


def test_semiarido_usa_plantillas_semiaridas(repo):
    r = engine(repo, climate=make_climate(rain=550, et0=1420))
    assert r.inputs.climate.zone.value == "semiarido"
    ids = {rule for ev in r.evaluations for rule in ev.rotation.rule_ids}
    assert "plantilla:agua-semiarido" in ids
    assert not any("mixta-sh" in i or "rent-subhumedo" in i for i in ids)


def test_con_riego_usa_plantillas_de_riego(repo):
    r = engine(repo, field=make_field(irrigated=True), climate=make_climate(rain=550, et0=1420))
    ids = {rule for ev in r.evaluations for rule in ev.rotation.rule_ids}
    assert "plantilla:agua-riego" in ids and "plantilla:rent-riego" in ids
    assert any(ev.profile.irrigation_mm_year for ev in r.evaluations)


def test_conservadora_aplica_reglas(repo):
    r = engine(repo, climate=make_climate(rain=550, et0=1420))  # semiárido en secano: maíz -> sorgo
    cons = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "conservadora")
    assert "regla:C1-agua" in cons.rotation.rule_ids
    assert "sorgo" in {s.crop_id for s in cons.rotation.steps}


def test_conservadora_corta_el_monocultivo(repo):
    r = engine(repo, declared=rot(("soja", 1, 11, 4), ("soja", 2, 11, 4), rid="lote-test-actual"))
    cons = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "conservadora")
    assert "regla:C2-monocultivo" in cons.rotation.rule_ids
    actual = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "actual")
    assert actual.profile.risks and any("monocultivo" in f.kind.value for f in actual.risk_flags)


def test_escenario_cambia_el_ranking_pero_no_las_rotaciones(repo):
    base = engine(repo)
    seco = engine(repo, scenario=ScenarioInput(id="seco", name="seco", rain_delta_pct=-40, temp_delta_c=2))
    assert {ev.rotation.id for ev in base.evaluations} == {ev.rotation.id for ev in seco.evaluations}
    assert seco.inputs.climate.scenario_precip_mm < base.inputs.climate.scenario_precip_mm
    by_id = {s.rotation_id: s.total for s in base.ranking}
    assert all(s.total < by_id[s.rotation_id] for s in seco.ranking)


def test_historial_con_monocultivo_avisa(repo):
    r = engine(repo, history=["maiz", "soja", "soja"])
    assert any("monocultivo reciente" in w for w in r.warnings)
    assert r.inputs.current_crop == "soja"


def test_historial_con_cultivo_desconocido_es_error(repo):
    with pytest.raises(InvalidInputError, match="desconocido"):
        engine(repo, history=["cultivo_inexistente"])


def test_sin_rotacion_actual_usa_el_historial(repo):
    r = engine(repo, declared=None, history=["soja", "maiz"])
    actual = next(ev for ev in r.evaluations if ev.rotation.strategy.value == "actual")
    assert [s.crop_id for s in actual.rotation.steps] == ["soja", "maiz"]


def test_sin_rotacion_ni_historial_es_error(repo):
    with pytest.raises(InvalidInputError, match="current_crop"):
        engine(repo, declared=None)


def test_smap_y_ndvi_se_usan_y_se_citan(repo):
    seco = engine(
        repo,
        soil_moisture=SoilMoistureInput(product="SMAP_L3", anomaly_pct=-40),
        vegetation=VegetationInput(bare_soil_fraction=0.8),
    )
    base = engine(repo)
    assert {"smap", "modis-ndvi"} <= {s.id for s in seco.sources}
    actual_s = next(ev for ev in seco.evaluations if ev.rotation.strategy.value == "actual")
    actual_b = next(ev for ev in base.evaluations if ev.rotation.strategy.value == "actual")
    assert actual_s.score.components[1].value < actual_b.score.components[1].value  # más erosión por NDVI
    assert any("NDVI" in w for w in seco.warnings)
    a_drivers = [d.factor for d in actual_s.score.components[0].drivers]
    assert "Humedad de suelo actual (SMAP)" in a_drivers


def test_confianza_baja_con_clima_de_muestra(repo):
    from app.models.enums import DataStatus

    r = engine(repo, climate=make_climate(origin=DataStatus.SAMPLE))
    assert r.confidence == Confidence.BAJA
    assert any("simulada" in reason for reason in r.confidence_reasons)


def test_confianza_sube_con_mejores_datos(repo):
    pobre = engine(repo, field=make_field(texture=None))
    mejor = engine(
        repo,
        field=make_field(lab=True),
        soil_moisture=SoilMoistureInput(product="SMAP_L4", anomaly_pct=0),
        vegetation=VegetationInput(bare_soil_fraction=0.3),
    )
    order = [Confidence.BAJA, Confidence.MEDIA, Confidence.ALTA]
    assert order.index(mejor.confidence) >= order.index(pobre.confidence)
    assert len(mejor.confidence_reasons) < len(pobre.confidence_reasons)


def test_determinista(repo):
    a, b = engine(repo), engine(repo)
    assert [(s.rotation_id, s.total) for s in a.ranking] == [(s.rotation_id, s.total) for s in b.ranking]


# --- con la muestra de NASA POWER (servicio) ---


@pytest.mark.parametrize("field_id", ["campo-este", "campo-centro", "campo-conlara"])
def test_servicio_con_los_tres_campos(rotation_service, field_id):
    result, climate = rotation_service.compare(CompareRequest(field_id=field_id))
    assert climate.status.value == "sample"
    assert len(result.ranking) >= 3
    assert result.evaluations[-1].score.rank == len(result.ranking)
    assert any("SIMULADOS" in w for w in result.warnings)
    assert result.inputs.history  # usa el historial del lote


def test_servicio_detalle_de_rotacion_generada(rotation_service):
    ev, _, _ = rotation_service.evaluation("campo-este-suelo")
    assert ev.rotation.strategy.value == "suelo"
