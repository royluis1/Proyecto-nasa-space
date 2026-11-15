"""Explicaciones en lenguaje simple, perfil, advertencias y evidencia de cada rotación.

Todo el texto se arma con plantillas a partir de resultados ya calculados: no hay
afirmaciones que no salgan de las métricas, del catálogo o de los datos de entrada.
"""

from dataclasses import dataclass

from app.models.constants import disclaimer
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
from app.i18n import LocalizedMap, join_words, tr

K = ScoreComponentKey
ZONE_NAMES = LocalizedMap({"arido": ("árido", "arid"), "semiarido": ("semiárido", "semi-arid"), "subhumedo_seco": ("subhúmedo seco", "dry sub-humid"), "humedo": ("húmedo", "humid")})


TEXTURE_NAMES = LocalizedMap({
    "arenosa": ("arenosa", "sandy"), "franco_arenosa": ("franco arenosa", "sandy loam"), "franca": ("franca", "loam"),
    "franco_limosa": ("franco limosa", "silt loam"), "franco_arcillosa": ("franco arcillosa", "clay loam"), "arcillosa": ("arcillosa", "clay"),
})
CONF_EN = {"alta": "high", "media": "medium", "baja": "low"}


def validation_note() -> str:
    return tr(
        "Antes de implementarla, validala con un ingeniero agrónomo local: fechas de siembra y variedades para tu "
        "zona, manejo y secado de coberturas, fertilización según análisis de suelo, y mercado y logística de cada cultivo.",
        "Before implementing it, validate it with a local agronomist: planting dates and varieties for your area, "
        "cover-crop management and termination, fertilization based on a soil test, and market and logistics for each crop.",
    )


def join(items: list[str]) -> str:
    return join_words(items)


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
        pos.append(tr(f"reduce la demanda hídrica estimada ({(1 - rel) * 100:.0f} % menos que la actual)", f"reduces estimated water demand ({(1 - rel) * 100:.0f} % less than the current one)"))
    elif rel >= 1.05:
        neg.append(tr(f"aumenta la demanda hídrica estimada ({(rel - 1) * 100:.0f} % más que la actual)", f"increases estimated water demand ({(rel - 1) * 100:.0f} % more than the current one)"))
    if m.winter_covered_per_year >= b.winter_covered_per_year + 0.9:
        pos.append(tr("agrega cobertura vegetal en invierno", "adds plant cover in winter"))
    elif m.covered_months / m.calendar.n_months >= b.covered_months / b.calendar.n_months + 0.1:
        pos.append(tr("mantiene el suelo cubierto más meses", "keeps the soil covered more months"))
    if m.distinct_crops > b.distinct_crops:
        pos.append(tr(f"diversifica el sistema ({m.distinct_crops} cultivos distintos frente a {b.distinct_crops})", f"diversifies the system ({m.distinct_crops} distinct crops vs. {b.distinct_crops})"))
    if b.monoculture and not m.monoculture:
        pos.append(tr("disminuye el riesgo asociado al monocultivo", "lowers the risk associated with monoculture"))
    if m.legume_steps_per_year >= b.legume_steps_per_year + 0.2:
        pos.append(tr("incorpora leguminosas que aportan nitrógeno", "adds legumes that supply nitrogen"))
    if c.erosion_penalty <= base.components.erosion_penalty - 3:
        pos.append(
            tr(f"reduce los meses de suelo desnudo (de {fmt(b.bare_months_per_year)} a {fmt(m.bare_months_per_year)} por año)",
               f"cuts months of bare soil (from {fmt(b.bare_months_per_year)} to {fmt(m.bare_months_per_year)} per year)")
        )
    elif c.erosion_penalty >= base.components.erosion_penalty + 3:
        neg.append(
            tr(f"deja el suelo más expuesto a la erosión ({fmt(m.bare_months_per_year)} meses sin cobertura por año)",
               f"leaves the soil more exposed to erosion ({fmt(m.bare_months_per_year)} months without cover per year)")
        )
    if c.values[K.RIESGO] >= cb.values[K.RIESGO] + 5:
        pos.append(tr("baja la exposición de los cultivos a sequía, calor y problemas sanitarios", "lowers the crops' exposure to drought, heat and pest or disease problems"))
    elif c.values[K.RIESGO] <= cb.values[K.RIESGO] - 5:
        neg.append(tr("aumenta la exposición de los cultivos a sequía, calor o problemas sanitarios", "increases the crops' exposure to drought, heat or pest or disease problems"))
    if c.values[K.INGRESO] >= cb.values[K.INGRESO] + 5:
        pos.append(tr("mejora el ingreso relativo estimado", "improves estimated relative income"))
    elif c.values[K.INGRESO] <= cb.values[K.INGRESO] - 5:
        neg.append(tr("baja el ingreso relativo estimado", "lowers estimated relative income"))
    for item in ev.rotation.management[:2]:
        neg.append(tr("requiere ", "requires ") + _lower_first(item.rstrip(".")))
    unsure = [cr.name for cr in (ev.new_crops or []) if cr.local_market == Level.BAJO]
    if unsure:
        neg.append(tr(f"hay que validar la disponibilidad de mercado local para {join(unsure)}", f"local market availability for {join(unsure)} needs to be validated"))
    if m.monoculture:
        neg.append(tr(f"mantiene el monocultivo de {join(list(dict.fromkeys(m.monoculture)))}", f"keeps the {join(list(dict.fromkeys(m.monoculture)))} monoculture"))
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
        [tr("Es la rotación que el productor ya conoce: no requiere cambios de manejo.", "It is the rotation the farmer already knows: no management changes needed.")] if is_actual else []
    )
    risks = [n[:1].upper() + n[1:] + "." for n in neg]
    if is_actual:
        if m.monoculture:
            risks.append(tr(f"Monocultivo de {join(list(dict.fromkeys(m.monoculture)))}.", f"{join(list(dict.fromkeys(m.monoculture)))} monoculture."))
        risks += [v[:1].upper() + v[1:] + "." for v in m.interval_violations]
        if c.erosion_penalty >= 12:
            risks.append(tr(f"{fmt(m.bare_months_per_year)} meses por año con el suelo sin cultivo vivo.", f"{fmt(m.bare_months_per_year)} months per year with no living crop on the soil."))
    if m.stressed_crops:
        risks.append(tr("Déficit hídrico estimado alto en ", "High estimated water deficit in ") + join(m.stressed_crops) + ".")
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
            tr(f"Mejora la salud del suelo (+{ds:.0f} puntos en S).", f"Improves soil health (+{ds:.0f} points in S)."),
            tr(f"Empeora la salud del suelo ({ds:.0f} puntos en S).", f"Worsens soil health ({ds:.0f} points in S)."),
            tr("Impacto en el suelo similar al de la rotación actual.", "Soil impact similar to the current rotation."),
            is_actual,
            tr(f"Salud del suelo: {c.values[K.SUELO]:.0f}/100.", f"Soil health: {c.values[K.SUELO]:.0f}/100."),
        ),
        erosion_impact=_impact(
            de,
            3,
            tr("Menos exposición a la erosión eólica que la actual.", "Less exposure to wind erosion than the current one."),
            tr("Más exposición a la erosión eólica que la actual.", "More exposure to wind erosion than the current one."),
            tr("Exposición a la erosión similar a la actual.", "Erosion exposure similar to the current one."),
            is_actual,
            tr(f"{fmt(m.bare_months_per_year)} meses sin cultivo vivo por año.", f"{fmt(m.bare_months_per_year)} months without a living crop per year."),
        ),
        erosion_risk=_level(c.erosion_penalty, 20, 10),
        biodiversity_impact=_impact(
            db,
            5,
            tr(f"Más diversidad: {m.distinct_crops} cultivos de {m.families} familias.", f"More diversity: {m.distinct_crops} crops from {m.families} families."),
            tr(f"Menos diversidad: {m.distinct_crops} cultivos de {m.families} familias.", f"Less diversity: {m.distinct_crops} crops from {m.families} families."),
            tr("Diversidad similar a la actual.", "Diversity similar to the current one."),
            is_actual,
            tr(f"{m.distinct_crops} cultivos de {m.families} familias.", f"{m.distinct_crops} crops from {m.families} families."),
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
            tr(f"Riesgo de déficit hídrico: la lluvia y el agua almacenada cubren solo el {cov * 100:.0f} % de la demanda.", f"Water-deficit risk: rain and stored water cover only {cov * 100:.0f} % of demand."),
            [
                tr(f"Demanda {m.water.demand_mm_year:.0f} mm/año; lluvia {m.annual_precip:.0f} mm/año (NASA POWER, {climate.period}).", f"Demand {m.water.demand_mm_year:.0f} mm/yr; rain {m.annual_precip:.0f} mm/yr (NASA POWER, {climate.period}).")
            ],
        )
    if m.heat_risk > 0.08:
        add(
            RiskKind.CALOR,
            Severity.ALTA if m.heat_risk > 0.15 else Severity.MEDIA,
            "thermometer",
            tr("Riesgo de golpes de calor (Tmax > 35 °C) en etapas sensibles de cultivos poco tolerantes.", "Risk of heat stress (Tmax > 35 °C) at sensitive stages of less tolerant crops."),
        )
    if m.frost_risk > 0.15:
        add(
            RiskKind.HELADA,
            Severity.MEDIA,
            "snowflake",
            tr("Riesgo de heladas sobre cultivos poco tolerantes en los meses fríos.", "Frost risk for less tolerant crops in the cold months."),
        )
    if ev.components.erosion_penalty >= 12:
        add(
            RiskKind.EROSION,
            Severity.ALTA if ev.components.erosion_penalty >= 20 else Severity.MEDIA,
            "wind",
            tr(f"Riesgo de erosión eólica: {fmt(m.bare_months_per_year)} meses por año sin cultivo vivo, varios en la época ventosa.", f"Wind-erosion risk: {fmt(m.bare_months_per_year)} months per year without a living crop, several in the windy season."),
        )
    if climate.scenario is not None and climate.scenario.heavy_rain and m.bare_months_per_year >= 2:
        add(
            RiskKind.EROSION,
            Severity.ALTA if m.bare_months_per_year >= 4 else Severity.MEDIA,
            "cloud-rain",
            tr(f"Con lluvias intensas, los {fmt(m.bare_months_per_year)} meses por año de suelo desnudo quedan expuestos a "
               "erosión hídrica y encharcamiento.",
               f"With heavy rain, the {fmt(m.bare_months_per_year)} months per year of bare soil are exposed to "
               "water erosion and waterlogging."),
        )
    if m.monoculture:
        add(
            RiskKind.MONOCULTIVO,
            Severity.ALTA,
            "repeat",
            tr(f"Monocultivo de {join(list(dict.fromkeys(m.monoculture)))}: aumentan plagas, enfermedades y malezas resistentes.", f"{join(list(dict.fromkeys(m.monoculture)))} monoculture: pests, diseases and resistant weeds increase."),
        )
    for v in m.interval_violations:
        add(RiskKind.MONOCULTIVO, Severity.MEDIA, "repeat", v[:1].upper() + v[1:] + ".")
    if m.bad_predecessors:
        add(
            RiskKind.OTRO,
            Severity.MEDIA,
            "shuffle",
            tr("Antecesores desfavorables: ", "Unfavorable previous crops: ") + "; ".join(m.bad_predecessors) + ".",
        )
    for crop in ev.new_crops or []:
        if crop.local_market == Level.BAJO:
            add(
                RiskKind.MERCADO,
                Severity.MEDIA,
                "store",
                tr(f"{crop.name}: mercado local limitado; validar comprador antes de sembrar.", f"{crop.name}: limited local market; confirm a buyer before planting."),
            )
    if m.cover_steps:
        add(
            RiskKind.MANEJO,
            Severity.INFO,
            "clipboard-list",
            tr("Las coberturas consumen agua: secarlas a tiempo es clave para no perjudicar al cultivo siguiente.", "Cover crops use water: terminating them in time is key so they don't harm the next crop."),
        )
    if climate.origin == DataStatus.SAMPLE:
        add(
            RiskKind.DATO_FALTANTE,
            Severity.MEDIA,
            "help-circle",
            tr("El clima usado es una muestra SIMULADA: los puntajes son ilustrativos hasta consultar NASA POWER.", "The weather used is a SIMULATED sample: scores are illustrative until NASA POWER is queried."),
        )
    return flags


# --- Recomendación ---


def _priority_text(weights: dict[K, float]) -> str:
    top = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)
    if top[0][1] - top[-1][1] < 0.02:
        return tr("con prioridades equilibradas", "with balanced priorities")
    names = LocalizedMap({
        K.AGUA: ("agua", "water"),
        K.SUELO: ("suelo", "soil"),
        K.RIESGO: ("riesgo climático", "climate risk"),
        K.INGRESO: ("ingreso", "income"),
        K.SOSTENIBILIDAD: ("sostenibilidad", "sustainability"),
    })
    best = [names[k] for k, w in top if w >= top[0][1] - 0.01][:2]
    return tr(f"con más peso en {join(best)}", f"with more weight on {join(best)}")


def _why(
    ev: Evaluated, base: Evaluated, best: Evaluated, rank: int, n: int, weights: dict[K, float], is_actual: bool
) -> str:
    pos, neg = reasons(ev, base) if not is_actual else ([], [])
    vals = ev.components.values
    if is_actual:
        strong = max(vals, key=vals.get)
        weak = min(vals, key=vals.get)
        text = tr(
            f"Es la rotación actual y sirve de línea base. Su punto más fuerte es {COMPONENT_NAMES[strong].lower()} "
            f"({vals[strong]:.0f}/100) y el más débil, {COMPONENT_NAMES[weak].lower()} ({vals[weak]:.0f}/100).",
            f"It is the current rotation and serves as the baseline. Its strongest point is {COMPONENT_NAMES[strong].lower()} "
            f"({vals[strong]:.0f}/100) and its weakest, {COMPONENT_NAMES[weak].lower()} ({vals[weak]:.0f}/100).",
        )
        if ev.metrics.monoculture:
            text += tr(f" Repite {join(list(dict.fromkeys(ev.metrics.monoculture)))} en campañas seguidas.",
                       f" It repeats {join(list(dict.fromkeys(ev.metrics.monoculture)))} in consecutive seasons.")
        prio = _priority_text(weights)
        prio = prio[:1].upper() + prio[1:]
        if rank == 1:
            text += tr(f" {prio}, ninguna alternativa la supera.", f" {prio}, no alternative beats it.")
        else:
            text += tr(f" {prio}, queda en el puesto {rank} de {n}.", f" {prio}, it ranks {rank} of {n}.")
        return text
    if rank == 1:
        text = tr("Esta rotación se recomienda porque ", "This rotation is recommended because it ") + (
            join(pos) if pos else tr("obtiene el mayor puntaje con tus prioridades", "gets the highest score with your priorities")
        )
        text += tr(f". Es la de mayor puntaje {_priority_text(weights)}.", f". It has the highest score {_priority_text(weights)}.")
    else:
        text = (
            tr("Frente a la rotación actual, esta alternativa ", "Compared with the current rotation, this alternative ")
            + (join(pos) if pos else tr("no mejora ningún aspecto clave", "does not improve any key aspect"))
            + "."
        )
        gaps = {k: (best.components.values[k] - vals[k]) * weights[k] for k in vals}
        worst = max(gaps, key=gaps.get)
        text += tr(
            f" Queda en el puesto {rank} de {n}: frente a la primera, pierde sobre todo en "
            f"{COMPONENT_NAMES[worst].lower()} ({vals[worst]:.0f} contra {best.components.values[worst]:.0f}).",
            f" It ranks {rank} of {n}: compared with the first, it loses mostly on "
            f"{COMPONENT_NAMES[worst].lower()} ({vals[worst]:.0f} vs. {best.components.values[worst]:.0f}).",
        )
    if neg:
        text += tr(" Sin embargo, ", " However, it ") + join(neg) + "."
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
        tr(f"NASA POWER ({label}, {base_climate.period}): lluvia media {base_climate.annual_precip:.0f} mm/año, ET0 {base_climate.annual_et0:.0f} mm/año, "
           f"índice de aridez {fmt(base_climate.aridity_index, 2)} (zona {ZONE_NAMES[base_climate.zone.value]}).",
           f"NASA POWER ({label}, {base_climate.period}): mean rain {base_climate.annual_precip:.0f} mm/yr, ET0 {base_climate.annual_et0:.0f} mm/yr, "
           f"aridity index {fmt(base_climate.aridity_index, 2)} ({ZONE_NAMES[base_climate.zone.value]} zone)."),
        tr(f"Con estos datos, los cultivos de la rotación demandan ~{ev.metrics.water.demand_mm_year:.0f} mm/año y la lluvia efectiva más el agua "
           f"almacenada cubren el {ev.metrics.water.coverage * 100:.0f} %.",
           f"With this data, the rotation's crops demand ~{ev.metrics.water.demand_mm_year:.0f} mm/yr and effective rain plus stored "
           f"water cover {ev.metrics.water.coverage * 100:.0f} %."),
    ]
    if base_climate.heat_days_per_year is not None:
        nasa.append(tr(f"Días con Tmax > 35 °C: {base_climate.heat_days_per_year:.0f} por año en promedio.", f"Days with Tmax > 35 °C: {base_climate.heat_days_per_year:.0f} per year on average."))
    if base_climate.precip_cv_pct is not None:
        nasa.append(tr(f"Variabilidad de la lluvia anual: {base_climate.precip_cv_pct:.0f} % (coeficiente de variación).", f"Annual rainfall variability: {base_climate.precip_cv_pct:.0f} % (coefficient of variation)."))
    if climate.scenario is not None:
        s = climate.scenario
        nasa.append(
            tr(f"Escenario aplicado '{s.name}': lluvia {s.rain_delta_pct:+.0f} %, temperatura +{fmt(s.temp_delta_c)} °C",
               f"Scenario applied '{s.name}': rain {s.rain_delta_pct:+.0f} %, temperature +{fmt(s.temp_delta_c)} °C")
            + (tr(f", año seco análogo {base_climate.driest_year}", f", analog dry year {base_climate.driest_year}") if s.dry_year and base_climate.driest_year else "")
            + (tr(", lluvias intensas de octubre a marzo", ", heavy rain from October to March") if s.heavy_rain else "")
            + (tr(", ola de calor en verano", ", summer heat wave") if s.heat_wave else "")
            + tr(f" → lluvia {climate.annual_precip:.0f} mm/año y ET0 {climate.annual_et0:.0f} mm/año.", f" → rain {climate.annual_precip:.0f} mm/yr and ET0 {climate.annual_et0:.0f} mm/yr.")
        )
    if soil_moisture:
        origin = f" ({soil_moisture.origin.origin_label})" if soil_moisture.origin else ""
        freq = (
            tr(f", sequía de suelo en el {soil_moisture.drought_frequency_pct:.0f} % de los meses", f", soil drought in {soil_moisture.drought_frequency_pct:.0f} % of months")
            if soil_moisture.drought_frequency_pct is not None
            else ""
        )
        nasa.append(
            tr(f"Humedad de suelo SMAP {'L3 superficial' if soil_moisture.product == 'SMAP_L3' else 'L4 en zona de raíces'}{origin}: "
               f"{soil_moisture.anomaly_pct:+.0f} % respecto de la "
               f"misma época de otros años{freq}.",
               f"SMAP soil moisture {'L3 surface' if soil_moisture.product == 'SMAP_L3' else 'L4 root zone'}{origin}: "
               f"{soil_moisture.anomaly_pct:+.0f} % compared with the "
               f"same time in other years{freq}.")
        )
    else:
        nasa.append(tr("Humedad de suelo SMAP: no disponible para este lote (no se usó).", "SMAP soil moisture: not available for this field (not used)."))
    if vegetation:
        origin = f" ({vegetation.origin.origin_label})" if vegetation.origin else ""
        trend = ""
        if vegetation.biomass_trend_pct_per_decade is not None:
            trend = tr(f", tendencia de biomasa {vegetation.biomass_trend_pct_per_decade:+.0f} % por década", f", biomass trend {vegetation.biomass_trend_pct_per_decade:+.0f} % per decade")
            trend += "" if vegetation.trend_significant else tr(" (no significativa)", " (not significant)")
        nasa.append(
            tr(f"NDVI MODIS {vegetation.product}{origin}: suelo desnudo el {vegetation.bare_soil_fraction * 100:.0f} % del tiempo "
               f"(NDVI < {fmt(vegetation.threshold, 2)}){trend}.",
               f"MODIS NDVI {vegetation.product}{origin}: bare soil {vegetation.bare_soil_fraction * 100:.0f} % of the time "
               f"(NDVI < {fmt(vegetation.threshold, 2)}){trend}.")
        )
    else:
        nasa.append(tr("NDVI MODIS: no disponible para este lote (no se usó).", "MODIS NDVI: not available for this field (not used)."))

    texture = TEXTURE_NAMES.get(soil.texture.value) or soil.texture.value.replace("_", " ")
    local = [
        tr(f"Textura {texture}", f"{texture[:1].upper()}{texture[1:]} texture")
        + (tr(" (SUPUESTA: el productor no la informó)", " (ASSUMED: the farmer did not report it)") if soil.texture_assumed else "")
        + tr(f": agua útil estimada {soil.available_water_mm:.0f} mm y eficiencia de barbecho {fmt(soil.fallow_efficiency, 2)}.",
             f": estimated available water {soil.available_water_mm:.0f} mm and fallow efficiency {fmt(soil.fallow_efficiency, 2)}."),
        tr("Sin análisis de laboratorio: materia orgánica, fósforo y pH no se evaluaron.", "No lab test: organic matter, phosphorus and pH were not evaluated.")
        if not soil.lab_analysis
        else tr("Hay análisis de suelo de laboratorio.", "There is a laboratory soil test."),
        tr(f"Pendiente {fmt(soil.slope_pct)} % (SRTM).", f"Slope {fmt(soil.slope_pct)} % (SRTM).")
        if soil.slope_pct is not None
        else tr("Pendiente no informada: no se evaluó la erosión hídrica.", "Slope not reported: water erosion was not evaluated."),
    ]
    names = LocalizedMap({
        K.AGUA: ("agua", "water"),
        K.SUELO: ("suelo", "soil"),
        K.RIESGO: ("riesgo", "risk"),
        K.INGRESO: ("ingreso", "income"),
        K.SOSTENIBILIDAD: ("sostenibilidad", "sustainability"),
    })
    producer = [
        tr("Pesos del puntaje según tus prioridades: ", "Score weights from your priorities: ")
        + ", ".join(f"{names[k]} {w * 100:.0f} %" for k, w in weights.items())
        + ".",
        tr("Lote con riego.", "Irrigated field.") if irrigated else tr("Lote en secano.", "Rainfed field."),
    ]
    if history:
        producer.append(tr("Historial: ", "History: ") + " → ".join(crops[c].name for c in history) + ".")
    if current_crop:
        producer.append(tr(f"Cultivo actual: {current_crop.name}.", f"Current crop: {current_crop.name}."))
    if ev.rotation.management:
        producer.append(
            tr("Manejo necesario: ", "Management needed: ") + "; ".join(_lower_first(x.rstrip(".")) for x in ev.rotation.management) + "."
        )
    validation = [
        tr("Coeficientes de cultivo (Kc) y fechas de siembra para tu zona y variedades.", "Crop coefficients (Kc) and planting dates for your area and varieties."),
        tr("Atributos cualitativos del catálogo (tolerancias, aportes e ingreso relativo).", "Qualitative catalog attributes (tolerances, contributions and relative income)."),
    ]
    if ev.metrics.cover_steps:
        validation.append(tr("Momento de secado de las coberturas según el agua disponible.", "Cover-crop termination timing based on available water."))
    unsure = [c.name for c in (ev.new_crops or []) if c.local_market in (Level.BAJO, Level.MEDIO)]
    if unsure:
        validation.append(tr(f"Mercado y logística para {join(unsure)}.", f"Market and logistics for {join(unsure)}."))
    validation.append(tr("Fertilización según análisis de suelo.", "Fertilization based on a soil test."))
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
        tr(f"El clima de {climate.period} representa las próximas campañas", f"The {climate.period} weather represents the coming seasons")
        + (tr(" (con el escenario aplicado).", " (with the scenario applied).") if climate.scenario else "."),
        tr("Coeficientes de cultivo (Kc) estándar de FAO-56; para coberturas, supuestos.", "Standard FAO-56 crop coefficients (Kc); assumed values for cover crops."),
        tr("Fechas de siembra y largo de ciclo típicos de cada cultivo.", "Typical planting dates and cycle length for each crop."),
        tr("Ingreso relativo cualitativo: no se usan precios ni costos reales.", "Qualitative relative income: no real prices or costs are used."),
    ]
    if soil.texture_assumed:
        assumptions.append(tr("Textura franco arenosa supuesta (no informada).", "Sandy loam texture assumed (not reported)."))
    if irrigated:
        limited = climate.scenario is not None and climate.scenario.irrigation_level == "limitado"
        assumptions.append(
            tr("Riego limitado: cubre el 40 % del déficit de los cultivos (la mitad del riego pleno).", "Limited irrigation: covers 40 % of the crops' deficit (half of full irrigation).")
            if limited
            else tr("El riego cubre el 80 % del déficit de los cultivos.", "Irrigation covers 80 % of the crops' deficit.")
        )
    if climate.scenario is not None and climate.scenario.heat_wave:
        assumptions.append(tr("Ola de calor: Tmax +3 °C y ET0 +10 % de diciembre a febrero (supuesto de sensibilidad).", "Heat wave: Tmax +3 °C and ET0 +10 % from December to February (sensitivity assumption)."))
    if climate.scenario is not None and climate.scenario.heavy_rain:
        assumptions.append(tr("Lluvias intensas: +35 % de lluvia de octubre a marzo en tormentas; solo el 30 % de ese extra se aprovecha "
            "(el resto escurre) y la erosión en suelo desnudo sube un 40 % (supuesto).",
            "Heavy rain: +35 % rain from October to March in storms; only 30 % of that extra is used "
            "(the rest runs off) and erosion on bare soil rises 40 % (assumption)."))
    uncertainties = [
        tr(f"El puntaje puede variar entre {ev.low:.0f} y {ev.high:.0f} (lluvia ±15 %, ET0 ±5 % y margen por confianza {ev.confidence.value}).",
           f"The score may range between {ev.low:.0f} and {ev.high:.0f} (rain ±15 %, ET0 ±5 % and a margin for {CONF_EN.get(ev.confidence.value, ev.confidence.value)} confidence)."),
        tr("NASA POWER describe el entorno regional (~50 km): la lluvia del lote puede ser distinta.", "NASA POWER describes the regional setting (~50 km): rain on your field may differ."),
        tr("No se modelan rendimientos, precios ni costos: el ingreso es un índice relativo.", "Yields, prices and costs are not modeled: income is a relative index."),
    ]
    if climate.origin == DataStatus.SAMPLE:
        uncertainties.insert(0, tr("El clima usado es una MUESTRA SIMULADA: los números son ilustrativos.", "The weather used is a SIMULATED SAMPLE: the numbers are illustrative."))
    gaps = []
    if soil_moisture is None:
        gaps.append(tr("Humedad de suelo SMAP del lote.", "SMAP soil moisture for the field."))
    if vegetation is None:
        gaps.append(tr("Serie de NDVI MODIS del lote.", "MODIS NDVI series for the field."))
    if not soil.lab_analysis:
        gaps.append(tr("Análisis de suelo de laboratorio.", "Laboratory soil test."))
    if soil.slope_pct is None:
        gaps.append(tr("Pendiente del lote (SRTM).", "Field slope (SRTM)."))
    if soil.texture_assumed:
        gaps.append(tr("Textura del suelo.", "Soil texture."))
    summary = tr(f"{ev.rotation.name}: puesto {rank} de {n}, {ev.total:.0f} puntos (rango {ev.low:.0f}–{ev.high:.0f}).",
                 f"{ev.rotation.name}: rank {rank} of {n}, {ev.total:.0f} points (range {ev.low:.0f}–{ev.high:.0f}).")
    return Recommendation(
        rotation_id=ev.rotation.id,
        summary=summary,
        why=_why(ev, base, best, rank, n, weights, is_actual),
        benefits=profile.benefits,
        risks=[f.message for f in flags if f.severity != Severity.INFO]
        or [tr("Sin riesgos destacados con los datos disponibles.", "No notable risks with the available data.")],
        assumptions=assumptions,
        uncertainties=uncertainties,
        information_gaps=gaps,
        evidence=ev_evidence,
        validation_note=validation_note(),
        requires_agronomist=True,
        disclaimer=disclaimer(),
    )


def confidence_for(
    crops: list[Crop], climate: ClimateContext, soil: SoilContext, soil_moisture, vegetation
) -> tuple[Confidence, list[str]]:
    reasons: list[str] = []
    if climate.origin == DataStatus.SAMPLE:
        reasons.append(tr("Clima de muestra simulada, no datos NASA reales.", "Simulated sample weather, not real NASA data."))
    if climate.n_years < 8:
        reasons.append(tr(f"Solo {climate.n_years} años completos de clima.", f"Only {climate.n_years} complete years of weather."))
    if soil.texture_assumed:
        reasons.append(tr("Textura del suelo supuesta.", "Soil texture assumed."))
    if not soil.lab_analysis:
        reasons.append(tr("Sin análisis de suelo de laboratorio.", "No laboratory soil test."))
    low = sorted({c.name for c in crops if c.confidence == Confidence.BAJA})
    if low:
        reasons.append(tr("Atributos con confianza baja en el catálogo: ", "Low-confidence attributes in the catalog: ") + join(low) + ".")
    if soil_moisture is None and vegetation is None:
        reasons.append(tr("Sin humedad de suelo (SMAP) ni NDVI del lote.", "No soil moisture (SMAP) or NDVI for the field."))
    sat_sample = [
        n for n, x in (("SMAP", soil_moisture), ("NDVI", vegetation)) if x is not None and x.origin == DataStatus.SAMPLE
    ]
    if sat_sample:
        reasons.append(tr(f"{join(sat_sample)} de muestra simulada, no observaciones del lote.", f"{join(sat_sample)} from a simulated sample, not observations of the field."))
    if climate.origin == DataStatus.SAMPLE or len(reasons) >= 4:
        return Confidence.BAJA, reasons
    return (Confidence.MEDIA if reasons else Confidence.ALTA), reasons


def strategy_label(strategy: RotationStrategy) -> str:
    return LocalizedMap({
        RotationStrategy.ACTUAL: ("Actual", "Current"),
        RotationStrategy.CONSERVADORA: ("Conservadora", "Conservative"),
        RotationStrategy.DIVERSIFICADA: ("Diversificada", "Diversified"),
        RotationStrategy.AGUA: ("Ahorro de agua", "Water saving"),
        RotationStrategy.SUELO: ("Salud del suelo", "Soil health"),
        RotationStrategy.RENTABILIDAD: ("Rentabilidad", "Profitability"),
        RotationStrategy.MIXTA: ("Mixta recomendada", "Recommended mix"),
    })[strategy]
