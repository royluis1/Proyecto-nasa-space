"""Productos satelitales admitidos, con sus capas, escalas y limitaciones.

⚠️ Los nombres de capa de AppEEARS están escritos según la documentación de cada
producto; verificarlos con la primera respuesta real (`GET /product/{id}` de AppEEARS).
El parser reconoce la columna por el final del nombre, así que tolera prefijos distintos.
"""

from dataclasses import dataclass, field
from datetime import date

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
