"""Catálogo de cultivos y reglas de rotación: completos, coherentes y con fuente."""

import pytest

from app.models.enums import CropCycle
from app.services.engine.calendar import build_calendar, calendar_warnings, step_length
from app.services.engine.generator import from_template

REQUIRED = {
    "soja",
    "maiz",
    "trigo",
    "cebada",
    "sorgo",
    "girasol",
    "mani",
    "alfalfa",
    "vicia",
    "avena",
    "centeno",
    "mijo",
    "colza",
    "pastura_perenne",
    "cobertura_leguminosas",
    "cobertura_gramineas",
}


def test_catalogo_tiene_los_16_cultivos_pedidos(crops):
    assert REQUIRED <= set(crops)


def test_cada_cultivo_tiene_todos_los_atributos(crops):
    for c in crops.values():
        assert c.name and c.scientific_name and c.sowing_window and c.agronomic_notes, c.id
        assert c.main_use and c.sources and c.confidence, c.id
        assert c.cycle_months.min <= c.cycle_months.max
        assert c.default_calendar.start_month in c.sowing_months
        # Las coberturas no se venden: sin ingreso ni rendimiento ni mercado.
        if c.is_cover_crop:
            assert c.relative_income is None and c.relative_yield is None and c.local_market is None, c.id
        else:
            assert c.relative_income is not None and c.ky is not None, c.id


def test_valores_numericos_tienen_fuente(crops):
    for c in crops.values():
        assert c.kc is not None and c.kc_source, c.id
        assert "FAO-56" in c.kc_source or "Supuesto" in c.kc_source, c.id
        if c.ky is not None:
            assert "FAO-33" in c.ky_source or "Supuesto" in c.ky_source, c.id


def test_fijacion_de_nitrogeno_coherente(crops):
    legumes = {"soja", "mani", "alfalfa", "vicia", "cobertura_leguminosas"}
    assert {c.id for c in crops.values() if c.fixes_nitrogen} == legumes


def test_calendario_por_defecto_respeta_el_ciclo(crops):
    from app.schemas.rotation import RotationStep

    for c in crops.values():
        if c.cycle == CropCycle.PERENNE:
            continue
        step = RotationStep(
            crop_id=c.id, year=1, start_month=c.default_calendar.start_month, end_month=c.default_calendar.end_month
        )
        assert c.cycle_months.min <= step_length(step) <= c.cycle_months.max, c.id


def test_hay_plantillas_para_cada_estrategia_zona_y_riego(repo):
    from app.services.engine.generator import matching_templates

    for zone, irrigated in [("semiarido", False), ("subhumedo", False), ("subhumedo", True)]:
        found = matching_templates(repo.templates, zone, irrigated)
        for strategy in ["diversificada", "agua", "suelo", "rentabilidad", "mixta"]:
            assert found.get(strategy), (zone, irrigated, strategy)


@pytest.mark.parametrize(
    "template_id",
    [
        "agua-riego",
        "agua-semiarido",
        "agua-subhumedo",
        "suelo-semiarido",
        "suelo-general",
        "div-semiarido",
        "div-general",
        "rent-riego",
        "rent-semiarido",
        "rent-subhumedo",
        "mixta-sa-1",
        "mixta-sa-2",
        "mixta-sa-3",
        "mixta-sh-1",
        "mixta-sh-2",
        "mixta-sh-3",
    ],
)
def test_plantillas_validas(repo, template_id):
    """Sin superposiciones, siembra en época y ciclo dentro del rango del catálogo."""
    template = next(t for t in repo.templates if t.id == template_id)
    calendar = build_calendar(from_template(template, "x"), repo.crops)
    assert calendar_warnings(calendar) == []
    assert template.rationale


def test_rotaciones_actuales_validas(repo):
    for r in repo.rotations.values():
        build_calendar(r, repo.crops)
