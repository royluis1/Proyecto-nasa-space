"""Punto de entrada (PREPARADO, SIN IMPLEMENTAR) para sensores de humedad propios del productor.

Hoy la humedad del suelo es satelital (SMAP, contexto regional de ~9 km). Si en el futuro el productor conecta
sensores en el lote, una fuente nueva tiene que implementar `SoilMoistureSource` y etiquetar sus datos como
"observado" en el lote, con la ubicación y la profundidad de cada sensor. Nada de esto está conectado todavía:
no hay endpoint ni almacenamiento para lecturas de sensores.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SensorReading:
    sensor_id: str
    at: dt.datetime
    depth_cm: float
    volumetric_water: float  # m³/m³
    latitude: float
    longitude: float


class SoilMoistureSource(Protocol):
    """Fuente de humedad del suelo de un lote (sensores propios, en el futuro)."""

    name: str

    def readings(self, field_id: str, since: dt.datetime) -> list[SensorReading]: ...
