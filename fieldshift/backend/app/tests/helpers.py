"""Constructores de datos sintéticos para los tests del motor (sin pandas ni red)."""

from app.models.enums import DataLabel, DataStatus, SoilTexture
from app.models.provenance import Provenance
from app.schemas.field import FieldOut, Location, SoilProfile
from app.schemas.rotation import Rotation, RotationStep
from app.services.engine import parameters as P
from app.services.engine.context import ClimateContext

# Distribución mensual aproximada (enero a diciembre), suma 1.
RAIN_SHARE = (0.15, 0.13, 0.12, 0.07, 0.03, 0.01, 0.01, 0.02, 0.04, 0.09, 0.13, 0.20)
ET0_SHARE = (0.135, 0.11, 0.095, 0.065, 0.045, 0.035, 0.04, 0.055, 0.075, 0.1, 0.12, 0.125)
TMIN = (16, 15, 13, 8, 4, 1, 0, 2, 5, 9, 12, 15)
HEAT = (0.15, 0.10, 0.04, 0, 0, 0, 0, 0, 0.01, 0.03, 0.08, 0.14)


def make_climate(
    rain: float = 700, et0: float = 1380, origin: DataStatus = DataStatus.LIVE, heat=HEAT, cv: float = 20
) -> ClimateContext:
    index = rain / et0
    return ClimateContext(
        precip=tuple(rain * s for s in RAIN_SHARE),
        et0=tuple(et0 * s for s in ET0_SHARE),
        tmin=tuple(float(t) for t in TMIN),
        heat_freq=tuple(heat),
        origin=origin,
        period="2016-2025",
        n_years=10,
        precip_cv_pct=cv,
        heat_days_per_year=sum(h * 30 for h in heat),
        zone=P.aridity_zone(index),
        aridity_index=round(index, 3),
        driest_year=2022,
        driest_precip=tuple(rain * 0.6 * s for s in RAIN_SHARE),
        driest_et0=tuple(et0 * 1.05 * s for s in ET0_SHARE),
    )


def make_field(
    texture: SoilTexture | None = SoilTexture.FRANCO_ARENOSA,
    irrigated: bool = False,
    history=None,
    lab: bool = False,
    slope: float | None = None,
    field_id: str = "lote-test",
) -> FieldOut:
    profile = (
        SoilProfile(texture=texture, lab_analysis=lab, provenance=Provenance(label=DataLabel.SUPUESTO))
        if texture or lab
        else None
    )
    return FieldOut(
        id=field_id,
        name="Lote de prueba",
        location=Location(lat=-33.85, lon=-65.2, slope_pct=slope),
        area_ha=100,
        irrigated=irrigated,
        soil_profile=profile,
        crop_history=history or [],
    )


def rot(
    *steps: tuple[str, int, int, int], years: int | None = None, rid: str = "r", strategy: str = "actual"
) -> Rotation:
    """rot(("soja", 1, 11, 4), ("maiz", 2, 10, 3))"""
    st = [RotationStep(crop_id=c, year=y, start_month=s, end_month=e) for c, y, s, e in steps]
    return Rotation(
        id=rid,
        field_id="lote-test",
        name=rid,
        strategy=strategy,
        duration_years=years or max(s.year for s in st),
        steps=st,
    )
