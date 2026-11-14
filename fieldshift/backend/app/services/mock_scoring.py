"""PUNTAJES SIMULADOS para que el frontend pueda avanzar en paralelo.

Esto NO es el motor de puntaje (llega en su propia fase). Los valores son fijos
por estrategia, se etiquetan como `supuesto` con confianza baja y las respuestas
que los usan llevan `data_status = mock`.
"""

from app.models.enums import RotationStrategy, ScoreComponentKey
from app.models.provenance import MOCK_PROVENANCE
from app.schemas.priority import Priorities
from app.schemas.rotation import Rotation, RotationScore, ScoreComponent

MOCK_WARNING = "Puntajes simulados: el motor de puntaje todavía no está implementado."

_NAMES = {
    ScoreComponentKey.AGUA: "Agua",
    ScoreComponentKey.SUELO: "Suelo",
    ScoreComponentKey.RIESGO: "Riesgo climático",
    ScoreComponentKey.INGRESO: "Ingreso relativo",
    ScoreComponentKey.SOSTENIBILIDAD: "Sostenibilidad",
}

_FIXED: dict[RotationStrategy, tuple[float, float, float, float, float]] = {
    RotationStrategy.ACTUAL: (50, 40, 50, 70, 40),
    RotationStrategy.AGUA: (70, 50, 60, 55, 50),
    RotationStrategy.SUELO: (55, 75, 55, 50, 70),
    RotationStrategy.MIXTA: (60, 65, 55, 55, 60),
}


def _weights(p: Priorities) -> list[float]:
    raw = [p.water, p.soil, p.risk, p.income, p.sustainability]
    total = sum(raw)
    return [1 / len(raw)] * len(raw) if total == 0 else [w / total for w in raw]


def mock_ranking(rotations: list[Rotation], priorities: Priorities, scenario_id: str | None = None) -> list[RotationScore]:
    weights = _weights(priorities)
    scored: list[tuple[float, Rotation, list[ScoreComponent]]] = []
    for rot in rotations:
        values = _FIXED[rot.strategy]
        comps = [
            ScoreComponent(key=k, name=_NAMES[k], value=v, weight=round(w, 3), provenance=MOCK_PROVENANCE)
            for k, v, w in zip(_NAMES, values, weights)
        ]
        total = round(sum(v * w for v, w in zip(values, weights)), 1)
        scored.append((total, rot, comps))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [
        RotationScore(rotation_id=rot.id, scenario_id=scenario_id, rank=i, total=total, components=comps)
        for i, (total, rot, comps) in enumerate(scored, start=1)
    ]
