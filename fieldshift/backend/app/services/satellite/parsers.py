"""Lectura de series satelitales desde CSV.

Formatos admitidos:
1. CSV de AppEEARS (extracción por punto): columnas `ID`, `Latitude`, `Longitude`, `Date` y una
   columna por capa, con nombre `<producto>_<versión>_<capa>` (p. ej. `MOD13Q1_061__250m_16_days_NDVI`).
2. CSV simple: `date,value[,qa]` (es lo que genera scripts/geotiff_to_csv.py desde GeoTIFF).

Reglas: los valores de relleno y fuera de rango pasan a faltantes; el NDVI sin escalar (enteros
de -2000 a 10000) se multiplica por 0,0001; los píxeles con mala calidad (nubes, nieve) se descartan
y se cuentan. Las series sub-diarias (SMAP L4, cada 3 h) se promedian por día.
"""

import io
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app.services.satellite.products import Product
from app.utils.exceptions import InvalidInputError

MAX_SITE_DISTANCE_DEG = 0.25  # en un CSV con varios puntos, el más cercano debe estar a menos de esto


@dataclass
class ParsedSeries:
    df: pd.DataFrame  # índice: fecha (diaria); columnas: value (float, NaN = faltante), qa_ok (bool o NaN)
    format: str
    site_id: str | None = None
    site_lat: float | None = None
    site_lon: float | None = None
    raw_rows: int = 0
    fill_or_range: int = 0  # valores de relleno o fuera de rango
    bad_quality: int = 0  # descartados por la capa de calidad
    scaled: bool = False
    warnings: list[str] = field(default_factory=list)


def _find(columns: list[str], *candidates: str) -> str | None:
    lower = {c.lower(): c for c in columns}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    for cand in candidates:
        for c in columns:
            if c.lower().endswith(cand.lower()):
                return c
    return None


def _qa_ok(qa: pd.Series, rule: str | None) -> pd.Series:
    qa = pd.to_numeric(qa, errors="coerce")
    if rule == "modis_reliability":
        return qa.isin([0, 1])
    if rule == "bit0_clear":
        return qa.notna() & ((qa.fillna(1).astype("int64") & 1) == 0)
    return pd.Series(True, index=qa.index)


def parse_csv(text: str, product: Product, lat: float | None = None, lon: float | None = None) -> ParsedSeries:
    try:
        raw = pd.read_csv(io.StringIO(text), comment="#")
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise InvalidInputError(f"No se pudo leer el CSV: {exc}") from None
    raw.columns = [str(c).strip() for c in raw.columns]
    cols = list(raw.columns)

    date_col = _find(cols, "Date", "date", "fecha")
    value_col = _find(cols, product.layer, product.variable, "value", "valor")
    if date_col is None or value_col is None:
        raise InvalidInputError(
            f"El CSV necesita una columna de fecha y una de {product.variable}. Columnas encontradas: {cols[:10]}.",
            {"esperado": ["Date o date", f"...{product.layer} o value"]},
        )
    qa_col = _find(cols, product.qa_layer) if product.qa_layer else None
    qa_col = qa_col or _find(cols, "qa", "pixel_reliability")
    fmt = "appeears" if value_col.endswith(product.layer) else "simple"

    out = ParsedSeries(df=pd.DataFrame(), format=fmt, raw_rows=len(raw))
    id_col = _find(cols, "ID", "site_id")
    lat_col, lon_col = _find(cols, "Latitude", "lat"), _find(cols, "Longitude", "lon")
    if id_col and raw[id_col].nunique() > 1:
        if lat is None or lat_col is None or lon_col is None:
            raise InvalidInputError("El CSV tiene varios puntos: indicá las coordenadas para elegir uno.")
        sites = raw.groupby(id_col)[[lat_col, lon_col]].first()
        dist = np.hypot(sites[lat_col] - lat, sites[lon_col] - lon)
        if dist.min() > MAX_SITE_DISTANCE_DEG:
            raise InvalidInputError("Ningún punto del CSV está cerca de la ubicación pedida.")
        raw = raw[raw[id_col] == dist.idxmin()]
    if id_col:
        out.site_id = str(raw[id_col].iloc[0]) if len(raw) else None
    if lat_col and lon_col and len(raw):
        out.site_lat, out.site_lon = float(raw[lat_col].iloc[0]), float(raw[lon_col].iloc[0])

    dates = pd.to_datetime(raw[date_col], errors="coerce", format="mixed")
    values = pd.to_numeric(raw[value_col], errors="coerce").astype("float64")
    bad_dates = int(dates.isna().sum())
    if bad_dates:
        out.warnings.append(f"{bad_dates} filas con fecha ilegible se descartaron.")

    is_fill = values.isin(product.fill_values)
    if product.scale and values[~is_fill].abs().max(skipna=True) > 1.5:
        values = values * product.scale
        out.scaled = True
        is_fill = is_fill | values.isin([f * product.scale for f in product.fill_values])
    out_of_range = ~values.between(product.valid_min, product.valid_max) & values.notna()
    out.fill_or_range = int((is_fill | out_of_range).sum())
    values = values.mask(is_fill | out_of_range)

    if qa_col is not None:
        ok = _qa_ok(raw[qa_col], product.qa_rule)
        out.bad_quality = int((~ok & values.notna()).sum())
        values = values.where(ok)
    elif product.qa_rule:
        out.warnings.append("El CSV no trae capa de calidad: no se pudieron descartar nubes ni datos dudosos.")

    df = pd.DataFrame({"value": values.to_numpy()}, index=dates).loc[lambda d: d.index.notna()]
    df.index = df.index.tz_localize(None).normalize() if df.index.tz is not None else df.index.normalize()
    df = df.groupby(level=0).mean()  # sub-diario -> diario; duplicados -> promedio
    df.index.name = "date"
    if df["value"].notna().sum() == 0:
        raise InvalidInputError("El CSV no tiene ningún valor válido de " + product.variable + ".")
    out.df = df.sort_index()
    return out
