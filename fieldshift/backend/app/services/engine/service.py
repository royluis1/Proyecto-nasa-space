"""Puente entre la API y el motor: trae el clima de NASA POWER y arma el pedido."""

from dataclasses import dataclass
from datetime import date

from app.models.enums import DataStatus, Level, RotationStrategy
from app.schemas.calendar import CalendarRequest, CalendarTimeline, TimelineAdvice
from app.schemas.rotation import CompareRequest, CompareResult, ScenarioInput
from app.schemas.satellite import SoilMoistureRequest, VegetationRequest
from app.services.climate_summary import build_summary, missing_warnings
from app.services.engine.context import ClimateContext, apply_scenario, climate_from_summary, soil_from_field
from app.services.engine.engine import EngineRequest, run
from app.services.engine.timeline import build_timeline
from app.services.terrain.service import TerrainProvider, terrain_for_field
from app.services.power.service import PowerService, resolve_parameters
from app.services.repository import Repository
from app.services.satellite.service import SatelliteService, soil_moisture_input, vegetation_input
from app.utils.exceptions import InvalidInputError, NoDataError, RotationNotFoundError
from app.i18n import tr

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
        raise InvalidInputError(tr("start_year no puede ser posterior a end_year.", "start_year cannot be after end_year."))
    if end >= today.year:
        raise InvalidInputError(tr("El período climático tiene que terminar en un año completo (anterior al actual).", "The climate period must end in a complete year (before the current one)."))
    if end - start + 1 > 20:
        raise InvalidInputError(tr("El período climático puede tener como máximo 20 años.", "The climate period can be at most 20 years."))
    return date(start, 1, 1), date(end, 12, 31)


def load_climate(
    power: PowerService, lat: float, lon: float, start: date, end: date, endpoint: str, field_id: str | None = None
) -> ClimateBundle:
    data = power.get_daily(lat, lon, start, end, resolve_parameters(None), "AG")
    summary = build_summary(data, lat, lon, start, end, "AG", endpoint, include_daily=False, field_id=field_id)
    return ClimateBundle(climate_from_summary(summary), data.status, [*data.warnings, *missing_warnings(summary)])


class RotationService:
    def __init__(
        self,
        repo: Repository,
        power: PowerService,
        endpoint: str,
        satellite: "SatelliteService | None" = None,
        terrain: "TerrainProvider | None" = None,
    ) -> None:
        self.repo = repo
        self.terrain = terrain
        self.power = power
        self.endpoint = endpoint
        self.satellite = satellite
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
                raise InvalidInputError(tr("Hay rotaciones que no pertenecen a este lote.", "Some rotations do not belong to this field."), {"rotation_ids": [rid]})
            if rot.id != field.current_rotation_id:
                extra.append(rot)
        history = req.history if req.history is not None else field.crop_history
        soil_moisture, vegetation, sat_warnings = self._satellite_inputs(req)
        field, terrain_warnings = self._with_terrain(field, req.use_satellite)
        sat_warnings += terrain_warnings
        engine_req = EngineRequest(
            field=field,
            climate=bundle.context,
            priorities=priorities,
            priorities_default=req.priorities is None and stored.is_default,
            scenario=scenario or req.scenario,
            declared_actual=declared,
            extra_rotations=extra,
            history=list(history),
            current_crop=req.current_crop or field.current_crop,
            strategies=req.strategies,
            soil_moisture=soil_moisture,
            vegetation=vegetation,
            warnings=[*bundle.warnings, *sat_warnings],
        )
        return run(engine_req, self.repo.crops, self.repo.templates), bundle

    def _with_terrain(self, field, use_satellite: bool):
        """Si el lote no tiene pendiente cargada, la toma de SRTM (Earthdata) o de la muestra, y lo avisa."""
        if field.location.slope_pct is not None or self.terrain is None or not use_satellite:
            return field, []
        try:
            summary, w = terrain_for_field(self.terrain, field)
        except (NoDataError, InvalidInputError) as exc:
            return field, [tr(f"SRTM no disponible para el lote: {exc.message}", f"SRTM unavailable for the field: {exc.message}")]
        location = field.location.model_copy(
            update={"slope_pct": summary.slope_mean_pct, "elevation_m": field.location.elevation_m or summary.elevation_mean_m}
        )
        return field.model_copy(update={"location": location}), [f"SRTM: {x}" for x in w]

    def _satellite_inputs(self, req: CompareRequest):
        """SMAP y NDVI del lote: los del pedido o, si faltan, los del servicio satelital (con su respaldo)."""
        sm, veg, warnings = req.soil_moisture, req.vegetation, []
        if self.satellite is None or not req.use_satellite:
            return sm, veg, warnings
        if sm is None:
            try:
                summary, w = self.satellite.soil_moisture(SoilMoistureRequest(field_id=req.field_id))
                sm = soil_moisture_input(summary)
                warnings += [f"SMAP: {x}" for x in w]
            except (NoDataError, InvalidInputError) as exc:
                warnings.append(tr(f"SMAP no disponible para el lote: {exc.message}", f"SMAP unavailable for the field: {exc.message}"))
        if veg is None:
            try:
                summary, w = self.satellite.vegetation(VegetationRequest(field_id=req.field_id))
                veg = vegetation_input(summary)
                warnings += [f"NDVI: {x}" for x in w]
            except (NoDataError, InvalidInputError) as exc:
                warnings.append(tr(f"NDVI no disponible para el lote: {exc.message}", f"NDVI unavailable for the field: {exc.message}"))
        return sm, veg, warnings

    def timeline(self, req: CalendarRequest, today: date | None = None) -> tuple[CalendarTimeline, ClimateBundle]:
        """Calendario de 2 a 4 campañas de una rotación, con el escenario aplicado."""
        result, bundle = self.compare(CompareRequest(field_id=req.field_id, priorities=req.priorities), req.scenario)
        by_id = {ev.rotation.id: ev for ev in result.evaluations}
        rotation_id = req.rotation_id or result.recommended_rotation_id
        if rotation_id not in by_id:
            raise RotationNotFoundError(tr(f"La rotación '{rotation_id}' no está entre las comparadas para este lote.", f"Rotation '{rotation_id}' is not among those compared for this field."))
        ev, best = by_id[rotation_id], by_id[result.recommended_rotation_id]
        field = self.repo.get_field(req.field_id)
        share = req.scenario.irrigation_share(field.irrigated) if req.scenario else (1.0 if field.irrigated else 0.0)
        today = today or date.today()
        first_year = req.first_campaign_year or (today.year if today.month < 7 else today.year + 1)
        tl = build_timeline(
            ev.rotation,
            self.repo.crops,
            apply_scenario(bundle.context, req.scenario),
            soil_from_field(field),
            share > 0,
            share if share > 0 else 1.0,
            req.campaigns,
            first_year,
            result.inputs.soil_moisture,
            result.inputs.vegetation,
        )
        advice = list(tl.advice)
        if rotation_id == best.rotation.id:
            text = tr("Es la rotación con mejor puntaje para este escenario y tus prioridades.", "It is the best-scoring rotation for this scenario and your priorities.")
        else:
            text = tr(
                f"Para este escenario, la rotación con mejor puntaje es «{best.rotation.name}» "
                f"({best.score.total:.0f} puntos contra {ev.score.total:.0f} de esta).",
                f"For this scenario, the best-scoring rotation is “{best.rotation.name}” "
                f"({best.score.total:.0f} points vs. {ev.score.total:.0f} for this one).",
            )
        advice.insert(0, TimelineAdvice(kind="rotacion", severity=Level.BAJO if rotation_id == best.rotation.id else Level.MEDIO,
                                        text=text, campaigns=[c.index for c in tl.campaigns]))
        timeline = CalendarTimeline(
            field_id=field.id,
            rotation=ev.rotation,
            scenario=req.scenario,
            irrigated=share > 0,
            campaigns=tl.campaigns,
            advice=advice,
            recommended_rotation_id=result.recommended_rotation_id,
            is_recommended=rotation_id == result.recommended_rotation_id,
            score_total=ev.score.total,
            recommended_total=best.score.total,
            data_used=tl.data_used,
            assumptions=tl.assumptions,
            warnings=result.warnings,
        )
        return timeline, bundle

    def evaluation(self, rotation_id: str):
        """Evaluación de una rotación (declarada o generada) con las prioridades guardadas del lote."""
        field_id = self._field_of(rotation_id)
        result, bundle = self.compare(CompareRequest(field_id=field_id))
        for ev in result.evaluations:
            if ev.rotation.id == rotation_id:
                return ev, result, bundle
        raise RotationNotFoundError(tr(f"No existe la rotación '{rotation_id}'.", f"Rotation '{rotation_id}' does not exist."))

    def _field_of(self, rotation_id: str) -> str:
        if rotation_id in self.repo.rotations:
            return self.repo.rotations[rotation_id].field_id
        for field_id in sorted(self.repo.fields, key=len, reverse=True):
            suffix = rotation_id.removeprefix(field_id + "-")
            if suffix != rotation_id and suffix.split("-")[0] in {s.value for s in RotationStrategy}:
                return field_id
        raise RotationNotFoundError(tr(f"No existe la rotación '{rotation_id}'.", f"Rotation '{rotation_id}' does not exist."))
