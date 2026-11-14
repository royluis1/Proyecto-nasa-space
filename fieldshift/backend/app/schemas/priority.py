"""Prioridades del productor (0 a 10). Son la base de los pesos del puntaje."""

from pydantic import BaseModel, Field


class Priorities(BaseModel):
    water: int = Field(default=5, ge=0, le=10, description="Ahorro de agua.")
    soil: int = Field(default=5, ge=0, le=10, description="Salud del suelo.")
    risk: int = Field(default=5, ge=0, le=10, description="Reducir riesgo climático.")
    income: int = Field(default=5, ge=0, le=10, description="Ingreso relativo.")
    sustainability: int = Field(default=5, ge=0, le=10, description="Sostenibilidad del lote.")


class FarmerPriority(BaseModel):
    field_id: str
    priorities: Priorities
    is_default: bool = Field(default=False, description="True = valores por defecto (estimado), no elegidos por el productor.")
