"""Validaciones de coordenadas y fechas, reutilizadas por los schemas."""

from datetime import date

# Primer día con datos diarios de meteorología en NASA POWER.
POWER_MIN_DATE = date(1981, 1, 1)
MAX_RANGE_YEARS = 20

# Recuadro aproximado de la provincia de San Luis (⚠️ a verificar con un mapa oficial).
# Fuera de él se acepta la coordenada, pero se avisa.
SAN_LUIS_BBOX = {"lat_min": -36.0, "lat_max": -32.0, "lon_min": -67.5, "lon_max": -64.9}

# La grilla de POWER es de ~50 km: más de 4 decimales es precisión falsa.
COORD_DECIMALS = 4


def round_coord(value: float) -> float:
    return round(value, COORD_DECIMALS)


def is_in_san_luis(lat: float, lon: float) -> bool:
    b = SAN_LUIS_BBOX
    return b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]


def validate_date_range(start: date, end: date, today: date | None = None) -> None:
    """Lanza ValueError con un mensaje en español si el rango no es válido."""
    today = today or date.today()
    if start > end:
        raise ValueError("La fecha de inicio no puede ser posterior a la fecha de fin.")
    if start < POWER_MIN_DATE:
        raise ValueError(f"No hay datos diarios antes del {POWER_MIN_DATE.isoformat()}.")
    if end > today:
        raise ValueError("La fecha de fin no puede estar en el futuro.")
    # Comparación por año y día para no depender de años bisiestos.
    limit = date(start.year + MAX_RANGE_YEARS, start.month, min(start.day, 28))
    if end > limit:
        raise ValueError(f"El rango máximo es de {MAX_RANGE_YEARS} años.")
