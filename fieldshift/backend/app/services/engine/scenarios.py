"""Escenarios predefinidos y resumen de resistencia de cada rotación a los escenarios.

Son pruebas de sensibilidad sobre el clima de referencia (NASA POWER), no proyecciones climáticas.
"""

from dataclasses import dataclass

from app.schemas.rotation import RotationScore, ScenarioInput


@dataclass(frozen=True)
class Preset:
    scenario: ScenarioInput
    group: str  # clima | eventos | lluvia | temperatura | riego
    help: str


def _p(group: str, help_: str, **kw) -> Preset:
    return Preset(ScenarioInput(**kw), group, help_)


PRESETS: list[Preset] = [
    _p("clima", "El clima promedio de los últimos 10 años, como está.", id="base", name="Año normal"),
    _p("clima", "Repite el año más seco de los últimos 10.", id="anio-seco", name="Año seco", dry_year=True),
    _p("eventos", "Llueve un 35 % más de octubre a marzo, en tormentas: más erosión y encharcamiento en suelo desnudo.",
       id="lluvias-intensas", name="Año con lluvias intensas", heavy_rain=True),
    _p("eventos", "Veranos con más días de más de 35 °C y más evaporación de diciembre a febrero.",
       id="olas-calor", name="Año con olas de calor", heat_wave=True),
    _p("lluvia", "Llueve un 10 % menos todo el año.", id="lluvia-10", name="Lluvia -10 %", rain_delta_pct=-10),
    _p("lluvia", "Llueve un 20 % menos todo el año.", id="lluvia-20", name="Lluvia -20 %", rain_delta_pct=-20),
    _p("lluvia", "Llueve un 30 % menos todo el año.", id="lluvia-30", name="Lluvia -30 %", rain_delta_pct=-30),
    _p("temperatura", "Todo el año 1 °C más: los cultivos piden más agua y hay más días de calor extremo.",
       id="temp-1", name="+1 °C", temp_delta_c=1),
    _p("temperatura", "Todo el año 2 °C más.", id="temp-2", name="+2 °C", temp_delta_c=2),
    _p("riego", "Secano: sin riego, aunque el lote lo tenga.", id="sin-riego", name="Sin riego", irrigation_level="sin_riego"),
    _p("riego", "Riego con la mitad de la lámina: cubre parte del déficit.", id="riego-limitado", name="Con riego limitado",
       irrigation_level="limitado"),
    _p("riego", "Riego pleno: cubre el 80 % del déficit de los cultivos.", id="riego-disponible", name="Con riego disponible",
       irrigation_level="disponible"),
]

PRESETS_BY_ID = {p.scenario.id: p for p in PRESETS}


@dataclass
class Resilience:
    rotation_id: str
    mean_total: float
    worst_total: float
    worst_scenario_id: str
    worst_rank: int
    wins: int  # escenarios en los que queda primera
    max_drop: float  # mayor caída frente al escenario base


def resilience(results: list[tuple[str, list[RotationScore]]], base_id: str = "base") -> list[Resilience]:
    """Qué rotación aguanta mejor: ordenadas por peor puesto, después por peor puntaje y por promedio."""
    base_ranking = next((r for sid, r in results if sid == base_id), results[0][1])
    base = {s.rotation_id: s.total or 0.0 for s in base_ranking}
    acc: dict[str, list[tuple[str, RotationScore]]] = {}
    for sid, ranking in results:
        for s in ranking:
            acc.setdefault(s.rotation_id, []).append((sid, s))
    out = []
    for rid, items in acc.items():
        totals = [s.total or 0.0 for _, s in items]
        worst_sid, worst = min(items, key=lambda x: (x[1].total or 0.0))
        out.append(
            Resilience(
                rotation_id=rid,
                mean_total=round(sum(totals) / len(totals), 1),
                worst_total=round(worst.total or 0.0, 1),
                worst_scenario_id=worst_sid,
                worst_rank=max(s.rank for _, s in items),
                wins=sum(1 for _, s in items if s.rank == 1),
                max_drop=round(max(0.0, max(base.get(rid, 0.0) - (s.total or 0.0) for _, s in items)), 1),
            )
        )
    return sorted(out, key=lambda r: (r.worst_rank, -r.worst_total, -r.mean_total))
