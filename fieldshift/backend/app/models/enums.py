"""Enumeraciones del dominio. Los valores están en español porque se muestran en la UI."""

from enum import StrEnum


class DataLabel(StrEnum):
    """Regla de honestidad 1: cada dato se etiqueta según su origen."""

    OBSERVADO = "observado"
    MODELADO = "modelado"
    ESTIMADO = "estimado"
    SUPUESTO = "supuesto"


class DataStatus(StrEnum):
    """De dónde salió la respuesta completa."""

    LIVE = "live"  # consultado ahora a la fuente
    CACHED = "cached"  # caché local
    SAMPLE = "sample"  # datos de muestra incluidos en el repo
    MOCK = "mock"  # valor simulado: la lógica todavía no está implementada
    UPLOADED = "uploaded"  # archivo cargado por el usuario (CSV de AppEEARS o convertido desde GeoTIFF)

    @property
    def origin_label(self) -> str:
        """Etiqueta visible para el usuario."""
        return _ORIGIN_LABELS[self]


_ORIGIN_LABELS = {
    DataStatus.LIVE: "DATO NASA EN VIVO",
    DataStatus.CACHED: "DATO CACHEADO",
    DataStatus.SAMPLE: "DATO DE MUESTRA",
    DataStatus.MOCK: "VALOR SIMULADO",
    DataStatus.UPLOADED: "DATO NASA CARGADO POR EL USUARIO",
}


class PowerParameter(StrEnum):
    """Parámetros diarios de NASA POWER admitidos por AgroOrbit."""

    T2M = "T2M"  # temperatura media a 2 m
    T2M_MAX = "T2M_MAX"
    T2M_MIN = "T2M_MIN"
    PRECTOTCORR = "PRECTOTCORR"  # precipitación corregida
    RH2M = "RH2M"  # humedad relativa a 2 m
    WS2M = "WS2M"  # viento a 2 m
    ALLSKY_SFC_SW_DWN = "ALLSKY_SFC_SW_DWN"  # radiación solar en superficie
    PS = "PS"  # presión en superficie


class Confidence(StrEnum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class Level(StrEnum):
    """Escala cualitativa usada en cultivos, riesgo e ingreso relativo."""

    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"


class Severity(StrEnum):
    INFO = "info"
    MEDIA = "media"
    ALTA = "alta"


class RotationStrategy(StrEnum):
    ACTUAL = "actual"
    CONSERVADORA = "conservadora"
    DIVERSIFICADA = "diversificada"
    AGUA = "agua"
    SUELO = "suelo"
    RENTABILIDAD = "rentabilidad"
    MIXTA = "mixta"


class CropGroup(StrEnum):
    CEREAL = "cereal"
    OLEAGINOSA = "oleaginosa"
    LEGUMINOSA = "leguminosa"
    FORRAJERA = "forrajera"
    COBERTURA = "cobertura"


class CropFamily(StrEnum):
    """Familia botánica: se usa para medir diversificación."""

    GRAMINEA = "graminea"
    LEGUMINOSA = "leguminosa"
    ASTERACEA = "asteracea"
    BRASICACEA = "brasicacea"
    MEZCLA = "mezcla"


class CropCycle(StrEnum):
    ESTIVAL = "estival"
    INVERNAL = "invernal"
    PERENNE = "perenne"


class SoilTexture(StrEnum):
    ARENOSA = "arenosa"
    FRANCO_ARENOSA = "franco_arenosa"
    FRANCA = "franca"
    FRANCO_LIMOSA = "franco_limosa"
    FRANCO_ARCILLOSA = "franco_arcillosa"
    ARCILLOSA = "arcillosa"


class ScoreComponentKey(StrEnum):
    AGUA = "A"
    SUELO = "S"
    RIESGO = "R"
    INGRESO = "I"
    SOSTENIBILIDAD = "E"


class RiskKind(StrEnum):
    CALOR = "calor"
    HELADA = "helada"
    DEFICIT_HIDRICO = "deficit_hidrico"
    EROSION = "erosion"
    MONOCULTIVO = "monocultivo"
    MERCADO = "mercado"
    MANEJO = "manejo"
    DATO_FALTANTE = "dato_faltante"
    OTRO = "otro"


class AridityZone(StrEnum):
    """Clase de aridez según el índice P/ET0 (UNEP)."""

    ARIDO = "arido"
    SEMIARIDO = "semiarido"
    SUBHUMEDO_SECO = "subhumedo_seco"
    HUMEDO = "humedo"


class ImpactDirection(StrEnum):
    """Impacto de una rotación frente a la rotación actual."""

    MEJORA = "mejora"
    NEUTRO = "neutro"
    EMPEORA = "empeora"
    LINEA_BASE = "linea_base"
