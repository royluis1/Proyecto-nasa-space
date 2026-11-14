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
    assert len(body["data"]) >= 16
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
    data = body["data"]
    ranking = data["ranking"]
    assert len(ranking) >= 3 and [s["rank"] for s in ranking] == list(range(1, len(ranking) + 1))
    assert {ev["rotation"]["strategy"] for ev in data["evaluations"]} >= {"actual", "mixta", "agua", "suelo"}
    assert data["recommended_rotation_id"] == ranking[0]["rotation_id"]
    assert body["meta"]["data_status"] == "sample" and body["meta"]["origin_label"] == "DATO DE MUESTRA"
    assert any("por defecto" in w for w in body["meta"]["warnings"])
    ev = data["evaluations"][0]
    assert ev["recommendation"]["why"] and ev["recommendation"]["validation_note"]
    assert ev["recommendation"]["disclaimer"] == DISCLAIMER


def test_comparar_con_prioridades_escenario_y_sensores(client):
    req = {
        "field_id": "campo-centro",
        "priorities": {"water": 10, "soil": 2, "risk": 5, "income": 2, "sustainability": 2},
        "scenario": {"id": "seco", "name": "seco", "rain_delta_pct": -20, "temp_delta_c": 1},
        "history": ["sorgo", "girasol", "girasol"],
        "soil_moisture": {"product": "SMAP_L3", "anomaly_pct": -30},
        "vegetation": {"bare_soil_fraction": 0.6},
    }
    data = client.post("/rotations/compare", json=req).json()["data"]
    assert data["weights"]["agua"] > 0.4
    assert data["inputs"]["climate"]["scenario_precip_mm"] < data["inputs"]["climate"]["annual_precip_mm"]
    assert {"smap", "modis-ndvi"} <= {s["id"] for s in data["sources"]}
    assert any("monocultivo reciente" in w for w in data["warnings"])


def test_comparar_solo_algunas_estrategias(client):
    req = {"field_id": "campo-conlara", "strategies": ["agua", "rentabilidad"]}
    data = client.post("/rotations/compare", json=req).json()["data"]
    assert {ev["rotation"]["strategy"] for ev in data["evaluations"]} == {"actual", "agua", "rentabilidad"}


def test_comparar_errores(client):
    pocas = {"field_id": "campo-este", "strategies": ["agua"]}
    assert_error(client.post("/rotations/compare", json=pocas), 400, "INVALID_INPUT")
    historial = {"field_id": "campo-este", "history": ["papa"]}
    assert_error(client.post("/rotations/compare", json=historial), 400, "INVALID_INPUT")
    ajena = {"field_id": "campo-este", "rotation_ids": ["campo-centro-actual"]}
    assert_error(client.post("/rotations/compare", json=ajena), 400, "INVALID_INPUT")
    escenario = {"field_id": "campo-este", "scenario": {"rain_delta_pct": -90}}
    assert_error(client.post("/rotations/compare", json=escenario), 422, "VALIDATION_ERROR")
    assert_error(client.post("/rotations/compare", json={"field_id": "nada"}), 404, "FIELD_NOT_FOUND")


def test_detalle_rotacion(client):
    body = client.get("/rotations/campo-este-suelo").json()
    assert body["data"]["rotation"]["strategy"] == "suelo"
    assert body["data"]["profile"]["sequence"]
    assert client.get("/rotations/campo-este-actual").json()["data"]["rotation"]["strategy"] == "actual"
    assert_error(client.get("/rotations/nada"), 404, "ROTATION_NOT_FOUND")
    assert_error(client.get("/rotations/campo-este-inventada"), 404, "ROTATION_NOT_FOUND")


def test_escenarios(client):
    req = {"field_id": "campo-centro", "scenarios": [
        {"id": "base", "name": "base"},
        {"id": "s", "name": "seco", "rain_delta_pct": -30, "temp_delta_c": 2},
    ]}
    body = client.post("/scenarios", json=req).json()
    base, seco = body["data"]
    assert base["ranking"] and seco["ranking"] and seco["recommended_rotation_id"]
    totals = {s["rotation_id"]: s["total"] for s in base["ranking"]}
    assert all(s["total"] < totals[s["rotation_id"]] for s in seco["ranking"])
    req["scenarios"][0]["rain_delta_pct"] = -90
    assert_error(client.post("/scenarios", json=req), 422, "VALIDATION_ERROR")


def test_exportar(client):
    data = client.get("/export/report", params={"field_id": "campo-este"}).json()["data"]
    assert data["disclaimer"] == DISCLAIMER and data["sources"] and data["assumptions"]
    assert set(data["explanations"]) == {s["rotation_id"] for s in data["ranking"]}
    r = client.get("/export/report", params={"field_id": "campo-este", "format": "csv"})
    assert r.headers["content-type"].startswith("text/csv")
    assert DISCLAIMER in r.text and "DATO DE MUESTRA" in r.text and "explicacion" in r.text
    assert_error(client.get("/export/report", params={"field_id": "campo-este", "format": "pdf"}), 422, "VALIDATION_ERROR")


def test_listar_lotes(client):
    body = client.get("/fields").json()
    assert {f["id"] for f in body["data"]} >= {"campo-este", "campo-centro", "campo-conlara"}


def test_crear_lote_completo_y_compararlo(client):
    lote = {
        "name": "Lote del mapa", "location": {"lat": -33.70, "lon": -65.40, "slope_pct": 1.5}, "area_ha": 120,
        "current_crop": "soja", "crop_history": ["maiz", "soja"], "drainage": "medio", "budget": "bajo",
        "soil_profile": {"texture": "arenosa", "organic_matter": "bajo", "provenance": {"label": "estimado"}},
        "boundary": {"type": "Polygon", "coordinates": [[[-65.41, -33.69], [-65.39, -33.69], [-65.39, -33.71], [-65.41, -33.69]]]},
    }
    r = client.post("/fields", json=lote)
    assert r.status_code == 201, r.text
    field = r.json()["data"]
    assert field["boundary"]["type"] == "Polygon" and field["budget"] == "bajo"
    data = client.post("/rotations/compare", json={"field_id": field["id"]}).json()["data"]
    assert data["inputs"]["current_crop"] == "soja"
    actual = next(e for e in data["evaluations"] if e["rotation"]["strategy"] == "actual")
    assert [s["crop_id"] for s in actual["rotation"]["steps"]] == ["maiz", "soja"]


def test_crear_lote_invalido(client):
    base = {"name": "X", "location": {"lat": -33.7, "lon": -65.4}, "area_ha": 10}
    assert_error(client.post("/fields", json={**base, "crop_history": ["papa"]}), 400, "INVALID_INPUT")
    abierto = {"type": "Polygon", "coordinates": [[[-65.41, -33.69], [-65.39, -33.69], [-65.39, -33.71], [-65.40, -33.70]]]}
    assert_error(client.post("/fields", json={**base, "boundary": abierto}), 422, "VALIDATION_ERROR")


def test_actualizar_lote(client):
    base = client.get("/fields/campo-este").json()["data"]
    cambios = {
        "name": "Campo Este (editado)", "location": base["location"], "area_ha": 640, "irrigated": True,
        "current_crop": "maiz", "crop_history": ["soja", "maiz"], "drainage": "alto",
    }
    r = client.put("/fields/campo-este", json=cambios)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["area_ha"] == 640 and data["irrigated"] is True and data["current_rotation_id"] == "campo-este-actual"
    assert client.get("/fields/campo-este").json()["data"]["name"] == "Campo Este (editado)"
    assert_error(client.put("/fields/nada", json=cambios), 404, "FIELD_NOT_FOUND")
    assert_error(client.put("/fields/campo-este", json={**cambios, "current_crop": "papa"}), 400, "INVALID_INPUT")
    assert_error(client.put("/fields/campo-este", json={**cambios, "area_ha": -1}), 422, "VALIDATION_ERROR")


def test_cors_permite_put(client):
    r = client.options("/fields/campo-este", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "PUT"})
    assert r.status_code == 200 and "PUT" in r.headers["access-control-allow-methods"]
