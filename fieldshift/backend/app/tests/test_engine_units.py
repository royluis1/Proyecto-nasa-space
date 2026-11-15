"""Tests unitarios del motor: calendario, agua, contexto, normalización y cada bonificación o penalización."""

import pytest

from app.models.enums import AridityZone
from app.models.enums import ScoreComponentKey as K
from app.schemas.priority import Priorities
from app.schemas.rotation import ScenarioInput
from app.services.engine import parameters as P
from app.services.engine.calendar import RotationCalendarError, build_calendar
from app.services.engine.context import apply_scenario, soil_from_field
from app.services.engine.scoring import (
    ScoringContext,
    compute_metrics,
    normalize_weights,
    score_components,
    total,
)
from app.services.engine.water import effective_rain, monthly_kc, water_balance
from app.tests.helpers import make_climate, make_field, rot

SOJA_MAIZ = rot(("soja", 1, 11, 4), ("maiz", 2, 10, 3))
SORGO_GIRASOL_MIJO = rot(("sorgo", 1, 11, 4), ("girasol", 2, 10, 2), ("mijo", 3, 12, 3))


def evaluate(rotation, crops, climate=None, field=None, irrigated=None, scenario=None, current=None):
    field = field or make_field()
    climate = apply_scenario(climate or make_climate(), scenario)
    soil = soil_from_field(field)
    irrigated = field.irrigated if irrigated is None else irrigated
    cal = build_calendar(rotation, crops)
    m = compute_metrics(cal, climate, soil, irrigated)
    ctx = ScoringContext(
        climate=climate, soil=soil, irrigated=irrigated, current_crop=crops.get(current) if current else None
    )
    return m, score_components(m, ctx, cal.steps[0].crop)


# --- calendario ---


def test_calendario_asigna_meses_y_barbecho(crops):
    cal = build_calendar(SOJA_MAIZ, crops)
    assert cal.n_months == 24
    assert cal.crop_at(10).id == "soja"  # noviembre del año 1
    assert cal.crop_at(5) is None  # junio del año 1: barbecho
    assert cal.crop_at(0).id == "maiz"  # el maíz del año 2 termina en marzo del año 1 siguiente (cíclico)


def test_calendario_permite_cosecha_y_siembra_en_el_mismo_mes(crops):
    r = rot(("soja", 1, 11, 4), ("cobertura_leguminosas", 2, 4, 9), ("maiz", 2, 10, 3))
    cal = build_calendar(r, crops)
    assert cal.crop_at(15).id == "cobertura_leguminosas"  # abril del año 2: el mes es del que se siembra


def test_calendario_rechaza_superposiciones(crops):
    with pytest.raises(RotationCalendarError, match="superpuestos"):
        build_calendar(rot(("soja", 1, 11, 4), ("trigo", 2, 2, 8)), crops)


def test_calendario_rechaza_cultivo_desconocido(crops):
    with pytest.raises(RotationCalendarError, match="desconocido"):
        build_calendar(rot(("cultivo_inexistente", 1, 9, 2)), crops)


# --- agua ---


def test_lluvia_efectiva_usda_scs():
    assert effective_rain(0) == 0
    assert effective_rain(100) == pytest.approx(100 * (125 - 20) / 125)  # 84 mm
    assert effective_rain(250) == pytest.approx(150)
    assert effective_rain(300) == pytest.approx(155)


def test_perfil_de_kc():
    assert [round(monthly_kc(k, 6, 0.4, 1.15, 0.5), 3) for k in range(6)] == [0.4, 0.775, 1.15, 1.15, 1.15, 0.5]
    assert monthly_kc(0, 1, 0.3, 1.0, 0.5) == 1.0


def test_balance_hidrico_cierra(crops):
    cal = build_calendar(SOJA_MAIZ, crops)
    soil = soil_from_field(make_field())
    wb = water_balance(cal, make_climate(), soil, irrigated=False)
    assert 0 < wb.coverage <= 1
    assert wb.irrigation_mm_year == 0
    assert wb.unmet_mm_year == pytest.approx(wb.demand_mm_year * (1 - wb.coverage))


def test_riego_cubre_el_80_por_ciento_del_deficit(crops):
    cal = build_calendar(SOJA_MAIZ, crops)
    soil = soil_from_field(make_field())
    wb = water_balance(cal, make_climate(), soil, irrigated=True)
    assert wb.irrigation_mm_year == pytest.approx(P.IRRIGATION_COVERAGE * wb.unmet_mm_year)
    assert wb.coverage_with_irrigation > wb.coverage


def test_mas_lluvia_mas_cobertura(crops):
    cal = build_calendar(SOJA_MAIZ, crops)
    soil = soil_from_field(make_field())
    seco = water_balance(cal, make_climate(rain=500), soil, False)
    humedo = water_balance(cal, make_climate(rain=900), soil, False)
    assert humedo.coverage > seco.coverage


# --- contexto y escenarios ---


@pytest.mark.parametrize(
    "index,zone",
    [
        (0.1, AridityZone.ARIDO),
        (0.41, AridityZone.SEMIARIDO),
        (0.55, AridityZone.SUBHUMEDO_SECO),
        (0.8, AridityZone.HUMEDO),
    ],
)
def test_zonas_de_aridez_unep(index, zone):
    assert P.aridity_zone(index) == zone


def test_con_riego_las_plantillas_son_las_de_zona_subhumeda():
    assert P.template_zone(AridityZone.SEMIARIDO) == "semiarido"
    assert P.template_zone(AridityZone.SEMIARIDO, irrigated=True) == "subhumedo"


def test_escenario_cambia_lluvia_et0_calor_y_heladas():
    base = make_climate()
    s = apply_scenario(base, ScenarioInput(id="s", name="s", rain_delta_pct=-20, temp_delta_c=2))
    assert s.annual_precip == pytest.approx(base.annual_precip * 0.8)
    assert s.annual_et0 == pytest.approx(base.annual_et0 * (1 + 2 * P.ET0_PER_DEGREE))
    assert all(h2 >= h1 for h1, h2 in zip(base.heat_freq, s.heat_freq))
    assert s.heat_freq[0] > base.heat_freq[0]
    assert s.tmin[6] == base.tmin[6] + 2
    assert s.zone == base.zone  # la zona no cambia con el escenario: las rotaciones siguen siendo comparables


def test_escenario_anio_seco_usa_el_analogo():
    base = make_climate()
    s = apply_scenario(base, ScenarioInput(id="s", name="s", dry_year=True))
    assert s.annual_precip == pytest.approx(base.annual_precip * 0.6)


def test_suelo_por_defecto_es_supuesto():
    soil = soil_from_field(make_field(texture=None))
    assert soil.texture_assumed and soil.texture == P.DEFAULT_TEXTURE
    arena = soil_from_field(make_field(texture="arenosa"))
    franca = soil_from_field(make_field(texture="franca"))
    assert arena.available_water_mm < franca.available_water_mm
    assert arena.wind_erodibility > franca.wind_erodibility


# --- normalización y pesos ---


def test_pesos_suman_uno_y_respetan_prioridades():
    w = normalize_weights(Priorities(water=10, soil=5, risk=5, income=0, sustainability=0))
    assert sum(w.values()) == pytest.approx(1)
    assert w[K.AGUA] == pytest.approx(0.5) and w[K.INGRESO] == 0


def test_prioridades_en_cero_dan_pesos_iguales():
    w = normalize_weights(Priorities(water=0, soil=0, risk=0, income=0, sustainability=0))
    assert all(v == pytest.approx(0.2) for v in w.values())


@pytest.mark.parametrize(
    "rotation", [SOJA_MAIZ, SORGO_GIRASOL_MIJO, rot(("soja", 1, 11, 4)), rot(("pastura_perenne", 1, 4, 3))]
)
@pytest.mark.parametrize("rain", [200, 700, 1500])
def test_componentes_normalizados_entre_0_y_100(crops, rotation, rain):
    _, c = evaluate(rotation, crops, climate=make_climate(rain=rain))
    for k, v in c.values.items():
        assert 0 <= v <= 100, (k, v)
    assert 0 <= total(c.values, normalize_weights(Priorities())) <= 100


# --- bonificaciones y penalizaciones ---


def drivers(c, key):
    return {d.factor: d.points for d in c.drivers[key]}


def test_penalizacion_por_monocultivo(crops):
    m, c = evaluate(rot(("soja", 1, 11, 4)), crops)
    assert m.monoculture == ["Soja"]
    assert drivers(c, K.RIESGO)["Penalización por monocultivo"] < 0
    assert drivers(c, K.SOSTENIBILIDAD)["Penalización por monocultivo"] < 0
    _, c2 = evaluate(SOJA_MAIZ, crops)
    assert "Penalización por monocultivo" not in drivers(c2, K.RIESGO)
    assert c2.values[K.SOSTENIBILIDAD] > c.values[K.SOSTENIBILIDAD]


def test_monocultivo_no_aplica_a_perennes(crops):
    m, _ = evaluate(rot(("pastura_perenne", 1, 4, 3), ("pastura_perenne", 2, 4, 3)), crops)
    assert m.monoculture == []


def test_bonificacion_por_diversificacion(crops):
    _, dos = evaluate(SOJA_MAIZ, crops)
    _, tres = evaluate(SORGO_GIRASOL_MIJO, crops)
    assert (
        drivers(tres, K.SOSTENIBILIDAD)["Bonificación por diversificación de cultivos"]
        > drivers(dos, K.SOSTENIBILIDAD)["Bonificación por diversificación de cultivos"]
    )


def test_bonificacion_por_leguminosas(crops):
    sin = rot(("sorgo", 1, 11, 4), ("maiz", 2, 10, 3))
    con = rot(("sorgo", 1, 11, 4), ("cobertura_leguminosas", 2, 4, 9), ("maiz", 2, 10, 3))
    _, c_sin = evaluate(sin, crops)
    _, c_con = evaluate(con, crops)
    assert drivers(c_sin, K.SUELO)["Bonificación por leguminosas"] == 0
    assert drivers(c_con, K.SUELO)["Bonificación por leguminosas"] > 0
    assert drivers(c_con, K.SOSTENIBILIDAD)["Bonificación por leguminosas"] > 0


def test_bonificacion_por_cobertura_y_menos_erosion(crops):
    desnudo = SOJA_MAIZ
    cubierto = rot(
        ("cobertura_gramineas", 1, 4, 8), ("soja", 1, 11, 4), ("cobertura_leguminosas", 2, 4, 9), ("maiz", 2, 10, 3)
    )
    m1, c1 = evaluate(desnudo, crops)
    m2, c2 = evaluate(cubierto, crops)
    assert m2.bare_months_per_year < m1.bare_months_per_year
    assert (
        drivers(c2, K.SUELO)["Bonificación por cobertura vegetal"]
        > drivers(c1, K.SUELO)["Bonificación por cobertura vegetal"]
    )
    assert c2.erosion_penalty < c1.erosion_penalty
    assert c2.values[K.SUELO] > c1.values[K.SUELO]


def test_penalizacion_por_erosion_depende_de_textura_y_pendiente(crops):
    _, arena = evaluate(SOJA_MAIZ, crops, field=make_field(texture="arenosa"))
    _, franca = evaluate(SOJA_MAIZ, crops, field=make_field(texture="franca"))
    _, pendiente = evaluate(SOJA_MAIZ, crops, field=make_field(texture="arenosa", slope=4))
    assert arena.erosion_penalty > franca.erosion_penalty
    assert pendiente.erosion_penalty > arena.erosion_penalty


def test_rastrojo_alto_protege_mas_que_bajo(crops):
    """Mismo calendario: el barbecho después del sorgo (mucho rastrojo) erosiona menos que después de la soja."""
    m_sorgo, _ = evaluate(rot(("sorgo", 1, 11, 4)), crops)
    m_soja, _ = evaluate(rot(("soja", 1, 11, 4)), crops)
    assert m_sorgo.erosion_index < m_soja.erosion_index


def test_penalizacion_por_alta_demanda_hidrica(crops):
    alta = rot(("trigo", 1, 6, 11), ("soja", 1, 12, 4), ("cobertura_leguminosas", 2, 4, 9), ("maiz", 2, 10, 3))
    _, c_alta = evaluate(alta, crops, climate=make_climate(rain=550))
    _, c_baja = evaluate(SORGO_GIRASOL_MIJO, crops, climate=make_climate(rain=550))
    assert drivers(c_alta, K.AGUA)["Penalización por alta demanda hídrica"] < drivers(c_baja, K.AGUA).get(
        "Penalización por alta demanda hídrica", 0
    )
    assert c_baja.values[K.AGUA] > c_alta.values[K.AGUA]


def test_ajuste_por_riego(crops):
    field = make_field()
    _, secano = evaluate(SOJA_MAIZ, crops, field=field, irrigated=False)
    _, riego = evaluate(SOJA_MAIZ, crops, field=field, irrigated=True)
    d = drivers(riego, K.AGUA)
    assert d["Ajuste por riego: costo del agua aplicada"] < 0  # el agua aplicada tiene costo
    assert riego.values[K.AGUA] > secano.values[K.AGUA]  # pero cubre el déficit
    assert riego.values[K.INGRESO] > secano.values[K.INGRESO]  # y mejora el rendimiento esperado


def test_escenario_seco_baja_agua_e_ingreso(crops):
    _, base = evaluate(SOJA_MAIZ, crops)
    _, seco = evaluate(SOJA_MAIZ, crops, scenario=ScenarioInput(id="s", name="s", rain_delta_pct=-30))
    assert seco.values[K.AGUA] < base.values[K.AGUA]
    assert seco.values[K.INGRESO] < base.values[K.INGRESO]
    assert seco.values[K.RIESGO] < base.values[K.RIESGO]


def test_escenario_caluroso_baja_resiliencia_climatica(crops):
    _, base = evaluate(SOJA_MAIZ, crops)
    _, calor = evaluate(SOJA_MAIZ, crops, scenario=ScenarioInput(id="s", name="s", temp_delta_c=3))
    assert drivers(calor, K.RIESGO)["Exposición a calor"] < drivers(base, K.RIESGO)["Exposición a calor"]
    assert calor.values[K.RIESGO] < base.values[K.RIESGO]


def test_tolerancia_a_sequia_suma(crops):
    _, maiz = evaluate(rot(("maiz", 1, 12, 5)), crops)
    _, sorgo = evaluate(rot(("sorgo", 1, 11, 4)), crops)
    assert (
        drivers(sorgo, K.AGUA)["Tolerancia a sequía de los cultivos"]
        > drivers(maiz, K.AGUA)["Tolerancia a sequía de los cultivos"]
    )


def test_intervalo_de_retorno_corto(crops):
    m, c = evaluate(rot(("girasol", 1, 10, 2), ("sorgo", 2, 11, 4)), crops)
    assert any("Girasol" in v for v in m.interval_violations)
    assert drivers(c, K.RIESGO)["Intervalo de retorno corto"] < 0


def test_antecesor_desfavorable_y_cultivo_actual(crops):
    m, c = evaluate(rot(("soja", 1, 11, 4), ("mani", 2, 10, 4)), crops, current="soja")
    assert any("Maní después de Soja" in b for b in m.bad_predecessors)
    d = drivers(c, K.RIESGO)
    assert d["Antecesores desfavorables"] < 0
    assert d["Inicio desfavorable sobre el cultivo actual"] < 0


def test_ingreso_usa_ky_y_castiga_el_deficit(crops):
    """Con menos lluvia el maíz (Ky 1,25) pierde más ingreso relativo que el sorgo (Ky 0,9)."""

    def income(r, rain):
        return evaluate(r, crops, climate=make_climate(rain=rain))[1].values[K.INGRESO]

    maiz, sorgo = rot(("maiz", 1, 12, 5)), rot(("sorgo", 1, 11, 4))
    caida_maiz = income(maiz, 800) - income(maiz, 450)
    caida_sorgo = income(sorgo, 800) - income(sorgo, 450)
    assert caida_maiz > caida_sorgo > 0


def test_cobertura_cuesta_ingreso(crops):
    _, sin = evaluate(SOJA_MAIZ, crops)
    _, con = evaluate(rot(("cobertura_gramineas", 1, 4, 8), ("soja", 1, 11, 4), ("maiz", 2, 10, 3)), crops)
    assert con.values[K.INGRESO] < sin.values[K.INGRESO]


def test_cada_componente_tiene_drivers_con_procedencia(crops):
    _, c = evaluate(SOJA_MAIZ, crops)
    for key, ds in c.drivers.items():
        assert ds, key
        for d in ds:
            assert d.detail and d.provenance.label and d.effect in ("sube", "baja", "neutro")
