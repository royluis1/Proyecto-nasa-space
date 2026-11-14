"""Earthdata Login (descarga con redirección a URS) y relieve SRTM. Sin red: el servidor se simula con httpx.MockTransport."""

import io
import zipfile
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import numpy as np
import pytest

httpx = pytest.importorskip("httpx")

from app.models.enums import DataStatus  # noqa: E402
from app.services.earthdata.session import (  # noqa: E402
    URS_HOST,
    EarthdataAuthError,
    EarthdataCredentials,
    EarthdataSession,
    credentials_from_settings,
)
from app.services.power.service import Cooldown  # noqa: E402
from app.services.terrain.service import TerrainProvider, default_radius, terrain_for_field  # noqa: E402
from app.services.terrain.srtm import read_hgt, read_hgt_zip, slope_class, terrain_stats, tile_name, tile_origin  # noqa: E402
from app.tests.conftest import SAMPLES_DIR  # noqa: E402
from app.utils.exceptions import NoDataError, UpstreamError  # noqa: E402

DATA = "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/SRTMGL1.003/S34W066.SRTMGL1.hgt/S34W066.SRTMGL1.hgt.zip"
S3 = "https://bucket.s3.us-west-2.amazonaws.com/S34W066.zip?firma=abc"
USER, PASSWORD = "agricultor", "clave-secreta"


# ---------------------------------------------------------------- SRTM puro


def plane_tile(n=1201, grade=0.05, void=None):
    """Baldosa con un plano que sube hacia el sur con la pendiente `grade` (0,05 = 5 %)."""
    dy = 111_320.0 / (n - 1)
    rows = np.arange(n)[:, None] * np.ones((1, n))
    z = (500 + rows * dy * grade).round().astype(">i2")
    if void is not None:
        z[void] = -32768
    return z.tobytes()


def zipped(hgt: bytes, name="S34W066.hgt") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(name, hgt)
    return buf.getvalue()


@pytest.mark.parametrize(
    "lat, lon, name",
    [(-33.85, -65.2, "S34W066"), (-32.45, -65.25, "S33W066"), (0.5, 6.2, "N00E006"), (45.0, -0.5, "N45W001"), (-0.1, 0.1, "S01E000")],
)
def test_nombre_de_baldosa(lat, lon, name):
    assert tile_name(lat, lon) == name
    la, lo = tile_origin(name)
    assert la <= lat < la + 1 and lo <= lon < lo + 1


def test_lee_hgt_big_endian_y_vacios():
    dem = read_hgt(plane_tile(void=(slice(0, 1), slice(0, 5))))
    assert dem.shape == (1201, 1201)
    assert np.isnan(dem[0, :5]).all() and dem[1, 0] == pytest.approx(505, abs=1)
    with pytest.raises(ValueError):
        read_hgt(b"\x00" * 100)
    with pytest.raises(ValueError):
        read_hgt_zip(zipped(b"", "leame.txt"))


def test_pendiente_de_un_plano_conocido():
    dem = read_hgt(plane_tile(grade=0.05))
    st = terrain_stats(dem, "S34W066", -33.5, -65.5, 600)
    assert st.slope_mean_pct == pytest.approx(5.0, abs=0.15)
    assert st.slope_p90_pct == pytest.approx(5.0, abs=0.6)  # los .hgt guardan metros enteros
    assert st.elevation_max_m - st.elevation_min_m == pytest.approx(2 * 600 * 0.05, rel=0.25)
    assert st.resolution_m == pytest.approx(92.8, abs=0.1) and not st.clipped


def test_plano_horizontal_y_poligono():
    dem = read_hgt(plane_tile(grade=0.0))
    ring = [(-65.52, -33.48), (-65.48, -33.48), (-65.48, -33.52), (-65.52, -33.52), (-65.52, -33.48)]
    st = terrain_stats(dem, "S34W066", -33.5, -65.5, 0, ring)
    assert st.slope_max_pct == 0 and st.elevation_mean_m == 500
    # el polígono (~3,7 x 4,4 km) cubre muchos más píxeles que un círculo chico
    assert st.pixels > terrain_stats(dem, "S34W066", -33.5, -65.5, 300).pixels * 10


def test_borde_de_baldosa_y_vacios():
    dem = read_hgt(plane_tile())
    assert terrain_stats(dem, "S34W066", -33.001, -65.5, 500).clipped
    hole = read_hgt(plane_tile(void=(slice(500, 700), slice(500, 700))))
    with pytest.raises(ValueError, match="vacíos"):
        terrain_stats(hole, "S34W066", -33.5, -65.5, 400)


@pytest.mark.parametrize("pct, cls", [(0.3, "plano"), (2, "suave"), (5, "moderada"), (12, "fuerte")])
def test_clases_de_pendiente(pct, cls):
    assert slope_class(pct) == cls


# ---------------------------------------------------------------- Earthdata Login


def urs_server(log, accept=True, html_at_end=False, s3_status=200):
    """Simula LP DAAC -> URS (login) -> LP DAAC (cookie) -> S3 firmado."""

    def handler(request: httpx.Request) -> httpx.Response:
        log.append(request)
        host = request.url.host
        if host == "data.lpdaac.earthdatacloud.nasa.gov" and "code" not in request.url.params:
            if request.headers.get("cookie", "").find("sesion=ok") >= 0:
                return httpx.Response(302, headers={"location": S3})
            if request.headers.get("authorization", "").startswith("Bearer "):
                return httpx.Response(302, headers={"location": S3})
            return httpx.Response(302, headers={"location": f"https://{URS_HOST}/oauth/authorize?client_id=lp&redirect_uri=x"})
        if host == URS_HOST:
            auth = request.headers.get("authorization", "")
            if not auth:
                return httpx.Response(401)
            if not accept:
                return httpx.Response(401)
            return httpx.Response(302, headers={"location": "https://data.lpdaac.earthdatacloud.nasa.gov/redirect?code=123"})
        if host == "data.lpdaac.earthdatacloud.nasa.gov":  # vuelta de URS con el código
            return httpx.Response(302, headers={"location": DATA, "set-cookie": "sesion=ok; Path=/"})
        if host.endswith("amazonaws.com"):
            if html_at_end:
                return httpx.Response(200, headers={"content-type": "text/html"}, text="<html>Aprobar aplicación</html>")
            return httpx.Response(s3_status, headers={"content-type": "application/zip"}, content=zipped(plane_tile()))
        return httpx.Response(404)

    return httpx.MockTransport(handler)


def session(log, creds=None, **kw):
    creds = creds or EarthdataCredentials(username=USER, password=PASSWORD)
    return EarthdataSession(creds, transport=urs_server(log, **kw))


def test_descarga_con_usuario_y_clave_pasando_por_urs(tmp_path):
    log = []
    dest = session(log).download(DATA, tmp_path / "S34W066.zip", expect=(".zip",))
    assert read_hgt_zip(dest.read_bytes()).shape == (1201, 1201)
    hosts = [r.url.host for r in log]
    assert URS_HOST in hosts and hosts[-1].endswith("amazonaws.com")
    for r in log:  # la clave solo viaja a URS; nunca al servidor de datos ni a S3
        has_auth = "authorization" in r.headers
        assert has_auth == (r.url.host == URS_HOST), r.url
    assert not list(tmp_path.glob("*.part"))


def test_descarga_con_token_no_lo_manda_a_s3(tmp_path):
    log = []
    session(log, EarthdataCredentials(token="tok-123")).download(DATA, tmp_path / "t.zip")
    assert log[0].headers["authorization"] == "Bearer tok-123"
    assert "authorization" not in log[-1].headers and log[-1].url.host.endswith("amazonaws.com")


def test_credenciales_rechazadas(tmp_path):
    with pytest.raises(EarthdataAuthError, match="rechazó las credenciales"):
        session([], accept=False).download(DATA, tmp_path / "x.zip")
    assert not (tmp_path / "x.zip").exists()


def test_pagina_html_en_vez_del_archivo(tmp_path):
    with pytest.raises(EarthdataAuthError, match="Authorized Apps"):
        session([], html_at_end=True).download(DATA, tmp_path / "x.zip")


def test_error_del_servidor_de_archivos(tmp_path):
    with pytest.raises(UpstreamError, match="404"):
        session([], s3_status=404).download(DATA, tmp_path / "x.zip")


def test_sin_credenciales_no_crea_sesion():
    with pytest.raises(EarthdataAuthError, match="Faltan credenciales"):
        EarthdataSession(EarthdataCredentials())


def test_credenciales_desde_la_configuracion_y_sin_mostrar_secretos():
    from pydantic import SecretStr

    s = SimpleNamespace(earthdata_token=None, earthdata_username=None, earthdata_password=None,
                        appeears_username="u", appeears_password=SecretStr("p"))
    creds = credentials_from_settings(s)
    assert creds.method == "usuario" and creds.username == "u"  # usa la cuenta de AppEEARS
    assert "p" not in repr(creds).replace("method", "") and "u'" not in repr(creds)
    s.earthdata_token = SecretStr("tok")
    assert credentials_from_settings(s).method == "token"


# ---------------------------------------------------------------- proveedor de relieve


class FakeSession:
    def __init__(self, blob=None, error=None):
        self.blob, self.error, self.downloads = blob, error, 0

    def get_json(self, url, params=None):
        return {"feed": {"entry": [{"links": [{"href": DATA}]}]}}

    def download(self, url, dest, expect=()):
        self.downloads += 1
        if self.error:
            raise self.error
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(self.blob)
        return dest

    def close(self):
        pass


SAMPLE = SAMPLES_DIR / "srtm_sample_san_luis.json"


def test_sin_credenciales_usa_la_muestra_y_lo_avisa(tmp_path):
    summary, warnings = TerrainProvider(tmp_path, SAMPLE).get(-33.85, -65.2, 300)
    assert summary.origin == DataStatus.SAMPLE and summary.slope_class == "plano"
    assert any("MUESTRA SIMULADA" in w for w in warnings) and any("sin credenciales" in w for w in warnings)


def test_en_vivo_y_despues_cacheado(tmp_path):
    fake = FakeSession(zipped(plane_tile(n=1201, grade=0.04)))
    p = TerrainProvider(tmp_path, SAMPLE, lambda: fake, product="SRTMGL3")
    first, w1 = p.get(-33.5, -65.5, 500)
    second, _ = p.get(-33.5, -65.5, 500)
    other, _ = p.get(-33.6, -65.6, 500)  # misma baldosa: no se vuelve a descargar
    assert first.origin == DataStatus.LIVE and first.slope_mean_pct == pytest.approx(4.0, abs=0.15)
    assert first.slope_class == "moderada" and "contorno" in first.interpretation
    assert second.origin == DataStatus.CACHED and fake.downloads == 1
    assert other.origin == DataStatus.CACHED and fake.downloads == 1
    assert w1 == []


def test_falla_de_earthdata_cae_a_la_muestra_y_espera_antes_de_reintentar(tmp_path):
    now = datetime(2026, 11, 14, tzinfo=timezone.utc)
    clock = {"t": now}
    fake = FakeSession(error=EarthdataAuthError("Earthdata rechazó las credenciales."))
    p = TerrainProvider(tmp_path, SAMPLE, lambda: fake, cooldown=Cooldown(300), now=lambda: clock["t"])
    s1, w1 = p.get(-33.85, -65.2, 300)
    s2, w2 = p.get(-33.85, -65.2, 300)
    assert s1.origin == s2.origin == DataStatus.SAMPLE and fake.downloads == 1
    assert any("rechazó" in w for w in w1) and any("se vuelve a probar" in w for w in w2)
    clock["t"] = now + timedelta(seconds=301)
    p.get(-33.85, -65.2, 300)
    assert fake.downloads == 2


def test_lejos_de_la_muestra_y_sin_datos(tmp_path):
    with pytest.raises(NoDataError):
        TerrainProvider(tmp_path, SAMPLE).get(10.0, 10.0, 300)


def test_radio_segun_la_superficie():
    assert default_radius(None) == 300
    assert default_radius(500) == pytest.approx(1261.6, abs=0.1)
    assert default_radius(0.1) == 90 and default_radius(100_000) == 2000


def test_lote_con_poligono_usa_el_poligono(tmp_path, repo):
    from app.schemas.field import Boundary

    field = repo.get_field("campo-este")
    ring = [(-65.21, -33.84), (-65.19, -33.84), (-65.19, -33.86), (-65.21, -33.86), (-65.21, -33.84)]
    field = field.model_copy(update={"boundary": Boundary(coordinates=[ring])})
    fake = FakeSession(zipped(plane_tile(n=1201, grade=0.01)))
    summary, _ = terrain_for_field(TerrainProvider(tmp_path, SAMPLE, lambda: fake, product="SRTMGL3"), field)
    assert summary.area == "polígono del lote" and summary.slope_mean_pct == pytest.approx(1.0, abs=0.1)


# ---------------------------------------------------------------- API y motor


def test_api_relieve_por_lote_y_por_punto(client):
    r = client.post("/terrain", json={"field_id": "campo-conlara"})
    assert r.status_code == 200
    d = r.json()
    assert d["data"]["tile"] == "S33W066" and d["data"]["slope_class"] == "suave"
    assert d["meta"]["data_status"] == "sample" and d["data"]["limitations"]
    assert client.post("/terrain", json={"latitude": -33.85, "longitude": -65.2}).status_code == 200
    assert client.post("/terrain", json={}).status_code == 422
    assert client.post("/terrain", json={"latitude": 70, "longitude": 0}).status_code == 422


def test_api_estado_de_earthdata_no_expone_secretos(client, monkeypatch):
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("FIELDSHIFT_EARTHDATA_USERNAME", USER)
    monkeypatch.setenv("FIELDSHIFT_EARTHDATA_PASSWORD", PASSWORD)
    try:
        r = client.get("/earthdata/status")
        assert r.json()["data"] == {"configured": True, "method": "usuario", "note": r.json()["data"]["note"]}
        assert USER not in r.text and PASSWORD not in r.text
    finally:
        get_settings.cache_clear()


def test_el_motor_usa_la_pendiente_de_srtm(client):
    data = client.post("/rotations/compare", json={"field_id": "campo-conlara"}).json()
    assert data["data"]["inputs"]["soil"]["slope_pct"] == 2.3
    assert any(w.startswith("SRTM:") for w in data["meta"]["warnings"])
    off = client.post("/rotations/compare", json={"field_id": "campo-conlara", "use_satellite": False}).json()
    assert off["data"]["inputs"]["soil"]["slope_pct"] is None
