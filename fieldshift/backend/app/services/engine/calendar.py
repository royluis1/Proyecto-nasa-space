"""Calendario mensual de una rotación: qué cultivo ocupa cada mes del ciclo.

El ciclo dura 12 x duration_years meses y es cíclico (el último mes sigue con el primero).
Un mismo mes puede ser el último de un cultivo y el primero del siguiente (cosecha y
siembra en el mismo mes): en ese caso el mes se asigna al cultivo que empieza.
"""

from dataclasses import dataclass

from app.models.enums import CropCycle
from app.schemas.crop import Crop
from app.schemas.rotation import Rotation, RotationStep

MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


class RotationCalendarError(ValueError):
    """La rotación no se puede ubicar en el calendario (cultivos superpuestos o desconocidos)."""


def step_length(step: RotationStep) -> int:
    return (step.end_month - step.start_month) % 12 + 1


@dataclass(frozen=True)
class PlacedStep:
    index: int  # orden cronológico dentro de la rotación
    step: RotationStep
    crop: Crop
    months: tuple[int, ...]  # índices de mes del ciclo, en orden
    owned: tuple[int, ...]  # meses que efectivamente ocupa (sin el mes cedido al siguiente)


@dataclass(frozen=True)
class Calendar:
    n_months: int
    steps: tuple[PlacedStep, ...]
    owner: tuple[int | None, ...]  # índice de paso por mes, None = barbecho

    @property
    def duration_years(self) -> int:
        return self.n_months // 12

    def crop_at(self, month_index: int) -> Crop | None:
        i = self.owner[month_index]
        return None if i is None else self.steps[i].crop

    def position(self, step_index: int, month_index: int) -> tuple[int, int]:
        """Posición del mes dentro del ciclo del cultivo y largo del ciclo."""
        months = self.steps[step_index].months
        return months.index(month_index), len(months)

    def previous_crop(self, month_index: int) -> Crop | None:
        """Último cultivo que ocupó el lote antes de este mes (para el rastrojo del barbecho)."""
        for back in range(1, self.n_months + 1):
            crop = self.crop_at((month_index - back) % self.n_months)
            if crop is not None:
                return crop
        return None


def build_calendar(rotation: Rotation, crops: dict[str, Crop]) -> Calendar:
    n = 12 * rotation.duration_years
    ordered = sorted(rotation.steps, key=lambda s: (s.year, s.start_month))
    placed: list[tuple[RotationStep, Crop, tuple[int, ...]]] = []
    for step in ordered:
        crop = crops.get(step.crop_id)
        if crop is None:
            raise RotationCalendarError(f"Cultivo desconocido en la rotación: '{step.crop_id}'.")
        start = (step.year - 1) * 12 + step.start_month - 1
        placed.append((step, crop, tuple((start + k) % n for k in range(step_length(step)))))

    claims: dict[int, list[tuple[int, int]]] = {}
    for i, (_, _, months) in enumerate(placed):
        for k, m in enumerate(months):
            claims.setdefault(m, []).append((i, k))

    owner: list[int | None] = [None] * n
    for m, who in claims.items():
        if len(who) == 1:
            owner[m] = who[0][0]
            continue
        if len(who) == 2:
            (a, ka), (b, kb) = who
            last_a, last_b = ka == len(placed[a][2]) - 1, kb == len(placed[b][2]) - 1
            if last_a and kb == 0:
                owner[m] = b
                continue
            if last_b and ka == 0:
                owner[m] = a
                continue
        names = ", ".join(placed[i][1].name for i, _ in who)
        raise RotationCalendarError(
            f"Cultivos superpuestos en '{rotation.name}' ({names}) en {MONTH_NAMES[m % 12]} del año {m // 12 + 1}."
        )

    steps = tuple(
        PlacedStep(i, step, crop, months, tuple(m for m in months if owner[m] == i))
        for i, (step, crop, months) in enumerate(placed)
    )
    return Calendar(n_months=n, steps=steps, owner=tuple(owner))


def calendar_warnings(calendar: Calendar) -> list[str]:
    """Avisos (no errores) para rotaciones cargadas por el usuario: meses de siembra y largo del ciclo."""
    out = []
    for p in calendar.steps:
        crop, step = p.crop, p.step
        if step.start_month not in crop.sowing_months:
            out.append(
                f"{crop.name}: siembra en {MONTH_NAMES[step.start_month - 1]}, fuera de su época habitual ({crop.sowing_window})."
            )
        if crop.cycle != CropCycle.PERENNE:
            length = step_length(step)
            if not crop.cycle_months.min <= length <= crop.cycle_months.max:
                out.append(
                    f"{crop.name}: ocupa {length} meses; su ciclo habitual es de "
                    f"{crop.cycle_months.min:g} a {crop.cycle_months.max:g} meses."
                )
    return out


def describe_step(p: PlacedStep) -> str:
    s, e = p.step.start_month, p.step.end_month
    return f"{p.crop.name} ({MONTH_NAMES[s - 1]}–{MONTH_NAMES[e - 1]}, año {p.step.year})"
