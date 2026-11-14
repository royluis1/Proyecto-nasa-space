"""Genera frontend/lib/demo/data/*.json: respuestas de ejemplo para el modo demostración del frontend.

Se calculan con el motor real, pero con clima, SMAP y NDVI de MUESTRA SIMULADA (sin red), así que son ILUSTRATIVAS.
El frontend las usa solo si el backend no responde, y avisa en pantalla.

Uso (desde fieldshift/):  python scripts/export_demo_data.py
"""

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.calendar import CalendarRequest  # noqa: E402
from app.schemas.rotation import CompareRequest  # noqa: E402
from app.schemas.satellite import SoilMoistureRequest, VegetationRequest  # noqa: E402
from app.services.climate_summary import build_summary  # noqa: E402
from app.services.engine.scenarios import PRESETS  # noqa: E402
from app.services.engine.service import RotationService  # noqa: E402
from app.services.power.cache import PowerCache  # noqa: E402
from app.services.power.sample import SampleProvider  # noqa: E402
from app.services.power.file_source import PowerFileProvider  # noqa: E402
from app.services.power.service import PowerService, resolve_parameters  # noqa: E402
from app.services.early_warning import EarlyWarningService  # noqa: E402
from app.services.forecast.open_meteo import ForecastService  # noqa: E402
from app.services.repository import Repository  # noqa: E402
from app.services.satellite.provider import SatelliteProvider  # noqa: E402
from app.services.satellite.service import SatelliteService  # noqa: E402
from app.services.terrain.service import TerrainProvider, terrain_for_field  # noqa: E402
from app.utils.exceptions import UpstreamError  # noqa: E402

OUT = ROOT / "frontend" / "lib" / "demo" / "data"
def dump(obj) -> dict | list:
    if isinstance(obj, list):
        return [dump(x) for x in obj]
    return obj.model_dump(mode="json") if hasattr(obj, "model_dump") else obj


def write(name: str, data) -> None:
    path = OUT / name
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    s = get_settings()
    OUT.mkdir(parents=True, exist_ok=True)

    def failing(*_):
        raise UpstreamError("modo sin red")

    repo = Repository(s.data_dir)
    power = PowerService(failing, PowerCache(Path(tempfile.mkdtemp()), 24), SampleProvider(s.nasa_samples_dir / s.power_sample_file),
                         files=PowerFileProvider([s.nasa_samples_dir / n for n in s.power_fallback_files]))
    samples = {"SPL4SMGP_rootzone": s.nasa_samples_dir / s.smap_sample_file, "MOD13Q1": s.nasa_samples_dir / s.ndvi_sample_file}
    satellite = SatelliteService(repo, SatelliteProvider(Path(tempfile.mkdtemp()), samples))
    terrain = TerrainProvider(Path(tempfile.mkdtemp()), s.nasa_samples_dir / s.srtm_sample_file)  # sin credenciales: muestra
    service = RotationService(repo, power, s.power_base_url, satellite, terrain)

    write("fields.json", [dump(f) for f in repo.list_fields()])
    write("crops.json", [dump(c) for c in repo.list_crops()])
    write("scenario-presets.json", [{"scenario": dump(p.scenario), "group": p.group, "help": p.help} for p in PRESETS])
    for field in repo.list_fields():
        fid = field.id
        compare, bundle = service.compare(CompareRequest(field_id=fid))
        data = dump(compare)
        data.pop("ranking")  # se reconstruye desde evaluations[].score
        write(f"compare-{fid}.json", data)
        start, end = bundle_period(bundle)
        data = power.get_daily(field.location.lat, field.location.lon, start, end, resolve_parameters(None), "AG")
        summary = build_summary(data, field.location.lat, field.location.lon, start, end, "AG", s.power_base_url, False, fid)
        write(f"climate-{fid}.json", dump(summary))
        sm, _ = satellite.soil_moisture(SoilMoistureRequest(field_id=fid))
        write(f"soil-moisture-{fid}.json", dump(sm))
        veg, _ = satellite.vegetation(VegetationRequest(field_id=fid))
        write(f"vegetation-{fid}.json", dump(veg))
        ews = EarlyWarningService(repo, power, ForecastService(None), satellite)  # sin red: sin pronóstico
        write(f"huerta-{fid}.json", dump(ews.huerta(field_id=fid)))
        for profile in ("huerta", "agricultor"):
            write(f"alerts-{fid}-{profile}.json", dump(ews.alerts(profile, field_id=fid)))
        relief, _ = terrain_for_field(terrain, field)
        write(f"terrain-{fid}.json", dump(relief))
        results = []
        for preset in PRESETS:
            res, _ = service.compare(CompareRequest(field_id=fid), preset.scenario)
            ranking = dump(res.ranking)
            for score in ranking:
                for comp in score["components"]:
                    comp["drivers"] = []  # recorte: en escenarios solo importa el total y el desglose
            notes = [{"rotation_id": ev.rotation.id, "summary": ev.recommendation.summary, "why": ev.recommendation.why,
                      "risks": ev.recommendation.risks, "risk_level": ev.score.risk_level, "risk_flags": []}
                     for ev in res.evaluations]
            results.append({"scenario": dump(preset.scenario), "recommended_rotation_id": res.recommended_rotation_id,
                            "ranking": ranking, "rotations": dump(notes), "warnings": []})
        write(f"scenarios-{fid}.json", results)
        timelines = []
        for ev in compare.evaluations:
            tl, _ = service.timeline(CalendarRequest(field_id=fid, rotation_id=ev.rotation.id, campaigns=4, first_campaign_year=2030))
            timelines.append(dump(tl))
        write(f"calendar-{fid}.json", timelines)
        write(f"rotations-{fid}.json", [dump(ev.rotation) for ev in compare.evaluations])


def bundle_period(bundle):
    from app.services.engine.service import climate_period

    return climate_period(None, None)


if __name__ == "__main__":
    main()
