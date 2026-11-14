"""Humedad del suelo satelital de un lote: SMAP L3 (superficie, observado) y L4 (zona de raíces, modelado).

Reusa el servicio satelital (AppEEARS en vivo, CSV cargado, caché o muestra rotulada). Siempre "última observación
disponible", nunca "tiempo real": SMAP llega con días de atraso y describe un píxel de ~9 km.
"""

from __future__ import annotations

import statistics
from datetime import timedelta

from app.schemas.regions import FieldSoilMoisture, MoisturePoint, SoilMoistureProduct
from app.schemas.satellite import SoilMoistureRequest
from app.services.satellite.products import PRODUCTS
from app.utils.exceptions import InvalidInputError, NoDataError

PRODUCT_KEYS = ["SPL3SMP_E", "SPL4SMGP_rootzone"]
DRY_PCT, WET_PCT = -15.0, 15.0  # lectura en palabras: más seco / normal / más húmedo (supuesto)


def reading(anomaly: float | None) -> str:
    if anomaly is None:
        return "Sin suficientes datos para comparar con lo normal."
    if anomaly <= DRY_PCT:
        return f"Más seco que lo normal para la época ({anomaly:+.0f} %)."
    if anomaly >= WET_PCT:
        return f"Más húmedo que lo normal para la época ({anomaly:+.0f} %)."
    return f"Parecido a lo normal para la época ({anomaly:+.0f} %)."


def field_soil_moisture(satellite, field_id: str, recent_days: int = 60) -> FieldSoilMoisture:
    products, warnings = [], []
    for key in PRODUCT_KEYS:
        meta = PRODUCTS[key]
        try:
            s, w = satellite.soil_moisture(SoilMoistureRequest(field_id=field_id, product=key, include_series=True))
        except (NoDataError, InvalidInputError) as exc:
            warnings.append(f"{meta.name}: {exc.message}")
            continue
        warnings += [f"SMAP {'L3' if key.startswith('SPL3') else 'L4'}: {x}" for x in w]
        points = [p for p in (s.series or []) if p.value is not None]
        last = points[-1] if points else None
        recent, month_mean, normal, anomaly, month = [], None, None, None, None
        if last:
            since = last.date - timedelta(days=recent_days)
            recent = [MoisturePoint(date=p.date, value=round(p.value, 4)) for p in points if p.date > since]
            month = last.date.month
            this_month = [p.value for p in points if p.date.year == last.date.year and p.date.month == month]
            others = [p.value for p in points if p.date.month == month and p.date.year != last.date.year]
            month_mean = round(statistics.fmean(this_month), 4) if this_month else None
            normal = round(statistics.fmean(others), 4) if others else None
            if month_mean is not None and normal:
                anomaly = round((month_mean - normal) / normal * 100, 1)
        products.append(SoilMoistureProduct(
            product=key, name=meta.name, label=meta.label.value, depth=meta.depth, resolution=meta.spatial_resolution,
            temporal_resolution=meta.temporal_resolution, units=meta.units, last_observation=last.date if last else None,
            last_value=round(last.value, 4) if last else None, recent=recent, month=month, month_mean=month_mean,
            month_normal=normal, anomaly_pct=anomaly, reading=reading(anomaly), origin=s.trace.status,
            origin_label=s.trace.status_label, retrieved_at=s.trace.retrieved_at, limitations=meta.limitations,
        ))
    if not products:
        raise NoDataError("No hay datos de humedad del suelo satelital para este lote.", {"motivos": warnings})
    return FieldSoilMoisture(field_id=field_id, products=products, warnings=list(dict.fromkeys(warnings)))
