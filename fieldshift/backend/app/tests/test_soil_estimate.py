"""GET /soil/estimate: suelo estimado de un punto, para completar el formulario antes de guardar el campo."""

from app.api.deps import get_soil_provider
from app.services.soil.soilgrids import SoilProvider
from app.tests.conftest import SAMPLES_DIR
from app.tests.test_zones_profile import SG


def test_sin_soilgrids_devuelve_la_muestra_rotulada(client):
    # El cliente de los tests no tiene conexión: cae en la muestra simulada, rotulada como tal.
    r = client.get("/soil/estimate", params={"lat": -33.85, "lon": -65.20})
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["estimate"]["origin"] == "sample"
    assert body["data"]["distance_km"] == 0
    assert body["meta"]["data_status"] == "sample"
    assert "DATO DE MUESTRA" in body["data"]["estimate"]["note"]
    assert any("MUESTRA SIMULADA" in w for w in body["meta"]["warnings"])


def test_lejos_de_las_muestras_no_inventa_un_suelo(client):
    r = client.get("/soil/estimate", params={"lat": -50.0, "lon": -70.0})
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["estimate"] is None
    assert body["meta"]["origin_label"] == "SIN ESTIMACIÓN DE SUELO"
    assert any("No se estimó el suelo" in w for w in body["meta"]["warnings"])


def test_con_soilgrids_devuelve_textura_y_materia_organica(client, tmp_path):
    live = SoilProvider(tmp_path / "live", SAMPLES_DIR / "soil_sample_san_luis.json", lambda lat, lon: SG)
    client.app.dependency_overrides[get_soil_provider] = lambda: live
    r = client.get("/soil/estimate", params={"lat": -33.85, "lon": -65.20})
    d = r.json()["data"]["estimate"]
    assert d["origin"] == "live"
    assert d["label"] == "estimado"
    assert d["texture"] is not None and d["organic_matter"] in {"bajo", "medio", "alto"}
    assert d["source"].startswith("SoilGrids")
    # La segunda vez sale de la caché, sin volver a consultar.
    assert client.get("/soil/estimate", params={"lat": -33.85, "lon": -65.20}).json()["data"]["estimate"]["origin"] == "cached"


def test_valida_las_coordenadas(client):
    assert client.get("/soil/estimate", params={"lat": -95, "lon": -65}).status_code == 422


def _urbano_en_el_centro(lat0, lon0):
    """SoilGrids falso: sin datos en el punto pedido (pueblo), con datos alrededor."""
    calls = []

    def fetch(lat, lon):
        calls.append((round(lat, 4), round(lon, 4)))
        if abs(lat - lat0) < 1e-6 and abs(lon - lon0) < 1e-6:
            return {"properties": {"layers": []}}
        return SG

    return fetch, calls


def test_en_el_centro_del_pueblo_usa_los_alrededores_y_lo_dice(client, tmp_path):
    fetch, calls = _urbano_en_el_centro(-33.8634, -65.1781)
    client.app.dependency_overrides[get_soil_provider] = lambda: SoilProvider(tmp_path / "u", None, fetch)
    body = client.get("/soil/estimate", params={"lat": -33.8634, "lon": -65.1781}).json()
    d = body["data"]
    assert d["estimate"]["origin"] == "live"
    assert d["distance_km"] == 3
    assert "alrededores" in d["note"] and "Mové el punto" in d["note"]
    assert d["lat"] > -33.8634  # el primero que se prueba es al norte
    assert len(calls) == 2  # el centro y el primer punto con datos: no pide de más


def test_sin_alrededores_no_busca_mas_lejos(client, tmp_path):
    fetch, calls = _urbano_en_el_centro(-33.8634, -65.1781)
    client.app.dependency_overrides[get_soil_provider] = lambda: SoilProvider(tmp_path / "v", None, fetch)
    d = client.get("/soil/estimate", params={"lat": -33.8634, "lon": -65.1781, "alrededores": "false"}).json()["data"]
    assert d["estimate"] is None and d["distance_km"] == 0
    assert len(calls) == 1


def test_un_punto_sin_suelo_queda_en_cache_y_no_se_vuelve_a_preguntar(tmp_path):
    fetch, calls = _urbano_en_el_centro(-33.8634, -65.1781)
    p = SoilProvider(tmp_path / "w", None, fetch)
    assert p.estimate(-33.8634, -65.1781)[0] is None
    est, warnings = p.estimate(-33.8634, -65.1781)
    assert est is None and any("zona urbana" in w for w in warnings)
    assert len(calls) == 1  # la segunda vez sale de la caché


def test_al_guardar_en_el_centro_del_pueblo_se_usa_el_suelo_de_los_alrededores(tmp_path, repo):
    """Lo que el formulario mostró es lo que se guarda: misma regla de alrededores, aclarada en la procedencia."""
    from app.services.field_profile import build_auto_profile
    from app.services.regions.repository import RegionRepository

    fetch, _ = _urbano_en_el_centro(-33.8634, -65.1781)
    field = repo.get_field("campo-este").model_copy(update={"soil_profile": None})
    field = field.model_copy(update={"location": field.location.model_copy(update={"lat": -33.8634, "lon": -65.1781})})
    out = build_auto_profile(field, RegionRepository(SAMPLES_DIR, repo.crops), SoilProvider(tmp_path / "z", None, fetch))
    assert out.soil_profile is not None and out.soil_profile.texture is not None
    assert "alrededores" in out.soil_profile.provenance.note
    assert any("alrededores" in w for w in out.auto_profile.warnings)
