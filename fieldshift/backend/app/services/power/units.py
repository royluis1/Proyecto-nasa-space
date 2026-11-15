"""Unidades internas de AgroOrbit y conversión desde lo que informe POWER.

Las unidades se leen del metadato de cada respuesta, no se asumen: según la
comunidad (AG, RE, SB) la radiación puede venir en MJ/m²/día o en kWh/m²/día.
"""

import pandas as pd

TARGET_UNITS = {
    "T2M": "°C",
    "T2M_MAX": "°C",
    "T2M_MIN": "°C",
    "PRECTOTCORR": "mm/día",
    "RH2M": "%",
    "WS2M": "m/s",
    "ALLSKY_SFC_SW_DWN": "MJ/m²/día",
    "PS": "kPa",
}

# unidad informada (normalizada) -> (factor, desplazamiento) para llegar a TARGET_UNITS
_CONVERSIONS: dict[str, dict[str, tuple[float, float]]] = {
    "temp": {"c": (1, 0), "degc": (1, 0), "°c": (1, 0), "k": (1, -273.15)},
    "PRECTOTCORR": {"mm/day": (1, 0), "mm/d": (1, 0), "mm": (1, 0)},
    "RH2M": {"%": (1, 0)},
    "WS2M": {"m/s": (1, 0)},
    "ALLSKY_SFC_SW_DWN": {"mj/m^2/day": (1, 0), "mj/m2/day": (1, 0), "kw-hr/m^2/day": (3.6, 0), "kwh/m^2/day": (3.6, 0)},
    "PS": {"kpa": (1, 0), "hpa": (0.1, 0), "mb": (0.1, 0), "pa": (0.001, 0)},
}


def _norm(unit: str) -> str:
    return unit.strip().lower().replace(" ", "")


def normalize_units(df: pd.DataFrame, units: dict[str, str]) -> tuple[pd.DataFrame, dict[str, str], list[str]]:
    """Devuelve (df convertido, unidades finales, advertencias)."""
    out = df.copy()
    final: dict[str, str] = {}
    warnings: list[str] = []
    for code in out.columns:
        target = TARGET_UNITS.get(code)
        reported = units.get(code, "")
        if target is None:
            final[code] = reported
            continue
        table = _CONVERSIONS["temp"] if code.startswith("T2M") else _CONVERSIONS[code]
        if not reported:
            warnings.append(f"{code}: POWER no informó la unidad; se asume {target}.")
            final[code] = target
            continue
        conv = table.get(_norm(reported))
        if conv is None:
            warnings.append(f"{code}: unidad desconocida '{reported}', se deja sin convertir.")
            final[code] = reported
            continue
        factor, offset = conv
        if (factor, offset) != (1, 0):
            out[code] = out[code] * factor + offset
        final[code] = target
    return out, final, warnings
