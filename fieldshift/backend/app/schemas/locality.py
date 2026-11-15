"""Ciudades y pueblos: búsqueda por nombre y localidad más cercana a un punto."""

from pydantic import BaseModel, Field


class LocalityOut(BaseModel):
    nombre: str = Field(examples=["Justo Daract"])
    provincia: str = Field(examples=["San Luis"])
    departamento: str = Field(default="", examples=["General Pedernera"])
    tipo: str = Field(default="", description="Tipo de asentamiento según BAHRA.", examples=["Localidad simple"])
    lat: float = Field(examples=[-33.86])
    lon: float = Field(examples=[-65.18])
    label: str = Field(description="Nombre y provincia, para mostrar.", examples=["Justo Daract, San Luis"])


class LocalitySearch(BaseModel):
    query: str
    results: list[LocalityOut]
    source: str | None = None


class NearestLocality(BaseModel):
    locality: LocalityOut | None = Field(description="La más cercana, o null si no hay ninguna dentro del radio.")
    distance_km: float | None = Field(default=None, description="Distancia al centro de la localidad.")
    text: str = Field(description="Frase lista para mostrar.", examples=["Tu huerta está cerca de Justo Daract, San Luis (a 2 km)."])
    source: str | None = None
