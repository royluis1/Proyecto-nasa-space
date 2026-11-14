"""Excepciones del dominio. No dependen de FastAPI; los handlers están en utils/errors.py."""


class FieldShiftError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str, details: object | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(FieldShiftError):
    status_code = 404
    code = "NOT_FOUND"


class FieldNotFoundError(NotFoundError):
    code = "FIELD_NOT_FOUND"


class RotationNotFoundError(NotFoundError):
    code = "ROTATION_NOT_FOUND"


class InvalidInputError(FieldShiftError):
    status_code = 400
    code = "INVALID_INPUT"


class UpstreamError(FieldShiftError):
    """Una fuente externa (p. ej. NASA POWER) falló y no hay caché ni muestra."""

    status_code = 502
    code = "UPSTREAM_ERROR"


class NoDataError(FieldShiftError):
    status_code = 503
    code = "NO_DATA_AVAILABLE"
