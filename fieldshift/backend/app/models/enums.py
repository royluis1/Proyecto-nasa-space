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
    AGUA = "agua"
    SUELO = "suelo"
    MIXTA = "mixta"


class CropGroup(StrEnum):
    CEREAL = "cereal"
    OLEAGINOSA = "oleaginosa"
    LEGUMINOSA = "leguminosa"
    FORRAJERA = "forrajera"
    COBERTURA = "cobertura"


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
    DATO_FALTANTE = "dato_faltante"
    OTRO = "otro"
