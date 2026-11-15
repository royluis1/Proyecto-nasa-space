"""Clasificación de celdas en zonas climáticas por el índice de aridez de la UNEP (lluvia / ET0).

Lo usan el script scripts/build_zones.py y los tests. Umbrales: docs/assumptions.md.
"""

from __future__ import annotations

import statistics

from app.i18n import LocalizedMap
from app.services.engine.parameters import ARIDITY_LIMITS
from app.i18n import tr

HOT_C = 35.0  # día de calor: Tmax > 35 °C
COLD_C = 2.0  # día frío con riesgo de helada: Tmin <= 2 °C
LIMITS = [limit for limit, _ in ARIDITY_LIMITS]  # 0,20 / 0,50 / 0,65
ORDER = ["arido", "semiarido", "subhumedo_seco", "humedo"]  # de más seca a más húmeda
LABELS = LocalizedMap({
    "arido": ("Árida", "Arid"),
    "semiarido": ("Semiárida", "Semi-arid"),
    "subhumedo_seco": ("Subhúmeda seca", "Dry sub-humid"),
    "humedo": ("Subhúmeda húmeda o más húmeda", "Moist sub-humid or wetter"),
})


def classify(aridity_index: float) -> str:
    for limit, zone in ARIDITY_LIMITS:
        if aridity_index < limit:
            return zone.value
    return "humedo"


def summarize(rows: list[dict]) -> dict:
    """rows: [{year, precip, et0, hot, cold}] de años completos -> clima de la celda y clase."""
    if not rows:
        raise ValueError(tr("No hay años completos para clasificar la celda.", "There are no complete years to classify the cell."))
    p = [r["precip"] for r in rows]
    e = [r["et0"] for r in rows]
    ai = statistics.fmean(p) / statistics.fmean(e)
    cls = classify(ai)
    yearly = [{"year": r["year"], "aridity_index": round(r["precip"] / r["et0"], 3), "zone_class": classify(r["precip"] / r["et0"])} for r in rows]
    return {
        "zone_class": cls,
        "precip_mm": round(statistics.fmean(p)),
        "et0_mm": round(statistics.fmean(e)),
        "deficit_mm": round(statistics.fmean(e) - statistics.fmean(p)),
        "aridity_index": round(ai, 3),
        "hot_days": round(statistics.fmean(r["hot"] for r in rows), 1),
        "frost_days": round(statistics.fmean(r["cold"] for r in rows), 1),
        "precip_cv_pct": round(statistics.stdev(p) / statistics.fmean(p) * 100, 1) if len(p) > 1 else None,
        "years": len(rows),
        "years_other_class_pct": round(100 * sum(y["zone_class"] != cls for y in yearly) / len(yearly), 1),
        "yearly": yearly,
    }


def neighbor_class(cls: str, wetter: bool) -> str | None:
    i = ORDER.index(cls) + (1 if wetter else -1)
    return ORDER[i] if 0 <= i < len(ORDER) else None
