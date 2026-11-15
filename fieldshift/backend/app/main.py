"""Punto de entrada de la API de AgroOrbit."""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import Settings, get_settings
from app.models.constants import DISCLAIMER
from app.utils.errors import register_exception_handlers
from app.utils.logging import setup_logging

logger = logging.getLogger("fieldshift.request")

DESCRIPTION = f"""
API de **AgroOrbit** (NASA Space Apps Challenge 2026 · *Field Shift: Adapting Farms with NASA Data*).

Compara estrategias de rotación de cultivos usando datos NASA, información local de suelo
y prioridades del productor.

- Cada valor indica si es **observado, modelado, estimado o supuesto**.
- `meta.data_status` indica si la respuesta usa datos en vivo, caché, muestra o valores simulados (`mock`).
- Los errores tienen siempre la forma `{{"error": {{"code", "message", "details", "request_id"}}}}`.

> {DISCLAIMER}
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="AgroOrbit API",
        version=settings.app_version,
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        logger.info(
            "request",
            extra={
                "request_id": request.state.request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round((time.perf_counter() - start) * 1000, 1),
            },
        )
        return response

    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
