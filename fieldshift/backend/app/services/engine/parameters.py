"""Parámetros del motor de rotaciones, con su supuesto y su fuente.

Todo número que influye en el puntaje está acá, para revisarlo y cambiarlo en un
solo lugar. Los que dicen "supuesto" no tienen fuente verificada: se documentan
en docs/assumptions.md y viajan en cada respuesta como `Assumption`.
"""

from app.models.enums import AridityZone, Level, SoilTexture
from app.schemas.common import Assumption, DataSource

# --- Escalas cualitativas -> número ---
LEVEL_VALUE = {Level.BAJO: 0.0, Level.MEDIO: 0.5, Level.ALTO: 1.0}
# Sensibilidad al estrés según la tolerancia del cultivo (tolerancia alta = poca sensibilidad).
SENSITIVITY = {Level.BAJO: 1.0, Level.MEDIO: 0.6, Level.ALTO: 0.3}
INCOME_VALUE = {Level.BAJO: 0.35, Level.MEDIO: 0.65, Level.ALTO: 1.0}
PEST_FACTOR = {Level.BAJO: 0.6, Level.MEDIO: 1.0, Level.ALTO: 1.5}
# Exposición a erosión de un mes de barbecho según el rastrojo del cultivo anterior.
RESIDUE_EXPOSURE = {Level.BAJO: 0.4, Level.MEDIO: 0.7, Level.ALTO: 1.0}

# --- Aridez (UNEP, índice P/ET0) ---
ARIDITY_LIMITS = [(0.2, AridityZone.ARIDO), (0.5, AridityZone.SEMIARIDO), (0.65, AridityZone.SUBHUMEDO_SECO)]


def aridity_zone(index: float) -> AridityZone:
    for limit, zone in ARIDITY_LIMITS:
        if index < limit:
            return zone
    return AridityZone.HUMEDO


def template_zone(zone: AridityZone, irrigated: bool = False) -> str:
    """Las plantillas distinguen semiárido (incluye árido) y subhúmedo (incluye húmedo).

    Con riego, el agua deja de ser la restricción principal: el lote se trata como subhúmedo.
    """
    if irrigated:
        return "subhumedo"
    return "semiarido" if zone in (AridityZone.ARIDO, AridityZone.SEMIARIDO) else "subhumedo"


# --- Suelo ---
# Agua útil (capacidad de campo - punto de marchitez), mm por metro: punto medio de FAO-56 Tabla 19.
TAW_MM_PER_M = {
    SoilTexture.ARENOSA: 80,
    SoilTexture.FRANCO_ARENOSA: 130,
    SoilTexture.FRANCA: 155,
    SoilTexture.FRANCO_LIMOSA: 160,
    SoilTexture.FRANCO_ARCILLOSA: 155,
    SoilTexture.ARCILLOSA: 160,
}
ROOT_ZONE_M = {Level.BAJO: 0.6, Level.MEDIO: 1.0, Level.ALTO: 1.4, None: 1.0}
# Fracción de la lluvia del barbecho que queda almacenada en el perfil (supuesto, rango 0,15-0,35).
FALLOW_EFFICIENCY = {
    SoilTexture.ARENOSA: 0.15,
    SoilTexture.FRANCO_ARENOSA: 0.20,
    SoilTexture.FRANCA: 0.25,
    SoilTexture.FRANCO_LIMOSA: 0.25,
    SoilTexture.FRANCO_ARCILLOSA: 0.25,
    SoilTexture.ARCILLOSA: 0.20,
}
# Erodabilidad eólica relativa (supuesto; mismo orden que los grupos de erodabilidad eólica).
WIND_ERODIBILITY = {
    SoilTexture.ARENOSA: 1.0,
    SoilTexture.FRANCO_ARENOSA: 0.85,
    SoilTexture.FRANCA: 0.6,
    SoilTexture.FRANCO_LIMOSA: 0.6,
    SoilTexture.FRANCO_ARCILLOSA: 0.45,
    SoilTexture.ARCILLOSA: 0.4,
}
DEFAULT_TEXTURE = SoilTexture.FRANCO_ARENOSA  # si el productor no la informa (supuesto)
# Meses más ventosos y secos en San Luis: julio a noviembre (supuesto).
WINDY_MONTHS = {7, 8, 9, 10, 11}
WINDY_WEIGHT = 1.3

# --- Agua ---
CROP_EXCESS_STORAGE = 0.5  # fracción de la lluvia efectiva sobrante que se almacena bajo cultivo (supuesto)
IRRIGATION_COVERAGE = 0.8  # fracción del déficit que cubre el riego (supuesto)
INITIAL_STORAGE_FRACTION = 0.5
ET0_PER_DEGREE = 0.03  # +3 % de ET0 por cada °C (supuesto, rango típico 2-4 %)
HEAT_SIGMA_C = 5.0  # desvío de Tmax diaria dentro de un mes (supuesto) para desplazar la frecuencia de calor
FROST_TMIN_HIGH = 3.0  # Tmin media mensual <= 3 °C: mes con heladas frecuentes (supuesto)
FROST_TMIN_MEDIUM = 6.0  # <= 6 °C: heladas ocasionales
DEFAULT_KY = 1.0  # si el cultivo no tiene Ky (FAO-33)
# Rendimiento relativo esperado en San Luis frente al potencial del cultivo (supuesto).
YIELD_MULT = {Level.BAJO: 0.6, Level.MEDIO: 0.85, Level.ALTO: 1.0}
BIOMASS_STRESS_FACTOR = 0.5  # la cobertura y el aporte de materia orgánica bajan con el déficit (supuesto)
DEMAND_PENALTY_FROM = 0.8  # demanda/lluvia desde la que se penaliza
DEMAND_PENALTY_SLOPE = 40
DEMAND_PENALTY_MAX = 40
COVER_CROP_COST = 0.08  # costo relativo por cobertura sin cosecha, en unidades de ingreso/año (supuesto)
LOW_MARKET_FACTOR = 0.85  # castigo al ingreso de cultivos con mercado local bajo (supuesto)
INCOME_REFERENCE = 1.0  # ingreso anual relativo que vale 100 puntos (un cultivo de ingreso alto por año, sin estrés)
SENSITIVITY_RAIN = 0.15  # +-15 % de lluvia para el rango de incertidumbre
SENSITIVITY_ET0 = 0.05
CONFIDENCE_MARGIN = {"alta": 2.0, "media": 5.0, "baja": 8.0}

# --- Fuentes ---
SOURCES = {
    "nasa-power": DataSource(
        id="nasa-power",
        name="NASA POWER, datos diarios por punto",
        provider="NASA Langley Research Center",
        product="Comunidad AG: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, PS",
        endpoint="https://power.larc.nasa.gov/api/temporal/daily/point",
        spatial_resolution="~0.5° x 0.625° (meteorología); ~1° (radiación)",
        temporal_resolution="diaria",
        license="Datos abiertos de NASA",
        citation="NASA Prediction Of Worldwide Energy Resources (POWER) Project",
        limitations=["Entorno regional (~50 km), no el lote.", "Reanálisis: datos modelados."],
    ),
    "fao-56": DataSource(
        id="fao-56",
        name="FAO-56: evapotranspiración del cultivo",
        provider="FAO",
        product="Kc (Tabla 12), agua útil por textura (Tabla 19), ET0 Penman-Monteith",
        spatial_resolution="no aplica",
        temporal_resolution="no aplica",
        license="Publicación FAO",
        citation="Allen, R. G., Pereira, L. S., Raes, D., Smith, M. (1998). FAO Irrigation and Drainage Paper 56.",
        limitations=["Kc estándar: no consideran variedades ni manejo local."],
    ),
    "usda-scs": DataSource(
        id="usda-scs",
        name="Lluvia efectiva mensual, método USDA-SCS simplificado",
        provider="USDA Soil Conservation Service (como se usa en FAO CROPWAT)",
        spatial_resolution="no aplica",
        temporal_resolution="mensual",
        license="Método publicado",
        citation="USDA-SCS (1970); fórmula simplificada de FAO CROPWAT.",
        limitations=["Fórmula empírica; no considera intensidad de lluvia ni pendiente."],
    ),
    "unep-aridity": DataSource(
        id="unep-aridity",
        name="Índice de aridez P/ET0",
        provider="UNEP",
        spatial_resolution="no aplica",
        temporal_resolution="anual",
        license="Clasificación publicada",
        citation="UNEP (1992). World Atlas of Desertification. Clases: árido < 0,2; semiárido < 0,5; subhúmedo seco < 0,65.",
        limitations=["La ET0 de UNEP se calculó con otro método; los límites son orientativos."],
    ),
    "catalogo-fieldshift": DataSource(
        id="catalogo-fieldshift",
        name="Catálogo de cultivos de FieldShift",
        provider="FieldShift (app/data/crops.json)",
        spatial_resolution="San Luis, Argentina",
        temporal_resolution="no aplica",
        license="Editable por el equipo",
        citation="Atributos cualitativos; fuentes por cultivo en el campo `sources`.",
        limitations=["Valores cualitativos provisorios, a validar con INTA y agrónomos locales."],
    ),
    "smap": DataSource(
        id="smap",
        name="SMAP humedad de suelo (L4 zona de raíces 0-100 cm; L3 superficial)",
        provider="NASA SMAP, NSIDC DAAC (vía AppEEARS)",
        product="SPL4SMGP.008 (modelado con asimilación) / SPL3SMP_E.006 (observado)",
        endpoint="https://appeears.earthdatacloud.nasa.gov/api",
        spatial_resolution="9 km (EASE-Grid 2.0)",
        temporal_resolution="L4: cada 3 h; L3: diaria con huecos",
        license="Datos abiertos de NASA",
        citation="Reichle, R. et al. SMAP L4 Version 8, NSIDC DAAC, doi:10.5067/T5RUATAQREF8.",
        limitations=["Un píxel de 9 km promedia muchos lotes.", "L4 es modelado; L3 mide solo ~5 cm."],
    ),
    "modis-ndvi": DataSource(
        id="modis-ndvi",
        name="MODIS NDVI (MOD13Q1 v6.1)",
        provider="NASA / USGS LP DAAC (vía AppEEARS)",
        product="MOD13Q1.061, compuesto de 16 días",
        endpoint="https://appeears.earthdatacloud.nasa.gov/api",
        spatial_resolution="250 m",
        temporal_resolution="16 días",
        license="Datos abiertos de NASA",
        citation="Didan, K. (2021). MOD13Q1 MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. LP DAAC.",
        limitations=["A 250 m mezcla lotes vecinos en lotes chicos.", "Nubes y compuestos de 16 días."],
    ),
}

# --- Supuestos que usa el puntaje ---
ASSUMPTIONS = [
    Assumption(
        id="kc",
        text="Coeficientes de cultivo Kc estándar (inicial, medio, final) para estimar la demanda hídrica.",
        value_range="0,30 a 1,20",
        source="FAO-56 Tabla 12; coberturas: supuesto",
        used_in=["A", "R", "I"],
    ),
    Assumption(
        id="kc-perfil",
        text="Perfil mensual de Kc: primer mes inicial, segundo mes intermedio, meses centrales medio, último mes final.",
        used_in=["A"],
    ),
    Assumption(
        id="lluvia-efectiva",
        text="Lluvia efectiva mensual con la fórmula USDA-SCS simplificada.",
        source="USDA-SCS / FAO CROPWAT",
        validated=True,
        used_in=["A"],
    ),
    Assumption(
        id="agua-util",
        text="Agua útil por textura (punto medio del rango) por profundidad de raíces (1 m si no se informa).",
        value_range="80-160 mm/m",
        source="FAO-56 Tabla 19",
        used_in=["A"],
    ),
    Assumption(
        id="eficiencia-barbecho",
        text="Fracción de la lluvia del barbecho que queda almacenada en el perfil, según la textura.",
        value_range="0,15-0,25",
        used_in=["A"],
    ),
    Assumption(
        id="almacenaje-bajo-cultivo",
        text="La mitad de la lluvia efectiva que el cultivo no usa se almacena en el perfil.",
        value_range="0,5",
        used_in=["A"],
    ),
    Assumption(
        id="riego", text="El riego cubre el 80 % del déficit del cultivo.", value_range="0,8", used_in=["A", "I"]
    ),
    Assumption(
        id="demanda-alta",
        text="Se penaliza la resiliencia hídrica cuando la demanda de los cultivos supera el 80 % de la lluvia anual (40 puntos por cada 100 % de exceso, máximo 40).",
        used_in=["A"],
    ),
    Assumption(
        id="et0-temperatura",
        text="La ET0 sube 3 % por cada °C de aumento de temperatura en los escenarios.",
        value_range="2-4 %/°C",
        used_in=["A", "R"],
    ),
    Assumption(
        id="calor-desvio",
        text="La frecuencia de días con Tmax > 35 °C bajo calentamiento se desplaza con un desvío de 5 °C.",
        value_range="5 °C",
        used_in=["R"],
    ),
    Assumption(
        id="heladas",
        text="Mes con heladas frecuentes si la Tmin media es <= 3 °C; ocasionales si es <= 6 °C.",
        used_in=["R"],
    ),
    Assumption(
        id="estres-ingreso",
        text="El rendimiento baja según el déficit relativo del cultivo: 1 - Ya/Ym = Ky x (1 - ETa/ETm).",
        value_range="Ky 0,7-1,25",
        source="FAO-33 (Doorenbos y Kassam, 1979); especies no listadas: supuesto",
        used_in=["I"],
    ),
    Assumption(
        id="rendimiento-relativo",
        text="El ingreso de cada cultivo se multiplica por su rendimiento relativo esperado en San Luis (bajo 0,6; medio 0,85; alto 1).",
        used_in=["I"],
    ),
    Assumption(
        id="biomasa-agua",
        text="La cobertura y el aporte de materia orgánica de un cultivo bajan a la mitad del déficit relativo que sufre.",
        used_in=["S"],
    ),
    Assumption(
        id="plantillas-riego",
        text="Con riego, las plantillas de rotación se eligen como en zona subhúmeda.",
        used_in=["generador"],
    ),
    Assumption(
        id="costo-cobertura",
        text="Cada cobertura sin cosecha tiene un costo relativo de 0,08 unidades de ingreso por año.",
        used_in=["I"],
    ),
    Assumption(
        id="erosion",
        text="Exposición a erosión: meses de barbecho ponderados por el rastrojo del cultivo anterior, la erodabilidad de la textura y los meses ventosos (julio a noviembre).",
        used_in=["S"],
    ),
    Assumption(
        id="atributos-cultivo",
        text="Atributos cualitativos del catálogo (tolerancias, aportes, ingreso, mercado).",
        source="Catálogo de FieldShift, a validar con INTA",
        used_in=["A", "S", "R", "I", "E"],
    ),
    Assumption(
        id="aridez",
        text="Zona por índice de aridez P/ET0 con ET0 FAO-56 de NASA POWER.",
        source="UNEP (1992)",
        validated=True,
        used_in=["generador"],
    ),
    Assumption(
        id="textura-por-defecto", text="Si no se informa la textura, se usa franco arenosa.", used_in=["A", "S"]
    ),
]
ASSUMPTION_IDS = [a.id for a in ASSUMPTIONS]
