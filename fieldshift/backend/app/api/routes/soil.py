from fastapi import APIRouter, Depends, Query

from app.api.deps import get_soil_provider
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.regions import PointSoilEstimate
from app.services.soil.nearby import estimate_nearby
from app.services.soil.soilgrids import SoilProvider

router = APIRouter(tags=["zonas y suelo"])


@router.get("/soil/estimate", response_model=ApiResponse[PointSoilEstimate], summary="Suelo estimado de un punto")
def soil_estimate(
    lat: float = Query(ge=-90, le=90, examples=[-33.85]),
    lon: float = Query(ge=-180, le=180, examples=[-65.20]),
    alrededores: bool = Query(default=True, description="Si en el punto no hay suelo agrícola, probar a 3 km."),
    soil: SoilProvider = Depends(get_soil_provider),
) -> ApiResponse[PointSoilEstimate]:
    """Textura y materia orgánica **estimadas** de un punto (SoilGrids de ISRIC, 0-30 cm, 250 m), para completar el
    formulario del campo antes de guardarlo. No es un análisis de laboratorio: lo que cargue el productor siempre gana.

    En el centro de un pueblo SoilGrids no tiene suelo (es zona urbana). Si pasa eso y `alrededores` es verdadero,
    se prueba a 3 km y la respuesta lo dice (`distance_km` y `note`); al guardar el campo se usa la misma regla.
    Orden de siempre: caché → SoilGrids en vivo → muestra rotulada (`origin = sample`) → sin dato con aviso.
    El frontend nunca completa el formulario con la muestra."""
    r = estimate_nearby(soil, lat, lon, alrededores)
    status = r.estimate.origin if r.estimate else DataStatus.MOCK
    label = r.estimate.origin_label if r.estimate else "SIN ESTIMACIÓN DE SUELO"
    data = PointSoilEstimate(estimate=r.estimate, lat=r.lat, lon=r.lon, distance_km=r.distance_km, note=r.note)
    return ApiResponse(data=data, meta=ResponseMeta(data_status=status, origin_label=label, warnings=r.warnings))
