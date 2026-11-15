from fastapi import APIRouter, Depends, Query

from app.api.deps import get_locality_index
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.locality import LocalityOut, LocalitySearch, NearestLocality
from app.services.localities import Locality, LocalityIndex

router = APIRouter(tags=["localidades"])

SOURCE = "IGN, Localidad BAHRA"


def _out(loc: Locality) -> LocalityOut:
    return LocalityOut(
        nombre=loc.nombre, provincia=loc.provincia, departamento=loc.departamento,
        tipo=loc.tipo, lat=loc.lat, lon=loc.lon, label=loc.label,
    )


def _meta(index: LocalityIndex) -> ResponseMeta:
    """Los límites y puntos del IGN son un archivo del repositorio, no una consulta en vivo."""
    warnings = [] if index.localities else ["No está cargado el archivo de localidades: correr scripts/build_localities.py."]
    return ResponseMeta(data_status=DataStatus.CACHED, origin_label=SOURCE, warnings=warnings)


@router.get("/localidades", response_model=ApiResponse[LocalitySearch], summary="Buscar una ciudad o pueblo")
def search(
    q: str = Query(min_length=2, description="Nombre o parte del nombre.", examples=["daract"]),
    provincia: str | None = Query(default=None, description="Limitar a una provincia.", examples=["San Luis"]),
    limit: int = Query(default=10, ge=1, le=50),
    index: LocalityIndex = Depends(get_locality_index),
) -> ApiResponse[LocalitySearch]:
    """Busca localidades por nombre, sin importar tildes ni mayúsculas. Primero las que empiezan igual
    y las más grandes. Fuente: IGN, capa Localidad BAHRA."""
    results = [_out(loc) for loc in index.search(q, limit=limit, provincia=provincia)]
    return ApiResponse(data=LocalitySearch(query=q, results=results, source=SOURCE), meta=_meta(index))


@router.get("/localidades/cerca", response_model=ApiResponse[NearestLocality], summary="Localidad más cercana a un punto")
def nearest(
    lat: float = Query(ge=-90, le=90, examples=[-33.85]),
    lon: float = Query(ge=-180, le=180, examples=[-65.20]),
    max_km: float = Query(default=60.0, gt=0, le=300, description="Radio de búsqueda."),
    index: LocalityIndex = Depends(get_locality_index),
) -> ApiResponse[NearestLocality]:
    """La ciudad o pueblo más cercano a unas coordenadas, para decir dónde está el campo o la huerta.
    La distancia es al centro de la localidad (BAHRA da un punto, no el límite)."""
    found = index.nearest(lat, lon, max_km=max_km)
    if not found:
        data = NearestLocality(locality=None, distance_km=None, text="No encontramos una ciudad o pueblo cerca.", source=SOURCE)
        return ApiResponse(data=data, meta=_meta(index))
    loc, km = found
    # Muy cerca: alcanza con el nombre. Más lejos: "cerca de X, a N km", para no dar a entender que está en el pueblo.
    text = f"En {loc.label}" if km < 3 else f"Cerca de {loc.label}, a {km:.0f} km"
    data = NearestLocality(locality=_out(loc), distance_km=round(km, 1), text=text, source=SOURCE)
    return ApiResponse(data=data, meta=_meta(index))
