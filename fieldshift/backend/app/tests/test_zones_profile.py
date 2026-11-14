"""Zonas climáticas, transición, aptitud de cultivos, suelo estimado, perfil automático y humedad satelital. Sin red."""

import json
from datetime import datetime, timezone

import pytest

from app.models.enums import Confidence, DataStatus, Level, SoilTexture
from app.models.provenance import Provenance
from app.schemas.field import SoilProfile
from app.schemas.regions import ZoneClimate
from app.services.field_profile import build_auto_profile
from app.services.power.service import Cooldown
from app.services.regions import geo
from app.services.regions.repository import RegionRepository, shifted_climate
from app.services.regions.suitability import suitability
from app.services.regions.zoning import classify, neighbor_class, summarize
from app.services.soil.soilgrids import SoilProvider, build_estimate, http_fetcher, om_level, parse_soilgrids, usda_texture
from app.tests.conftest import SAMPLES_DIR
from app.utils.exceptions import NotFoundError, UpstreamError

# ------------------------------------------------------------------ clasificación


@pytest.mark.parametrize("ai, cls", [(0.1, "arido"), (0.2, "semiarido"), (0.49, "semiarido"), (0.5, "subhumedo_seco"), (0.649, "subhumedo_seco"), (0.65, "humedo"), (1.2, "humedo")])
def test_clases_unep(ai, cls):
    assert classify(ai) == cls


def test_resumen_de_celda_con_datos_sinteticos():
    rows = [{"year": 2015 + i, "precip": p, "et0": 1300.0, "hot": 20, "cold": 30} for i, p in enumerate([520, 780, 600, 700, 690])]
    s = summarize(rows)
    assert s["aridity_index"] == pytest.approx(3290 / 5 / 1300, abs=1e-3) and s["zone_class"] == "subhumedo_seco"
    assert s["deficit_mm"] == 1300 - 658 and s["years"] == 5
    assert s["years_other_class_pct"] == 40.0  # 520/1300 = 0,40 y 600/1300 = 0,46: semiárida
    assert s["yearly"][0]["zone_class"] == "semiarido"
    with pytest.raises(ValueError):
        summarize([])
    assert neighbor_class("semiarido", wetter=True) == "subhumedo_seco" and neighbor_class("arido", wetter=False) is None


# ------------------------------------------------------------------ geometría

SQUARE = {"type": "Polygon", "coordinates": [[[-66, -34], [-64, -34], [-64, -32], [-66, -32], [-66, -34]]]}
WITH_HOLE = {"type": "Polygon", "coordinates": [SQUARE["coordinates"][0], [[-65.5, -33.5], [-64.5, -33.5], [-64.5, -32.5], [-65.5, -32.5], [-65.5, -33.5]]]}


def test_punto_dentro_y_fuera_con_agujeros_y_multipoligonos():
    assert geo.contains(SQUARE, -33, -65) and not geo.contains(SQUARE, -35, -65)
    assert not geo.contains(WITH_HOLE, -33, -65) and geo.contains(WITH_HOLE, -33.9, -65.9)
    multi = {"type": "MultiPolygon", "coordinates": [SQUARE["coordinates"], [[[-60, -30], [-59, -30], [-59, -29], [-60, -29], [-60, -30]]]]}
    assert geo.contains(multi, -29.5, -59.5)
    assert geo.bbox(SQUARE) == (-66, -34, -64, -32)


def test_distancia_al_borde():
    assert geo.distance_km(SQUARE, -33, -65) == 0
    d = geo.distance_km(SQUARE, -33, -63.9)  # 0,1° al este a -33°
    assert d == pytest.approx(0.1 * 111.32 * 0.8387, rel=0.01)


# ------------------------------------------------------------------ zonas sintéticas y transición


def poly(x0, y0, x1, y1):
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


def cell(cid, cls, geom, ai, other_pct=0.0, other_cls=None, lat=-33, lon=-65):
    yearly = [{"year": 2015 + i, "aridity_index": ai, "zone_class": other_cls if i < round(other_pct / 10) and other_cls else cls} for i in range(10)]
    return {"type": "Feature", "geometry": geom, "properties": {
        "kind": "cell", "cell_id": cid, "zone_id": f"prueba-{cls}", "zone_label": cls, "center_lat": lat, "center_lon": lon,
        "zone_class": cls, "precip_mm": round(ai * 1300), "et0_mm": 1300, "deficit_mm": round(1300 - ai * 1300), "aridity_index": ai,
        "hot_days": 25.0, "frost_days": 30.0, "precip_cv_pct": 20.0, "years": 10, "years_other_class_pct": other_pct, "yearly": yearly}}


def zone(cls, geom, ai):
    return {"type": "Feature", "geometry": geom, "properties": {
        "kind": "zone", "zone_id": f"prueba-{cls}", "zone_class": cls, "zone_label": cls, "province_id": "prueba", "cells": 2, "area_km2": 1000,
        "precip_mm": round(ai * 1300), "et0_mm": 1300, "deficit_mm": round(1300 - ai * 1300), "aridity_index": ai, "aridity_min": ai,
        "aridity_max": ai, "hot_days": 25.0, "frost_days": 30.0, "precip_cv_pct": 20.0, "years_other_class_pct": 0}}


@pytest.fixture
def folder(tmp_path):
    prov = {"type": "FeatureCollection", "fieldshift": {"source": "prueba", "license": "x"},
            "features": [{"type": "Feature", "properties": {"id": "prueba", "name": "Prueba"}, "geometry": SQUARE},
                         {"type": "Feature", "properties": {"id": "vecina", "name": "Vecina"}, "geometry": poly(-64, -34, -62, -32)}]}
    (tmp_path / "provincias_argentina.geojson").write_text(json.dumps(prov))
    feats = [
        zone("semiarido", poly(-66, -34, -65, -32), 0.38), zone("subhumedo_seco", poly(-65, -34, -64, -32), 0.58),
        cell("w-sur", "semiarido", poly(-66, -34, -65, -33), 0.35, lat=-33.5, lon=-65.5),
        cell("w-norte", "semiarido", poly(-66, -33, -65, -32), 0.48, lat=-32.5, lon=-65.5),  # cerca del límite 0,50
        cell("e-sur", "subhumedo_seco", poly(-65, -34, -64, -33), 0.58, other_pct=40, other_cls="semiarido", lat=-33.5, lon=-64.5),
        cell("e-norte", "subhumedo_seco", poly(-65, -33, -64, -32), 0.58, lat=-32.5, lon=-64.5),
    ]
    zones = {"type": "FeatureCollection", "fieldshift": {"origin": "sample", "period": "2015-2024", "method": "prueba",
                                                          "warning": "DATO DE MUESTRA"}, "features": feats}
    (tmp_path / "zonas_prueba_muestra.geojson").write_text(json.dumps(zones))
    return tmp_path


def test_lejos_del_borde_y_del_limite_no_es_transicion(folder, repo):
    z = RegionRepository(folder, repo.crops).zone_at(-33.5, -65.8)
    assert z.zone.zone_class == "semiarido" and z.cell.cell_id == "w-sur"
    t = z.transition
    assert not t.is_transition and t.distance_to_border_km > 25 and t.message is None


def test_cerca_del_borde_es_transicion(folder, repo):
    t = RegionRepository(folder, repo.crops).zone_at(-33.5, -65.1).transition
    assert t.is_transition and t.distance_to_border_km < 25 and t.other_zone_class == "subhumedo_seco"
    assert "transición entre subhúmeda seca y semiárida" in t.message
    assert t.suitability_other and len(t.options) == 4


def test_cerca_del_umbral_es_transicion(folder, repo):
    t = RegionRepository(folder, repo.crops).zone_at(-32.5, -65.8).transition
    assert t.is_transition and t.aridity_margin == pytest.approx(0.02) and any("límite 0.50" in r for r in t.reasons)
    assert t.other_zone_class == "subhumedo_seco"


def test_alta_variabilidad_es_transicion(folder, repo):
    t = RegionRepository(folder, repo.crops).zone_at(-33.5, -64.3).transition
    assert t.is_transition and t.years_other_class_pct == 40 and t.other_zone_class == "semiarido"
    assert any("4 de cada 10" in r for r in t.reasons)


def test_provincia_sin_zonas_y_punto_fuera(folder, repo):
    rr = RegionRepository(folder, repo.crops)
    z = rr.zone_at(-33, -63)
    assert z.province_id == "vecina" and not z.zones_available and "próximamente" in z.note
    assert not rr.zones_out("vecina").available
    with pytest.raises(NotFoundError):
        rr.zone_at(-40, -70)
    with pytest.raises(NotFoundError):
        rr.zones_out("no-existe")
    assert [p["properties"]["has_zones"] for p in rr.provinces_out()] == [True, False]


def test_zonas_precalculadas_tienen_prioridad_sobre_la_muestra(folder, repo):
    live = json.loads((folder / "zonas_prueba_muestra.geojson").read_text())
    live["fieldshift"]["origin"] = "live"
    (folder / "zonas_prueba.geojson").write_text(json.dumps(live))
    rr = RegionRepository(folder, repo.crops)
    assert rr.zones_out("prueba").origin == DataStatus.CACHED
    assert rr.suitability("prueba-semiarido").crops[0].confidence == Confidence.MEDIA


def test_zonas_de_muestra_de_san_luis(repo, tmp_path):
    import shutil

    for name in ("provincias_argentina.geojson", "zonas_san_luis_muestra.geojson"):
        shutil.copy(SAMPLES_DIR / name, tmp_path / name)  # solo la muestra: sin las zonas calculadas con POWER
    z = RegionRepository(tmp_path, repo.crops).zones_out("san-luis")
    assert z.available and z.origin == DataStatus.SAMPLE and "DATO DE MUESTRA" in z.warning
    assert {f["properties"]["zone_class"] for f in z.zones} <= {"arido", "semiarido", "subhumedo_seco", "humedo"}
    assert all(f["properties"]["suitability"] for f in z.zones) and len(z.cells) > 20
    assert "NASA POWER" in z.title and "UNEP" in z.title


def test_zonas_reales_de_san_luis_si_estan(repo):
    if not (SAMPLES_DIR / "zonas_san_luis.geojson").exists():
        pytest.skip("Todavía no se corrió scripts/build_zones.py --live")
    z = RegionRepository(SAMPLES_DIR, repo.crops).zones_out("san-luis")
    assert z.origin == DataStatus.CACHED and z.warning is None and z.period == "2015-2025" and z.generated_at
    for cell in z.cells:
        p = cell["properties"]
        assert p["years"] >= 10 and 100 < p["precip_mm"] < 1500 and 900 < p["et0_mm"] < 2500  # el NO árido llega a ~2050 mm de ET0


# ------------------------------------------------------------------ aptitud


def clim(ai, hot=10.0, frost=5.0, cv=15.0):
    return ZoneClimate(precip_mm=ai * 1300, et0_mm=1300, deficit_mm=1300 - ai * 1300, aridity_index=ai, hot_days=hot,
                       frost_days=frost, precip_cv_pct=cv, years_other_class_pct=0)


def test_alta_demanda_hidrica_nunca_alta_en_zona_seca(repo):
    for crop in repo.crops.values():
        if crop.water_requirement != Level.ALTO:
            continue
        for ai in (0.15, 0.3, 0.45):
            s = suitability(crop, clim(ai), Confidence.BAJA)
            assert s.level != Level.ALTO, (crop.id, ai)
            assert any("no puede tener aptitud alta" in r for r in s.reasons)
    assert suitability(repo.crops["maiz"], clim(0.3), Confidence.BAJA).level == Level.BAJO
    assert suitability(repo.crops["alfalfa"], clim(0.3), Confidence.BAJA).level == Level.MEDIO  # tolera sequía: sube, con tope
    assert suitability(repo.crops["maiz"], clim(0.8), Confidence.BAJA).level == Level.ALTO


def test_calor_y_heladas_bajan_la_aptitud_con_motivo(repo):
    trigo = repo.crops["trigo"]  # poco tolerante al calor, en el lote hasta diciembre
    assert suitability(trigo, clim(0.7, hot=30), Confidence.BAJA).level == Level.MEDIO
    assert suitability(trigo, clim(0.7, hot=50), Confidence.BAJA).level == Level.BAJO
    maiz = repo.crops["maiz"]  # poco tolerante a heladas pero no está en invierno: solo riesgo
    s = suitability(maiz, clim(0.8, frost=40), Confidence.BAJA)
    assert s.level == Level.ALTO and any("heladas" in r for r in s.risks)
    s = suitability(repo.crops["soja"], clim(0.6, cv=30), Confidence.BAJA)
    assert any("cambia mucho entre años" in r for r in s.risks)
    assert s.depends_on and "validación agronómica local" in s.note


def test_clima_de_la_otra_zona():
    c = shifted_climate(clim(0.52), "semiarido")
    assert classify(c.aridity_index) == "semiarido" and c.et0_mm == 1300 and c.precip_mm < 0.52 * 1300


# ------------------------------------------------------------------ suelo estimado

SG = {"properties": {"layers": [
    {"name": n, "unit_measure": {"d_factor": 10}, "depths": [{"label": lbl, "values": {"mean": v}} for lbl, v in vals]}
    for n, vals in {
        "clay": [("0-5cm", 100), ("5-15cm", 120), ("15-30cm", 140)],
        "sand": [("0-5cm", 650), ("5-15cm", 640), ("15-30cm", 620)],
        "silt": [("0-5cm", 250), ("5-15cm", 240), ("15-30cm", 240)],
        "soc": [("0-5cm", 90), ("5-15cm", 70), ("15-30cm", 50)],
    }.items()]}}


def test_parsea_soilgrids_y_estima_textura_y_materia_organica():
    v = parse_soilgrids(SG)
    assert v["clay"] == pytest.approx((10 * 5 + 12 * 10 + 14 * 15) / 30)
    est = build_estimate(v, DataStatus.LIVE, "SoilGrids", None, "x")
    assert est.texture_usda == "franco arenoso" and est.texture == SoilTexture.FRANCO_ARENOSA
    assert est.organic_matter_pct == pytest.approx(round(v["soc"] / 10 * 1.724, 2)) and est.organic_matter == Level.MEDIO
    assert est.label == "estimado" and est.resolution == "250 m"
    assert om_level(0.8) == Level.BAJO and om_level(3) == Level.ALTO and om_level(None) is None
    nodata = {"properties": {"layers": [{"name": "clay", "depths": [{"label": "0-5cm", "values": {"mean": None}}]}]}}
    assert parse_soilgrids(nodata)["clay"] is None


@pytest.mark.parametrize("s, si, c, t", [(92, 5, 3, "arenoso"), (82, 12, 6, "areno franco"), (40, 40, 20, "franco"),
                                         (20, 65, 15, "franco limoso"), (30, 35, 35, "franco arcilloso"), (20, 30, 50, "arcilloso")])
def test_triangulo_textural(s, si, c, t):
    assert usda_texture(s, si, c) == t


def test_cliente_de_soilgrids():
    httpx = pytest.importorskip("httpx")
    seen = []

    def handler(req):
        seen.append(req)
        return httpx.Response(200, json=SG) if float(req.url.params["lat"]) < 0 else httpx.Response(500)

    t = httpx.MockTransport(handler)
    assert http_fetcher(5, t)(-33.85, -65.2) == SG
    assert sorted(seen[0].url.params.get_list("property")) == ["clay", "sand", "silt", "soc"]
    with pytest.raises(UpstreamError):
        http_fetcher(5, t)(10, 10)


def test_respaldo_del_suelo(tmp_path):
    sample = SAMPLES_DIR / "soil_sample_san_luis.json"
    live = SoilProvider(tmp_path, sample, lambda lat, lon: SG)
    est, w = live.estimate(-33.85, -65.2)
    assert est.origin == DataStatus.LIVE and w == []
    assert live.estimate(-33.85, -65.2)[0].origin == DataStatus.CACHED

    def down(*_):
        raise UpstreamError("SoilGrids no respondió (ConnectError).")

    p = SoilProvider(tmp_path / "x", sample, down, Cooldown(300))
    est, w = p.estimate(-33.85, -65.2)
    assert est.origin == DataStatus.SAMPLE and "DATO DE MUESTRA" in est.note and any("MUESTRA SIMULADA" in x for x in w)
    none, w = SoilProvider(tmp_path / "y", None, down).estimate(-24.0, -65.0)
    assert none is None and any("No se estimó el suelo" in x for x in w)


# ------------------------------------------------------------------ perfil automático


def test_lo_cargado_por_el_productor_pisa_lo_estimado(repo, tmp_path):
    rr = RegionRepository(SAMPLES_DIR, repo.crops)
    soil = SoilProvider(tmp_path, SAMPLES_DIR / "soil_sample_san_luis.json")
    base = repo.get_field("campo-este")
    mine = Provenance(label="observado", note="Lo cargué yo.")
    field = base.model_copy(update={"soil_profile": SoilProfile(texture=SoilTexture.ARCILLOSA, provenance=mine)})
    out = build_auto_profile(field, rr, soil)
    assert out.soil_profile.texture == SoilTexture.ARCILLOSA  # no se pisa
    assert out.auto_profile.soil_estimate.texture == SoilTexture.FRANCO_ARENOSA  # la estimación queda a la vista
    assert out.auto_profile.soil_applied == ["materia orgánica"] and out.soil_profile.organic_matter == Level.MEDIO
    lab = field.model_copy(update={"soil_profile": SoilProfile(texture=SoilTexture.FRANCA, lab_analysis=True, provenance=mine)})
    out = build_auto_profile(lab, rr, soil)
    assert out.auto_profile.soil_applied == [] and out.soil_profile.organic_matter is None
    assert any("laboratorio" in w for w in out.auto_profile.warnings)


def test_perfil_completo_sin_suelo_cargado(repo, tmp_path):
    rr = RegionRepository(SAMPLES_DIR, repo.crops)
    field = repo.get_field("campo-centro").model_copy(update={"soil_profile": None})
    out = build_auto_profile(field, rr, SoilProvider(tmp_path, SAMPLES_DIR / "soil_sample_san_luis.json"))
    ap = out.auto_profile
    assert out.soil_profile.provenance.label == "estimado" and out.soil_profile.provenance.confidence == Confidence.BAJA
    assert ap.zone and ap.zone.zone and 3 <= len(ap.top_crops) <= 5
    assert all(c.level != Level.BAJO for c in ap.top_crops)
    assert ap.generated_at <= datetime.now(timezone.utc)


def test_perfil_sin_fuentes_queda_vacio_con_aviso(repo, tmp_path):
    rr = RegionRepository(tmp_path, repo.crops)  # sin límites ni zonas
    field = repo.get_field("campo-centro").model_copy(update={"soil_profile": None})
    out = build_auto_profile(field, rr, SoilProvider(tmp_path, None))
    assert out.soil_profile is None and out.auto_profile.soil_estimate is None and out.auto_profile.zone is None
    assert len(out.auto_profile.warnings) >= 2


# ------------------------------------------------------------------ API


def test_api_crear_campo_devuelve_el_perfil(client):
    r = client.post("/fields", json={"name": "Lote nuevo", "location": {"lat": -33.6, "lon": -65.4}, "area_ha": 120,
                                     "soil_profile": {"texture": "franca", "provenance": {"label": "observado"}}})
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["soil_profile"]["texture"] == "franca" and d["auto_profile"]["soil_estimate"]["texture"] == "franco_arenosa"
    assert d["auto_profile"]["zone"]["zone"]["zone_id"].startswith("san-luis-")
    assert client.get(f"/fields/{d['id']}").json()["data"]["auto_profile"] is not None


def test_api_zonas_y_aptitud(client):
    assert client.get("/regions/provinces").json()["data"]["features"]
    z = client.get("/regions/san-luis/zones").json()
    assert z["data"]["available"] and z["meta"]["data_status"] in ("cached", "sample")
    assert client.get("/regions/cordoba/zones").json()["data"]["available"] is False
    assert client.get("/regions/nada/zones").status_code == 404
    a = client.get("/zones/at", params={"lat": -33.85, "lon": -65.2}).json()["data"]
    assert a["province_id"] == "san-luis" and a["zone"] and a["transition"] is not None
    assert client.get("/zones/at", params={"lat": -40, "lon": -54}).status_code == 404
    s = client.get("/crops/suitability", params={"zone_id": "san-luis-semiarido"})
    assert s.status_code == 200 and all(c["note"] == "Requiere validación agronómica local." for c in s.json()["data"]["crops"])
    assert client.get("/crops/suitability", params={"zone_id": "san-luis-nada"}).status_code == 404


def test_api_humedad_satelital_del_lote(client):
    r = client.get("/fields/campo-este/soil-moisture")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["title"] == "Humedad del suelo satelital (contexto regional)" and "no es tiempo real" in d["context"]
    labels = {p["product"]: p["label"] for p in d["products"]}
    assert labels == {"SPL3SMP_E": "observado", "SPL4SMGP_rootzone": "modelado"}
    for p in d["products"]:
        assert p["last_observation"] and p["recent"] and p["origin"] == "sample"
    assert "Sensores propios" in d["sensors"]
    assert client.get("/fields/no-existe/soil-moisture").status_code == 404
