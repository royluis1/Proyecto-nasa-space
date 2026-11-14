"""Sobre de respuesta, errores y entidades transversales (fuentes, supuestos, advertencias)."""

from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from app.models.constants import DISCLAIMER
from app.models.enums import DataStatus, RiskKind, Severity

T = TypeVar("T")


class ResponseMeta(BaseModel):
    data_status: DataStatus
    as_of: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: list[str] = []
    disclaimer: str = DISCLAIMER


class ApiResponse(BaseModel, Generic[T]):
    """Todas las respuestas exitosas tienen `data` + `meta` (estado de los datos y advertencia)."""

    data: T
    meta: ResponseMeta


class ErrorBody(BaseModel):
    code: str = Field(examples=["FIELD_NOT_FOUND"])
    message: str = Field(examples=["No existe el lote 'campo-x'."])
    details: Any | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class DataSource(BaseModel):
    id: str = Field(examples=["nasa-power"])
    name: str
    provider: str
    product: str | None = None
    endpoint: str | None = None
    spatial_resolution: str
    temporal_resolution: str
    license: str
    citation: str
    limitations: list[str] = []


class Assumption(BaseModel):
    id: str
    text: str
    value_range: str | None = None
    source: str | None = Field(default=None, description="Fuente verificable; None = a validar.")
    validated: bool = False
    used_in: list[str] = []


class RiskFlag(BaseModel):
    """Advertencia. La severidad se comunica con texto e ícono, nunca solo con color."""

    id: str
    target_type: str = Field(examples=["field", "rotation"])
    target_id: str
    kind: RiskKind
    severity: Severity
    icon: str = Field(examples=["alert-triangle"])
    message: str
    evidence: list[str] = []
