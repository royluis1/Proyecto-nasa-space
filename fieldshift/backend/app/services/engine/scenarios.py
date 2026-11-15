"""Escenarios predefinidos y resumen de resistencia de cada rotación a los escenarios.

Son pruebas de sensibilidad sobre el clima de referencia (NASA POWER), no proyecciones climáticas.
"""

from dataclasses import dataclass

from app.schemas.rotation import RotationScore, ScenarioInput
from app.i18n import current_lang


@dataclass(frozen=True)
class Preset:
    scenario: ScenarioInput
    group: str  # clima | eventos | lluvia | temperatura | riego
    help: str


def _p(group: str, help_: str, **kw) -> Preset:
    return Preset(ScenarioInput(**kw), group, help_)


def _presets(t) -> list[Preset]:
    """Los escenarios predefinidos; t(es, en) elige el idioma de los textos (los ids no cambian)."""
    return [
        _p("clima", t("El clima promedio de los últimos 10 años, como está.", "The average weather of the last 10 years, as it is."),
           id="base", name=t("Año normal", "Normal year")),
        _p("clima", t("Repite el año más seco de los últimos 10.", "Repeats the driest year of the last 10."),
           id="anio-seco", name=t("Año seco", "Dry year"), dry_year=True),
        _p("eventos", t("Llueve un 35 % más de octubre a marzo, en tormentas: más erosión y encharcamiento en suelo desnudo.",
                        "35 % more rain from October to March, in storms: more erosion and waterlogging on bare soil."),
           id="lluvias-intensas", name=t("Año con lluvias intensas", "Year with heavy rain"), heavy_rain=True),
        _p("eventos", t("Veranos con más días de más de 35 °C y más evaporación de diciembre a febrero.",
                        "Summers with more days above 35 °C and more evaporation from December to February."),
           id="olas-calor", name=t("Año con olas de calor", "Year with heat waves"), heat_wave=True),
        _p("lluvia", t("Llueve un 10 % menos todo el año.", "10 % less rain all year."), id="lluvia-10", name=t("Lluvia -10 %", "Rain -10 %"), rain_delta_pct=-10),
        _p("lluvia", t("Llueve un 20 % menos todo el año.", "20 % less rain all year."), id="lluvia-20", name=t("Lluvia -20 %", "Rain -20 %"), rain_delta_pct=-20),
        _p("lluvia", t("Llueve un 30 % menos todo el año.", "30 % less rain all year."), id="lluvia-30", name=t("Lluvia -30 %", "Rain -30 %"), rain_delta_pct=-30),
        _p("temperatura", t("Todo el año 1 °C más: los cultivos piden más agua y hay más días de calor extremo.",
                            "1 °C warmer all year: crops need more water and there are more days of extreme heat."),
           id="temp-1", name="+1 °C", temp_delta_c=1),
        _p("temperatura", t("Todo el año 2 °C más.", "2 °C warmer all year."), id="temp-2", name="+2 °C", temp_delta_c=2),
        _p("riego", t("Secano: sin riego, aunque el lote lo tenga.", "Rainfed: no irrigation, even if the field has it."),
           id="sin-riego", name=t("Sin riego", "No irrigation"), irrigation_level="sin_riego"),
        _p("riego", t("Riego con la mitad de la lámina: cubre parte del déficit.", "Irrigation at half depth: covers part of the deficit."),
           id="riego-limitado", name=t("Con riego limitado", "Limited irrigation"), irrigation_level="limitado"),
        _p("riego", t("Riego pleno: cubre el 80 % del déficit de los cultivos.", "Full irrigation: covers 80 % of the crops' deficit."),
           id="riego-disponible", name=t("Con riego disponible", "Irrigation available"), irrigation_level="disponible"),
    ]


_PRESETS_BY_LANG = {"es": _presets(lambda es, en: es), "en": _presets(lambda es, en: en)}


class _LangList:
    """Lista que se lee en el idioma del pedido (se usa como una lista común)."""

    def __init__(self, by_lang: dict) -> None:
        self._by_lang = by_lang

    def _cur(self):
        return self._by_lang[current_lang()]

    def __iter__(self):
        return iter(self._cur())

    def __len__(self) -> int:
        return len(self._cur())

    def __getitem__(self, i):
        return self._cur()[i]

    def __contains__(self, x) -> bool:
        return x in self._cur()


PRESETS = _LangList(_PRESETS_BY_LANG)
PRESETS_BY_ID = _LangList({k: {p.scenario.id: p for p in v} for k, v in _PRESETS_BY_LANG.items()})


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
