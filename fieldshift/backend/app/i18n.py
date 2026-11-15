"""Idioma de las respuestas: español o inglés.

El frontend manda el idioma elegido en el encabezado Accept-Language ("es" o "en"). Un middleware lo guarda
en una variable de contexto y los textos se escriben de a pares donde se arman: tr("Lluvia", "Rain").
Sin encabezado, o con otro idioma, se responde en español (el idioma original de la API).

Los códigos (ids, enums como "alto"/"bajo", nombres de campos) no se traducen: solo los textos para leer.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Literal

Lang = Literal["es", "en"]
DEFAULT_LANG: Lang = "es"

_lang: ContextVar[Lang] = ContextVar("lang", default=DEFAULT_LANG)


def current_lang() -> Lang:
    return _lang.get()


def set_lang(lang: Lang):
    """Fija el idioma (devuelve el token para restaurarlo con reset_lang)."""
    return _lang.set(lang)


def reset_lang(token) -> None:
    _lang.reset(token)


def tr(es: str, en: str) -> str:
    """El texto en el idioma del pedido."""
    return en if _lang.get() == "en" else es


def is_en() -> bool:
    return _lang.get() == "en"


def parse_accept_language(value: str | None) -> Lang:
    """Primer idioma del encabezado: "en", "en-US", "en;q=0.9,es" -> en. Cualquier otro -> es."""
    if not value:
        return DEFAULT_LANG
    first = value.split(",")[0].split(";")[0].strip().lower()
    return "en" if first.startswith("en") else "es"


class LanguageMiddleware:
    """Middleware ASGI: lee Accept-Language y deja el idioma disponible para todo el pedido."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        header = None
        for k, v in scope.get("headers", []):
            if k == b"accept-language":
                header = v.decode("latin-1")
                break
        token = set_lang(parse_accept_language(header))
        try:
            await self.app(scope, receive, send)
        finally:
            reset_lang(token)


class LocalizedMap(dict):
    """Diccionario de textos en los dos idiomas: {"clave": ("español", "english")}.
    Al leerlo (m[k], m.get, values, items) devuelve el texto del idioma del pedido."""

    def __getitem__(self, key):
        es, en = super().__getitem__(key)
        return tr(es, en)

    def get(self, key, default=None):
        return self[key] if key in self else default

    def values(self):
        return [self[k] for k in self]

    def items(self):
        return [(k, self[k]) for k in self]


def join_words(items: list[str]) -> str:
    """'a, b y c' / 'a, b and c'."""
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + tr(" y ", " and ") + items[-1]


def decimal(x: float, decimals: int = 1) -> str:
    """Número para los textos: coma decimal en español, punto en inglés."""
    s = f"{x:.{decimals}f}"
    return s if is_en() else s.replace(".", ",")
