from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import get_region_repository, get_repository, get_satellite_service
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.regions import FieldSoilMoisture, ProvincesOut, ZoneAt, ZonesOut, ZoneSuitability
from app.services.regions.repository import RegionRepository
from app.services.repository import Repository
from app.services.satellite.service import SatelliteService
from app.services.soil_moisture_field import field_soil_moisture

router = APIRouter(tags=["zonas y suelo"])
NOT_FOUND = {404: {"model": ErrorResponse}}
SAMPLE_WARNING = "Zonas de MUESTRA SIMULADA: no son datos de NASA POWER. Correr scripts/build_zones.py --live con internet."


def _meta(origin: DataStatus | None, warning: str | None = None, extra: list[str] | None = None) -> ResponseMeta:
    st = origin or DataStatus.SAMPLE
    warnings = [*([warning] if warning else []), *(extra or [])]
    return ResponseMeta(data_status=st, origin_label=st.origin_label, warnings=warnings)


@router.get("/regions/provinces", response_model=ApiResponse[ProvincesOut], summary="Provincias de Argentina")
def provinces(regions: RegionRepository = Depends(get_region_repository)) -> ApiResponse[ProvincesOut]:
    """GeoJSON de las provincias (simplificado), con `has_zones` y el origen de su zonificación.
    Fuente de los límites: ver `source` y `license` (Natural Earth hasta tener el archivo del IGN)."""
    meta = regions.provinces["fieldshift"]
    data = ProvincesOut(source=meta["source"], license=meta["license"], note=meta.get("note"),
                        generated_at=meta.get("generated_at"), features=regions.provinces_out())
    return ApiResponse(data=data, meta=ResponseMeta(data_status=DataStatus.SAMPLE, origin_label=meta["source"]))


@router.get("/regions/{province_id}/zones", response_model=ApiResponse[ZonesOut], summary="Zonas climáticas de una provincia",
            responses=NOT_FOUND)
def zones(province_id: str = Path(examples=["san-luis"]), regions: RegionRepository = Depends(get_region_repository)) -> ApiResponse[ZonesOut]:
    """Zonas climáticas derivadas de NASA POWER (índice de aridez UNEP) con su clima y la aptitud resumida de cada
    cultivo, y las celdas de POWER que las forman. Si la provincia no tiene zonificación: `available = false`.
    No son zonas agroecológicas oficiales."""
    z = regions.zones_out(province_id)
    return ApiResponse(data=z, meta=_meta(z.origin, z.warning))


@router.get("/zones/at", response_model=ApiResponse[ZoneAt], summary="Zona de un punto y transición", responses=NOT_FOUND)
def zone_at(
    lat: float = Query(ge=-56, le=-21, examples=[-33.85]),
    lon: float = Query(ge=-74, le=-53, examples=[-65.2]),
    regions: RegionRepository = Depends(get_region_repository),
) -> ApiResponse[ZoneAt]:
    """Provincia, zona y celda de POWER del punto, si está en una zona de transición húmedo/seco (con la aptitud para
    las dos zonas y opciones a evaluar) y los cultivos más aptos. 404 si el punto no cae en ninguna provincia."""
    z = regions.zone_at(lat, lon)
    return ApiResponse(data=z, meta=_meta(z.zone.origin if z.zone else None, z.note))


@router.get("/crops/suitability", response_model=ApiResponse[ZoneSuitability], summary="Aptitud de cultivos en una zona",
            responses=NOT_FOUND)
def crop_suitability(
    zone_id: str = Query(examples=["san-luis-semiarido"]), regions: RegionRepository = Depends(get_region_repository)
) -> ApiResponse[ZoneSuitability]:
    """Aptitud orientativa (alta, media o baja) de cada cultivo del catálogo con el clima de la zona, con motivos,
    riesgos, confianza y lo que depende del suelo y del manejo. Requiere validación agronómica local."""
    s = regions.suitability(zone_id)
    return ApiResponse(data=s, meta=_meta(s.zone.origin, SAMPLE_WARNING if s.zone.origin == DataStatus.SAMPLE else None,
                                          ["Aptitud orientativa por reglas: no es una recomendación de siembra."]))


@router.get("/fields/{field_id}/soil-moisture", response_model=ApiResponse[FieldSoilMoisture],
            summary="Humedad del suelo satelital del lote (SMAP)", responses={**NOT_FOUND, 503: {"model": ErrorResponse}})
def soil_moisture(
    field_id: str,
    recent_days: int = Query(default=60, ge=7, le=365),
    repo: Repository = Depends(get_repository),
    satellite: SatelliteService = Depends(get_satellite_service),
) -> ApiResponse[FieldSoilMoisture]:
    """SMAP L3 (capa superficial ~5 cm, observado) y L4 (zona de raíces, MODELADO), ~9 km: última observación
    disponible, serie reciente y anomalía frente al mismo mes de otros años. Contexto regional, no tiempo real."""
    repo.get_field(field_id)
    r = field_soil_moisture(satellite, field_id, recent_days)
    origin = r.products[0].origin
    return ApiResponse(data=r, meta=ResponseMeta(data_status=origin, origin_label=origin.origin_label, warnings=r.warnings))
