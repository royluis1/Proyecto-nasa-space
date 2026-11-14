"""Validaciones puras (no necesitan FastAPI)."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.field import Location
from app.schemas.rotation import Rotation
from app.utils.validators import is_in_san_luis, validate_date_range

TODAY = date(2026, 11, 14)


def test_rango_valido():
    validate_date_range(date(2015, 1, 1), date(2025, 12, 31), today=TODAY)


@pytest.mark.parametrize(
    "start,end,msg",
    [
        (date(2020, 1, 2), date(2020, 1, 1), "posterior"),
        (date(1980, 1, 1), date(1990, 1, 1), "antes"),
        (date(2026, 1, 1), date(2027, 1, 1), "futuro"),
        (date(1990, 1, 1), date(2015, 1, 1), "máximo"),
    ],
)
def test_rangos_invalidos(start, end, msg):
    with pytest.raises(ValueError, match=msg):
        validate_date_range(start, end, today=TODAY)


def test_san_luis():
    assert is_in_san_luis(-33.85, -65.20)
    assert not is_in_san_luis(-34.6, -58.4)  # Buenos Aires


def test_coordenadas_se_redondean():
    loc = Location(lat=-33.851234567, lon=-65.2034999)
    assert loc.lat == -33.8512 and loc.lon == -65.2035


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (float("nan"), 0)])
def test_coordenadas_invalidas(lat, lon):
    with pytest.raises(ValidationError):
        Location(lat=lat, lon=lon)


def test_rotacion_con_paso_fuera_de_duracion():
    with pytest.raises(ValidationError):
        Rotation(
            id="x", field_id="f", name="x", strategy="actual", duration_years=1,
            steps=[{"crop_id": "soja", "year": 2, "start_month": 11, "end_month": 4}],
        )


def test_datos_de_muestra_cargan(repo):
    assert len(repo.list_crops()) >= 12
    assert {"campo-este", "campo-centro", "campo-conlara"} <= set(repo.fields)
    for field_id in repo.fields:
        rots = repo.rotations_for_field(field_id)  # las demás rotaciones las genera el motor
        assert sum(r.strategy == "actual" for r in rots) == 1
    crop_ids = set(repo.crops)
    for rot in repo.rotations.values():
        assert {s.crop_id for s in rot.steps} <= crop_ids, rot.id


def test_cultivos_tienen_fuente_y_confianza(repo):
    for crop in repo.list_crops():
        assert crop.sources and crop.confidence
