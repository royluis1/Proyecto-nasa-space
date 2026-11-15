"""Productos satelitales admitidos, con sus capas, escalas y limitaciones.

⚠️ Los nombres de capa de AppEEARS están escritos según la documentación de cada
producto; verificarlos con la primera respuesta real (`GET /product/{id}` de AppEEARS).
El parser reconoce la columna por el final del nombre, así que tolera prefijos distintos.
"""

import dataclasses
from dataclasses import dataclass, field
from datetime import date

from app.i18n import current_lang
from app.models.enums import DataLabel


@dataclass(frozen=True)
class Product:
    key: str
    appeears_id: str  # producto.versión en AppEEARS
    name: str
    variable: str  # nombre corto de la variable
    layer: str  # capa de AppEEARS
    qa_layer: str | None
    units: str
    label: DataLabel  # observado o modelado
    provider: str
    spatial_resolution: str
    temporal_resolution: str
    depth: str | None
    first_date: date
    valid_min: float
    valid_max: float
    fill_values: tuple[float, ...]
    scale: float | None  # se aplica solo si los valores vienen sin escalar
    qa_rule: str | None = (
        None  # "modis_reliability" (0 bueno, 1 marginal) o "bit0_clear" (bit 0 = 0: calidad recomendada)
    )
    citation: str = ""
    limitations: list[str] = field(default_factory=list)


SMAP_COMMON_LIMITS = [
    "Un píxel de ~9 km promedia muchos lotes, caminos y montes: no es la humedad de tu lote.",
    "La humedad absoluta (m³/m³) depende del suelo del píxel; por eso se usan anomalías y percentiles.",
    "Hay datos desde el 31 de marzo de 2015.",
]

PRODUCTS: dict[str, Product] = {
    "SPL4SMGP_rootzone": Product(
        key="SPL4SMGP_rootzone",
        appeears_id="SPL4SMGP.008",
        name="SMAP L4 humedad de suelo en zona de raíces (0-100 cm)",
        variable="sm_rootzone",
        layer="Geophysical_Data_sm_rootzone",
        qa_layer=None,
        units="m³/m³",
        label=DataLabel.MODELADO,
        provider="NASA SMAP, NSIDC DAAC (vía AppEEARS)",
        spatial_resolution="9 km (EASE-Grid 2.0)",
        temporal_resolution="cada 3 horas; se agrega a promedio diario",
        depth="0 a 100 cm",
        first_date=date(2015, 3, 31),
        valid_min=0.0,
        valid_max=0.9,
        fill_values=(-9999.0,),
        scale=None,
        citation="Reichle, R. et al. SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture "
        "Geophysical Data, Version 8. NSIDC DAAC. doi:10.5067/T5RUATAQREF8",
        limitations=[
            "Es un producto MODELADO: un modelo de suelo (GEOS-5 Catchment) asimila las observaciones de SMAP.",
            "Mientras el instrumento no observa, el valor sale solo del modelo.",
            *SMAP_COMMON_LIMITS,
        ],
    ),
    "SPL4SMGP_surface": Product(
        key="SPL4SMGP_surface",
        appeears_id="SPL4SMGP.008",
        name="SMAP L4 humedad de suelo superficial (0-5 cm)",
        variable="sm_surface",
        layer="Geophysical_Data_sm_surface",
        qa_layer=None,
        units="m³/m³",
        label=DataLabel.MODELADO,
        provider="NASA SMAP, NSIDC DAAC (vía AppEEARS)",
        spatial_resolution="9 km (EASE-Grid 2.0)",
        temporal_resolution="cada 3 horas; se agrega a promedio diario",
        depth="0 a 5 cm",
        first_date=date(2015, 3, 31),
        valid_min=0.0,
        valid_max=0.9,
        fill_values=(-9999.0,),
        scale=None,
        citation="Reichle, R. et al. SMAP L4 Version 8. NSIDC DAAC. doi:10.5067/T5RUATAQREF8",
        limitations=["Producto MODELADO.", "Capa superficial: cambia mucho con cada lluvia.", *SMAP_COMMON_LIMITS],
    ),
    "SPL3SMP_E": Product(
        key="SPL3SMP_E",
        appeears_id="SPL3SMP_E.006",
        name="SMAP L3 mejorado, humedad de suelo superficial (pasada de la mañana)",
        variable="soil_moisture",
        layer="Soil_Moisture_Retrieval_Data_AM_soil_moisture",
        qa_layer="Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag",
        units="m³/m³",
        label=DataLabel.OBSERVADO,
        provider="NASA SMAP, NSIDC DAAC (vía AppEEARS)",
        spatial_resolution="9 km (EASE-Grid 2.0)",
        temporal_resolution="diaria, con huecos (el satélite pasa cada 2 a 3 días)",
        depth="~5 cm superficiales",
        first_date=date(2015, 3, 31),
        valid_min=0.0,
        valid_max=0.9,
        fill_values=(-9999.0,),
        scale=None,
        qa_rule="bit0_clear",  # ⚠️ verificar cómo entrega AppEEARS la bandera de calidad
        citation="O'Neill, P. et al. SMAP Enhanced L3 Radiometer Global Daily 9 km EASE-Grid Soil Moisture, Version 6. NSIDC DAAC.",
        limitations=[
            "Mide solo los ~5 cm superficiales: no representa el agua disponible para las raíces.",
            "Días sin pasada: la serie tiene huecos.",
            *SMAP_COMMON_LIMITS,
        ],
    ),
}

MODIS_LIMITS = [
    "Compuesto de 16 días por máximo valor: no ve cambios rápidos (siembra, cosecha) con precisión de días.",
    "Nubes, nieve o humo invalidan píxeles; se descartan con la capa de confiabilidad.",
    "El NDVI se satura con mucha biomasa (> 0,8) y no distingue cultivos de malezas.",
    "No mide materia orgánica ni carbono del suelo.",
]


def _modis(key: str, platform: str, res: str, first: date) -> Product:
    sensor = "Terra" if key.startswith("MOD") else "Aqua"
    return Product(
        key=key,
        appeears_id=f"{key}.061",
        name=f"MODIS {sensor} NDVI 16 días {res} m",
        variable="NDVI",
        layer=f"_{res}m_16_days_NDVI",
        qa_layer=f"_{res}m_16_days_pixel_reliability",
        units="adimensional (-0,2 a 1)",
        label=DataLabel.OBSERVADO,
        provider=f"NASA/USGS LP DAAC, MODIS {platform} (vía AppEEARS)",
        spatial_resolution=f"{res} m",
        temporal_resolution="compuesto de 16 días (23 por año)",
        depth=None,
        first_date=first,
        valid_min=-0.2,
        valid_max=1.0,
        fill_values=(-3000.0, -0.3),
        scale=0.0001,
        qa_rule="modis_reliability",  # 0 = bueno, 1 = marginal; 2 = nieve/hielo, 3 = nubes, -1 = sin dato
        citation=f"Didan, K. (2021). {key} MODIS/{sensor} Vegetation Indices 16-Day L3 Global {res}m SIN Grid V061. "
        "NASA EOSDIS LP DAAC.",
        limitations=[
            f"Un píxel de {res} m: en lotes de menos de ~{25 if res == '250' else 100} ha mezcla vecinos y bordes.",
            *MODIS_LIMITS,
        ],
    )


PRODUCTS.update(
    {
        "MOD13Q1": _modis("MOD13Q1", "Terra", "250", date(2000, 2, 18)),
        "MYD13Q1": _modis("MYD13Q1", "Aqua", "250", date(2002, 7, 4)),
        "MOD13A1": _modis("MOD13A1", "Terra", "500", date(2000, 2, 18)),
    }
)

SOIL_MOISTURE_PRODUCTS = ["SPL4SMGP_rootzone", "SPL4SMGP_surface", "SPL3SMP_E"]
VEGETATION_PRODUCTS = ["MOD13Q1", "MYD13Q1", "MOD13A1"]

ECO_COMMON_LIMITS = [
    "ECOSTRESS va en la Estación Espacial: pasa a distintas horas del día y no todos los días; las nubes dejan huecos.",
    "Píxel de 70 m: describe el entorno del punto, no todo el lote.",
    "Hay datos desde julio de 2018.",
]

PRODUCTS.update({
    "HLSL30_VI": Product(
        key="HLSL30_VI",
        appeears_id="HLSL30_VI.020",
        name="Landsat (HLS L30) NDVI 30 m",
        variable="NDVI",
        layer="NDVI",
        qa_layer=None,
        units="índice (-1 a 1)",
        label=DataLabel.OBSERVADO,
        provider="NASA HLS (Landsat 8/9 armonizado), LP DAAC (vía AppEEARS)",
        spatial_resolution="30 m",
        temporal_resolution="cada 8 a 16 días (Landsat 8 y 9), con huecos por nubes",
        depth=None,
        first_date=date(2013, 4, 11),
        valid_min=-1.0,
        valid_max=1.0,
        fill_values=(-19999.0,),
        scale=0.0001,
        citation="Masek, J. et al. HLS Operational Land Surface Reflectance and TOA Brightness Daily Global 30m v2.0 (HLSL30_VI). LP DAAC.",
        limitations=[
            "Las nubes y sus sombras pueden bajar el NDVI de algunas fechas: se usan medianas por período.",
            "Cada sector es un píxel de 30 m dentro del lote: muestra diferencias entre sectores, no un mapa continuo.",
            "Mide verdor, no rendimiento ni materia orgánica.",
        ],
    ),
    "ECO_L2T_LSTE": Product(
        key="ECO_L2T_LSTE",
        appeears_id="ECO_L2T_LSTE.002",
        name="ECOSTRESS temperatura de la superficie (LST) 70 m",
        variable="LST",
        layer="LST",
        qa_layer="cloud",
        units="K",
        label=DataLabel.OBSERVADO,
        provider="NASA ECOSTRESS, LP DAAC (vía AppEEARS)",
        spatial_resolution="70 m",
        temporal_resolution="instantánea, cada 1 a 5 días a distintas horas",
        depth=None,
        first_date=date(2018, 7, 9),
        valid_min=200.0,
        valid_max=360.0,
        fill_values=(),
        scale=None,
        qa_rule="zero_clear",
        citation="Hook, S., Hulley, G. ECOSTRESS Tiled Land Surface Temperature and Emissivity Instantaneous L2 Global 70 m V002. LP DAAC.",
        limitations=[
            "Es la temperatura del suelo o de las hojas, no la del aire: al sol puede superar en 10 a 20 °C a la del aire.",
            *ECO_COMMON_LIMITS,
        ],
    ),
    "ECO_L4T_ESI": Product(
        key="ECO_L4T_ESI",
        appeears_id="ECO_L4T_ESI.002",
        name="ECOSTRESS índice de estrés evaporativo (ESI) 70 m",
        variable="ESI",
        layer="ESI",
        qa_layer="cloud",
        units="relación (0 a 1)",
        label=DataLabel.MODELADO,
        provider="NASA ECOSTRESS (modelo PT-JPL), LP DAAC (vía AppEEARS)",
        spatial_resolution="70 m",
        temporal_resolution="instantánea, cada 1 a 5 días",
        depth=None,
        first_date=date(2018, 7, 10),
        valid_min=0.0,
        valid_max=1.0,
        fill_values=(),
        scale=None,
        qa_rule="zero_clear",
        citation="Fisher, J. et al. ECOSTRESS Tiled Evaporative Stress Index PT-JPL Instantaneous L4 Global 70 m V002. LP DAAC.",
        limitations=[
            "Es un índice MODELADO: evapotranspiración real / potencial. Cerca de 1 = sin estrés; cerca de 0 = mucho estrés.",
            *ECO_COMMON_LIMITS,
        ],
    ),
})


# --- Traducción al inglés de los textos de cada producto (los ids y capas no cambian) ---
_SMAP_COMMON_LIMITS_EN = [
    "A ~9 km pixel averages many fields, roads and woodland: it is not your field's moisture.",
    "Absolute moisture (m³/m³) depends on the pixel's soil; that is why anomalies and percentiles are used.",
    "Data is available since March 31, 2015.",
]
_MODIS_LIMITS_EN = [
    "16-day maximum-value composite: it does not see fast changes (planting, harvest) with day-level precision.",
    "Clouds, snow or smoke invalidate pixels; they are discarded with the reliability layer.",
    "NDVI saturates with high biomass (> 0.8) and does not tell crops from weeds.",
    "It does not measure soil organic matter or carbon.",
]
_ECO_COMMON_LIMITS_EN = [
    "ECOSTRESS rides on the Space Station: it passes at different times of day and not every day; clouds leave gaps.",
    "70 m pixel: it describes the point's surroundings, not the whole field.",
    "Data is available since July 2018.",
]
_PRODUCTS_EN_TEXTS: dict[str, dict] = {
    "SPL4SMGP_rootzone": dict(
        name="SMAP L4 root-zone soil moisture (0-100 cm)",
        provider="NASA SMAP, NSIDC DAAC (via AppEEARS)",
        temporal_resolution="every 3 hours; aggregated to a daily mean",
        depth="0 to 100 cm",
        limitations=[
            "It is a MODELED product: a land model (GEOS-5 Catchment) assimilates SMAP observations.",
            "While the instrument is not observing, the value comes from the model alone.",
            *_SMAP_COMMON_LIMITS_EN,
        ],
    ),
    "SPL4SMGP_surface": dict(
        name="SMAP L4 surface soil moisture (0-5 cm)",
        provider="NASA SMAP, NSIDC DAAC (via AppEEARS)",
        temporal_resolution="every 3 hours; aggregated to a daily mean",
        depth="0 to 5 cm",
        limitations=["MODELED product.", "Surface layer: it changes a lot with every rain.", *_SMAP_COMMON_LIMITS_EN],
    ),
    "SPL3SMP_E": dict(
        name="SMAP L3 enhanced, surface soil moisture (morning pass)",
        provider="NASA SMAP, NSIDC DAAC (via AppEEARS)",
        temporal_resolution="daily, with gaps (the satellite passes every 2 to 3 days)",
        depth="top ~5 cm",
        limitations=[
            "It measures only the top ~5 cm: it does not represent the water available to roots.",
            "Days without a pass: the series has gaps.",
            *_SMAP_COMMON_LIMITS_EN,
        ],
    ),
    "HLSL30_VI": dict(
        name="Landsat (HLS L30) NDVI 30 m",
        units="index (-1 to 1)",
        provider="NASA HLS (harmonized Landsat 8/9), LP DAAC (via AppEEARS)",
        temporal_resolution="every 8 to 16 days (Landsat 8 and 9), with gaps from clouds",
        limitations=[
            "Clouds and their shadows can lower the NDVI of some dates: medians per period are used.",
            "Each sector is one 30 m pixel inside the field: it shows differences between sectors, not a continuous map.",
            "It measures greenness, not yield or organic matter.",
        ],
    ),
    "ECO_L2T_LSTE": dict(
        name="ECOSTRESS land surface temperature (LST) 70 m",
        provider="NASA ECOSTRESS, LP DAAC (via AppEEARS)",
        temporal_resolution="instantaneous, every 1 to 5 days at different times",
        limitations=[
            "It is the temperature of the soil or leaves, not the air: in the sun it can exceed air temperature by 10 to 20 °C.",
            *_ECO_COMMON_LIMITS_EN,
        ],
    ),
    "ECO_L4T_ESI": dict(
        name="ECOSTRESS evaporative stress index (ESI) 70 m",
        units="ratio (0 to 1)",
        provider="NASA ECOSTRESS (PT-JPL model), LP DAAC (via AppEEARS)",
        temporal_resolution="instantaneous, every 1 to 5 days",
        limitations=[
            "It is a MODELED index: actual / potential evapotranspiration. Near 1 = no stress; near 0 = severe stress.",
            *_ECO_COMMON_LIMITS_EN,
        ],
    ),
}
for _key in ("MOD13Q1", "MYD13Q1", "MOD13A1"):
    _p = PRODUCTS[_key]
    _sensor = "Terra" if _key.startswith("MOD") else "Aqua"
    _res = "250" if _key.endswith("Q1") else "500"
    _PRODUCTS_EN_TEXTS[_key] = dict(
        name=f"MODIS {_sensor} NDVI 16-day {_res} m",
        units="dimensionless (-0.2 to 1)",
        provider=f"NASA/USGS LP DAAC, MODIS {_sensor} (via AppEEARS)",
        temporal_resolution="16-day composite (23 per year)",
        limitations=[
            f"A {_res} m pixel: on fields under ~{25 if _res == '250' else 100} ha it mixes neighbors and edges.",
            *_MODIS_LIMITS_EN,
        ],
    )

_PRODUCTS_BY_LANG: dict[str, dict[str, Product]] = {
    "es": dict(PRODUCTS),
    "en": {k: dataclasses.replace(v, **_PRODUCTS_EN_TEXTS.get(k, {})) for k, v in PRODUCTS.items()},
}


class _LangProducts(dict):
    """Catálogo de productos en el idioma del pedido. Se usa como un dict común (solo lectura)."""

    def _cur(self) -> dict[str, Product]:
        return _PRODUCTS_BY_LANG[current_lang()]

    def __getitem__(self, key: str) -> Product:
        return self._cur()[key]

    def get(self, key, default=None):
        return self._cur().get(key, default)

    def values(self):
        return self._cur().values()

    def items(self):
        return self._cur().items()


PRODUCTS = _LangProducts({k: None for k in PRODUCTS})
