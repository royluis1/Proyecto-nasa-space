"""Aptitud orientativa de cada cultivo para el clima de una zona (reglas simples y explicables).

No es una recomendación de siembra: cruza el catálogo (requerimiento hídrico, tolerancia a sequía, calor y heladas)
con el clima de la zona. No captura suelo ni manejo. Umbrales: docs/assumptions.md (supuestos a validar).
"""

from __future__ import annotations

from app.models.enums import Confidence, Level
from app.schemas.crop import Crop
from app.schemas.regions import CropSuitability, ZoneClimate
from app.services.regions.zoning import LABELS, classify

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

DEPENDS_ON = [
    "Suelo: textura y profundidad definen cuánta agua guarda el perfil (no lo captura la zona).",
    "Riego: con riego la limitación por agua cambia por completo.",
    "Fecha de siembra y ciclo de la variedad o el híbrido: corren el cultivo de los meses de calor o de helada.",
    "Barbecho previo y cobertura: cuánta agua hay en el perfil al sembrar.",
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
        f"Requerimiento hídrico {crop.water_requirement.value} en una zona {LABELS[zone].lower()} "
        f"(lluvia {climate.precip_mm:.0f} mm/año, déficit de {climate.deficit_mm:.0f} mm/año)."
    )
    if crop.drought_tolerance == Level.ALTO and water != Level.ALTO:
        capped = crop.water_requirement == Level.ALTO and zone in DRY_ZONES
        new = Level.MEDIO if capped else _up(water)
        if new != water:
            reasons.append("Tolera bien la sequía: mejora un nivel.")
            water = new
    if crop.water_requirement == Level.ALTO and zone in DRY_ZONES:
        reasons.append("Un cultivo de alta demanda de agua no puede tener aptitud alta en secano en una zona árida o semiárida.")
    if climate.precip_cv_pct and climate.precip_cv_pct >= 25:
        risks.append(f"La lluvia cambia mucho entre años ({climate.precip_cv_pct:.0f} %): hay años bastante más secos que el promedio.")

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
            reasons.append(f"Tolerancia al calor {crop.heat_tolerance.value} con {climate.hot_days:.0f} días/año de más de 35 °C en verano.")
        elif climate.hot_days > HEAT_DOWN_DAYS:
            risks.append(f"{climate.hot_days:.0f} días/año de más de 35 °C: cuidar que la floración no coincida con los picos de calor.")

    # 3. heladas
    frost = Level.ALTO
    if crop.frost_tolerance == Level.BAJO and climate.frost_days > FROST_DAYS:
        if months & WINTER:
            frost = Level.MEDIO
            reasons.append(f"Poco tolerante a heladas y está en el lote en invierno ({climate.frost_days:.0f} días/año con mínimas de 2 °C o menos).")
        else:
            risks.append("Poco tolerante a heladas: riesgo de heladas tempranas o tardías según la fecha de siembra.")

    level = min((water, heat, frost), key=ORDER.index)
    return CropSuitability(
        crop_id=crop.id, crop_name=crop.name, level=level, reasons=reasons, risks=risks,
        depends_on=DEPENDS_ON, confidence=confidence,
    )


def rank(crops: list[Crop], climate: ZoneClimate, confidence: Confidence, include_cover: bool = True) -> list[CropSuitability]:
    items = [suitability(c, climate, confidence) for c in crops if include_cover or not c.is_cover_crop]
    water = {c.id: ORDER.index(c.water_requirement) for c in crops}
    return sorted(items, key=lambda s: (-ORDER.index(s.level), water[s.crop_id], s.crop_name))
