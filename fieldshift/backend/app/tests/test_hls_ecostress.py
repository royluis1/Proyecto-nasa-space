"""Landsat/HLS por sectores, ECOSTRESS y AppEEARS con varios puntos. Sin red."""

from datetime import date, datetime, timezone

import pytest

from app.models.enums import DataStatus
from app.services.satellite.parsers import parse_csv
from app.services.satellite.products import PRODUCTS
from app.services.satellite.provider import SatelliteProvider
from app.services.satellite.sectors import BARE_NDVI, sector_points, summarize_sectors
from app.tests.conftest import SAMPLES_DIR

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def test_grilla_de_3x3_sobre_el_lote():
    pts = sector_points(-33.85, -65.2, 400)
    assert [p.id for p in pts] == [f"s{i}" for i in range(1, 10)]
    by = {p.name: p for p in pts}
    assert by["Norte"].lat > by["Centro"].lat > by["Sur"].lat and by["Oeste"].lon < by["Centro"].lon < by["Este"].lon
    assert by["Centro"].lat == pytest.approx(-33.85) and by["Centro"].lon == pytest.approx(-65.2)
    # 400 ha = 2 km de lado: los sectores quedan a 2/3 km del centro
    assert (by["Norte"].lat - by["Centro"].lat) * 111.32 == pytest.approx(2 / 3, rel=0.01)


def test_con_poligono_solo_los_sectores_de_adentro():
    tri = {"type": "Polygon", "coordinates": [[[-65.3, -33.9], [-65.1, -33.9], [-65.3, -33.7], [-65.3, -33.9]]]}
    pts = sector_points(-33.8, -65.2, 300, tri)
    assert 3 <= len(pts) < 9 and "Noreste" not in [p.name for p in pts]


def test_sector_mas_debil_y_lectura():
    pts = sector_points(-33.85, -65.2, 400)
    series = {p.id: [0.6, 0.55, 0.5, 0.65] for p in pts}
    series["s9"] = [0.4, 0.2, 0.25, 0.45]  # sureste: menos verdor y suelo desnudo
    series["s1"] = []
    rows, weakest, barest, reading = summarize_sectors(pts, series)
    s9 = next(r for r in rows if r.id == "s9")
    assert weakest == barest == "s9" and s9.vigor == "más débil" and s9.bare_pct == 50.0
    assert "Sureste" in reading and "menos de verdor" in reading
    assert next(r for r in rows if r.id == "s1").observations == 0
    same = {p.id: [0.5, 0.52] for p in pts}
    assert "parecido" in summarize_sectors(pts, same)[3]
    assert BARE_NDVI == 0.3


def test_parser_hls_escala_y_ecostress_descarta_nubes():
    hls = "ID,Latitude,Longitude,Date,HLSL30_VI_020_NDVI\na,-33.85,-65.2,2025-01-01,6500\na,-33.85,-65.2,2025-01-09,-19999\n"
    s = parse_csv(hls, PRODUCTS["HLSL30_VI"], -33.85, -65.2)
    assert s.df["value"].dropna().tolist() == pytest.approx([0.65]) and s.scaled
    eco = ("ID,Latitude,Longitude,Date,ECO_L2T_LSTE_002_LST,ECO_L2T_LSTE_002_cloud\n"
           "a,-33.85,-65.2,2025-01-01T15:00:00,320.5,0\na,-33.85,-65.2,2025-01-03T11:00:00,290.0,1\n")
    e = parse_csv(eco, PRODUCTS["ECO_L2T_LSTE"], -33.85, -65.2)
    assert e.df["value"].dropna().tolist() == [320.5] and e.bad_quality == 1


def test_productos_con_etiqueta_y_capas_verificadas():
    assert PRODUCTS["HLSL30_VI"].appeears_id == "HLSL30_VI.020" and PRODUCTS["HLSL30_VI"].label.value == "observado"
    assert PRODUCTS["ECO_L2T_LSTE"].layer == "LST" and PRODUCTS["ECO_L2T_LSTE"].qa_layer == "cloud"
    assert PRODUCTS["ECO_L4T_ESI"].label.value == "modelado"


class FakeClient:
    def __init__(self, csv_text):
        self.csv, self.calls, self.bodies = csv_text, [], []

    def submit_point_task(self, name, pid, layers, lat, lon, start, end, point_id="lote", points=None):
        self.bodies.append({"points": points, "layers": layers, "product": pid})
        return "tarea-1"

    def task_status(self, task_id):
        return "done"

    def download_csv(self, task_id, layer):
        return self.csv


def test_varios_puntos_en_una_tarea_y_cache(tmp_path):
    pts = [("s1", -33.84, -65.21), ("s2", -33.86, -65.19)]
    csv = ("ID,Latitude,Longitude,Date,HLSL30_VI_020_NDVI\n"
           "s1,-33.84,-65.21,2025-01-01,6000\ns2,-33.86,-65.19,2025-01-01,3000\n")
    fake = FakeClient(csv)
    prov = SatelliteProvider(tmp_path, {}, lambda: fake, now=lambda: NOW)
    from app.utils.exceptions import NoDataError

    with pytest.raises(NoDataError):  # primera vez: se pide la tarea; sin muestra, todavía no hay datos
        prov.get_points(PRODUCTS["HLSL30_VI"], pts, date(2024, 1, 1), date(2025, 6, 1))
    assert fake.bodies[0]["points"] == pts and fake.bodies[0]["layers"] == ["NDVI"]
    done = prov.get_points(PRODUCTS["HLSL30_VI"], pts, date(2024, 1, 1), date(2025, 6, 1))
    assert done.status == DataStatus.LIVE and done.series["s1"].df["value"].iloc[0] == pytest.approx(0.6)
    again = prov.get_points(PRODUCTS["HLSL30_VI"], pts, date(2024, 1, 1), date(2025, 6, 1))
    assert again.status == DataStatus.CACHED and set(again.series) == {"s1", "s2"}


def test_cliente_appeears_manda_todos_los_puntos():
    httpx = pytest.importorskip("httpx")
    from app.services.satellite.appeears import AppEEARSClient

    seen = []

    def handler(req):
        seen.append(req)
        return httpx.Response(200, json={"task_id": "t-9"})

    c = AppEEARSClient(token="tok", transport=httpx.MockTransport(handler))
    tid = c.submit_point_task("x", "HLSL30_VI.020", ["NDVI"], 0, 0, date(2024, 1, 1), date(2024, 2, 1),
                              points=[("s1", -33.8, -65.2), ("s2", -33.9, -65.1)])
    import json

    body = json.loads(seen[0].content)
    assert tid == "t-9" and [c["id"] for c in body["params"]["coordinates"]] == ["s1", "s2"]


def test_muestra_rotulada_solo_si_coinciden_los_puntos(tmp_path):
    prov = SatelliteProvider(tmp_path, {"HLSL30_VI": SAMPLES_DIR / "hls_sectors_sample_san_luis.csv"}, None, now=lambda: NOW)
    pts = [(p.id, p.lat, p.lon) for p in sector_points(-33.85, -65.2, 500)]
    d = prov.get_points(PRODUCTS["HLSL30_VI"], pts, date(2024, 11, 1), date(2026, 11, 1))
    assert d.status == DataStatus.SAMPLE and len(d.series) == 9 and any("SIMULADOS" in w for w in d.warnings)
    far = [("s1", -33.7, -65.0)]  # otro lote: no se le asigna la serie de un sector de ejemplo
    with pytest.raises(Exception):
        prov.get_points(PRODUCTS["HLSL30_VI"], far, date(2024, 11, 1), date(2026, 11, 1))


def test_api_sectores_y_calor(client):
    s = client.get("/fields/campo-este/sectors")
    assert s.status_code == 200
    d = s.json()["data"]
    assert len(d["sectors"]) == 9 and d["weakest"] and d["label"] == "observado" and d["origin"] == "sample"
    h = client.get("/fields/campo-este/heat-stress").json()["data"]
    assert h["lst"]["label"] == "observado" and h["esi"]["label"] == "modelado"
    assert 20 < h["lst_summer_mean_c"] < 60 and h["stress_level"] in ("bajo", "medio", "alto")
    assert client.get("/fields/no-existe/sectors").status_code == 404
