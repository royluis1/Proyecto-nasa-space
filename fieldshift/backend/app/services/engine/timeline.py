"""Calendario agrícola de varias campañas (julio a junio) para una rotación.

Para cada mes: etapa del cultivo, cobertura del suelo, riesgo de golpe de calor y de déficit
hídrico (con el clima de NASA POWER y el escenario aplicado), y recomendaciones simples.
SMAP ajusta el riesgo hídrico del arranque de la primera campaña y NDVI se usa para comparar
con lo observado en el lote. Todo es orientativo: los umbrales son supuestos de diseño.
"""

from dataclasses import dataclass

from app.models.enums import Level
from app.schemas.calendar import TimelineAdvice, TimelineCampaign, TimelineMonth
from app.schemas.crop import Crop
from app.schemas.rotation import Rotation, SoilMoistureInput, VegetationInput
from app.services.engine import parameters as P
from app.services.engine.calendar import MONTH_NAMES, Calendar, build_calendar
from app.services.engine.context import ClimateContext, SoilContext
from app.services.engine.water import water_balance
from app.i18n import join_words, tr

# Umbrales (supuestos de diseño)
HEAT_HIGH, HEAT_MEDIUM = 0.35, 0.12  # índice = frecuencia de calor relativa x sensibilidad x etapa
WATER_HIGH, WATER_MEDIUM = 0.45, 0.2  # índice = déficit relativo x sensibilidad a sequía
STAGE_WEIGHT = {"siembra": 0.6, "desarrollo": 1.0, "cosecha": 0.5}
RESIDUE_MONTHS = {Level.BAJO: 6, Level.MEDIO: 3, Level.ALTO: 0}  # meses que el rastrojo protege el suelo
BARE_STRETCH_MIN = 3
SMAP_DRY_ANOMALY = -15.0
SMAP_EARLY_MONTHS = 6  # julio a diciembre de la primera campaña
CAMPAIGN_START_MONTH = 7  # julio

_LEVELS = [Level.BAJO, Level.MEDIO, Level.ALTO]


def _level(value: float, high: float, medium: float) -> Level:
    return Level.ALTO if value >= high else Level.MEDIO if value >= medium else Level.BAJO


def _bump(level: Level | None) -> Level | None:
    return None if level is None else _LEVELS[min(2, _LEVELS.index(level) + 1)]


def _months_text(months: list[TimelineMonth]) -> str:
    names = [MONTH_NAMES[m.month - 1] for m in months]
    return join_words(names)


@dataclass
class TimelineResult:
    campaigns: list[TimelineCampaign]
    advice: list[TimelineAdvice]
    data_used: list[str]
    assumptions: list[str]


def _cover(calendar: Calendar, m: int, crop: Crop | None) -> str:
    if crop is not None:
        return "cobertura" if crop.is_cover_crop else "cultivo"
    prev = calendar.previous_crop(m)
    if prev is None:
        return "desnudo"
    since = 0
    for back in range(1, calendar.n_months + 1):
        if calendar.owner[(m - back) % calendar.n_months] is not None:
            break
        since += 1
    return "rastrojo" if since < RESIDUE_MONTHS[prev.erosion_risk] else "desnudo"


def build_timeline(
    rotation: Rotation,
    crops: dict[str, Crop],
    climate: ClimateContext,
    soil: SoilContext,
    irrigated: bool,
    irrigation_share: float,
    n_campaigns: int,
    first_year: int,
    soil_moisture: SoilMoistureInput | None = None,
    vegetation: VegetationInput | None = None,
) -> TimelineResult:
    calendar = build_calendar(rotation, crops)
    water = water_balance(calendar, climate, soil, irrigated, irrigation_share)
    n = calendar.n_months
    smap_dry = soil_moisture is not None and (
        soil_moisture.anomaly_pct <= SMAP_DRY_ANOMALY or soil_moisture.stress_level == Level.ALTO
    )

    campaigns: list[TimelineCampaign] = []
    index = 0
    for c in range(n_campaigns):
        months: list[TimelineMonth] = []
        for k in range(12):
            month = (CAMPAIGN_START_MONTH - 1 + k) % 12 + 1
            year = first_year + c + (1 if month < CAMPAIGN_START_MONTH else 0)
            # mes del ciclo de la rotación (el año 1 de la rotación empieza en enero de la primera campaña)
            cycle_m = (12 * c + CAMPAIGN_START_MONTH - 1 + k) % n
            owner = calendar.owner[cycle_m]
            crop = calendar.crop_at(cycle_m)
            heat_pct = 100 * climate.heat_freq[month - 1]
            stage, harvest_of, heat_risk, water_risk, stress_pct = "barbecho", None, None, None, None
            if owner is not None and crop is not None:
                pos, length = calendar.position(owner, cycle_m)
                stage = "siembra" if pos == 0 else "cosecha" if pos == length - 1 else "desarrollo"
                if pos == 0:
                    prev_step = next(
                        (p for p in calendar.steps if p.index != owner and p.months[-1] == cycle_m and cycle_m not in p.owned),
                        None,
                    )
                    harvest_of = prev_step.crop.name if prev_step else None
                heat_idx = min(1.0, climate.heat_freq[month - 1] / 0.3) * P.SENSITIVITY[crop.heat_tolerance]
                heat_risk = _level(heat_idx * STAGE_WEIGHT[stage], HEAT_HIGH, HEAT_MEDIUM)
                stress = max(0.0, water.month_stress[cycle_m])
                stress_pct = round(100 * stress, 0)
                water_idx = stress * (0.6 + 0.4 * P.SENSITIVITY[crop.drought_tolerance])
                water_risk = _level(water_idx, WATER_HIGH, WATER_MEDIUM)
                if smap_dry and c == 0 and k < SMAP_EARLY_MONTHS:
                    # SMAP: el perfil arranca más seco que lo normal; pesa en los primeros meses de la primera campaña
                    water_risk = _bump(water_risk)
            cover = _cover(calendar, cycle_m, crop)
            months.append(
                TimelineMonth(
                    index=index,
                    campaign=c + 1,
                    year=year,
                    month=month,
                    label=f"{MONTH_NAMES[month - 1]} {year}",
                    crop_id=crop.id if crop else None,
                    crop_name=crop.name if crop else None,
                    is_cover_crop=bool(crop and crop.is_cover_crop),
                    stage=stage,
                    harvest_of=harvest_of,
                    cover=cover,
                    bare_soil=cover == "desnudo",
                    heat_risk=heat_risk,
                    water_risk=water_risk,
                    heat_days_pct=round(heat_pct, 1),
                    precip_mm=round(climate.precip[month - 1], 0),
                    et0_mm=round(climate.et0[month - 1], 0),
                    water_stress_pct=stress_pct,
                )
            )
            index += 1
        campaigns.append(
            TimelineCampaign(
                index=c + 1,
                label=f"{first_year + c}/{str(first_year + c + 1)[-2:]}",
                months=months,
                covered_months=sum(1 for m in months if m.crop_id),
                bare_months=sum(1 for m in months if m.bare_soil),
                heat_risk_months=sum(1 for m in months if m.heat_risk == Level.ALTO),
                water_risk_months=sum(1 for m in months if m.water_risk == Level.ALTO),
            )
        )

    advice = _advice(campaigns, climate, irrigated, irrigation_share, smap_dry, soil_moisture)
    data_used, assumptions = _data_notes(rotation, calendar, climate, soil_moisture, vegetation)
    if vegetation is not None:
        observed = 12 * vegetation.bare_soil_fraction
        planned = sum(c.bare_months + sum(1 for m in c.months if m.cover == "rastrojo") for c in campaigns) / len(campaigns)
        better = planned < observed - 0.5
        advice.append(
            TimelineAdvice(
                kind="datos",
                severity=Level.BAJO if better else Level.MEDIO,
                text=(
                    tr(f"MODIS NDVI: en los últimos años el lote estuvo ~{observed:.0f} meses por año con poca vegetación. "
                       f"Con esta rotación serían ~{planned:.0f} meses sin cultivo vivo",
                       f"MODIS NDVI: in recent years the field spent ~{observed:.0f} months per year with little vegetation. "
                       f"With this rotation it would be ~{planned:.0f} months without a living crop")
                    + (tr(": menos tiempo de suelo expuesto.", ": less time with exposed soil.") if better else tr(": conviene sumar cobertura.", ": adding cover is advisable."))
                ),
                campaigns=[c.index for c in campaigns],
            )
        )
    return TimelineResult(campaigns, _merge(advice), data_used, assumptions)


def _advice(
    campaigns: list[TimelineCampaign],
    climate: ClimateContext,
    irrigated: bool,
    share: float,
    smap_dry: bool,
    soil_moisture: SoilMoistureInput | None,
) -> list[TimelineAdvice]:
    out: list[TimelineAdvice] = []
    heavy = climate.scenario is not None and climate.scenario.heavy_rain
    timeline = [m for c in campaigns for m in c.months]

    # tramos sin cultivo vivo
    run: list[TimelineMonth] = []
    for m in [*timeline, None]:
        if m is not None and m.crop_id is None:
            run.append(m)
            continue
        if len(run) >= BARE_STRETCH_MIN:
            windy = [x for x in run if x.month in P.WINDY_MONTHS and x.bare_soil]
            bare = sum(1 for x in run if x.bare_soil)
            reason = []
            if windy:
                reason.append(tr("en la época de viento", "in the windy season"))
            if heavy and any(x.month in P.HEAVY_RAIN_MONTHS for x in run):
                reason.append(tr("con tormentas fuertes", "with strong storms"))
            out.append(
                TimelineAdvice(
                    kind="cobertura",
                    severity=Level.ALTO if windy or bare >= 4 else Level.MEDIO,
                    text=(
                        tr(f"De {run[0].label} a {run[-1].label} el lote queda {len(run)} meses sin cultivo vivo",
                           f"From {run[0].label} to {run[-1].label} the field has {len(run)} months without a living crop")
                        + (tr(f" ({bare} con suelo desnudo)", f" ({bare} with bare soil)") if bare else "")
                        + (" " + tr(" y ", " and ").join(reason) if reason else "")
                        + tr(". Considerá un cultivo de cobertura (por ejemplo centeno o vicia) o dejar el rastrojo en pie.",
                             ". Consider a cover crop (for example rye or vetch) or leaving the residue standing.")
                    ),
                    campaigns=[run[0].campaign],
                )
            )
        run = []

    for camp in campaigns:
        by_crop: dict[str, list[TimelineMonth]] = {}
        for m in camp.months:
            if m.crop_name and not m.is_cover_crop:
                by_crop.setdefault(m.crop_name, []).append(m)
        for crop, months in by_crop.items():
            hot = [m for m in months if m.heat_risk == Level.ALTO]
            if hot:
                out.append(
                    TimelineAdvice(
                        kind="calor",
                        severity=Level.ALTO,
                        text=(
                            tr(f"{crop}: riesgo alto de golpe de calor en {_months_text(hot)}. Elegí una fecha de siembra que "
                               "corra la floración fuera de los meses más calurosos o una variedad más tolerante.",
                               f"{crop}: high heat-stress risk in {_months_text(hot)}. Choose a planting date that "
                               "moves flowering out of the hottest months, or a more tolerant variety.")
                        ),
                        campaigns=[camp.index],
                    )
                )
            dry = [m for m in months if m.water_risk == Level.ALTO]
            if dry:
                tip = (
                    tr("Priorizá el riego en esos meses.", "Prioritize irrigation in those months.")
                    if irrigated and share >= 1
                    else tr("Con riego limitado, guardá el agua para esos meses.", "With limited irrigation, save the water for those months.")
                    if irrigated
                    else tr("Revisá el agua útil del perfil antes de sembrar y ajustá densidad y fecha de siembra.", "Check the profile's available water before planting and adjust density and planting date.")
                )
                out.append(
                    TimelineAdvice(
                        kind="agua",
                        severity=Level.ALTO,
                        text=tr(f"{crop}: riesgo alto de falta de agua en {_months_text(dry)}. {tip}", f"{crop}: high water-shortage risk in {_months_text(dry)}. {tip}"),
                        campaigns=[camp.index],
                    )
                )
    if smap_dry and soil_moisture is not None:
        out.append(
            TimelineAdvice(
                kind="siembra",
                severity=Level.MEDIO,
                text=(
                    tr(f"SMAP: la humedad del suelo está {abs(soil_moisture.anomaly_pct):.0f} % por debajo de lo normal para la época. "
                       "Antes de la primera siembra, medí la humedad del perfil (barreno o sonda); el riesgo hídrico de los primeros "
                       "meses ya está aumentado por esto.",
                       f"SMAP: soil moisture is {abs(soil_moisture.anomaly_pct):.0f} % below normal for the season. "
                       "Before the first planting, measure profile moisture (auger or probe); the water risk of the first "
                       "months is already raised by this.")
                ),
                campaigns=[1],
            )
        )
    return out


def _merge(advice: list[TimelineAdvice]) -> list[TimelineAdvice]:
    """Junta consejos con el mismo texto (se repiten en cada campaña de una rotación de un año)."""
    merged: dict[tuple[str, str], TimelineAdvice] = {}
    for a in advice:
        key = (a.kind, a.text)
        if key in merged:
            merged[key].campaigns = sorted(set(merged[key].campaigns + a.campaigns))
        else:
            merged[key] = a.model_copy()
    order = {Level.ALTO: 0, Level.MEDIO: 1, Level.BAJO: 2}
    return sorted(merged.values(), key=lambda a: (order[a.severity], a.campaigns[:1] or [0]))


def _data_notes(
    rotation: Rotation,
    calendar: Calendar,
    climate: ClimateContext,
    soil_moisture: SoilMoistureInput | None,
    vegetation: VegetationInput | None,
) -> tuple[list[str], list[str]]:
    used = [
        tr(f"NASA POWER ({climate.origin.origin_label}, {climate.period}): lluvia, ET0 y días con más de 35 °C de cada mes",
           f"NASA POWER ({climate.origin.origin_label}, {climate.period}): rain, ET0 and days above 35 °C each month")
        + (tr(f", con el escenario '{climate.scenario.name}'.", f", with the scenario '{climate.scenario.name}'.") if climate.scenario else ".")
    ]
    if soil_moisture is not None:
        origin = soil_moisture.origin.origin_label if soil_moisture.origin else tr("sin etiqueta", "unlabeled")
        used.append(
            tr(f"SMAP {soil_moisture.product.removeprefix('SMAP_')} ({origin}): humedad {soil_moisture.anomaly_pct:+.0f} % frente a lo normal; "
               "ajusta el riesgo hídrico del arranque de la primera campaña.",
               f"SMAP {soil_moisture.product.removeprefix('SMAP_')} ({origin}): moisture {soil_moisture.anomaly_pct:+.0f} % vs. normal; "
               "it adjusts the water risk at the start of the first season.")
        )
    else:
        used.append(tr("SMAP: no disponible; el riesgo hídrico sale solo del balance con NASA POWER.", "SMAP: not available; water risk comes only from the NASA POWER balance."))
    if vegetation is not None:
        origin = vegetation.origin.origin_label if vegetation.origin else tr("sin etiqueta", "unlabeled")
        used.append(tr(f"MODIS NDVI {vegetation.product} ({origin}): meses con poca vegetación observados en el lote.", f"MODIS NDVI {vegetation.product} ({origin}): months with little vegetation observed in the field."))
    else:
        used.append(tr("NDVI: no disponible; no se compara con lo observado en el lote.", "NDVI: not available; no comparison with what was observed in the field."))
    assumptions = [
        tr("Campañas de julio a junio. Las fechas de siembra y cosecha son las típicas de cada cultivo.", "Seasons from July to June. Planting and harvest dates are typical for each crop."),
        tr("Riesgo de calor: frecuencia de días con Tmax > 35 °C por la sensibilidad del cultivo, mayor en pleno desarrollo.", "Heat risk: frequency of days with Tmax > 35 °C times the crop's sensitivity, higher in full growth."),
        tr("Riesgo hídrico: demanda no cubierta del balance mensual (Kc x ET0, lluvia efectiva y agua del perfil).", "Water risk: uncovered demand from the monthly balance (Kc x ET0, effective rain and profile water)."),
        tr("El rastrojo protege el suelo unos meses según el cultivo anterior; después se considera suelo desnudo.", "Residue protects the soil for a few months depending on the previous crop; after that it counts as bare soil."),
        tr("Las campañas repiten el mismo clima promedio: no es un pronóstico año por año.", "The seasons repeat the same average weather: it is not a year-by-year forecast."),
    ]
    return used, assumptions
