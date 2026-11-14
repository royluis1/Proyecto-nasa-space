"""Descarga de archivos de servidores de NASA protegidos por Earthdata Login.

Mismo flujo que los ejemplos oficiales de Earthdata (urllib con HTTPBasicAuthHandler + CookieJar, o
requests.Session con `rebuild_auth`):

1. Se pide el archivo al servidor de datos (por ejemplo LP DAAC).
2. El servidor redirige a urs.earthdata.nasa.gov para iniciar sesión.
3. Las credenciales se mandan SOLO a urs.earthdata.nasa.gov (con token, también al servidor de datos
   original), nunca a terceros como el almacenamiento en la nube al que se redirige al final.
4. URS devuelve al servidor de datos, que deja una cookie de sesión (se guarda en el cliente) y
   redirige al archivo.

Las credenciales salen de variables de entorno (FIELDSHIFT_EARTHDATA_*), nunca del código, y no se escriben
en los registros ni en los mensajes de error.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

from app.utils.exceptions import UpstreamError

URS_HOST = "urs.earthdata.nasa.gov"
MAX_REDIRECTS = 10
CHUNK = 1024 * 1024


class EarthdataAuthError(UpstreamError):
    """Earthdata rechazó las credenciales o falta autorizar la aplicación."""


@dataclass(frozen=True)
class EarthdataCredentials:
    token: str | None = None
    username: str | None = None
    password: str | None = None

    @property
    def method(self) -> str:
        if self.token:
            return "token"
        if self.username and self.password:
            return "usuario"
        return "ninguno"

    @property
    def configured(self) -> bool:
        return self.method != "ninguno"

    def __repr__(self) -> str:  # nunca mostrar secretos
        return f"EarthdataCredentials(method={self.method!r})"


def credentials_from_settings(s) -> EarthdataCredentials:
    """FIELDSHIFT_EARTHDATA_TOKEN, o usuario y contraseña. Si faltan, usa los de AppEEARS (es la misma cuenta)."""
    secret = lambda v: v.get_secret_value() if v else None  # noqa: E731
    token = secret(s.earthdata_token)
    user = s.earthdata_username or s.appeears_username
    password = secret(s.earthdata_password) or secret(s.appeears_password)
    return EarthdataCredentials(token=token, username=user, password=password)


class EarthdataSession:
    def __init__(self, creds: EarthdataCredentials, timeout_s: float = 60.0, transport=None, max_bytes: int = 200 * CHUNK) -> None:
        import httpx  # solo se importa si se descarga algo

        if not creds.configured:
            raise EarthdataAuthError("Faltan credenciales de Earthdata (FIELDSHIFT_EARTHDATA_USERNAME y _PASSWORD, o _TOKEN).")
        self._httpx = httpx
        self.creds = creds
        self.max_bytes = max_bytes
        # sin seguir redirecciones solo: se decide en cada salto a quién se le mandan las credenciales
        self._client = httpx.Client(timeout=timeout_s, transport=transport, follow_redirects=False)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> EarthdataSession:
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _auth_for(self, url: str, origin_host: str | None) -> tuple[dict, tuple[str, str] | None]:
        host = urlparse(url).hostname
        if self.creds.token and host in (origin_host, URS_HOST):
            return {"Authorization": f"Bearer {self.creds.token}"}, None
        if not self.creds.token and host == URS_HOST:
            return {}, (self.creds.username or "", self.creds.password or "")
        return {}, None

    def download(self, url: str, dest: Path, expect: tuple[str, ...] = ()) -> Path:
        """Descarga `url` a `dest` (escritura atómica). `expect`: extensiones o tipos aceptables (evita guardar una página HTML de login)."""
        origin_host = urlparse(url).hostname
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            headers, auth = self._auth_for(current, origin_host)
            try:
                with self._client.stream("GET", current, headers=headers, auth=auth) as resp:
                    if resp.is_redirect:
                        current = urljoin(current, resp.headers["location"])
                        continue
                    host = urlparse(current).hostname
                    if resp.status_code in (401, 403):
                        if host == URS_HOST or resp.status_code == 401:
                            raise EarthdataAuthError(
                                "Earthdata rechazó las credenciales (usuario, contraseña o token vencido). "
                                "Revisalas en urs.earthdata.nasa.gov."
                            )
                        raise EarthdataAuthError(
                            f"El servidor {host} negó el acceso ({resp.status_code}). Puede faltar aceptar la licencia "
                            "o autorizar la aplicación del archivo en urs.earthdata.nasa.gov (Applications > Authorized Apps)."
                        )
                    if resp.status_code == 404:
                        raise UpstreamError(f"El archivo no existe en {host} (404).")
                    if resp.status_code >= 400:
                        raise UpstreamError(f"{host} respondió {resp.status_code}.")
                    ctype = resp.headers.get("content-type", "")
                    if "text/html" in ctype and not any(e in ("html", "text/html") for e in expect):
                        raise EarthdataAuthError(
                            "Earthdata devolvió una página web en lugar del archivo: entrá a urs.earthdata.nasa.gov y "
                            "autorizá la aplicación del centro de datos (por ejemplo, LP DAAC) en Applications > Authorized Apps."
                        )
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    tmp = dest.with_name(dest.name + ".part")
                    size = 0
                    with open(tmp, "wb") as fh:
                        for chunk in resp.iter_bytes(CHUNK):
                            size += len(chunk)
                            if size > self.max_bytes:
                                fh.close()
                                tmp.unlink(missing_ok=True)
                                raise UpstreamError(f"El archivo supera el máximo de {self.max_bytes // CHUNK} MB.")
                            fh.write(chunk)
                    os.replace(tmp, dest)
                    return dest
            except self._httpx.HTTPError as exc:
                raise UpstreamError(f"No se pudo conectar con {urlparse(current).hostname} ({exc.__class__.__name__}).") from None
        raise UpstreamError("Demasiadas redirecciones al descargar de Earthdata.")

    def get_json(self, url: str, params: dict | None = None) -> dict:
        """Consultas públicas (por ejemplo CMR): sin credenciales."""
        try:
            resp = self._client.get(url, params=params, follow_redirects=True)
        except self._httpx.HTTPError as exc:
            raise UpstreamError(f"No se pudo conectar con {urlparse(url).hostname} ({exc.__class__.__name__}).") from None
        if resp.status_code >= 400:
            raise UpstreamError(f"{urlparse(url).hostname} respondió {resp.status_code}.")
        return resp.json()
