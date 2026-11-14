"""Calor y estrés de la zona con ECOSTRESS: temperatura de la superficie (LST, observada) e índice de estrés
evaporativo (ESI, modelado), píxeles de 70 m, vía AppEEARS. Umbrales: docs/assumptions.md (supuestos a validar).
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta

from app.schemas.regions import FieldHeatStress, HeatReading
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteProvider
from app.utils.exceptions import NoDataError

K = 273.15
HOT_SURFACE_C = 45.0  # superficie muy caliente (supuesto)
ESI_HIGH_STRESS, ESI_LOW_STRESS = 0.3, 0.6  # ESI < 0,3 estrés alto; > 0,6 bajo (supuesto)
RECENT_DAYS = 90
YEARS = 3
SUMMER = {12, 1, 2}


def _reading(product, data, n: int, last) -> HeatReading:
    return HeatReading(product=product.appeears_id, name=product.name, label=product.label.value, resolution=product.spatial_resolution,
                       observations=n, last_observation=last, origin=data.status, origin_label=data.status.origin_label,
                       limitations=product.limitations)


def field_heat_stress(provider: SatelliteProvider, field, today: date | None = None) -> FieldHeatStress:
    today = today or date.today()
    end = today - timedelta(days=7)
    start = date(end.year - YEARS, end.month, 1)
    pt = [("lote", field.location.lat, field.location.lon)]
    warnings: list[str] = []
    lst = esi = None
    summer = mx = hot = esi_recent = esi_normal = level = None

    try:
        d = provider.get_points(PRODUCTS["ECO_L2T_LSTE"], pt, start, end)
        s = d.series["lote"].df["value"].dropna() - K
        warnings += [f"ECOSTRESS LST: {w}" for w in d.warnings]
        lst = _reading(PRODUCTS["ECO_L2T_LSTE"], d, len(s), s.index.max().date() if len(s) else None)
        sv = s[s.index.month.isin(SUMMER)]
        summer = round(float(sv.mean()), 1) if len(sv) else None
        mx = round(float(s.max()), 1) if len(s) else None
        hot = int((s > HOT_SURFACE_C).sum())
    except NoDataError as exc:
        warnings.append(f"ECOSTRESS LST no disponible: {exc.message}")

    try:
        d = provider.get_points(PRODUCTS["ECO_L4T_ESI"], pt, start, end)
        e = d.series["lote"].df["value"].dropna()
        warnings += [f"ECOSTRESS ESI: {w}" for w in d.warnings]
        esi = _reading(PRODUCTS["ECO_L4T_ESI"], d, len(e), e.index.max().date() if len(e) else None)
        if len(e):
            last = e.index.max()
            recent = e[e.index > last - timedelta(days=RECENT_DAYS)]
            months = set(recent.index.month)
            normal = e[(e.index <= last - timedelta(days=RECENT_DAYS)) & e.index.month.isin(months)]
            esi_recent = round(float(recent.mean()), 2) if len(recent) else None
            esi_normal = round(float(normal.mean()), 2) if len(normal) else None
            if esi_recent is not None:
                level = "alto" if esi_recent < ESI_HIGH_STRESS else "medio" if esi_recent <= ESI_LOW_STRESS else "bajo"
    except NoDataError as exc:
        warnings.append(f"ECOSTRESS ESI no disponible: {exc.message}")

    parts = []
    if summer is not None:
        parts.append(f"En verano la superficie llega a {summer:.0f} °C de media en las pasadas del satélite"
                     + (f", con {hot} observaciones por encima de {HOT_SURFACE_C:.0f} °C." if hot else "."))
    if level:
        cmp = ""
        if esi_normal:
            cmp = " (más estrés que lo normal para la época)" if esi_recent < esi_normal - 0.05 else (
                " (menos estrés que lo normal)" if esi_recent > esi_normal + 0.05 else " (parecido a lo normal)")
        parts.append(f"Estrés hídrico de la vegetación {level} en los últimos 3 meses: ESI {esi_recent:.2f}{cmp}.")
    reading = " ".join(parts) or "Sin datos de ECOSTRESS para esta ubicación."
    if lst is None and esi is None:
        raise NoDataError("No hay datos de ECOSTRESS para este lote.", {"warnings": warnings})
    return FieldHeatStress(
        field_id=field.id, period=f"{start} a {end}", lst=lst, lst_summer_mean_c=summer, lst_max_c=mx, hot_surface_obs=hot,
        esi=esi, esi_recent=esi_recent, esi_normal=esi_normal, stress_level=level, reading=reading,
        warnings=list(dict.fromkeys(warnings)),
    )
