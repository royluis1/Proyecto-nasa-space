from datetime import datetime

from pydantic import BaseModel

from app.models.enums import Confidence
from app.schemas.common import Assumption, DataSource
from app.schemas.field import FieldOut
from app.schemas.rotation import Rotation, RotationScore


class Report(BaseModel):
    generated_at: datetime
    field: FieldOut
    rotations: list[Rotation]
    ranking: list[RotationScore]
    explanations: dict[str, str]
    recommended_rotation_id: str
    confidence: Confidence
    sources: list[DataSource]
    assumptions: list[Assumption]
    warnings: list[str]
    disclaimer: str
