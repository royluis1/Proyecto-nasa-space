"""Resumen climático. La integración real con NASA POWER llega en la fase siguiente."""

from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.models.provenance import Valued
from app.utils.validators import validate_date_range


class DateRange(BaseModel):
    start: date = Field(examples=["2015-01-01"])
    end: date = Field(examples=["2025-12-31"])

    @model_validator(mode="after")
    def _valid(self) -> "DateRange":
        validate_date_range(self.start, self.end)
        return self


class ClimateSummaryRequest(BaseModel):
    field_id: str
    period: DateRange


class ClimateSummary(BaseModel):
    field_id: str
    period: DateRange
    annual_precip_mm: Valued | None = None
    mean_temp_c: Valued | None = None
    mean_tmax_c: Valued | None = None
    mean_tmin_c: Valued | None = None
    heat_days_per_year: Valued | None = None
    frost_days_per_year: Valued | None = None
    missing_pct: float | None = Field(default=None, ge=0, le=100)
    source_ids: list[str] = []
