"""Motor de rotaciones: genera candidatas, las puntúa, las ordena y las explica.

Es una función pura: recibe el clima ya resumido, el lote y los catálogos, y no hace
red ni disco. La obtención del clima está en service.py.
"""

from dataclasses import dataclass, field

from app.models.enums import Confidence, Level, RotationStrategy, ScoreComponentKey
from app.schemas.crop import Crop
from app.schemas.field import FieldOut
from app.schemas.priority import Priorities
from app.schemas.rotation import (
    ClimateInputSummary,
    CompareResult,
    EngineInputsSummary,
    Rotation,
    RotationEvaluation,
    RotationScore,
    RotationTemplate,
    ScenarioInput,
    SoilInputSummary,
    SoilMoistureInput,
    VegetationInput,
)
from app.services.engine import parameters as P
from app.services.engine.calendar import RotationCalendarError, build_calendar, calendar_warnings
from app.services.engine.context import ClimateContext, apply_scenario, perturb, soil_from_field
from app.services.engine.explain import (
    Evaluated,
    build_profile,
    confidence_for,
    evidence,
    recommendation,
    risk_flags,
)
from app.services.engine.generator import actual_rotation, generate, rotation_id
from app.services.engine.scoring import (
    ScoringContext,
    compute_metrics,
    normalize_weights,
    score_components,
    to_schema,
    total,
)
from app.utils.exceptions import InvalidInputError

MIN_ROTATIONS = 3
_CONF_ORDER = [Confidence.BAJA, Confidence.MEDIA, Confidence.ALTA]


@dataclass
class EngineRequest:
    field: FieldOut
    climate: ClimateContext  # clima base, sin escenario
    priorities: Priorities
    priorities_default: bool = False
    scenario: ScenarioInput | None = None
    declared_actual: Rotation | None = None
    extra_rotations: list[Rotation] = field(default_factory=list)
    history: list[str] = field(default_factory=list)
    current_crop: str | None = None
    strategies: list[RotationStrategy] | None = None
    soil_moisture: SoilMoistureInput | None = None
    vegetation: VegetationInput | None = None
    warnings: list[str] = field(default_factory=list)


def _signature(rotation: Rotation) -> tuple:
    return (
        rotation.duration_years,
        tuple(sorted((s.crop_id, s.year, s.start_month, s.end_month) for s in rotation.steps)),
    )


def _evaluate(
    rotation: Rotation,
    crops: dict[str, Crop],
    climate: ClimateContext,
    ctx: ScoringContext,
    weights: dict[ScoreComponentKey, float],
    erosion_scale: float = 1.0,
) -> Evaluated:
    try:
        calendar = build_calendar(rotation, crops)
    except RotationCalendarError as exc:
        raise InvalidInputError(str(exc), {"rotation_id": rotation.id}) from None
    metrics = compute_metrics(calendar, climate, ctx.soil, ctx.irrigated)
    comps = score_components(metrics, ctx, calendar.steps[0].crop, erosion_scale)
    return Evaluated(rotation=rotation, metrics=metrics, components=comps, total=total(comps.values, weights))


def _uncertainty(
    ev: Evaluated, crops, climate: ClimateContext, ctx: ScoringContext, weights, erosion_scale: float
) -> tuple[float, float]:
    totals = [ev.total]
    for rain, et0 in ((1 - P.SENSITIVITY_RAIN, 1 + P.SENSITIVITY_ET0), (1 + P.SENSITIVITY_RAIN, 1 - P.SENSITIVITY_ET0)):
        alt_climate = perturb(climate, rain, et0)
        alt_ctx = ScoringContext(**{**ctx.__dict__, "climate": alt_climate})
        totals.append(_evaluate(ev.rotation, crops, alt_climate, alt_ctx, weights, erosion_scale).total)
    margin = P.CONFIDENCE_MARGIN[ev.confidence.value]
    return max(0.0, min(totals) - margin), min(100.0, max(totals) + margin)


def run(req: EngineRequest, crops: dict[str, Crop], templates: list[RotationTemplate]) -> CompareResult:
    field_ = req.field
    warnings = list(req.warnings)
    for crop_id in [*req.history, *([req.current_crop] if req.current_crop else [])]:
        if crop_id not in crops:
            raise InvalidInputError(f"Cultivo desconocido en el historial: '{crop_id}'.", {"crop_id": crop_id})

    soil = soil_from_field(field_)
    irrigated = field_.irrigated or bool(req.scenario and req.scenario.irrigation)
    if req.scenario and req.scenario.irrigation and not field_.irrigated:
        warnings.append("Escenario con riego: el lote se evalúa como si tuviera riego.")
    if soil.texture_assumed:
        warnings.append("Textura del suelo no informada: se supone franco arenosa.")
    climate = apply_scenario(req.climate, req.scenario)
    if req.scenario and req.scenario.dry_year and req.climate.driest_year is None:
        warnings.append("No hay años completos para elegir un año seco análogo: se usa la climatología.")

    current_id = req.current_crop or (req.history[-1] if req.history else None)
    current = crops.get(current_id) if current_id else None
    repeat = req.history[-1] if len(req.history) >= 2 and req.history[-1] == req.history[-2] else None
    if repeat:
        warnings.append(
            f"El historial muestra {crops[repeat].name} en las últimas campañas seguidas (monocultivo reciente)."
        )

    ctx = ScoringContext(
        climate=climate,
        soil=soil,
        irrigated=irrigated,
        current_crop=current,
        history_repeat=repeat,
        soil_moisture=req.soil_moisture,
        vegetation=req.vegetation,
    )
    weights = normalize_weights(req.priorities)
    zone = P.template_zone(req.climate.zone, field_.irrigated)

    actual = actual_rotation(field_, req.declared_actual, req.history, crops)
    try:
        warnings += [f"Rotación actual: {w}" for w in calendar_warnings(build_calendar(actual, crops))]
    except RotationCalendarError as exc:
        raise InvalidInputError(f"La rotación actual no es válida: {exc}") from None
    generated, mixed = generate(field_, actual, templates, crops, zone, field_.irrigated, req.strategies)

    # NDVI: si muestra más suelo desnudo que la rotación declarada, se corrige la erosión de la actual.
    actual_erosion_scale = 1.0
    if req.vegetation is not None:
        actual_ev0 = _evaluate(actual, crops, climate, ctx, weights)
        declared_bare = actual_ev0.metrics.bare_months_per_year / 12
        if req.vegetation.bare_soil_fraction > declared_bare + 0.15:
            actual_erosion_scale = min(2.0, req.vegetation.bare_soil_fraction / max(declared_bare, 0.05))
            warnings.append(
                f"El NDVI muestra suelo desnudo el {req.vegetation.bare_soil_fraction * 100:.0f} % del tiempo, más que lo declarado "
                f"({declared_bare * 100:.0f} %): se aumentó la exposición a erosión de la rotación actual."
            )

    evaluated: list[Evaluated] = [_evaluate(actual, crops, climate, ctx, weights, actual_erosion_scale)]
    for rot in [*req.extra_rotations, *generated]:
        evaluated.append(_evaluate(rot, crops, climate, ctx, weights))
    if mixed:
        variants = [_evaluate(r, crops, climate, ctx, weights) for r in mixed]
        best = max(variants, key=lambda e: e.total)
        best.rotation = best.rotation.model_copy(
            update={
                "id": rotation_id(field_.id, RotationStrategy.MIXTA),
                "name": f"Mixta recomendada: {best.rotation.name}",
                "rule_ids": [
                    *best.rotation.rule_ids,
                    f"seleccion:mejor de {len(variants)} variantes mixtas con tus prioridades",
                ],
            }
        )
        evaluated.append(best)

    seen: dict[tuple, str] = {}
    unique: list[Evaluated] = []
    for ev in evaluated:
        sig = _signature(ev.rotation)
        if sig in seen:
            warnings.append(f"'{ev.rotation.name}' coincide con '{seen[sig]}': se muestra una sola vez.")
            continue
        seen[sig] = ev.rotation.name
        unique.append(ev)
    if len(unique) < MIN_ROTATIONS:
        raise InvalidInputError(f"Se necesitan al menos {MIN_ROTATIONS} rotaciones distintas para comparar.")

    base = unique[0]
    actual_crop_ids = set(base.metrics.crop_ids)
    for ev in unique:
        ev.new_crops = [crops[c] for c in dict.fromkeys(ev.metrics.crop_ids) if c not in actual_crop_ids]
        ev.confidence, ev.confidence_reasons = confidence_for(
            [crops[c] for c in ev.metrics.crop_ids], climate, soil, req.soil_moisture, req.vegetation
        )
        scale = actual_erosion_scale if ev is base else 1.0
        ev.low, ev.high = _uncertainty(ev, crops, climate, ctx, weights, scale)

    ranked = sorted(unique, key=lambda e: (-round(e.total, 6), e is not base))
    best = ranked[0]
    n = len(ranked)
    scenario_id = req.scenario.id if req.scenario else None
    history_ids = req.history

    scores: list[RotationScore] = []
    evaluations: list[RotationEvaluation] = []
    for rank, ev in enumerate(ranked, start=1):
        is_actual = ev is base
        profile = build_profile(ev, base, is_actual)
        flags = risk_flags(ev, climate)
        ev_evidence = evidence(
            ev,
            climate,
            req.climate,
            soil,
            irrigated,
            weights,
            history_ids,
            current,
            crops,
            req.soil_moisture,
            req.vegetation,
        )
        rec = recommendation(
            ev,
            base,
            best,
            rank,
            n,
            weights,
            is_actual,
            flags,
            ev_evidence,
            climate,
            soil,
            irrigated,
            req.soil_moisture,
            req.vegetation,
            profile,
        )
        r_value = ev.components.values[ScoreComponentKey.RIESGO]
        score = RotationScore(
            rotation_id=ev.rotation.id,
            scenario_id=scenario_id,
            rank=rank,
            total=round(ev.total, 1),
            uncertainty_low=round(ev.low, 1),
            uncertainty_high=round(ev.high, 1),
            components=to_schema(ev.components, weights),
            relative_water_demand=profile.relative_water_demand,
            risk_level=Level.BAJO if r_value >= 70 else Level.MEDIO if r_value >= 45 else Level.ALTO,
            confidence=ev.confidence,
        )
        scores.append(score)
        rot_warnings = calendar_warnings(ev.metrics.calendar) if ev.rotation.origin == "declarada" else []
        evaluations.append(
            RotationEvaluation(
                rotation=ev.rotation,
                profile=profile,
                score=score,
                recommendation=rec,
                risk_flags=flags,
                assumption_ids=P.ASSUMPTION_IDS,
                source_ids=_source_ids(req),
                confidence=ev.confidence,
                confidence_reasons=ev.confidence_reasons or [],
                warnings=rot_warnings,
            )
        )

    overall = min((ev.confidence for ev in ranked), key=_CONF_ORDER.index)
    overall_reasons = list(dict.fromkeys(r for ev in ranked for r in (ev.confidence_reasons or [])))
    keys = {
        ScoreComponentKey.AGUA: "agua",
        ScoreComponentKey.SUELO: "suelo",
        ScoreComponentKey.RIESGO: "riesgo",
        ScoreComponentKey.INGRESO: "ingreso",
        ScoreComponentKey.SOSTENIBILIDAD: "sostenibilidad",
    }
    if req.priorities_default:
        warnings.append("Prioridades por defecto (estimado): el productor no las cargó.")

    return CompareResult(
        field_id=field_.id,
        priorities=req.priorities,
        weights={keys[k]: round(w, 3) for k, w in weights.items()},
        scenario=req.scenario,
        inputs=EngineInputsSummary(
            location=field_.location,
            climate=ClimateInputSummary(
                origin=req.climate.origin,
                origin_label=req.climate.origin.origin_label,
                period=req.climate.period,
                annual_precip_mm=round(req.climate.annual_precip, 0),
                annual_et0_mm=round(req.climate.annual_et0, 0),
                aridity_index=req.climate.aridity_index,
                zone=req.climate.zone,
                precip_cv_pct=req.climate.precip_cv_pct,
                heat_days_per_year=req.climate.heat_days_per_year,
                scenario=req.scenario.name if req.scenario else None,
                scenario_precip_mm=round(climate.annual_precip, 0),
                scenario_et0_mm=round(climate.annual_et0, 0),
            ),
            soil=SoilInputSummary(
                texture=None if soil.texture_assumed else soil.texture,
                texture_assumed=soil.texture_assumed,
                lab_analysis=soil.lab_analysis,
                available_water_mm=soil.available_water_mm,
                fallow_efficiency=soil.fallow_efficiency,
                slope_pct=soil.slope_pct,
            ),
            irrigated=irrigated,
            current_crop=current.id if current else None,
            history=history_ids,
            soil_moisture=req.soil_moisture,
            vegetation=req.vegetation,
            priorities_default=req.priorities_default,
        ),
        ranking=scores,
        evaluations=evaluations,
        recommended_rotation_id=best.rotation.id,
        confidence=overall,
        confidence_reasons=overall_reasons,
        assumptions=P.ASSUMPTIONS,
        sources=[P.SOURCES[s] for s in _source_ids(req)],
        warnings=list(dict.fromkeys(warnings)),
    )


def _source_ids(req: EngineRequest) -> list[str]:
    ids = ["nasa-power", "fao-56", "usda-scs", "unep-aridity", "catalogo-fieldshift"]
    if req.soil_moisture:
        ids.append("smap")
    if req.vegetation:
        ids.append("modis-ndvi")
    return ids
