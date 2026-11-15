"""Aptitud orientativa de cada cultivo para el clima de una zona (reglas simples y explicables).

No es una recomendación de siembra: cruza el catálogo (requerimiento hídrico, tolerancia a sequía, calor y heladas)
con el clima de la zona. No captura suelo ni manejo. Umbrales: docs/assumptions.md (supuestos a validar).
"""

from __future__ import annotations

from app.models.enums import Confidence, Level
from app.schemas.crop import Crop
from app.schemas.regions import CropSuitability, ZoneClimate
from app.services.regions.zoning import LABELS, classify
from app.i18n import tr

LEVEL_EN = {"bajo": "low", "medio": "medium", "alto": "high"}

ORDER = [Level.BAJO, Level.MEDIO, Level.ALTO]

# Aptitud por agua en secano: requerimiento hídrico del cultivo x clase de aridez de la zona.
WATER_MATRIX: dict[Level, dict[str, Level]] = {
    Level.ALTO: {"arido": Level.BAJO, "semiarido": Level.BAJO, "subhumedo_seco": Level.MEDIO, "humedo": Level.ALTO},
    Level.MEDIO: {"arido": Level.BAJO, "semiarido": Level.MEDIO, "subhumedo_seco": Level.ALTO, "humedo": Level.ALTO},
    Level.BAJO: {"arido": Level.MEDIO, "semiarido": Level.ALTO, "subhumedo_seco": Level.ALTO, "humedo": Level.ALTO},
}
DRY_ZONES = {"arido", "semiarido"}
HEAT_DOWN_DAYS = 20  # días/año con Tmax > 35 °C desde los que se baja un nivel a cultivos poco tolerantes al calor
HEAT_LOW_DAYS = 40  # desde aquí, aptitud baja para cultivos poco tolerantes
FROST_DAYS = 10  # días/año con Tmin <= 2 °C desde los que pesa la poca tolerancia a heladas
SUMMER = {12, 1, 2}
WINTER = {6, 7, 8}

def depends_on() -> list[str]:
    """Lo que la zona no captura, en el idioma del pedido."""
    return [
        tr("Suelo: textura y profundidad definen cuánta agua guarda el perfil (no lo captura la zona).",
           "Soil: texture and depth define how much water the profile holds (the zone does not capture it)."),
        tr("Riego: con riego la limitación por agua cambia por completo.",
           "Irrigation: with irrigation the water limitation changes completely."),
        tr("Fecha de siembra y ciclo de la variedad o el híbrido: corren el cultivo de los meses de calor o de helada.",
           "Planting date and the variety's or hybrid's cycle: they shift the crop away from the heat or frost months."),
        tr("Barbecho previo y cobertura: cuánta agua hay en el perfil al sembrar.",
           "Previous fallow and cover: how much water is in the profile at planting."),
    ]


def _down(level: Level, steps: int = 1) -> Level:
    return ORDER[max(0, ORDER.index(level) - steps)]


def _up(level: Level) -> Level:
    return ORDER[min(2, ORDER.index(level) + 1)]


def crop_months(crop: Crop) -> set[int]:
    s, e = crop.default_calendar.start_month, crop.default_calendar.end_month
    n = (e - s) % 12 + 1
    return {(s - 1 + k) % 12 + 1 for k in range(n)}


def suitability(crop: Crop, climate: ZoneClimate, confidence: Confidence) -> CropSuitability:
    zone = classify(climate.aridity_index)
    months = crop_months(crop)
    reasons: list[str] = []
    risks: list[str] = []

    # 1. agua
    water = WATER_MATRIX[crop.water_requirement][zone]
    reasons.append(
        tr(f"Requerimiento hídrico {crop.water_requirement.value} en una zona {LABELS[zone].lower()} "
           f"(lluvia {climate.precip_mm:.0f} mm/año, déficit de {climate.deficit_mm:.0f} mm/año).",
           f"{LEVEL_EN[crop.water_requirement.value].capitalize()} water requirement in a {LABELS[zone].lower()} zone "
           f"(rain {climate.precip_mm:.0f} mm/yr, deficit of {climate.deficit_mm:.0f} mm/yr).")
    )
    if crop.drought_tolerance == Level.ALTO and water != Level.ALTO:
        capped = crop.water_requirement == Level.ALTO and zone in DRY_ZONES
        new = Level.MEDIO if capped else _up(water)
        if new != water:
            reasons.append(tr("Tolera bien la sequía: mejora un nivel.", "It tolerates drought well: it moves up one level."))
            water = new
    if crop.water_requirement == Level.ALTO and zone in DRY_ZONES:
        reasons.append(tr("Un cultivo de alta demanda de agua no puede tener aptitud alta en secano en una zona árida o semiárida.", "A high-water-demand crop cannot have high suitability in rainfed farming in an arid or semi-arid zone."))
    if climate.precip_cv_pct and climate.precip_cv_pct >= 25:
        risks.append(tr(f"La lluvia cambia mucho entre años ({climate.precip_cv_pct:.0f} %): hay años bastante más secos que el promedio.", f"Rain varies a lot between years ({climate.precip_cv_pct:.0f} %): some years are quite a bit drier than average."))

    # 2. calor (solo si el cultivo está en el lote en verano)
    heat = Level.ALTO
    if months & SUMMER:
        if crop.heat_tolerance == Level.BAJO and climate.hot_days > HEAT_LOW_DAYS:
            heat = Level.BAJO
        elif crop.heat_tolerance == Level.BAJO and climate.hot_days > HEAT_DOWN_DAYS:
            heat = Level.MEDIO
        elif crop.heat_tolerance == Level.MEDIO and climate.hot_days > HEAT_LOW_DAYS:
            heat = Level.MEDIO
        if heat != Level.ALTO:
            reasons.append(tr(f"Tolerancia al calor {crop.heat_tolerance.value} con {climate.hot_days:.0f} días/año de más de 35 °C en verano.", f"{LEVEL_EN[crop.heat_tolerance.value].capitalize()} heat tolerance with {climate.hot_days:.0f} days/yr above 35 °C in summer."))
        elif climate.hot_days > HEAT_DOWN_DAYS:
            risks.append(tr(f"{climate.hot_days:.0f} días/año de más de 35 °C: cuidar que la floración no coincida con los picos de calor.", f"{climate.hot_days:.0f} days/yr above 35 °C: make sure flowering does not coincide with the heat peaks."))

    # 3. heladas
    frost = Level.ALTO
    if crop.frost_tolerance == Level.BAJO and climate.frost_days > FROST_DAYS:
        if months & WINTER:
            frost = Level.MEDIO
            reasons.append(tr(f"Poco tolerante a heladas y está en el lote en invierno ({climate.frost_days:.0f} días/año con mínimas de 2 °C o menos).", f"Not very frost-tolerant and it is in the field in winter ({climate.frost_days:.0f} days/yr with lows of 2 °C or less)."))
        else:
            risks.append(tr("Poco tolerante a heladas: riesgo de heladas tempranas o tardías según la fecha de siembra.", "Not very frost-tolerant: risk of early or late frosts depending on the planting date."))

    level = min((water, heat, frost), key=ORDER.index)
    return CropSuitability(
        crop_id=crop.id, crop_name=crop.name, level=level, reasons=reasons, risks=risks,
        depends_on=depends_on(), confidence=confidence,
    )


def rank(crops: list[Crop], climate: ZoneClimate, confidence: Confidence, include_cover: bool = True) -> list[CropSuitability]:
    items = [suitability(c, climate, confidence) for c in crops if include_cover or not c.is_cover_crop]
    water = {c.id: ORDER.index(c.water_requirement) for c in crops}
    return sorted(items, key=lambda s: (-ORDER.index(s.level), water[s.crop_id], s.crop_name))
