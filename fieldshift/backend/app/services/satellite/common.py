"""Piezas compartidas por SMAP y NDVI: trazabilidad, calidad y tendencias."""

from datetime import date

import pandas as pd

from app.schemas.satellite import DataTrace, QualityReport, Trend
from app.services.climate_analysis import mann_kendall_sen
from app.services.satellite.products import Product
from app.services.satellite.provider import SatelliteData


def trend(values: pd.Series, units: str, scale: float = 1000.0, decimals: int = 4) -> Trend:
    """Sen + Mann-Kendall. Se escala antes para no perder precisión en el redondeo de la función base."""
    t = mann_kendall_sen(values * scale)
    slope = None if t.slope_per_decade is None else round(t.slope_per_decade / scale, decimals)
    return Trend(
        slope_per_decade=slope,
        units=units,
        kendall_tau=t.kendall_tau,
        p_value=t.p_value,
        significant=t.significant,
        n_years=t.n_years,
    )


def build_trace(product: Product, data: SatelliteData, lat: float, lon: float, start: date, end: date) -> DataTrace:
    valid = data.series.df["value"].dropna()
    pixel = data.sample_site or data.series.site_id
    return DataTrace(
        source=product.provider,
        product=f"{product.appeears_id} · {product.layer}",
        product_name=product.name,
        label=product.label,
        status=data.status,
        status_label=data.status.origin_label,
        period_start=start,
        period_end=end,
        last_observation=valid.index.max().date() if len(valid) else None,
        retrieved_at=data.retrieved_at,
        spatial_resolution=product.spatial_resolution,
        temporal_resolution=product.temporal_resolution,
        depth=product.depth,
        latitude=lat,
        longitude=lon,
        pixel_site=pixel,
        task_id=data.task_id,
        citation=product.citation,
        limitations=product.limitations,
    )


def quality(data: SatelliteData, expected: int | None = None) -> QualityReport:
    s = data.series
    records = len(s.df) if expected is None else max(expected, len(s.df))
    valid = int(s.df["value"].notna().sum())
    return QualityReport(
        records=records,
        valid=valid,
        missing_or_fill=records - valid - s.bad_quality if records - valid - s.bad_quality > 0 else 0,
        bad_quality=s.bad_quality,
        valid_pct=round(valid / records * 100, 1) if records else 0.0,
        format=s.format,
        scaled=s.scaled,
        warnings=list(s.warnings),
    )


def f(x, d: int = 4) -> float | None:
    return None if x is None or pd.isna(x) else round(float(x), d)
