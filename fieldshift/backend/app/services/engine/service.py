"""Puente entre la API y el motor: trae el clima de NASA POWER y arma el pedido."""

from dataclasses import dataclass
from datetime import date

from app.models.enums import DataStatus, RotationStrategy
from app.schemas.rotation import CompareRequest, CompareResult, ScenarioInput
from app.services.climate_summary import build_summary, missing_warnings
from app.services.engine.context import ClimateContext, climate_from_summary
from app.services.engine.engine import EngineRequest, run
from app.services.power.service import PowerService, resolve_parameters
from app.services.repository import Repository
from app.utils.exceptions import InvalidInputError, RotationNotFoundError

DEFAULT_CLIMATE_YEARS = 10


@dataclass
class ClimateBundle:
    context: ClimateContext
    status: DataStatus
    warnings: list[str]


def climate_period(start_year: int | None, end_year: int | None, today: date | None = None) -> tuple[date, date]:
    """Por defecto, los últimos 10 años completos."""
    today = today or date.today()
    end = end_year or today.year - 1
    start = start_year or end - DEFAULT_CLIMATE_YEARS + 1
    if start > end:
        raise InvalidInputError("start_year no puede ser posterior a end_year.")
    if end >= today.year:
        raise InvalidInputError("El período climático tiene que terminar en un año completo (anterior al actual).")
    if end - start + 1 > 20:
        raise InvalidInputError("El período climático puede tener como máximo 20 años.")
    return date(start, 1, 1), date(end, 12, 31)


def load_climate(
    power: PowerService, lat: float, lon: float, start: date, end: date, endpoint: str, field_id: str | None = None
) -> ClimateBundle:
    data = power.get_daily(lat, lon, start, end, resolve_parameters(None), "AG")
    summary = build_summary(data, lat, lon, start, end, "AG", endpoint, include_daily=False, field_id=field_id)
    return ClimateBundle(climate_from_summary(summary), data.status, [*data.warnings, *missing_warnings(summary)])


class RotationService:
    def __init__(self, repo: Repository, power: PowerService, endpoint: str) -> None:
        self.repo = repo
        self.power = power
        self.endpoint = endpoint
        self._climate: dict[tuple, ClimateBundle] = {}

    def climate_for(self, field_id: str, start_year: int | None = None, end_year: int | None = None) -> ClimateBundle:
        field = self.repo.get_field(field_id)
        start, end = climate_period(start_year, end_year)
        key = (field.location.lat, field.location.lon, start, end)
        if key not in self._climate:  # una sola consulta por pedido aunque haya varios escenarios
            self._climate[key] = load_climate(
                self.power, field.location.lat, field.location.lon, start, end, self.endpoint, field.id
            )
        return self._climate[key]

    def compare(
        self, req: CompareRequest, scenario: ScenarioInput | None = None
    ) -> tuple[CompareResult, ClimateBundle]:
        field = self.repo.get_field(req.field_id)
        bundle = self.climate_for(req.field_id, req.start_year, req.end_year)
        stored = self.repo.get_priorities(req.field_id)
        priorities = req.priorities or stored.priorities
        declared = self.repo.rotations.get(field.current_rotation_id) if field.current_rotation_id else None
        extra = []
        for rid in req.rotation_ids or []:
            rot = self.repo.get_rotation(rid)
            if rot.field_id != field.id:
                raise InvalidInputError("Hay rotaciones que no pertenecen a este lote.", {"rotation_ids": [rid]})
            if rot.id != field.current_rotation_id:
                extra.append(rot)
        history = req.history if req.history is not None else field.crop_history
        engine_req = EngineRequest(
            field=field,
            climate=bundle.context,
            priorities=priorities,
            priorities_default=req.priorities is None and stored.is_default,
            scenario=scenario or req.scenario,
            declared_actual=declared,
            extra_rotations=extra,
            history=list(history),
            current_crop=req.current_crop,
            strategies=req.strategies,
            soil_moisture=req.soil_moisture,
            vegetation=req.vegetation,
            warnings=list(bundle.warnings),
        )
        return run(engine_req, self.repo.crops, self.repo.templates), bundle

    def evaluation(self, rotation_id: str):
        """Evaluación de una rotación (declarada o generada) con las prioridades guardadas del lote."""
        field_id = self._field_of(rotation_id)
        result, bundle = self.compare(CompareRequest(field_id=field_id))
        for ev in result.evaluations:
            if ev.rotation.id == rotation_id:
                return ev, result, bundle
        raise RotationNotFoundError(f"No existe la rotación '{rotation_id}'.")

    def _field_of(self, rotation_id: str) -> str:
        if rotation_id in self.repo.rotations:
            return self.repo.rotations[rotation_id].field_id
        for field_id in sorted(self.repo.fields, key=len, reverse=True):
            suffix = rotation_id.removeprefix(field_id + "-")
            if suffix != rotation_id and suffix.split("-")[0] in {s.value for s in RotationStrategy}:
                return field_id
        raise RotationNotFoundError(f"No existe la rotación '{rotation_id}'.")
