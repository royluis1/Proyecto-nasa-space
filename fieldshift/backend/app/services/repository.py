"""Acceso a datos del prototipo: JSON de muestra + memoria para lo creado en la sesión.

Lo creado con POST se pierde al reiniciar el servidor. La persistencia en archivos
llega en una fase posterior; la interfaz pública de esta clase no debería cambiar.
"""

import copy
import json
import uuid
from pathlib import Path

from app.models.enums import CropScale
from app.schemas.crop import Crop
from app.schemas.field import FieldCreate, FieldOut
from app.schemas.priority import FarmerPriority, Priorities
from app.schemas.rotation import Rotation, RotationTemplate
from app.i18n import current_lang, tr
from app.utils.exceptions import ConflictError, FieldNotFoundError, InvalidInputError, RotationNotFoundError


def _load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _overlay(item: dict, texts: dict | None) -> dict:
    """Copia del dato con los textos en inglés de app/data/en.json ("a.b" = campo anidado)."""
    out = copy.deepcopy(item)
    for key, value in (texts or {}).items():
        target = out
        *path, last = key.split(".")
        for part in path:
            target = target.get(part) if isinstance(target, dict) else None
            if target is None:
                break
        if isinstance(target, dict):
            target[last] = value
    return out


class Repository:
    """Datos del prototipo. El catálogo, las plantillas y los ejemplos existen en español y en inglés:
    se usa la versión del idioma del pedido (los ids son los mismos)."""

    def __init__(self, data_dir: Path) -> None:
        en_path = data_dir / "en.json"
        en = json.loads(en_path.read_text(encoding="utf-8")) if en_path.exists() else {}
        crops_raw = _load(data_dir / "crops.json")
        templates_raw = _load(data_dir / "rotation_templates.json")
        rotations_raw = _load(data_dir / "rotations.json")
        self._crops: dict[str, dict[str, Crop]] = {
            "es": {c["id"]: Crop(**c) for c in crops_raw},
            "en": {c["id"]: Crop(**_overlay(c, en.get("crops", {}).get(c["id"]))) for c in crops_raw},
        }
        self._templates: dict[str, list[RotationTemplate]] = {
            "es": [RotationTemplate(**t) for t in templates_raw],
            "en": [RotationTemplate(**_overlay(t, en.get("rotation_templates", {}).get(t["id"]))) for t in templates_raw],
        }
        self._rotations: dict[str, dict[str, Rotation]] = {
            "es": {r["id"]: Rotation(**r) for r in rotations_raw},
            "en": {r["id"]: Rotation(**_overlay(r, en.get("rotations", {}).get(r["id"]))) for r in rotations_raw},
        }
        # Los lotes se guardan en un solo lugar (los cargados por usuarios se editan); los de ejemplo se traducen al leerlos.
        self.fields: dict[str, FieldOut] = {f["id"]: FieldOut(**f) for f in _load(data_dir / "fields.json")}
        self._fields_en: dict[str, FieldOut] = {
            f["id"]: FieldOut(**_overlay(f, en["fields"][f["id"]])) for f in _load(data_dir / "fields.json") if f["id"] in en.get("fields", {})
        }
        self._originals: dict[str, FieldOut] = dict(self.fields)
        self.priorities: dict[str, FarmerPriority] = {}
        self._check_references()

    @property
    def crops(self) -> dict[str, Crop]:
        return self._crops[current_lang()]

    @property
    def templates(self) -> list[RotationTemplate]:
        return self._templates[current_lang()]

    @property
    def rotations(self) -> dict[str, Rotation]:
        return self._rotations[current_lang()]

    def _localized(self, field: FieldOut) -> FieldOut:
        """Lote de ejemplo en inglés: se traduce cada texto que siga igual al original (lo que editó el usuario queda)."""
        original, english = self._originals.get(field.id), self._fields_en.get(field.id)
        if current_lang() != "en" or original is None or english is None:
            return field
        update: dict = {}
        for key in ("name", "farm_name", "sample_note"):
            if getattr(field, key) == getattr(original, key):
                update[key] = getattr(english, key)
        sp, sp0, sp_en = field.soil_profile, original.soil_profile, english.soil_profile
        if sp and sp0 and sp_en and sp.provenance.note == sp0.provenance.note:
            update["soil_profile"] = sp.model_copy(update={"provenance": sp.provenance.model_copy(update={"note": sp_en.provenance.note})})
        return field.model_copy(update=update) if update else field

    def _check_references(self) -> None:
        """Falla al arrancar si el catálogo o las rotaciones nombran cultivos que no existen."""
        missing = set()
        for crop in self._crops["es"].values():
            missing |= set(crop.rotation.good_predecessors + crop.rotation.avoid_predecessors) - set(self._crops["es"])
        for steps in [r.steps for r in self._rotations["es"].values()] + [t.steps for t in self._templates["es"]]:
            missing |= {s.crop_id for s in steps} - set(self._crops["es"])
        for f in self.fields.values():
            missing |= set(f.crop_history) - set(self._crops["es"])
        if missing:
            raise ValueError(f"Cultivos inexistentes referenciados en los datos: {sorted(missing)}")

    # --- cultivos ---
    def list_crops(self, scale: "CropScale | None" = None) -> list[Crop]:
        crops = self.crops.values()
        if scale is not None:
            crops = [c for c in crops if c.scale == scale]
        return list(crops)

    # --- lotes ---
    def get_field(self, field_id: str) -> FieldOut:
        try:
            return self._localized(self.fields[field_id])
        except KeyError:
            raise FieldNotFoundError(tr(f"No existe el lote '{field_id}'.", f"Field '{field_id}' does not exist.")) from None

    def list_fields(self) -> list[FieldOut]:
        return [self._localized(f) for f in self.fields.values()]

    def _check_crops(self, data: FieldCreate) -> None:
        unknown = sorted({*data.crop_history, *([data.current_crop] if data.current_crop else [])} - set(self.crops))
        if unknown:
            raise InvalidInputError(tr(f"Cultivos desconocidos: {unknown}.", f"Unknown crops: {unknown}."), {"crop_ids": unknown})

    def update_field(self, field_id: str, data: FieldCreate) -> FieldOut:
        """Reemplaza los datos del lote (la rotación actual declarada se conserva)."""
        self.get_field(field_id)
        current = self.fields[field_id]
        self._check_crops(data)
        updated = FieldOut(id=field_id, current_rotation_id=current.current_rotation_id, sample_note=current.sample_note,
                           **data.model_dump())
        self.fields[field_id] = updated
        return updated

    def create_field(self, data: FieldCreate) -> FieldOut:
        self._check_crops(data)
        field = FieldOut(id=f"lote-{uuid.uuid4().hex[:8]}", **data.model_dump())
        self.fields[field.id] = field
        return field

    def delete_field(self, field_id: str) -> None:
        """Borra un lote cargado por un usuario. Los de ejemplo no se borran del servidor: la página es pública y
        desaparecerían para todos (el frontend los oculta solo en el navegador de quien los quiere sacar)."""
        field = self.get_field(field_id)
        if field.sample_note:
            raise ConflictError(tr("Los campos de ejemplo no se borran del servidor: se pueden ocultar en tu navegador.",
                                   "Example fields are not deleted from the server: you can hide them in your browser."))
        del self.fields[field_id]
        self.priorities.pop(field_id, None)

    def save_field(self, field: FieldOut) -> FieldOut:
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
            raise RotationNotFoundError(tr(f"No existe la rotación '{rotation_id}'.", f"Rotation '{rotation_id}' does not exist.")) from None
