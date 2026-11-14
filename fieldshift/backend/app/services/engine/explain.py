"""Explicaciones en lenguaje simple, perfil, advertencias y evidencia de cada rotación.

Todo el texto se arma con plantillas a partir de resultados ya calculados: no hay
afirmaciones que no salgan de las métricas, del catálogo o de los datos de entrada.
"""

from dataclasses import dataclass

from app.models.constants import DISCLAIMER
from app.models.enums import (
    Confidence,
    DataStatus,
    ImpactDirection,
    Level,
    RiskKind,
    RotationStrategy,
    ScoreComponentKey,
    Severity,
)
from app.schemas.common import RiskFlag
from app.schemas.crop import Crop
from app.schemas.rotation import EvidenceBreakdown, Impact, Recommendation, Rotation, RotationProfile
from app.services.engine.calendar import describe_step
from app.services.engine.context import ClimateContext, SoilContext
from app.services.engine.scoring import COMPONENT_NAMES, Components, Metrics, fmt

K = ScoreComponentKey
ZONE_NAMES = {"arido": "árido", "semiarido": "semiárido", "subhumedo_seco": "subhúmedo seco", "humedo": "húmedo"}
VALIDATION_NOTE = (
    "Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu "
    "zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo."
)


def join(items: list[str]) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " y " + items[-1]


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text else text


@dataclass
class Evaluated:
    """Resultado intermedio de una rotación."""

    rotation: Rotation
    metrics: Metrics
    components: Components
    total: float
    low: float = 0.0
    high: float = 100.0
    confidence: Confidence = Confidence.BAJA
    confidence_reasons: list[str] | None = None
    new_crops: list[Crop] | None = None
    warnings: list[str] | None = None


# --- Perfil ---


def complexity(ev: Evaluated, is_actual: bool) -> Level:
    if is_actual:
        return Level.BAJO
    m = ev.metrics
    points = (
        len(ev.new_crops or [])
        + m.cover_steps
        + int(m.double_crop)
        + int(m.calendar.duration_years >= 4)
        + int(m.perennial)
    )
    return Level.BAJO if points <= 1 else Level.MEDIO if points <= 3 else Level.ALTO


def _impact(
    delta: float, threshold: float, better: str, worse: str, same: str, is_actual: bool, baseline: str
) -> Impact:
    if is_actual:
        return Impact(direction=ImpactDirection.LINEA_BASE, detail=baseline)
    if delta >= threshold:
        return Impact(direction=ImpactDirection.MEJORA, detail=better)
    if delta <= -threshold:
        return Impact(direction=ImpactDirection.EMPEORA, detail=worse)
    return Impact(direction=ImpactDirection.NEUTRO, detail=same)


def _level(value: float, high: float, medium: float) -> Level:
    return Level.ALTO if value >= high else Level.MEDIO if value >= medium else Level.BAJO


def reasons(ev: Evaluated, base: Evaluated) -> tuple[list[str], list[str]]:
    """Ventajas y desventajas frente a la rotación actual, en frases cortas."""
    m, b = ev.metrics, base.metrics
    c, cb = ev.components, base.components
    pos, neg = [], []
    rel = m.water.demand_mm_year / b.water.demand_mm_year if b.water.demand_mm_year else 1.0
    if rel <= 0.95:
        pos.append(f"reduce la demanda hídrica estimada ({(1 - rel) * 100:.0f} % menos que la actual)")
    elif rel >= 1.05:
        neg.append(f"aumenta la demanda hídrica estimada ({(rel - 1) * 100:.0f} % más que la actual)")
    if m.winter_covered_per_year >= b.winter_covered_per_year + 0.9:
        pos.append("agrega cobertura vegetal en invierno")
    elif m.covered_months / m.calendar.n_months >= b.covered_months / b.calendar.n_months + 0.1:
        pos.append("mantiene el suelo cubierto más meses")
    if m.distinct_crops > b.distinct_crops:
        pos.append(f"diversifica el sistema ({m.distinct_crops} cultivos distintos frente a {b.distinct_crops})")
    if b.monoculture and not m.monoculture:
        pos.append("disminuye el riesgo asociado al monocultivo")
    if m.legume_steps_per_year >= b.legume_steps_per_year + 0.2:
        pos.append("incorpora leguminosas que aportan nitrógeno")
    if c.erosion_penalty <= base.components.erosion_penalty - 3:
        pos.append(
            f"reduce los meses de suelo desnudo (de {fmt(b.bare_months_per_year)} a {fmt(m.bare_months_per_year)} por año)"
        )
    elif c.erosion_penalty >= base.components.erosion_penalty + 3:
        neg.append(
            f"deja el suelo más expuesto a la erosión ({fmt(m.bare_months_per_year)} meses sin cobertura por año)"
        )
    if c.values[K.RIESGO] >= cb.values[K.RIESGO] + 5:
        pos.append("baja la exposición de los cultivos a sequía, calor y problemas sanitarios")
    elif c.values[K.RIESGO] <= cb.values[K.RIESGO] - 5:
        neg.append("aumenta la exposición de los cultivos a sequía, calor o problemas sanitarios")
    if c.values[K.INGRESO] >= cb.values[K.INGRESO] + 5:
        pos.append("mejora el ingreso relativo estimado")
    elif c.values[K.INGRESO] <= cb.values[K.INGRESO] - 5:
        neg.append("baja el ingreso relativo estimado")
    for item in ev.rotation.management[:2]:
        neg.append("requiere " + _lower_first(item.rstrip(".")))
    unsure = [cr.name for cr in (ev.new_crops or []) if cr.local_market == Level.BAJO]
    if unsure:
        neg.append(f"hay que validar la disponibilidad de mercado local para {join(unsure)}")
    if m.monoculture:
        neg.append(f"mantiene el monocultivo de {join(list(dict.fromkeys(m.monoculture)))}")
    if m.interval_violations:
        neg.append(_lower_first(m.interval_violations[0]))
    return pos, neg


def build_profile(ev: Evaluated, base: Evaluated, is_actual: bool) -> RotationProfile:
    m, c = ev.metrics, ev.components
    w = m.water
    ratio = w.demand_mm_year / m.annual_precip if m.annual_precip else 1.0
    pos, neg = reasons(ev, base) if not is_actual else ([], [])
    ds = c.values[K.SUELO] - base.components.values[K.SUELO]
    de = base.components.erosion_penalty - c.erosion_penalty
    db = c.values[K.SOSTENIBILIDAD] - base.components.values[K.SOSTENIBILIDAD]
    benefits = [p[:1].upper() + p[1:] + "." for p in pos] or (
        ["Es la rotación que el productor ya conoce: no requiere cambios de manejo."] if is_actual else []
    )
    risks = [n[:1].upper() + n[1:] + "." for n in neg]
    if is_actual:
        if m.monoculture:
            risks.append(f"Monocultivo de {join(list(dict.fromkeys(m.monoculture)))}.")
        risks += [v[:1].upper() + v[1:] + "." for v in m.interval_violations]
        if c.erosion_penalty >= 12:
            risks.append(f"{fmt(m.bare_months_per_year)} meses por año con el suelo sin cultivo vivo.")
    if m.stressed_crops:
        risks.append("Déficit hídrico estimado alto en " + join(m.stressed_crops) + ".")
    return RotationProfile(
        sequence=[describe_step(p) for p in m.calendar.steps],
        duration_years=m.calendar.duration_years,
        distinct_crops=m.distinct_crops,
        water_demand_mm_year=round(w.demand_mm_year, 0),
        water_requirement=Level.BAJO if ratio < 0.7 else Level.MEDIO if ratio < 0.95 else Level.ALTO,
        rain_coverage_pct=round(w.coverage * 100, 1),
        deficit_mm_year=round(w.unmet_mm_year, 0),
        irrigation_mm_year=round(w.irrigation_mm_year, 0) if w.irrigation_mm_year > 0 else None,
        relative_water_demand=round(w.demand_mm_year / base.metrics.water.demand_mm_year, 2)
        if base.metrics.water.demand_mm_year
        else None,
        covered_months_pct=round(m.covered_months / m.calendar.n_months * 100, 1),
        bare_months_per_year=round(m.bare_months_per_year, 1),
        soil_impact=_impact(
            ds,
            5,
            f"Mejora la salud del suelo (+{ds:.0f} puntos en S).",
            f"Empeora la salud del suelo ({ds:.0f} puntos en S).",
            "Impacto en el suelo similar al de la rotación actual.",
            is_actual,
            f"Salud del suelo: {c.values[K.SUELO]:.0f}/100.",
        ),
        erosion_impact=_impact(
            de,
            3,
            "Menos exposición a la erosión eólica que la actual.",
            "Más exposición a la erosión eólica que la actual.",
            "Exposición a la erosión similar a la actual.",
            is_actual,
            f"{fmt(m.bare_months_per_year)} meses sin cultivo vivo por año.",
        ),
        erosion_risk=_level(c.erosion_penalty, 20, 10),
        biodiversity_impact=_impact(
            db,
            5,
            f"Más diversidad: {m.distinct_crops} cultivos de {m.families} familias.",
            f"Menos diversidad: {m.distinct_crops} cultivos de {m.families} familias.",
            "Diversidad similar a la actual.",
            is_actual,
            f"{m.distinct_crops} cultivos de {m.families} familias.",
        ),
        relative_income=_level(c.values[K.INGRESO], 65, 40),
        implementation_complexity=complexity(ev, is_actual),
        benefits=benefits,
        risks=risks,
        justification=ev.rotation.description or "",
    )


# --- Advertencias ---


def risk_flags(ev: Evaluated, climate: ClimateContext) -> list[RiskFlag]:
    m, rid = ev.metrics, ev.rotation.id
    flags: list[RiskFlag] = []

    def add(kind: RiskKind, severity: Severity, icon: str, message: str, evidence: list[str] | None = None) -> None:
        flags.append(
            RiskFlag(
                id=f"{rid}-{kind.value}-{len(flags) + 1}",
                target_type="rotation",
                target_id=rid,
                kind=kind,
                severity=severity,
                icon=icon,
                message=message,
                evidence=evidence or [],
            )
        )

    cov = m.water.coverage
    if cov < 0.7:
        add(
            RiskKind.DEFICIT_HIDRICO,
            Severity.ALTA if cov < 0.55 else Severity.MEDIA,
            "droplet",
            f"Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el {cov * 100:.0f} % de la demanda.",
            [
                f"Demanda {m.water.demand_mm_year:.0f} mm/año; lluvia {m.annual_precip:.0f} mm/año (NASA POWER, {climate.period})."
            ],
        )
    if m.heat_risk > 0.08:
        add(
            RiskKind.CALOR,
            Severity.ALTA if m.heat_risk > 0.15 else Severity.MEDIA,
            "thermometer",
            "Riesgo de golpes de calor (Tmax > 35 °C) en etapas sensibles de cultivos poco tolerantes.",
        )
    if m.frost_risk > 0.15:
        add(
            RiskKind.HELADA,
            Severity.MEDIA,
            "snowflake",
            "Riesgo de heladas sobre cultivos poco tolerantes en los meses fríos.",
        )
    if ev.components.erosion_penalty >= 12:
        add(
            RiskKind.EROSION,
            Severity.ALTA if ev.components.erosion_penalty >= 20 else Severity.MEDIA,
            "wind",
            f"Riesgo de erosión eólica: {fmt(m.bare_months_per_year)} meses por año sin cultivo vivo, varios en la época ventosa.",
        )
    if m.monoculture:
        add(
            RiskKind.MONOCULTIVO,
            Severity.ALTA,
            "repeat",
            f"Monocultivo de {join(list(dict.fromkeys(m.monoculture)))}: aumentan plagas, enfermedades y malezas resistentes.",
        )
    for v in m.interval_violations:
        add(RiskKind.MONOCULTIVO, Severity.MEDIA, "repeat", v[:1].upper() + v[1:] + ".")
    if m.bad_predecessors:
        add(
            RiskKind.OTRO,
            Severity.MEDIA,
            "shuffle",
            "Antecesores desfavorables: " + "; ".join(m.bad_predecessors) + ".",
        )
    for crop in ev.new_crops or []:
        if crop.local_market == Level.BAJO:
            add(
                RiskKind.MERCADO,
                Severity.MEDIA,
                "store",
                f"{crop.name}: mercado local limitado; validar comprador antes de sembrar.",
            )
    if m.cover_steps:
        add(
            RiskKind.MANEJO,
            Severity.INFO,
            "clipboard-list",
            "Las coberturas consumen agua: secarlas a tiempo es clave para no perjudicar al cultivo siguiente.",
        )
    if climate.origin == DataStatus.SAMPLE:
        add(
            RiskKind.DATO_FALTANTE,
            Severity.MEDIA,
            "help-circle",
            "El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.",
        )
    return flags


# --- Recomendación ---


def _priority_text(weights: dict[K, float]) -> str:
    top = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)
    if top[0][1] - top[-1][1] < 0.02:
        return "con prioridades equilibradas"
    names = {
        K.AGUA: "agua",
        K.SUELO: "suelo",
        K.RIESGO: "riesgo climático",
        K.INGRESO: "ingreso",
        K.SOSTENIBILIDAD: "sostenibilidad",
    }
    best = [names[k] for k, w in top if w >= top[0][1] - 0.01][:2]
    return f"con más peso en {join(best)}"


def _why(
    ev: Evaluated, base: Evaluated, best: Evaluated, rank: int, n: int, weights: dict[K, float], is_actual: bool
) -> str:
    pos, neg = reasons(ev, base) if not is_actual else ([], [])
    vals = ev.components.values
    if is_actual:
        strong = max(vals, key=vals.get)
        weak = min(vals, key=vals.get)
        text = (
            f"Es la rotación actual y sirve de línea base. Su punto más fuerte es {COMPONENT_NAMES[strong].lower()} "
            f"({vals[strong]:.0f}/100) y el más débil, {COMPONENT_NAMES[weak].lower()} ({vals[weak]:.0f}/100)."
        )
        if ev.metrics.monoculture:
            text += f" Repite {join(list(dict.fromkeys(ev.metrics.monoculture)))} en campañas seguidas."
        prio = _priority_text(weights)
        prio = prio[:1].upper() + prio[1:]
        if rank == 1:
            text += f" {prio}, ninguna alternativa la supera."
        else:
            text += f" {prio}, queda en el puesto {rank} de {n}."
        return text
    if rank == 1:
        text = "Esta rotación se recomienda porque " + (
            join(pos) if pos else "obtiene el mayor puntaje con tus prioridades"
        )
        text += f". Es la de mayor puntaje {_priority_text(weights)}."
    else:
        text = (
            "Frente a la rotación actual, esta alternativa "
            + (join(pos) if pos else "no mejora ningún aspecto clave")
            + "."
        )
        gaps = {k: (best.components.values[k] - vals[k]) * weights[k] for k in vals}
        worst = max(gaps, key=gaps.get)
        text += (
            f" Queda en el puesto {rank} de {n}: frente a la primera, pierde sobre todo en "
            f"{COMPONENT_NAMES[worst].lower()} ({vals[worst]:.0f} contra {best.components.values[worst]:.0f})."
        )
    if neg:
        text += " Sin embargo, " + join(neg) + "."
    return text


def evidence(
    ev: Evaluated,
    climate: ClimateContext,
    base_climate: ClimateContext,
    soil: SoilContext,
    irrigated: bool,
    weights: dict[K, float],
    history: list[str],
    current_crop: Crop | None,
    crops: dict[str, Crop],
    soil_moisture,
    vegetation,
) -> EvidenceBreakdown:
    label = climate.origin.origin_label
    nasa = [
        f"NASA POWER ({label}, {base_climate.period}): lluvia media {base_climate.annual_precip:.0f} mm/año, ET0 {base_climate.annual_et0:.0f} mm/año, "
        f"índice de aridez {fmt(base_climate.aridity_index, 2)} (zona {ZONE_NAMES[base_climate.zone.value]}).",
        f"Con estos datos, los cultivos de la rotación demandan ~{ev.metrics.water.demand_mm_year:.0f} mm/año y la lluvia efectiva más el agua "
        f"almacenada cubren el {ev.metrics.water.coverage * 100:.0f} %.",
    ]
    if base_climate.heat_days_per_year is not None:
        nasa.append(f"Días con Tmax > 35 °C: {base_climate.heat_days_per_year:.0f} por año en promedio.")
    if base_climate.precip_cv_pct is not None:
        nasa.append(f"Variabilidad de la lluvia anual: {base_climate.precip_cv_pct:.0f} % (coeficiente de variación).")
    if climate.scenario is not None:
        s = climate.scenario
        nasa.append(
            f"Escenario aplicado '{s.name}': lluvia {s.rain_delta_pct:+.0f} %, temperatura +{fmt(s.temp_delta_c)} °C"
            + (f", año seco análogo {base_climate.driest_year}" if s.dry_year and base_climate.driest_year else "")
            + f" → lluvia {climate.annual_precip:.0f} mm/año y ET0 {climate.annual_et0:.0f} mm/año."
        )
    if soil_moisture:
        origin = f" ({soil_moisture.origin.origin_label})" if soil_moisture.origin else ""
        freq = (
            f", sequía de suelo en el {soil_moisture.drought_frequency_pct:.0f} % de los meses"
            if soil_moisture.drought_frequency_pct is not None
            else ""
        )
        nasa.append(
            f"Humedad de suelo SMAP {'L3 superficial' if soil_moisture.product == 'SMAP_L3' else 'L4 en zona de raíces'}{origin}: "
            f"{soil_moisture.anomaly_pct:+.0f} % respecto de la "
            f"misma época de otros años{freq}."
        )
    else:
        nasa.append("Humedad de suelo SMAP: no disponible para este lote (no se usó).")
    if vegetation:
        origin = f" ({vegetation.origin.origin_label})" if vegetation.origin else ""
        trend = ""
        if vegetation.biomass_trend_pct_per_decade is not None:
            trend = f", tendencia de biomasa {vegetation.biomass_trend_pct_per_decade:+.0f} % por década"
            trend += "" if vegetation.trend_significant else " (no significativa)"
        nasa.append(
            f"NDVI MODIS {vegetation.product}{origin}: suelo desnudo el {vegetation.bare_soil_fraction * 100:.0f} % del tiempo "
            f"(NDVI < {fmt(vegetation.threshold, 2)}){trend}."
        )
    else:
        nasa.append("NDVI MODIS: no disponible para este lote (no se usó).")

    texture = soil.texture.value.replace("_", " ")
    local = [
        f"Textura {texture}"
        + (" (SUPUESTA: el productor no la informó)" if soil.texture_assumed else "")
        + f": agua útil estimada {soil.available_water_mm:.0f} mm y eficiencia de barbecho {fmt(soil.fallow_efficiency, 2)}.",
        "Sin análisis de laboratorio: materia orgánica, fósforo y pH no se evaluaron."
        if not soil.lab_analysis
        else "Hay análisis de suelo de laboratorio.",
        f"Pendiente {fmt(soil.slope_pct)} % (SRTM)."
        if soil.slope_pct is not None
        else "Pendiente no informada: no se evaluó la erosión hídrica.",
    ]
    names = {
        K.AGUA: "agua",
        K.SUELO: "suelo",
        K.RIESGO: "riesgo",
        K.INGRESO: "ingreso",
        K.SOSTENIBILIDAD: "sostenibilidad",
    }
    producer = [
        "Pesos del puntaje según tus prioridades: "
        + ", ".join(f"{names[k]} {w * 100:.0f} %" for k, w in weights.items())
        + ".",
        "Lote con riego." if irrigated else "Lote en secano.",
    ]
    if history:
        producer.append("Historial: " + " → ".join(crops[c].name for c in history) + ".")
    if current_crop:
        producer.append(f"Cultivo actual: {current_crop.name}.")
    if ev.rotation.management:
        producer.append(
            "Manejo necesario: " + "; ".join(_lower_first(x.rstrip(".")) for x in ev.rotation.management) + "."
        )
    validation = [
        "Coeficientes de cultivo (Kc) y fechas de siembra para tu zona y variedades.",
        "Atributos cualitativos del catálogo (tolerancias, aportes e ingreso relativo).",
    ]
    if ev.metrics.cover_steps:
        validation.append("Momento de secado de las coberturas según el agua disponible.")
    unsure = [c.name for c in (ev.new_crops or []) if c.local_market in (Level.BAJO, Level.MEDIO)]
    if unsure:
        validation.append(f"Mercado y logística para {join(unsure)}.")
    validation.append("Fertilización según análisis de suelo.")
    return EvidenceBreakdown(nasa_data=nasa, local_soil=local, producer=producer, needs_validation=validation)


def recommendation(
    ev: Evaluated,
    base: Evaluated,
    best: Evaluated,
    rank: int,
    n: int,
    weights: dict[K, float],
    is_actual: bool,
    flags: list[RiskFlag],
    ev_evidence: EvidenceBreakdown,
    climate: ClimateContext,
    soil: SoilContext,
    irrigated: bool,
    soil_moisture,
    vegetation,
    profile: RotationProfile,
) -> Recommendation:
    assumptions = [
        f"El clima de {climate.period} representa las próximas campañas"
        + (" (con el escenario aplicado)." if climate.scenario else "."),
        "Coeficientes de cultivo (Kc) estándar de FAO-56; para coberturas, supuestos.",
        "Fechas de siembra y largo de ciclo típicos de cada cultivo.",
        "Ingreso relativo cualitativo: no se usan precios ni costos reales.",
    ]
    if soil.texture_assumed:
        assumptions.append("Textura franco arenosa supuesta (no informada).")
    if irrigated:
        assumptions.append("El riego cubre el 80 % del déficit de los cultivos.")
    uncertainties = [
        f"El puntaje puede variar entre {ev.low:.0f} y {ev.high:.0f} (lluvia ±15 %, ET0 ±5 % y margen por confianza {ev.confidence.value}).",
        "NASA POWER describe el entorno regional (~50 km): la lluvia del lote puede ser distinta.",
        "No se modelan rendimientos, precios ni costos: el ingreso es un índice relativo.",
    ]
    if climate.origin == DataStatus.SAMPLE:
        uncertainties.insert(0, "El clima usado es una MUESTRA SIMULADA: los números son ilustrativos.")
    gaps = []
    if soil_moisture is None:
        gaps.append("Humedad de suelo SMAP del lote.")
    if vegetation is None:
        gaps.append("Serie de NDVI MODIS del lote.")
    if not soil.lab_analysis:
        gaps.append("Análisis de suelo de laboratorio.")
    if soil.slope_pct is None:
        gaps.append("Pendiente del lote (SRTM).")
    if soil.texture_assumed:
        gaps.append("Textura del suelo.")
    summary = f"{ev.rotation.name}: puesto {rank} de {n}, {ev.total:.0f} puntos (rango {ev.low:.0f}–{ev.high:.0f})."
    return Recommendation(
        rotation_id=ev.rotation.id,
        summary=summary,
        why=_why(ev, base, best, rank, n, weights, is_actual),
        benefits=profile.benefits,
        risks=[f.message for f in flags if f.severity != Severity.INFO]
        or ["Sin riesgos destacados con los datos disponibles."],
        assumptions=assumptions,
        uncertainties=uncertainties,
        information_gaps=gaps,
        evidence=ev_evidence,
        validation_note=VALIDATION_NOTE,
        requires_agronomist=True,
        disclaimer=DISCLAIMER,
    )


def confidence_for(
    crops: list[Crop], climate: ClimateContext, soil: SoilContext, soil_moisture, vegetation
) -> tuple[Confidence, list[str]]:
    reasons: list[str] = []
    if climate.origin == DataStatus.SAMPLE:
        reasons.append("Clima de muestra simulada, no datos NASA reales.")
    if climate.n_years < 8:
        reasons.append(f"Solo {climate.n_years} años completos de clima.")
    if soil.texture_assumed:
        reasons.append("Textura del suelo supuesta.")
    if not soil.lab_analysis:
        reasons.append("Sin análisis de suelo de laboratorio.")
    low = sorted({c.name for c in crops if c.confidence == Confidence.BAJA})
    if low:
        reasons.append("Atributos con confianza baja en el catálogo: " + join(low) + ".")
    if soil_moisture is None and vegetation is None:
        reasons.append("Sin humedad de suelo (SMAP) ni NDVI del lote.")
    sat_sample = [
        n for n, x in (("SMAP", soil_moisture), ("NDVI", vegetation)) if x is not None and x.origin == DataStatus.SAMPLE
    ]
    if sat_sample:
        reasons.append(f"{join(sat_sample)} de muestra simulada, no observaciones del lote.")
    if climate.origin == DataStatus.SAMPLE or len(reasons) >= 4:
        return Confidence.BAJA, reasons
    return (Confidence.MEDIA if reasons else Confidence.ALTA), reasons


def strategy_label(strategy: RotationStrategy) -> str:
    return {
        RotationStrategy.ACTUAL: "Actual",
        RotationStrategy.CONSERVADORA: "Conservadora",
        RotationStrategy.DIVERSIFICADA: "Diversificada",
        RotationStrategy.AGUA: "Ahorro de agua",
        RotationStrategy.SUELO: "Salud del suelo",
        RotationStrategy.RENTABILIDAD: "Rentabilidad",
        RotationStrategy.MIXTA: "Mixta recomendada",
    }[strategy]
