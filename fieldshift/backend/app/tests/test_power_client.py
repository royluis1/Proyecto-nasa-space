"""Cliente HTTP de POWER con transporte simulado (requiere httpx, sin red)."""

from datetime import date

import pytest

httpx = pytest.importorskip("httpx")

from app.services.power.client import PowerClient  # noqa: E402
from app.tests.fixtures import power_response  # noqa: E402
from app.utils.exceptions import UpstreamError  # noqa: E402


def _client(handler, retries=3):
    sleeps: list[float] = []
    c = PowerClient("https://power.test/api", 5, retries, 1.0, transport=httpx.MockTransport(handler), sleep=sleeps.append)
    return c, sleeps


def _fetch(c):
    return c.fetch(-33.85, -65.2, date(2015, 1, 1), date(2015, 1, 10), ["T2M", "PRECTOTCORR"], "AG")


def test_arma_bien_la_url():
    seen = {}

    def handler(request):
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=power_response())

    c, _ = _client(handler)
    _fetch(c)
    assert seen == {
        "parameters": "T2M,PRECTOTCORR", "community": "AG", "latitude": "-33.85", "longitude": "-65.2",
        "start": "20150101", "end": "20150110", "format": "JSON",
    }


def test_reintenta_ante_503_y_luego_responde():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json=power_response())

    c, sleeps = _client(handler)
    assert "properties" in _fetch(c)
    assert calls["n"] == 3
    assert len(sleeps) == 2 and sleeps[1] > sleeps[0]  # backoff creciente


def test_timeout_agota_reintentos():
    def handler(request):
        raise httpx.ReadTimeout("lento", request=request)

    c, sleeps = _client(handler, retries=2)
    with pytest.raises(UpstreamError, match="3 intentos"):
        _fetch(c)
    assert len(sleeps) == 2


def test_error_4xx_no_se_reintenta():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(422, json={"messages": ["parámetro inválido"]})

    c, sleeps = _client(handler)
    with pytest.raises(UpstreamError, match="422"):
        _fetch(c)
    assert calls["n"] == 1 and not sleeps
