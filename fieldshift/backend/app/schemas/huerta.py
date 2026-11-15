"""Rotación simple de huerta por familias botánicas (no son las 16 plantillas de campo)."""

from pydantic import BaseModel, Field


class HuertaFamilyGroup(BaseModel):
    group_id: str
    label: str = Field(description="Nombre del grupo de familia (p. ej. Solanáceas).")
    crops: list[str] = Field(description="Hortalizas del catálogo en esta familia.")
    return_interval_years: int | None = Field(description="Años mínimos antes de repetir la familia en el mismo cantero (catálogo).")
    note: str


class HuertaRotationGuide(BaseModel):
    """Guía orientativa para rotar canteros por familia. Fuente: INTA Pro-Huerta. Requiere criterio local."""

    groups: list[HuertaFamilyGroup]
    order: list[str] = Field(description="Orden sugerido de familias en el cantero, temporada a temporada.")
    rules: list[str]
    source: str
