"""Acceso a datos del prototipo: JSON de muestra + memoria para lo creado en la sesión.

Lo creado con POST se pierde al reiniciar el servidor. La persistencia en archivos
llega en una fase posterior; la interfaz pública de esta clase no debería cambiar.
"""

import json
import uuid
from pathlib import Path

from app.schemas.crop import Crop
from app.schemas.field import FieldCreate, FieldOut
from app.schemas.priority import FarmerPriority, Priorities
from app.schemas.rotation import Rotation, RotationTemplate
from app.utils.exceptions import FieldNotFoundError, InvalidInputError, RotationNotFoundError


def _load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


class Repository:
    def __init__(self, data_dir: Path) -> None:
        self.crops: dict[str, Crop] = {c["id"]: Crop(**c) for c in _load(data_dir / "crops.json")}
        self.fields: dict[str, FieldOut] = {f["id"]: FieldOut(**f) for f in _load(data_dir / "fields.json")}
        self.rotations: dict[str, Rotation] = {
            r["id"]: Rotation(**r) for r in _load(data_dir / "rotations.json")
        }
        self.templates: list[RotationTemplate] = [RotationTemplate(**t) for t in _load(data_dir / "rotation_templates.json")]
        self.priorities: dict[str, FarmerPriority] = {}
        self._check_references()

    def _check_references(self) -> None:
        """Falla al arrancar si el catálogo o las rotaciones nombran cultivos que no existen."""
        missing = set()
        for crop in self.crops.values():
            missing |= set(crop.rotation.good_predecessors + crop.rotation.avoid_predecessors) - set(self.crops)
        for steps in [r.steps for r in self.rotations.values()] + [t.steps for t in self.templates]:
            missing |= {s.crop_id for s in steps} - set(self.crops)
        for f in self.fields.values():
            missing |= set(f.crop_history) - set(self.crops)
        if missing:
            raise ValueError(f"Cultivos inexistentes referenciados en los datos: {sorted(missing)}")

    # --- cultivos ---
    def list_crops(self) -> list[Crop]:
        return list(self.crops.values())

    # --- lotes ---
    def get_field(self, field_id: str) -> FieldOut:
        try:
            return self.fields[field_id]
        except KeyError:
            raise FieldNotFoundError(f"No existe el lote '{field_id}'.") from None

    def list_fields(self) -> list[FieldOut]:
        return list(self.fields.values())

    def create_field(self, data: FieldCreate) -> FieldOut:
        unknown = sorted({*data.crop_history, *([data.current_crop] if data.current_crop else [])} - set(self.crops))
        if unknown:
            raise InvalidInputError(f"Cultivos desconocidos: {unknown}.", {"crop_ids": unknown})
        field = FieldOut(id=f"lote-{uuid.uuid4().hex[:8]}", **data.model_dump())
        self.fields[field.id] = field
        return field

    # --- prioridades ---
    def save_priorities(self, fp: FarmerPriority) -> FarmerPriority:
        self.get_field(fp.field_id)
        self.priorities[fp.field_id] = fp
        return fp

    def get_priorities(self, field_id: str) -> FarmerPriority:
        """Devuelve las guardadas o, si no hay, los valores por defecto marcados como tales."""
        return self.priorities.get(field_id) or FarmerPriority(
            field_id=field_id, priorities=Priorities(), is_default=True
        )

    # --- rotaciones ---
    def rotations_for_field(self, field_id: str) -> list[Rotation]:
        self.get_field(field_id)
        return [r for r in self.rotations.values() if r.field_id == field_id]

    def get_rotation(self, rotation_id: str) -> Rotation:
        try:
            return self.rotations[rotation_id]
        except KeyError:
            raise RotationNotFoundError(f"No existe la rotación '{rotation_id}'.") from None
