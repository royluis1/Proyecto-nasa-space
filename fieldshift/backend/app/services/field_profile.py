"""Perfil automático del campo al cargarlo: suelo estimado, zona climática, cultivos más aptos y transición.

Regla: lo que carga el productor siempre pisa lo automático. Si hay análisis de laboratorio, no se usa la estimación.
Si una fuente falla, el dato queda vacío con un aviso: no se inventa.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.enums import Confidence, DataLabel
from app.models.provenance import Provenance
from app.schemas.field import FieldOut, SoilProfile
from app.schemas.regions import AutoProfile
from app.services.regions.repository import RegionRepository
from app.services.soil.nearby import estimate_nearby
from app.services.soil.soilgrids import SoilProvider
from app.utils.exceptions import FieldShiftError


def build_auto_profile(field: FieldOut, regions: RegionRepository, soil: SoilProvider) -> FieldOut:
    lat, lon = field.location.lat, field.location.lon
    warnings: list[str] = []

    nearby = estimate_nearby(soil, lat, lon)
    estimate = nearby.estimate
    warnings += nearby.warnings

    zone = None
    try:
        zone = regions.zone_at(lat, lon)
        if not zone.zones_available:
            warnings.append(f"Zona: {zone.note}")
    except FieldShiftError as exc:
        warnings.append(f"Zona: {exc.message}")

    profile = field.soil_profile
    applied: list[str] = []
    if estimate and profile and profile.lab_analysis:
        warnings.append("Hay análisis de laboratorio: se usa ese y no la estimación de suelo.")
    elif estimate:
        updates = {}
        if (profile is None or profile.texture is None) and estimate.texture:
            updates["texture"] = estimate.texture
            applied.append("textura")
        if (profile is None or profile.organic_matter is None) and estimate.organic_matter:
            updates["organic_matter"] = estimate.organic_matter
            applied.append("materia orgánica")
        if updates:
            where = f" Tomado de los alrededores, a unos {nearby.distance_km:.0f} km del punto (en el punto no hay suelo agrícola)." if nearby.distance_km else ""
            note = f"Estimado ({', '.join(applied)}) con {estimate.source}, 0-30 cm, 250 m.{where} {estimate.note}"
            if profile is None:
                prov = Provenance(label=DataLabel.ESTIMADO, retrieved_at=estimate.retrieved_at, resolution="250 m",
                                  method=estimate.source, confidence=Confidence.BAJA, note=note)
                profile = SoilProfile(**updates, provenance=prov)
            else:  # el productor cargó una parte: se completa el resto y se aclara
                prov = profile.provenance.model_copy(update={"note": f"{profile.provenance.note or 'Cargado por el productor.'} {note}"})
                profile = profile.model_copy(update={**updates, "provenance": prov})

    auto = AutoProfile(
        soil_estimate=estimate,
        soil_applied=applied,
        zone=zone,
        top_crops=zone.top_crops if zone else [],
        warnings=warnings,
        generated_at=datetime.now(timezone.utc),
    )
    return field.model_copy(update={"soil_profile": profile, "auto_profile": auto})
