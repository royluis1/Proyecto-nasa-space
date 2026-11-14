"""Balance hídrico mensual de una rotación (función pura).

Para cada mes del ciclo:
- con cultivo: demanda = Kc x ET0. Se cubre primero con lluvia efectiva y después con
  el agua almacenada en el perfil. Lo que falta es el déficit; con riego, se cubre una
  parte. La mitad de la lluvia efectiva que el cultivo no usa se almacena.
- en barbecho: se almacena una fracción de la lluvia (eficiencia de barbecho).

El almacenaje tiene un tope (agua útil del suelo). Se simula el ciclo dos veces y se
informa la segunda, para que el resultado no dependa del agua inicial.
"""

from dataclasses import dataclass

from app.services.engine import parameters as P
from app.services.engine.calendar import Calendar
from app.services.engine.context import ClimateContext, SoilContext


def effective_rain(p_mm: float) -> float:
    """Lluvia efectiva mensual, fórmula USDA-SCS simplificada (FAO CROPWAT)."""
    if p_mm <= 0:
        return 0.0
    if p_mm <= 250:
        return p_mm * (125 - 0.2 * p_mm) / 125
    return 125 + 0.1 * p_mm


def monthly_kc(position: int, length: int, kc_ini: float, kc_mid: float, kc_end: float) -> float:
    """Kc del mes según su posición en el ciclo del cultivo."""
    if length == 1:
        return kc_mid
    if position == 0:
        return kc_ini
    if position == length - 1:
        return kc_end
    if position == 1 and length >= 4:
        return (kc_ini + kc_mid) / 2
    return kc_mid


@dataclass(frozen=True)
class StepWater:
    demand_mm: float
    unmet_mm: float  # antes del riego
    irrigation_mm: float

    @property
    def stress(self) -> float:
        """Déficit relativo después del riego (0 = sin déficit)."""
        return 0.0 if self.demand_mm <= 0 else (self.unmet_mm - self.irrigation_mm) / self.demand_mm


@dataclass(frozen=True)
class WaterBalance:
    demand_mm_year: float
    unmet_mm_year: float
    irrigation_mm_year: float
    effective_rain_used_mm_year: float
    month_stress: tuple[float, ...]  # por mes del ciclo, déficit relativo después del riego
    steps: tuple[StepWater, ...]

    @property
    def coverage(self) -> float:
        """Fracción de la demanda cubierta por lluvia y agua almacenada (sin riego)."""
        return 1.0 if self.demand_mm_year <= 0 else 1 - self.unmet_mm_year / self.demand_mm_year

    @property
    def coverage_with_irrigation(self) -> float:
        if self.demand_mm_year <= 0:
            return 1.0
        return 1 - (self.unmet_mm_year - self.irrigation_mm_year) / self.demand_mm_year


def water_balance(calendar: Calendar, climate: ClimateContext, soil: SoilContext, irrigated: bool) -> WaterBalance:
    n = calendar.n_months
    cap = soil.available_water_mm
    storage = P.INITIAL_STORAGE_FRACTION * cap
    for record in (False, True):
        demand = [0.0] * len(calendar.steps)
        unmet = [0.0] * len(calendar.steps)
        irrigation = [0.0] * len(calendar.steps)
        rain_used = 0.0
        stress = [0.0] * n
        for m in range(n):
            month = m % 12
            rain = climate.precip[month]
            i = calendar.owner[m]
            if i is None:
                storage = min(cap, storage + soil.fallow_efficiency * rain)
                continue
            crop = calendar.steps[i].crop
            pos, length = calendar.position(i, m)
            kc = monthly_kc(pos, length, crop.kc.ini, crop.kc.mid, crop.kc.end) if crop.kc else 0.8
            need = kc * climate.et0[month]
            pe = effective_rain(rain)
            from_rain = min(need, pe)
            missing = need - from_rain
            from_storage = min(missing, storage)
            storage -= from_storage
            missing -= from_storage
            storage = min(cap, storage + P.CROP_EXCESS_STORAGE * (pe - from_rain))
            irr = P.IRRIGATION_COVERAGE * missing if irrigated else 0.0
            demand[i] += need
            unmet[i] += missing
            irrigation[i] += irr
            rain_used += from_rain
            stress[m] = 0.0 if need <= 0 else (missing - irr) / need
        if record:
            years = calendar.duration_years
            return WaterBalance(
                demand_mm_year=sum(demand) / years,
                unmet_mm_year=sum(unmet) / years,
                irrigation_mm_year=sum(irrigation) / years,
                effective_rain_used_mm_year=rain_used / years,
                month_stress=tuple(stress),
                steps=tuple(StepWater(d, u, r) for d, u, r in zip(demand, unmet, irrigation)),
            )
    raise AssertionError("inalcanzable")
