"""Búsqueda de ciudades y pueblos, y localidad más cercana a un punto."""

import json

import pytest

from app.services.localities import LocalityIndex, load_index, normalize

ROWS = [
    {"nombre": "Justo Daract", "provincia": "San Luis", "departamento": "General Pedernera", "tipo": "Localidad simple",
     "lat": -33.86337, "lon": -65.17806, "orden": 1},
    {"nombre": "Villa Salles", "provincia": "San Luis", "departamento": "General Pedernera", "tipo": "Localidad simple",
     "lat": -33.86, "lon": -65.22, "orden": 1},
    {"nombre": "Villa Mercedes", "provincia": "San Luis", "departamento": "General Pedernera", "tipo": "Localidad compuesta",
     "lat": -33.67, "lon": -65.46, "orden": 0},
    {"nombre": "Córdoba", "provincia": "Córdoba", "departamento": "Capital", "tipo": "Localidad compuesta",
     "lat": -31.42, "lon": -64.18, "orden": 0},
]


@pytest.fixture
def index(tmp_path):
    p = tmp_path / "loc.json"
    p.write_text(json.dumps({"source": {"name": "IGN"}, "localities": ROWS}), encoding="utf-8")
    return LocalityIndex.from_file(p)


def test_normalize_saca_tildes_y_mayusculas():
    assert normalize("Córdoba") == "cordoba"


def test_busca_sin_tildes(index):
    assert [l.nombre for l in index.search("cordoba")] == ["Córdoba"]


def test_primero_las_que_empiezan_igual(index):
    # "villa" coincide con dos; ordena por tamaño (Localidad compuesta primero).
    assert [l.nombre for l in index.search("villa")] == ["Villa Mercedes", "Villa Salles"]


def test_busca_por_el_medio_del_nombre(index):
    assert [l.nombre for l in index.search("daract")] == ["Justo Daract"]


def test_filtra_por_provincia(index):
    assert index.search("cordoba", provincia="San Luis") == []


def test_consulta_vacia_no_devuelve_todo(index):
    assert index.search("  ") == []


def test_mas_cercana(index):
    loc, km = index.nearest(-33.85, -65.20)
    assert loc.nombre == "Villa Salles"
    assert km < 3


def test_sin_localidades_cerca_devuelve_none(index):
    assert index.nearest(-50.0, -70.0) is None


def test_respeta_el_radio(index):
    assert index.nearest(-33.85, -65.20, max_km=0.5) is None


def test_archivo_que_no_existe_no_rompe(tmp_path):
    assert load_index(tmp_path / "no_esta.json").localities == []


def test_endpoint_busqueda(client):
    r = client.get("/localidades", params={"q": "daract"})
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["results"][0]["nombre"] == "Justo Daract"
    assert body["data"]["results"][0]["label"] == "Justo Daract, San Luis"


def test_endpoint_busqueda_exige_dos_letras(client):
    assert client.get("/localidades", params={"q": "a"}).status_code == 422


def test_endpoint_cercana(client):
    r = client.get("/localidades/cerca", params={"lat": -33.9265, "lon": -65.0721})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["locality"]["provincia"] == "San Luis"
    assert d["distance_km"] > 0
    assert "Justo Daract" in d["text"]


def test_endpoint_cercana_en_el_mar_no_encuentra(client):
    d = client.get("/localidades/cerca", params={"lat": -40.0, "lon": -50.0}).json()["data"]
    assert d["locality"] is None
    assert "No encontramos" in d["text"]
