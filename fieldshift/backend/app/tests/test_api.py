"""Tests de la API. Requieren fastapi y httpx (si faltan, se saltean)."""

from app.models.constants import DISCLAIMER


def assert_error(resp, status, code):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert body["error"]["message"]
    assert body["error"]["request_id"]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    assert "X-Request-ID" in r.headers


def test_docs_disponibles(client):
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    for p in ["/health", "/crops", "/fields", "/fields/{field_id}", "/priorities", "/climate-summary",
              "/rotations/compare", "/rotations/{rotation_id}", "/scenarios", "/export/report"]:
        assert p in paths, p


def test_crops_con_advertencia(client):
    body = client.get("/crops").json()
    assert len(body["data"]) >= 8
    assert body["meta"]["disclaimer"] == DISCLAIMER
    assert body["meta"]["data_status"] == "sample"


def test_obtener_lote(client):
    body = client.get("/fields/campo-este").json()
    assert body["data"]["location"]["lat"] == -33.85
    assert body["meta"]["warnings"]  # avisa que es ilustrativo


def test_lote_inexistente(client):
    assert_error(client.get("/fields/no-existe"), 404, "FIELD_NOT_FOUND")


def test_ruta_inexistente_mismo_formato(client):
    assert_error(client.get("/no-existe"), 404, "NOT_FOUND")


def test_crear_lote_y_recuperarlo(client):
    r = client.post("/fields", json={"name": "Lote A", "location": {"lat": -33.123456, "lon": -65.5}, "area_ha": 100})
    assert r.status_code == 201
    field = r.json()["data"]
    assert field["location"]["lat"] == -33.1235
    assert client.get(f"/fields/{field['id']}").status_code == 200


def test_lote_fuera_de_san_luis_avisa(client):
    r = client.post("/fields", json={"name": "BA", "location": {"lat": -34.6, "lon": -58.4}, "area_ha": 10})
    assert r.status_code == 201
    assert any("fuera de San Luis" in w for w in r.json()["meta"]["warnings"])


def test_coordenadas_invalidas(client):
    r = client.post("/fields", json={"name": "X", "location": {"lat": 95, "lon": 0}, "area_ha": 10})
    assert_error(r, 422, "VALIDATION_ERROR")
    assert any("lat" in d["campo"] for d in r.json()["error"]["details"])


def test_prioridades(client):
    ok = client.post("/priorities", json={"field_id": "campo-este", "priorities": {"water": 10}})
    assert ok.status_code == 200 and ok.json()["data"]["is_default"] is False
    bad = client.post("/priorities", json={"field_id": "campo-este", "priorities": {"water": 11}})
    assert_error(bad, 422, "VALIDATION_ERROR")
    assert_error(client.post("/priorities", json={"field_id": "nada", "priorities": {}}), 404, "FIELD_NOT_FOUND")


def test_climate_summary_con_muestra(client):
    req = {"latitude": -33.85, "longitude": -65.2, "start_date": "2015-01-01", "end_date": "2025-12-31"}
    body = client.post("/climate-summary", json=req).json()
    assert body["meta"]["data_status"] == "sample"
    assert body["meta"]["origin_label"] == "DATO DE MUESTRA"
    data = body["data"]
    assert len(data["daily"]) == 4018 and len(data["monthly"]) == 132 and len(data["annual"]) == 11
    assert data["source"]["origin_label"] == "DATO DE MUESTRA"
    assert data["precipitation"]["mean_annual_mm"] > 0
    assert data["trends"]["precipitation"]["n_years"] == 11


def test_climate_summary_por_lote_sin_diaria(client):
    req = {"field_id": "campo-centro", "start_date": "2020-01-01", "end_date": "2021-12-31", "include_daily": False}
    data = client.post("/climate-summary", json=req).json()["data"]
    assert data["daily"] is None and data["field_id"] == "campo-centro"


def test_climate_summary_valida_fechas_y_coordenadas(client):
    base = {"latitude": -33.85, "longitude": -65.2}
    invertido = {**base, "start_date": "2025-01-01", "end_date": "2015-01-01"}
    assert_error(client.post("/climate-summary", json=invertido), 422, "VALIDATION_ERROR")
    futuro = {**base, "start_date": "2025-01-01", "end_date": "2099-01-01"}
    assert_error(client.post("/climate-summary", json=futuro), 422, "VALIDATION_ERROR")
    lat_mal = {"latitude": 95, "longitude": 0, "start_date": "2020-01-01", "end_date": "2020-12-31"}
    assert_error(client.post("/climate-summary", json=lat_mal), 422, "VALIDATION_ERROR")


def test_climate_summary_sin_datos_da_503(client):
    req = {"latitude": -34.6, "longitude": -58.4, "start_date": "2020-01-01", "end_date": "2020-12-31"}
    assert_error(client.post("/climate-summary", json=req), 503, "NO_DATA_AVAILABLE")


def test_comparar_rotaciones(client):
    body = client.post("/rotations/compare", json={"field_id": "campo-este"}).json()
    ranking = body["data"]["ranking"]
    assert [s["rank"] for s in ranking] == [1, 2, 3]
    assert body["meta"]["data_status"] == "mock"
    assert any("por defecto" in w for w in body["meta"]["warnings"])


def test_comparar_exige_actual_y_minimo_tres(client):
    pocas = {"field_id": "campo-este", "rotation_ids": ["campo-este-actual", "campo-este-agua"]}
    assert_error(client.post("/rotations/compare", json=pocas), 400, "INVALID_INPUT")
    ajena = {"field_id": "campo-este", "rotation_ids": ["campo-este-actual", "campo-este-agua", "campo-centro-suelo"]}
    assert_error(client.post("/rotations/compare", json=ajena), 400, "INVALID_INPUT")


def test_detalle_rotacion(client):
    body = client.get("/rotations/campo-este-suelo").json()
    assert body["data"]["rotation"]["strategy"] == "suelo"
    assert_error(client.get("/rotations/nada"), 404, "ROTATION_NOT_FOUND")


def test_escenarios(client):
    req = {"field_id": "campo-centro", "scenarios": [{"id": "s", "name": "seco", "rain_delta_pct": -20}]}
    assert client.post("/scenarios", json=req).status_code == 200
    req["scenarios"][0]["rain_delta_pct"] = -90
    assert_error(client.post("/scenarios", json=req), 422, "VALIDATION_ERROR")


def test_exportar(client):
    assert client.get("/export/report", params={"field_id": "campo-este"}).json()["data"]["disclaimer"] == DISCLAIMER
    r = client.get("/export/report", params={"field_id": "campo-este", "format": "csv"})
    assert r.headers["content-type"].startswith("text/csv")
    assert DISCLAIMER in r.text
    assert_error(client.get("/export/report", params={"field_id": "campo-este", "format": "pdf"}), 422, "VALIDATION_ERROR")
