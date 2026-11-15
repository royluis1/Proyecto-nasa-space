"""Servicio de humedad de suelo (SMAP) y NDVI (MODIS): resuelve ubicación y período, trae la serie y la resume."""

from app.models.enums import Level
from app.schemas.rotation import SoilMoistureInput, VegetationInput
from app.schemas.satellite import SoilMoistureRequest, SoilMoistureSummary, VegetationRequest, VegetationSummary
from app.services.repository import Repository
from app.services.satellite import soil_moisture as smm
from app.services.satellite import vegetation as veg
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteData, SatelliteProvider
from app.utils.exceptions import InvalidInputError
from app.utils.validators import is_in_san_luis
from app.i18n import tr


class SatelliteService:
    def __init__(self, repo: Repository, provider: SatelliteProvider) -> None:
        self.repo = repo
        self.provider = provider

    def _location(self, req) -> tuple[float, float]:
        if req.field_id:
            field = self.repo.get_field(req.field_id)
            return field.location.lat, field.location.lon
        return req.latitude, req.longitude

    @staticmethod
    def _check_period(product, start, end) -> None:
        if start > end:
            raise InvalidInputError(
                tr(f"No hay datos de {product.name} en el período pedido (empiezan el {product.first_date}).", f"There is no {product.name} data in the requested period (it starts on {product.first_date}).")
            )
        if (end - start).days > 366 * 20:
            raise InvalidInputError(tr("El rango máximo es de 20 años.", "The maximum range is 20 years."))

    def _warnings(self, data: SatelliteData, lat: float, lon: float) -> list[str]:
        out = list(data.warnings)
        if not is_in_san_luis(lat, lon):
            out.append(tr("La ubicación está fuera de San Luis: los supuestos agronómicos pueden no aplicar.", "The location is outside San Luis: the agronomic assumptions may not apply."))
        return out

    def soil_moisture(self, req: SoilMoistureRequest) -> tuple[SoilMoistureSummary, list[str]]:
        product = PRODUCTS[req.product]
        lat, lon = self._location(req)
        start, end = smm.default_period(product, req.start_date, req.end_date)
        self._check_period(product, start, end)
        data = self.provider.get(product, lat, lon, start, end, req.csv_content)
        summary = smm.summarize(data, product, lat, lon, start, end, req.recent_days, req.include_series)
        return summary, self._warnings(data, lat, lon)

    def vegetation(self, req: VegetationRequest) -> tuple[VegetationSummary, list[str]]:
        product = PRODUCTS[req.product]
        lat, lon = self._location(req)
        start, end = veg.default_period(product, req.start_date, req.end_date)
        self._check_period(product, start, end)
        data = self.provider.get(product, lat, lon, start, end, req.csv_content)
        summary = veg.summarize(data, product, lat, lon, start, end, req.bare_threshold, req.include_series)
        return summary, self._warnings(data, lat, lon)


def soil_moisture_input(s: SoilMoistureSummary) -> SoilMoistureInput | None:
    """Lo que usa el motor de rotaciones a partir del resumen SMAP."""
    ws = s.water_stress
    if ws.anomaly_pct is None:
        return None
    return SoilMoistureInput(
        product="SMAP_L3" if s.trace.product.startswith("SPL3") else "SMAP_L4",
        anomaly_pct=max(-100.0, min(300.0, ws.anomaly_pct)),
        period=f"{ws.window_start} a {ws.window_end}",
        drought_frequency_pct=s.drought_frequency_pct,
        stress_level=ws.level if isinstance(ws.level, Level) else None,
        origin=s.trace.status,
    )


def vegetation_input(v: VegetationSummary) -> VegetationInput | None:
    bare = v.recent_bare_soil_fraction if v.recent_bare_soil_fraction is not None else v.bare_soil_fraction
    if bare is None:
        return None
    complete = [c.campaign for c in v.campaigns if c.complete]
    return VegetationInput(
        product=v.trace.product.split(".")[0],
        bare_soil_fraction=bare,
        threshold=v.bare_threshold,
        mean_ndvi=v.mean_ndvi,
        cover_fraction=v.cover_fraction_mean,
        biomass_trend_pct_per_decade=v.biomass_trend_pct_per_decade,
        trend_significant=v.biomass_trend.significant,
        period=tr(f"campañas {complete[0]} a {complete[-1]}", f"seasons {complete[0]} to {complete[-1]}") if complete else None,
        origin=v.trace.status,
    )
