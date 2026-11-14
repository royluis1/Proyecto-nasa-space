"""Genera los ejemplos de salida del motor de rotaciones en docs/examples/.

Uso (desde fieldshift/):
    python scripts/run_rotation_examples.py            # sin red: clima de MUESTRA SIMULADA
    python scripts/run_rotation_examples.py --live     # intenta NASA POWER en vivo (con caché)

Escribe un JSON completo por caso y un resumen en Markdown.
"""

import argparse
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.priority import Priorities  # noqa: E402
from app.schemas.rotation import CompareRequest, ScenarioInput, SoilMoistureInput, VegetationInput  # noqa: E402
from app.services.engine.explain import strategy_label  # noqa: E402
from app.services.engine.service import RotationService  # noqa: E402
from app.services.power.cache import PowerCache  # noqa: E402
from app.services.power.sample import SampleProvider  # noqa: E402
from app.services.power.service import PowerService  # noqa: E402
from app.services.repository import Repository  # noqa: E402
from app.utils.exceptions import UpstreamError  # noqa: E402

CASES = [
    ("campo-este_base", "Campo Este, prioridades equilibradas", CompareRequest(field_id="campo-este")),
    (
        "campo-centro_agua_seco",
        "Campo Centro (semiárido), prioriza agua, escenario lluvia -20 % y +1 °C",
        CompareRequest(
            field_id="campo-centro",
            priorities=Priorities(water=9, soil=6, risk=7, income=4, sustainability=5),
            scenario=ScenarioInput(
                id="seco-20-calor-1", name="Lluvia -20 % y +1 °C", rain_delta_pct=-20, temp_delta_c=1
            ),
        ),
    ),
    (
        "campo-conlara_riego_ingreso",
        "Campo Conlara (riego), prioriza ingreso",
        CompareRequest(
            field_id="campo-conlara", priorities=Priorities(water=4, soil=4, risk=5, income=9, sustainability=3)
        ),
    ),
    (
        "campo-este_sensores",
        "Campo Este con historial de monocultivo, SMAP y NDVI (valores de ejemplo)",
        CompareRequest(
            field_id="campo-este",
            history=["maiz", "soja", "soja", "soja"],
            soil_moisture=SoilMoistureInput(product="SMAP_L3", anomaly_pct=-25, period="2025-09 a 2025-11"),
            vegetation=VegetationInput(bare_soil_fraction=0.75, period="2021-2025"),
        ),
    ),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    s = get_settings()
    if args.live:
        from app.services.power.client import PowerClient

        fetcher = PowerClient(s.power_base_url, s.request_timeout_s, s.max_retries, s.retry_backoff_s).fetch
        cache = PowerCache(s.cache_dir, s.cache_ttl_hours)
    else:

        def fetcher(*_):
            raise UpstreamError("modo sin red")

        cache = PowerCache(Path(tempfile.mkdtemp()), s.cache_ttl_hours)
    power = PowerService(fetcher, cache, SampleProvider(s.nasa_samples_dir / s.power_sample_file))
    service = RotationService(Repository(s.data_dir), power, s.power_base_url)

    out = ROOT / "docs" / "examples"
    out.mkdir(parents=True, exist_ok=True)
    md = [
        "# Ejemplos de salida del motor de rotaciones",
        "",
        "Generados con `python scripts/run_rotation_examples.py`. "
        + (
            "Clima: NASA POWER."
            if args.live
            else "**Clima: MUESTRA SIMULADA** (sin red); los números son ilustrativos."
        ),
        "",
    ]
    for k, (slug, title, req) in enumerate(CASES):
        result, climate = service.compare(req)
        data = result.model_dump(mode="json", exclude_none=True)
        if k > 0:  # el primer caso va completo; en los demás, el ranking y solo la evaluación recomendada
            data["evaluations"] = data["evaluations"][:1]
            data["note"] = (
                "Ejemplo recortado: solo la evaluación de la rotación recomendada. La respuesta real trae todas."
            )
        (out / f"{slug}.json").write_text(
            json.dumps(
                {
                    "data": data,
                    "meta": {"data_status": climate.status.value, "origin_label": climate.status.origin_label},
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        c = result.inputs.climate
        md += [
            f"## {title}",
            "",
            f"Archivo completo: [`{slug}.json`]({slug}.json)",
            "",
            f"- Clima ({c.origin_label}, {c.period}): lluvia {c.annual_precip_mm:.0f} mm/año, ET0 {c.annual_et0_mm:.0f} mm/año, "
            f"índice de aridez {str(c.aridity_index).replace('.', ',')} ({c.zone.value.replace('_', ' ')})"
            + (f"; escenario: {c.scenario} → lluvia {c.scenario_precip_mm:.0f} mm/año" if c.scenario else "")
            + ".",
            "- Pesos: " + ", ".join(f"{k} {v * 100:.0f} %" for k, v in result.weights.items()) + ".",
            f"- Confianza general: **{result.confidence.value}**.",
            "",
            "| # | Estrategia | Rotación | Total (rango) | A | S | R | I | E | Demanda mm/año |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for ev in result.evaluations:
            sc = ev.score
            comps = " | ".join(f"{x.value:.0f}" for x in sc.components)
            md.append(
                f"| {sc.rank} | {strategy_label(ev.rotation.strategy)} | {ev.rotation.name} | "
                f"**{sc.total:.0f}** ({sc.uncertainty_low:.0f}–{sc.uncertainty_high:.0f}) | {comps} | {ev.profile.water_demand_mm_year:.0f} |"
            )
        best = result.evaluations[0]
        md += [
            "",
            "**Explicación de la recomendada:**",
            "",
            "> " + best.recommendation.why,
            "",
            "**Riesgos:** " + " ".join(best.recommendation.risks),
            "",
            "**Validación:** " + best.recommendation.validation_note,
            "",
        ]
        if result.warnings:
            md += ["**Advertencias:**", ""] + [f"- {w}" for w in result.warnings] + [""]
    (out / "README.md").write_text("\n".join(md), encoding="utf-8")
    print(f"Ejemplos escritos en {out}")


if __name__ == "__main__":
    main()
