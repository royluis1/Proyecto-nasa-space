"""Handlers que devuelven siempre el mismo formato de error: {"error": {code, message, details, request_id}}."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import ErrorBody, ErrorResponse
from app.utils.exceptions import FieldShiftError

logger = logging.getLogger("fieldshift.errors")


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _error(status: int, code: str, message: str, request: Request, details: object | None = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details, request_id=_request_id(request)))
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"))


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(FieldShiftError)
    async def _fieldshift(request: Request, exc: FieldShiftError) -> JSONResponse:
        logger.info("error de dominio %s: %s", exc.code, exc.message)
        return _error(exc.status_code, exc.code, exc.message, request, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"campo": ".".join(str(p) for p in e.get("loc", [])), "mensaje": e.get("msg")}
            for e in exc.errors()
        ]
        return _error(422, "VALIDATION_ERROR", "Los datos enviados no son válidos.", request, details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
        return _error(exc.status_code, code, str(exc.detail), request)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("error no controlado")
        return _error(500, "INTERNAL_ERROR", "Error interno. Revisá los logs con el request_id.", request)
