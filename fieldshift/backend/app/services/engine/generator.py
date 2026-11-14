"""Generador de rotaciones candidatas.

- Actual: la declarada del lote o, si no hay, la reconstruida desde el historial.
- Conservadora: la actual con cambios mínimos por reglas (ver CONSERVATIVE_RULES).
- Diversificada, agua, suelo, rentabilidad: la primera plantilla de
  app/data/rotation_templates.json cuyas condiciones (zona de aridez, riego) coinciden.
- Mixta: todas las plantillas mixtas que coinciden; el motor elige la de mayor puntaje
  con las prioridades del productor.
"""

from app.models.enums import CropCycle, RotationStrategy
from app.schemas.crop import Crop
from app.schemas.field import FieldOut
from app.schemas.rotation import Rotation, RotationStep, RotationTemplate
from app.services.engine.calendar import RotationCalendarError, build_calendar
from app.utils.exceptions import InvalidInputError

GENERATED_STRATEGIES = [
    RotationStrategy.CONSERVADORA,
    RotationStrategy.DIVERSIFICADA,
    RotationStrategy.AGUA,
    RotationStrategy.SUELO,
    RotationStrategy.RENTABILIDAD,
    RotationStrategy.MIXTA,
]

# Reglas de la rotación conservadora, en orden.
CONSERVATIVE_RULES = {
    "C1-agua": "En secano semiárido, reemplazar los cultivos de requerimiento hídrico alto por uno de su grupo más tolerante.",
    "C2-monocultivo": "Si un cultivo anual se repite en campañas seguidas, alternarlo con otro de distinta familia.",
    "C3-cobertura": "Ocupar el barbecho invernal más largo con una cobertura corta de gramíneas (abril a agosto).",
}
WATER_SUBSTITUTES = {"maiz": "sorgo"}
ALTERNATES = {
    "soja": ["maiz", "sorgo"],
    "maiz": ["soja", "girasol"],
    "sorgo": ["girasol", "soja"],
    "girasol": ["sorgo", "maiz"],
    "mani": ["maiz", "sorgo"],
    "trigo": ["colza", "cobertura_leguminosas"],
    "cebada": ["colza", "cobertura_leguminosas"],
}
COVER_FOR_FALLOW = RotationStep(crop_id="cobertura_gramineas", year=1, start_month=4, end_month=8)


def rotation_id(field_id: str, strategy: RotationStrategy) -> str:
    return f"{field_id}-{strategy.value}"


def matching_templates(
    templates: list[RotationTemplate], zone: str, irrigated: bool
) -> dict[RotationStrategy, list[RotationTemplate]]:
    out: dict[RotationStrategy, list[RotationTemplate]] = {}
    for t in templates:
        if zone in t.when.zones and irrigated in t.when.irrigated:
            out.setdefault(t.strategy, []).append(t)
    return out


def from_template(t: RotationTemplate, field_id: str, suffix: str = "") -> Rotation:
    return Rotation(
        id=rotation_id(field_id, t.strategy) + suffix,
        field_id=field_id,
        name=t.name,
        strategy=t.strategy,
        duration_years=t.duration_years,
        steps=[s.model_copy() for s in t.steps],
        description=t.rationale,
        origin="generada",
        rule_ids=[f"plantilla:{t.id}"],
        management=list(t.management),
    )


def _valid(rotation: Rotation, crops: dict[str, Crop]) -> bool:
    try:
        build_calendar(rotation, crops)
        return True
    except RotationCalendarError:
        return False


def _replace_step(rotation: Rotation, index: int, new_crop: Crop, crops: dict[str, Crop]) -> Rotation | None:
    """Cambia el cultivo de un paso: primero con su calendario típico, si no, con los meses originales."""
    old = rotation.steps[index]
    cal = new_crop.default_calendar
    options = [(cal.start_month, cal.end_month)]
    if old.start_month in new_crop.sowing_months:
        options.append((old.start_month, old.end_month))
    for start, end in options:
        steps = list(rotation.steps)
        steps[index] = RotationStep(crop_id=new_crop.id, year=old.year, start_month=start, end_month=end)
        candidate = rotation.model_copy(update={"steps": steps})
        if _valid(candidate, crops):
            return candidate
    return None


def _chronological(rotation: Rotation) -> list[int]:
    return sorted(range(len(rotation.steps)), key=lambda i: (rotation.steps[i].year, rotation.steps[i].start_month))


def conservative(actual: Rotation, crops: dict[str, Crop], zone: str, irrigated: bool) -> Rotation:
    rot = actual.model_copy(deep=True)
    applied: list[str] = []
    changes: list[str] = []

    if zone == "semiarido" and not irrigated:
        for i, step in enumerate(rot.steps):
            sub = WATER_SUBSTITUTES.get(step.crop_id)
            if sub and crops[step.crop_id].water_requirement.value == "alto":
                new = _replace_step(rot, i, crops[sub], crops)
                if new:
                    changes.append(f"{crops[step.crop_id].name} → {crops[sub].name}")
                    rot = new
                    applied.append("C1-agua")

    order = _chronological(rot)
    for a, b in zip(order, order[1:] + order[:1]):
        sa, sb = rot.steps[a], rot.steps[b]
        if a == b or sa.crop_id != sb.crop_id or crops[sa.crop_id].cycle == CropCycle.PERENNE:
            continue
        for alt in ALTERNATES.get(sb.crop_id, []):
            if crops[sa.crop_id].id in crops[alt].rotation.avoid_predecessors:
                continue
            new = _replace_step(rot, b, crops[alt], crops)
            if new:
                changes.append(f"{crops[sb.crop_id].name} repetido → {crops[alt].name}")
                rot = new
                applied.append("C2-monocultivo")
                break

    if zone == "subhumedo" or irrigated or not applied:
        for year in range(1, rot.duration_years + 1):
            cover = COVER_FOR_FALLOW.model_copy(update={"year": year})
            candidate = rot.model_copy(update={"steps": [*rot.steps, cover]})
            if _valid(candidate, crops):
                rot = candidate
                changes.append(f"cobertura de gramíneas en el invierno del año {year}")
                applied.append("C3-cobertura")
                break

    detail = "; ".join(changes) if changes else "sin cambios posibles por reglas"
    chrono = sorted(rot.steps, key=lambda s: (s.year, s.start_month))
    sequence = " – ".join(crops[s.crop_id].name for s in chrono)
    return rot.model_copy(
        update={
            "id": rotation_id(actual.field_id, RotationStrategy.CONSERVADORA),
            "name": f"Conservadora: {sequence}",
            "strategy": RotationStrategy.CONSERVADORA,
            "origin": "generada",
            "description": f"Mantiene la base de la rotación actual con cambios mínimos ({detail}).",
            "rule_ids": [f"regla:{r}" for r in dict.fromkeys(applied)],
            "management": (
                ["secar la cobertura en agosto para no consumir el agua del barbecho"]
                if "C3-cobertura" in applied
                else []
            ),
        }
    )


def actual_rotation(field: FieldOut, declared: Rotation | None, history: list[str], crops: dict[str, Crop]) -> Rotation:
    """La rotación declarada del lote o, si no hay, una reconstruida desde el historial."""
    if declared is not None:
        return declared
    recent = history[-3:]
    if not recent:
        raise InvalidInputError(
            "El lote no tiene rotación actual ni historial de cultivos: cargá al menos el cultivo actual (`current_crop`)."
        )
    steps = [
        RotationStep(
            crop_id=c,
            year=i + 1,
            start_month=crops[c].default_calendar.start_month,
            end_month=crops[c].default_calendar.end_month,
        )
        for i, c in enumerate(recent)
    ]
    rotation = Rotation(
        id=rotation_id(field.id, RotationStrategy.ACTUAL),
        field_id=field.id,
        name="Actual (según historial): " + " – ".join(crops[c].name for c in recent),
        strategy=RotationStrategy.ACTUAL,
        duration_years=len(steps),
        steps=steps,
        description="Reconstruida desde el historial de cultivos, con fechas típicas de cada cultivo.",
    )
    if not _valid(rotation, crops):
        raise InvalidInputError("No se pudo reconstruir la rotación actual desde el historial: cargala explícitamente.")
    return rotation


def generate(
    field: FieldOut,
    actual: Rotation,
    templates: list[RotationTemplate],
    crops: dict[str, Crop],
    zone: str,
    irrigated: bool,
    strategies: list[RotationStrategy] | None = None,
) -> tuple[list[Rotation], list[Rotation]]:
    """Devuelve (rotaciones generadas sin la mixta, variantes de la mixta)."""
    wanted = [s for s in (strategies or GENERATED_STRATEGIES) if s != RotationStrategy.ACTUAL]
    by_strategy = matching_templates(templates, zone, irrigated)
    out: list[Rotation] = []
    mixed: list[Rotation] = []
    for strategy in wanted:
        if strategy == RotationStrategy.CONSERVADORA:
            out.append(conservative(actual, crops, zone, irrigated))
        elif strategy == RotationStrategy.MIXTA:
            mixed = [from_template(t, field.id, f"-{k + 1}") for k, t in enumerate(by_strategy.get(strategy, []))]
        elif by_strategy.get(strategy):
            out.append(from_template(by_strategy[strategy][0], field.id))
    return out, mixed
