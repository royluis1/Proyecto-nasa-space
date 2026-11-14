"""Puntaje explicable de una rotación.

Score = w_agua*A + w_suelo*S + w_riesgo*R + w_ingreso*I + w_sostenibilidad*E

Cada componente va de 0 a 100 y se arma con términos explícitos (ScoreDriver): cada
bonificación o penalización queda registrada con sus puntos y su motivo. La fórmula de
cada uno está en docs/scoring.md.
"""

from dataclasses import dataclass, field

from app.models.enums import Confidence, CropCycle, DataLabel, Level, ScoreComponentKey
from app.models.provenance import Provenance
from app.schemas.crop import Crop
from app.schemas.priority import Priorities
from app.schemas.rotation import (
    ScoreComponent,
    ScoreDriver,
    SoilMoistureInput,
    VegetationInput,
)
from app.services.engine import parameters as P
from app.services.engine.calendar import Calendar
from app.services.engine.context import ClimateContext, SoilContext
from app.services.engine.water import WaterBalance, water_balance

COMPONENT_NAMES = {
    ScoreComponentKey.AGUA: "Resiliencia hídrica",
    ScoreComponentKey.SUELO: "Salud del suelo",
    ScoreComponentKey.RIESGO: "Resiliencia climática",
    ScoreComponentKey.INGRESO: "Ingreso relativo estimado",
    ScoreComponentKey.SOSTENIBILIDAD: "Sostenibilidad y diversificación",
}
COMPONENT_ORDER = list(COMPONENT_NAMES)

_PROV = {
    ScoreComponentKey.AGUA: Provenance(
        label=DataLabel.ESTIMADO,
        source_id="nasa-power",
        method="Balance hídrico mensual: Kc FAO-56 x ET0 de NASA POWER, lluvia efectiva USDA-SCS",
        confidence=Confidence.MEDIA,
    ),
    ScoreComponentKey.SUELO: Provenance(
        label=DataLabel.ESTIMADO,
        source_id="catalogo-fieldshift",
        method="Meses cubiertos, aportes cualitativos del catálogo y exposición a erosión",
        confidence=Confidence.BAJA,
    ),
    ScoreComponentKey.RIESGO: Provenance(
        label=DataLabel.ESTIMADO,
        source_id="nasa-power",
        method="Exposición climática de NASA POWER x tolerancias del catálogo; reglas de rotación",
        confidence=Confidence.MEDIA,
    ),
    ScoreComponentKey.INGRESO: Provenance(
        label=DataLabel.SUPUESTO,
        source_id="catalogo-fieldshift",
        method="Ingreso relativo cualitativo, castigado por déficit hídrico; no son precios",
        confidence=Confidence.BAJA,
    ),
    ScoreComponentKey.SOSTENIBILIDAD: Provenance(
        label=DataLabel.ESTIMADO,
        source_id="catalogo-fieldshift",
        method="Cultivos y familias distintas, leguminosas, coberturas y repeticiones",
        confidence=Confidence.MEDIA,
    ),
}
_SUPUESTO = Provenance(label=DataLabel.SUPUESTO, confidence=Confidence.BAJA)


# Con anomalías normales, ~16 % de los meses tienen z <= -1: más que eso es un lugar más propenso a sequías.
EXPECTED_DROUGHT_PCT = 16.0


def fmt(x: float, decimals: int = 1) -> str:
    """Número con coma decimal, para los textos."""
    return f"{x:.{decimals}f}".replace(".", ",")


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def normalize_weights(p: Priorities) -> dict[ScoreComponentKey, float]:
    """Prioridades 0-10 -> pesos que suman 1. Si todas son 0, pesos iguales."""
    raw = dict(zip(COMPONENT_ORDER, [p.water, p.soil, p.risk, p.income, p.sustainability]))
    total = sum(raw.values())
    if total == 0:
        return {k: 1 / len(raw) for k in raw}
    return {k: v / total for k, v in raw.items()}


# --- Métricas (no dependen de las prioridades) ---


@dataclass
class Metrics:
    calendar: Calendar
    water: WaterBalance
    annual_precip: float
    crop_ids: list[str]
    cash_sequence: list[str]  # cultivos de cosecha en orden cronológico (sin coberturas)
    distinct_crops: int
    families: int
    legume_steps_per_year: float
    cover_steps: int
    covered_months: int
    covered_effective: float  # meses cubiertos ponderados por el agua disponible (biomasa)
    bare_months_per_year: float
    winter_covered_per_year: float  # meses de mayo a septiembre con cultivo vivo
    erosion_index: float  # exposición anual ponderada (antes de textura y pendiente)
    om_per_year: float
    root_levels: int
    drought_tolerance: float  # 0-1, promedio ponderado por meses
    heat_risk: float  # 0-1
    frost_risk: float
    drought_risk: float
    monoculture: list[str] = field(default_factory=list)
    monoculture_weight: float = 0.0  # suma de factores de riesgo sanitario de los cultivos repetidos
    interval_violations: list[str] = field(default_factory=list)
    bad_predecessors: list[str] = field(default_factory=list)
    good_predecessors: list[str] = field(default_factory=list)
    income_per_year: float = 0.0
    income_notes: list[str] = field(default_factory=list)
    double_crop: bool = False
    perennial: bool = False
    stressed_crops: list[str] = field(default_factory=list)


def _cyclic_pairs(seq: list):
    if len(seq) == 1:
        return [(seq[0], seq[0])]
    return list(zip(seq, seq[1:] + seq[:1]))


def compute_metrics(calendar: Calendar, climate: ClimateContext, soil: SoilContext, irrigated: bool) -> Metrics:
    n = calendar.n_months
    years = calendar.duration_years
    water = water_balance(calendar, climate, soil, irrigated)
    steps = list(calendar.steps)  # build_calendar los deja en orden cronológico
    crops = [p.crop for p in steps]

    covered = sum(1 for o in calendar.owner if o is not None)
    biomass = [1 - P.BIOMASS_STRESS_FACTOR * min(1.0, max(0.0, st)) for st in water.month_stress]
    covered_effective = sum(biomass[m] for m in range(n) if calendar.owner[m] is not None)
    winter = sum(1 for m in range(n) if calendar.owner[m] is not None and (m % 12) + 1 in (5, 6, 7, 8, 9))

    erosion = 0.0
    for m in range(n):
        if calendar.owner[m] is None:
            prev = calendar.previous_crop(m)
            exposure = P.RESIDUE_EXPOSURE[prev.erosion_risk] if prev else 1.0
            erosion += exposure * (P.WINDY_WEIGHT if (m % 12) + 1 in P.WINDY_MONTHS else 1.0)

    month_crops = [(m, calendar.crop_at(m)) for m in range(n) if calendar.owner[m] is not None]
    cv_factor = 1 + max(0.0, (climate.precip_cv_pct or 0) - 15) / 50
    heat = frost = drought = tol = 0.0
    for m, crop in month_crops:
        month = m % 12
        heat += min(1.0, climate.heat_freq[month] / 0.3) * P.SENSITIVITY[crop.heat_tolerance]
        tmin = climate.tmin[month]
        exposure = 1.0 if tmin <= P.FROST_TMIN_HIGH else 0.5 if tmin <= P.FROST_TMIN_MEDIUM else 0.0
        frost += exposure * P.SENSITIVITY[crop.frost_tolerance]
        drought += min(1.0, water.month_stress[m] * P.SENSITIVITY[crop.drought_tolerance] * cv_factor)
        tol += P.LEVEL_VALUE[crop.drought_tolerance]
    k = max(1, len(month_crops))

    cash = [c for c in crops if not c.is_cover_crop]
    cash_ids = [c.id for c in cash]
    monoculture, mono_weight = [], 0.0
    for a, b in _cyclic_pairs(cash):
        if a.id == b.id and a.cycle != CropCycle.PERENNE:
            monoculture.append(a.name)
            mono_weight += P.PEST_FACTOR[a.pest_risk]

    intervals = []
    for crop_id in dict.fromkeys(c.id for c in crops):
        crop = next(c for c in crops if c.id == crop_id)
        if crop.cycle == CropCycle.PERENNE:
            continue
        starts = sorted(p.months[0] for p in steps if p.crop.id == crop_id)
        gaps = [((b - a) % n or n) for a, b in _cyclic_pairs(starts)]
        shortest = round(min(gaps) / 12)
        if shortest < crop.rotation.return_interval_years.min:
            intervals.append(
                f"{crop.name} se siembra en campañas seguidas; conviene volver cada {crop.rotation.return_interval_years.min:g} años o más"
                if shortest <= 1
                else f"{crop.name} vuelve cada {shortest} años; conviene cada {crop.rotation.return_interval_years.min:g} o más"
            )

    bad, good = [], []
    for prev, cur in _cyclic_pairs(crops):
        if prev.id in cur.rotation.avoid_predecessors and not (prev.id == cur.id and cur.cycle == CropCycle.PERENNE):
            bad.append(f"{cur.name} después de {prev.name}")
        elif prev.id in cur.rotation.good_predecessors:
            good.append(f"{cur.name} después de {prev.name}")

    income = 0.0
    income_notes = []
    stressed = []
    for p, sw in zip(steps, water.steps):
        crop = p.crop
        if crop.is_cover_crop:
            income -= P.COVER_CROP_COST
            continue
        if crop.relative_income is None:
            continue
        ky = crop.ky if crop.ky is not None else P.DEFAULT_KY
        factor = max(0.0, 1 - ky * max(0.0, sw.stress))  # FAO-33: 1 - Ya/Ym = Ky (1 - ETa/ETm)
        yield_mult = P.YIELD_MULT[crop.relative_yield] if crop.relative_yield else 1.0
        value = P.INCOME_VALUE[crop.relative_income] * yield_mult * factor
        if crop.local_market == Level.BAJO:
            value *= P.LOW_MARKET_FACTOR
            income_notes.append(f"{crop.name}: mercado local limitado")
        if sw.stress > 0.25:
            stressed.append(
                f"{crop.name} ({sw.stress * 100:.0f} % de déficit, rinde ~{factor * 100:.0f} % de su potencial)"
            )
        income += value

    harvest_years: dict[int, int] = {}
    for p in steps:
        if not p.crop.is_cover_crop and p.crop.cycle != CropCycle.PERENNE:
            harvest_years[p.step.year] = harvest_years.get(p.step.year, 0) + 1

    return Metrics(
        calendar=calendar,
        water=water,
        annual_precip=climate.annual_precip,
        crop_ids=[c.id for c in crops],
        cash_sequence=cash_ids,
        distinct_crops=len({c.id for c in crops}),
        families=len({c.family for c in crops}),
        legume_steps_per_year=sum(1 for c in crops if c.fixes_nitrogen) / years,
        cover_steps=sum(1 for c in crops if c.is_cover_crop),
        covered_months=covered,
        covered_effective=covered_effective,
        bare_months_per_year=(n - covered) / years,
        winter_covered_per_year=winter / years,
        erosion_index=erosion / years,
        om_per_year=sum(
            P.LEVEL_VALUE[p.crop.organic_matter_contribution]
            * (1 - P.BIOMASS_STRESS_FACTOR * min(1.0, max(0.0, sw.stress)))
            for p, sw in zip(steps, water.steps)
        )
        / years,
        root_levels=len({c.root_depth for c in crops}),
        drought_tolerance=tol / k,
        heat_risk=heat / k,
        frost_risk=frost / k,
        drought_risk=drought / k,
        monoculture=monoculture,
        monoculture_weight=mono_weight,
        interval_violations=intervals,
        bad_predecessors=bad,
        good_predecessors=good,
        income_per_year=income / years,
        income_notes=list(dict.fromkeys(income_notes)),
        double_crop=any(v >= 2 for v in harvest_years.values()),
        perennial=any(c.cycle == CropCycle.PERENNE for c in crops),
        stressed_crops=stressed,
    )


# --- Componentes ---


def _d(factor: str, points: float, detail: str, prov: Provenance | None = None) -> ScoreDriver:
    effect = "sube" if points > 0.05 else "baja" if points < -0.05 else "neutro"
    return ScoreDriver(
        factor=factor, effect=effect, points=round(points, 1) + 0.0, detail=detail, provenance=prov or _SUPUESTO
    )


@dataclass
class ScoringContext:
    climate: ClimateContext
    soil: SoilContext
    irrigated: bool
    current_crop: Crop | None = None
    history_repeat: str | None = None  # cultivo repetido al final del historial
    soil_moisture: SoilMoistureInput | None = None
    vegetation: VegetationInput | None = None


def water_component(m: Metrics, ctx: ScoringContext) -> tuple[float, list[ScoreDriver]]:
    w = m.water
    coverage = w.coverage_with_irrigation if ctx.irrigated else w.coverage
    drivers = [
        _d(
            "Demanda cubierta por lluvia y agua almacenada" + (" y riego" if ctx.irrigated else ""),
            100 * coverage,
            f"Los cultivos demandan ~{w.demand_mm_year:.0f} mm/año (Kc x ET0); la lluvia efectiva y el perfil cubren "
            f"{w.coverage * 100:.0f} %"
            + (f" y el riego suma ~{w.irrigation_mm_year:.0f} mm/año." if ctx.irrigated else "."),
            _PROV[ScoreComponentKey.AGUA],
        )
    ]
    ratio = w.demand_mm_year / m.annual_precip if m.annual_precip > 0 else 2.0
    pen = min(P.DEMAND_PENALTY_MAX, max(0.0, ratio - P.DEMAND_PENALTY_FROM) * P.DEMAND_PENALTY_SLOPE)
    if pen > 0:
        drivers.append(
            _d(
                "Penalización por alta demanda hídrica",
                -pen,
                f"La demanda equivale al {ratio * 100:.0f} % de la lluvia anual (se penaliza desde el {P.DEMAND_PENALTY_FROM * 100:.0f} %).",
            )
        )
    if ctx.irrigated and w.irrigation_mm_year > 0:
        drivers.append(
            _d(
                "Ajuste por riego: costo del agua aplicada",
                -min(15.0, w.irrigation_mm_year / 40),
                f"El riego cubre el déficit, pero ~{w.irrigation_mm_year:.0f} mm/año tienen costo y presionan el acuífero.",
            )
        )
    drivers.append(
        _d(
            "Tolerancia a sequía de los cultivos",
            6 * m.drought_tolerance,
            f"Promedio de tolerancia a sequía: {fmt(m.drought_tolerance, 2)} (0 = baja, 1 = alta).",
        )
    )
    if ctx.soil_moisture:
        sm = ctx.soil_moisture
        shift = max(-5.0, min(5.0, sm.anomaly_pct / 5)) * max(0.5, min(1.2, ratio))
        label = "observado, capa superficial" if sm.product == "SMAP_L3" else "modelado, zona de raíces"
        drivers.append(
            _d(
                "Humedad de suelo actual (SMAP)",
                shift,
                f"{sm.product} ({label}): {sm.anomaly_pct:+.0f} % respecto de lo normal"
                + (f" en {sm.period}." if sm.period else "."),
                Provenance(
                    label=DataLabel.OBSERVADO if sm.product == "SMAP_L3" else DataLabel.MODELADO,
                    source_id="smap",
                    resolution="~9 km",
                ),
            )
        )
    return clamp(sum(d.points for d in drivers)), drivers


def _ndvi_drivers(ctx: ScoringContext) -> list[ScoreDriver]:
    """Solo para la rotación actual: el NDVI observa el manejo real, no las alternativas."""
    v = ctx.vegetation
    prov = Provenance(
        label=DataLabel.OBSERVADO,
        source_id="modis-ndvi",
        resolution="250 m" if v.product.endswith("Q1") else "500 m",
        note=f"Origen: {v.origin.origin_label}" if v.origin else None,
    )
    out = []
    if v.cover_fraction is not None:
        out.append(
            _d(
                "Cobertura observada (NDVI)",
                0.0,
                f"{v.product}: cobertura vegetal estimada {v.cover_fraction * 100:.0f} % y suelo desnudo "
                f"{v.bare_soil_fraction * 100:.0f} % del tiempo" + (f" ({v.period})." if v.period else "."),
                prov,
            )
        )
    t = v.biomass_trend_pct_per_decade
    if t is not None:
        if v.trend_significant and t < 0:
            out.append(
                _d(
                    "Tendencia de biomasa en baja (NDVI)",
                    -6.0,
                    f"El NDVI integrado por campaña cae {abs(t):.0f} % por década (tendencia significativa).",
                    prov,
                )
            )
        elif v.trend_significant and t > 0:
            out.append(
                _d(
                    "Tendencia de biomasa en alza (NDVI)",
                    4.0,
                    f"El NDVI integrado por campaña sube {t:.0f} % por década (tendencia significativa).",
                    prov,
                )
            )
        else:
            out.append(
                _d(
                    "Tendencia de biomasa (NDVI)",
                    0.0,
                    f"Cambio de {t:+.0f} % por década en el NDVI integrado, sin tendencia significativa.",
                    prov,
                )
            )
    return out


def soil_component(
    m: Metrics, ctx: ScoringContext, erosion_scale: float = 1.0, is_actual: bool = False
) -> tuple[float, list[ScoreDriver], float]:
    n = m.calendar.n_months
    drivers = [
        _d(
            "Bonificación por cobertura vegetal",
            40 * m.covered_effective / n,
            f"El lote tiene cultivo vivo {m.covered_months / n * 100:.0f} % de los meses "
            f"({fmt(m.winter_covered_per_year)} de 5 meses de invierno por año); con el déficit hídrico, la biomasa "
            f"equivale a {m.covered_effective / n * 100:.0f} %.",
        ),
        _d(
            "Aporte de materia orgánica",
            30 * min(1.0, m.om_per_year / 1.2),
            f"Aporte de rastrojo y raíces ajustado por agua: {fmt(m.om_per_year, 2)} por año (1,2 o más = máximo).",
        ),
        _d(
            "Bonificación por leguminosas",
            15 * min(1.0, m.legume_steps_per_year / 0.5),
            f"{fmt(m.legume_steps_per_year, 2)} cultivos que fijan nitrógeno por año (0,5 o más = máximo).",
        ),
        _d(
            "Diversidad de profundidad de raíces",
            7.5 * (m.root_levels - 1),
            f"{m.root_levels} profundidades de raíz distintas exploran distintas capas del perfil.",
        ),
    ]
    pen = min(40.0, m.erosion_index * erosion_scale * ctx.soil.wind_erodibility * ctx.soil.slope_factor * 3)
    detail = (
        f"{fmt(m.bare_months_per_year)} meses por año sin cultivo vivo; exposición ponderada por rastrojo y viento "
        f"{fmt(m.erosion_index * erosion_scale)}, textura {ctx.soil.texture.value.replace('_', ' ')}"
    )
    if ctx.soil.slope_pct:
        detail += f", pendiente {fmt(ctx.soil.slope_pct)} %"
    if erosion_scale != 1.0:
        detail += f" (ajustada por NDVI x{fmt(erosion_scale, 2)})"
    drivers.append(_d("Penalización por erosión", -pen, detail + "."))
    if is_actual and ctx.vegetation is not None:
        drivers += _ndvi_drivers(ctx)
    return clamp(sum(d.points for d in drivers)), drivers, pen


def risk_component(m: Metrics, ctx: ScoringContext, first_crop: Crop) -> tuple[float, list[ScoreDriver]]:
    climate_prov = _PROV[ScoreComponentKey.RIESGO]
    drivers = [
        _d(
            "Resiliencia climática base",
            100,
            "Se parte de 100 y se descuenta la exposición de cada cultivo.",
            climate_prov,
        ),
        _d(
            "Exposición a sequía",
            -60 * m.drought_risk,
            f"Déficit en los meses con cultivo x sensibilidad a sequía (índice {fmt(m.drought_risk, 2)}"
            + (f"; variabilidad de lluvia {ctx.climate.precip_cv_pct:.0f} %)." if ctx.climate.precip_cv_pct else ")."),
            climate_prov,
        ),
        _d(
            "Exposición a calor",
            -30 * m.heat_risk,
            f"Días con Tmax > 35 °C en los meses con cultivo x sensibilidad al calor (índice {fmt(m.heat_risk, 2)}).",
            climate_prov,
        ),
        _d(
            "Exposición a heladas",
            -15 * m.frost_risk,
            f"Meses fríos con cultivo x sensibilidad a heladas (índice {fmt(m.frost_risk, 2)}).",
            climate_prov,
        ),
    ]
    if m.monoculture:
        pen = min(30.0, 10 * m.monoculture_weight)
        drivers.append(
            _d(
                "Penalización por monocultivo",
                -pen,
                "Se repite en campañas seguidas: "
                + ", ".join(dict.fromkeys(m.monoculture))
                + ". Aumentan plagas y enfermedades.",
            )
        )
    if m.interval_violations:
        drivers.append(
            _d(
                "Intervalo de retorno corto",
                -min(18.0, 6 * len(m.interval_violations)),
                "; ".join(m.interval_violations) + ".",
            )
        )
    if m.bad_predecessors:
        drivers.append(
            _d(
                "Antecesores desfavorables",
                -min(15.0, 5 * len(m.bad_predecessors)),
                "; ".join(m.bad_predecessors) + ".",
            )
        )
    if m.good_predecessors:
        drivers.append(
            _d(
                "Antecesores favorables",
                min(6.0, 2 * len(m.good_predecessors)),
                "; ".join(m.good_predecessors[:3]) + ".",
            )
        )
    sm = ctx.soil_moisture
    if sm is not None and sm.drought_frequency_pct is not None:
        sensitivity = 1 - 0.7 * m.drought_tolerance
        excess = max(0.0, sm.drought_frequency_pct - EXPECTED_DROUGHT_PCT)
        drivers.append(
            _d(
                "Frecuencia de sequías de suelo (SMAP)",
                -min(10.0, excess / 2) * sensitivity,
                f"SMAP {'L3' if sm.product == 'SMAP_L3' else 'L4'}: {sm.drought_frequency_pct:.0f} % de los meses con sequía de humedad de suelo "
                f"(lo esperable es ~{EXPECTED_DROUGHT_PCT:.0f} %); pesa más en cultivos poco tolerantes.",
                Provenance(
                    label=DataLabel.OBSERVADO if sm.product == "SMAP_L3" else DataLabel.MODELADO,
                    source_id="smap",
                    resolution="~9 km",
                ),
            )
        )
    if ctx.current_crop is not None:
        cur = ctx.current_crop
        if cur.id in first_crop.rotation.avoid_predecessors:
            extra = 8.0 if (ctx.history_repeat == first_crop.id) else 5.0
            drivers.append(
                _d(
                    "Inicio desfavorable sobre el cultivo actual",
                    -extra,
                    f"Empieza con {first_crop.name} sobre {cur.name} (cultivo actual)"
                    + (", que ya se repitió en el historial." if ctx.history_repeat == first_crop.id else "."),
                )
            )
    return clamp(sum(d.points for d in drivers)), drivers


def income_component(m: Metrics) -> tuple[float, list[ScoreDriver]]:
    value = 100 * min(1.0, max(0.0, m.income_per_year) / P.INCOME_REFERENCE)
    detail = (
        f"Ingreso relativo de los cultivos de cosecha, ajustado por rendimiento esperado y déficit hídrico (Ky de FAO-33): "
        f"{fmt(m.income_per_year, 2)} por año ({fmt(P.INCOME_REFERENCE)} = 100 puntos). Es un índice cualitativo, no un margen en pesos."
    )
    drivers = [_d("Ingreso relativo de los cultivos", value, detail, _PROV[ScoreComponentKey.INGRESO])]
    if m.stressed_crops:
        drivers.append(
            _d("Castigo por déficit hídrico", 0.0, "Ya incluido arriba: " + ", ".join(m.stressed_crops) + ".")
        )
    if m.cover_steps:
        drivers.append(
            _d(
                "Costo de coberturas",
                0.0,
                f"Ya incluido arriba: {m.cover_steps} cobertura(s) sin cosecha restan ingreso.",
            )
        )
    if m.income_notes:
        drivers.append(_d("Mercado local", 0.0, "Ya incluido arriba: " + "; ".join(m.income_notes) + "."))
    return clamp(value), drivers


def sustainability_component(m: Metrics) -> tuple[float, list[ScoreDriver]]:
    n = m.calendar.n_months
    service_months = sum(
        1
        for i in m.calendar.owner
        if i is not None
        and (m.calendar.steps[i].crop.is_cover_crop or m.calendar.steps[i].crop.cycle == CropCycle.PERENNE)
    )
    drivers = [
        _d("Base", 20, "Puntaje de partida."),
        _d(
            "Bonificación por diversificación de cultivos",
            min(30.0, (m.distinct_crops - 1) * 10),
            f"{m.distinct_crops} cultivos distintos.",
        ),
        _d(
            "Bonificación por familias botánicas",
            min(20.0, (m.families - 1) * 10),
            f"{m.families} familias botánicas: cortan ciclos de plagas y enfermedades.",
        ),
        _d(
            "Bonificación por leguminosas",
            15 * min(1.0, m.legume_steps_per_year / 0.5),
            "Fijan nitrógeno y reducen la dependencia de fertilizantes.",
        ),
        _d(
            "Coberturas y pasturas",
            15 * min(1.0, service_months / n / 0.4),
            f"{service_months / n * 100:.0f} % de los meses con coberturas o pasturas (40 % o más = máximo).",
        ),
    ]
    if m.monoculture:
        drivers.append(
            _d(
                "Penalización por monocultivo",
                -min(30.0, 15 * len(m.monoculture)),
                "Repetir el mismo cultivo reduce la biodiversidad del sistema.",
            )
        )
    return clamp(sum(d.points for d in drivers)), drivers


@dataclass
class Components:
    values: dict[ScoreComponentKey, float]
    drivers: dict[ScoreComponentKey, list[ScoreDriver]]
    erosion_penalty: float


def score_components(
    m: Metrics, ctx: ScoringContext, first_crop: Crop, erosion_scale: float = 1.0, is_actual: bool = False
) -> Components:
    a, da = water_component(m, ctx)
    s, ds, erosion_pen = soil_component(m, ctx, erosion_scale, is_actual)
    r, dr = risk_component(m, ctx, first_crop)
    i, di = income_component(m)
    e, de = sustainability_component(m)
    K = ScoreComponentKey
    return Components(
        values={K.AGUA: a, K.SUELO: s, K.RIESGO: r, K.INGRESO: i, K.SOSTENIBILIDAD: e},
        drivers={K.AGUA: da, K.SUELO: ds, K.RIESGO: dr, K.INGRESO: di, K.SOSTENIBILIDAD: de},
        erosion_penalty=erosion_pen,
    )


def total(values: dict[ScoreComponentKey, float], weights: dict[ScoreComponentKey, float]) -> float:
    return clamp(sum(values[k] * weights[k] for k in COMPONENT_ORDER))


def to_schema(c: Components, weights: dict[ScoreComponentKey, float]) -> list[ScoreComponent]:
    return [
        ScoreComponent(
            key=k,
            name=COMPONENT_NAMES[k],
            value=round(c.values[k], 1),
            weight=round(weights[k], 3),
            drivers=c.drivers[k],
            provenance=_PROV[k],
        )
        for k in COMPONENT_ORDER
    ]
