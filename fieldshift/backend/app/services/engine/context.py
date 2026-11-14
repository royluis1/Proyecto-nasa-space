"""Contexto de clima y suelo que usa el motor, y aplicación de escenarios climáticos."""

from dataclasses import dataclass, replace
from statistics import NormalDist

from app.models.enums import AridityZone, DataStatus, Level, SoilTexture
from app.schemas.climate import ClimateSummary
from app.schemas.field import FieldOut
from app.schemas.rotation import ScenarioInput
from app.services.engine import parameters as P
from app.utils.exceptions import InvalidInputError

_NORMAL = NormalDist()


@dataclass(frozen=True)
class ClimateContext:
    """Climatología mensual (12 valores, enero a diciembre) del lote, ya con el escenario aplicado."""

    precip: tuple[float, ...]  # mm/mes
    et0: tuple[float, ...]  # mm/mes
    tmin: tuple[float, ...]  # °C, media mensual
    heat_freq: tuple[float, ...]  # fracción de días con Tmax > 35 °C
    origin: DataStatus
    period: str
    n_years: int
    precip_cv_pct: float | None
    heat_days_per_year: float | None
    zone: AridityZone  # siempre la del clima base: las rotaciones generadas no cambian con el escenario
    aridity_index: float  # del clima base
    driest_year: int | None = None
    driest_precip: tuple[float, ...] | None = None
    driest_et0: tuple[float, ...] | None = None
    scenario: ScenarioInput | None = None
    erosion_factor: float = 1.0  # >1 con lluvias intensas: más erosión hídrica en el suelo desnudo
    storm_extra: tuple[float, ...] = (0.0,) * 12  # lluvia extra de tormenta por mes (mm), incluida en precip

    def useful_rain(self, month: int) -> tuple[float, float]:
        """(lluvia que entra en la fórmula de lluvia efectiva, lluvia extra de tormenta aprovechable) del mes 0-11."""
        extra = self.storm_extra[month]
        return self.precip[month] - extra, P.HEAVY_RAIN_INFILTRATION * extra

    @property
    def annual_precip(self) -> float:
        return sum(self.precip)

    @property
    def annual_et0(self) -> float:
        return sum(self.et0)


def _month_values(values: list[float | None], name: str) -> tuple[float, ...]:
    if len(values) != 12 or any(v is None for v in values):
        raise InvalidInputError(f"Falta la climatología mensual de {name}: no se puede calcular el puntaje.")
    return tuple(float(v) for v in values)


def climate_from_summary(summary: ClimateSummary) -> ClimateContext:
    clim = sorted(summary.monthly_climatology, key=lambda c: c.month)
    precip = _month_values([c.precip_mm for c in clim], "lluvia")
    et0 = _month_values([c.et0_mm for c in clim], "ET0")
    tmin = _month_values([c.tmin_mean for c in clim], "temperatura mínima")
    heat = tuple((v or 0.0) / 100 for v in summary.heat.frequency_pct_by_month)
    index = sum(precip) / sum(et0) if sum(et0) > 0 else 0.0

    complete = [a for a in summary.annual if a.complete and a.precip_mm is not None]
    driest = min(complete, key=lambda a: a.precip_mm) if complete else None
    d_precip = d_et0 = None
    if driest is not None:
        rows = {m.month: m for m in summary.monthly if m.year == driest.year}
        d_precip = tuple(
            rows[m].precip_mm if m in rows and rows[m].precip_mm is not None else precip[m - 1] for m in range(1, 13)
        )
        d_et0 = tuple(rows[m].et0_mm if m in rows and rows[m].et0_mm is not None else et0[m - 1] for m in range(1, 13))

    return ClimateContext(
        precip=precip,
        et0=et0,
        tmin=tmin,
        heat_freq=heat,
        origin=summary.source.origin,
        period=f"{summary.period.start.year}-{summary.period.end.year}",
        n_years=len(complete),
        precip_cv_pct=summary.variability.annual_precip_cv_pct,
        heat_days_per_year=summary.heat.mean_days_per_year,
        zone=P.aridity_zone(index),
        aridity_index=round(index, 3),
        driest_year=driest.year if driest else None,
        driest_precip=d_precip,
        driest_et0=d_et0,
    )


def _shift_frequency(freq: float, delta_c: float) -> float:
    """Desplaza la frecuencia de días calurosos como si la Tmax subiera delta_c (distribución normal)."""
    if delta_c == 0:
        return freq
    p = min(max(freq, 1e-4), 1 - 1e-4)
    z = _NORMAL.inv_cdf(1 - p) - delta_c / P.HEAT_SIGMA_C
    return 1 - _NORMAL.cdf(z)


def apply_scenario(base: ClimateContext, scenario: ScenarioInput | None) -> ClimateContext:
    if scenario is None:
        return base
    precip, et0 = base.precip, base.et0
    if scenario.dry_year and base.driest_precip is not None:
        precip, et0 = base.driest_precip, base.driest_et0
    rain = 1 + scenario.rain_delta_pct / 100
    et0_factor = 1 + P.ET0_PER_DEGREE * scenario.temp_delta_c
    precip = [p * rain for p in precip]
    et0 = [e * et0_factor for e in et0]
    heat = [_shift_frequency(f, scenario.temp_delta_c) for f in base.heat_freq]
    erosion = 1.0
    storm = [0.0] * 12
    if scenario.heavy_rain:
        for m in P.HEAVY_RAIN_MONTHS:
            storm[m - 1] = precip[m - 1] * (P.HEAVY_RAIN_FACTOR - 1)
            precip[m - 1] += storm[m - 1]
        erosion = P.HEAVY_RAIN_EROSION
    if scenario.heat_wave:
        for m in P.HEAT_WAVE_MONTHS:
            et0[m - 1] *= 1 + P.HEAT_WAVE_ET0
            heat[m - 1] = _shift_frequency(heat[m - 1], P.HEAT_WAVE_SHIFT_C)
    return replace(
        base,
        precip=tuple(precip),
        et0=tuple(et0),
        tmin=tuple(t + scenario.temp_delta_c for t in base.tmin),
        heat_freq=tuple(heat),
        scenario=scenario,
        erosion_factor=erosion,
        storm_extra=tuple(storm),
    )


def perturb(ctx: ClimateContext, rain_factor: float, et0_factor: float) -> ClimateContext:
    """Variante para el rango de incertidumbre."""
    return replace(
        ctx,
        precip=tuple(p * rain_factor for p in ctx.precip),
        et0=tuple(e * et0_factor for e in ctx.et0),
        storm_extra=tuple(x * rain_factor for x in ctx.storm_extra),
    )


@dataclass(frozen=True)
class SoilContext:
    texture: SoilTexture
    texture_assumed: bool
    lab_analysis: bool
    available_water_mm: float
    fallow_efficiency: float
    wind_erodibility: float
    slope_pct: float | None
    slope_factor: float
    organic_matter: Level | None


def soil_from_field(field: FieldOut) -> SoilContext:
    profile = field.soil_profile
    texture = profile.texture if profile and profile.texture else None
    used = texture or P.DEFAULT_TEXTURE
    depth = P.ROOT_ZONE_M[profile.effective_depth if profile else None]
    slope = field.location.slope_pct
    return SoilContext(
        texture=used,
        texture_assumed=texture is None,
        lab_analysis=bool(profile and profile.lab_analysis),
        available_water_mm=round(P.TAW_MM_PER_M[used] * depth, 1),
        fallow_efficiency=P.FALLOW_EFFICIENCY[used],
        wind_erodibility=P.WIND_ERODIBILITY[used],
        slope_pct=slope,
        slope_factor=1 + min(0.5, (slope or 0) / 10),
        organic_matter=profile.organic_matter if profile else None,
    )
