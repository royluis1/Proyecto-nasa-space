"""Métricas de humedad de suelo SMAP (funciones puras sobre la serie diaria)."""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.models.enums import Level
from app.schemas.satellite import (
    DroughtEvent,
    MonthlyClimatologySM,
    SoilMoistureMonth,
    SoilMoisturePoint,
    SoilMoistureSummary,
    WaterStress,
)
from app.services.satellite.common import build_trace, f, quality, trend
from app.services.satellite.products import Product
from app.services.satellite.provider import SatelliteData
from app.i18n import tr

MIN_DAYS_MONTH = {"SPL3SMP_E": 8}  # L3 tiene huecos por las pasadas
DEFAULT_MIN_DAYS = 20
MIN_YEARS_CLIMATOLOGY = 3
DROUGHT_Z = -1.0
LOW_PERCENTILE = 25
MIN_MONTHS_YEAR = 10
STRESS_HIGH_ANOMALY = 10.0  # % por debajo de lo normal
STRESS_MEDIUM_ANOMALY = 5.0

def assumptions() -> list[str]:
    """Supuestos del resumen, en el idioma del pedido."""
    return [
        tr("Sequía de humedad de suelo: mes con anomalía estandarizada z <= -1 frente al mismo mes de los otros años.",
           "Soil-moisture drought: a month with standardized anomaly z <= -1 vs. the same month in other years."),
        tr("Mes con baja humedad: promedio por debajo del percentil 25 de todos los meses del período.",
           "Low-moisture month: average below the 25th percentile of all months in the period."),
        tr("Meses típicamente secos: los 4 meses del año con menor humedad media.",
           "Typically dry months: the 4 months of the year with the lowest mean moisture."),
        tr("Estrés hídrico relativo: percentil de los últimos días frente a la misma época de otros años. "
           "Alto: percentil <= 20 y al menos 10 % por debajo de lo normal; medio: percentil <= 40 y 5 % por debajo.",
           "Relative water stress: percentile of recent days vs. the same time in other years. "
           "High: percentile <= 20 and at least 10 % below normal; medium: percentile <= 40 and 5 % below."),
        tr("Un mes es válido con al menos 20 días con dato (8 para SMAP L3); un año, con al menos 10 meses válidos.",
           "A month is valid with at least 20 days of data (8 for SMAP L3); a year, with at least 10 valid months."),
    ]


def monthly_table(daily: pd.Series, min_days: int) -> pd.DataFrame:
    g = daily.groupby([daily.index.year, daily.index.month])
    table = pd.DataFrame({"mean": g.mean(), "days": g.count()})
    table.index.names = ["year", "month"]
    table.loc[table["days"] < min_days, "mean"] = np.nan
    return table


def climatology(table: pd.DataFrame) -> pd.DataFrame:
    by_month = table["mean"].groupby(level="month")
    clim = pd.DataFrame({"mean": by_month.mean(), "std": by_month.std(ddof=1), "years": by_month.count()})
    clim = clim.reindex(range(1, 13))
    clim["years"] = clim["years"].fillna(0).astype(int)
    return clim


def anomalies(table: pd.DataFrame, clim: pd.DataFrame) -> pd.Series:
    months = table.index.get_level_values("month")
    mean = clim["mean"].reindex(months).to_numpy()
    std = clim["std"].reindex(months).to_numpy()
    years = clim["years"].reindex(months).to_numpy()
    z = (table["mean"].to_numpy() - mean) / np.where(std > 0, std, np.nan)
    z = np.where(years >= MIN_YEARS_CLIMATOLOGY, z, np.nan)
    return pd.Series(z, index=table.index)


def drought_events(z: pd.Series) -> list[DroughtEvent]:
    events, run = [], []
    for (y, m), value in z.items():
        if pd.notna(value) and value <= DROUGHT_Z:
            run.append(((y, m), value))
            continue
        if run:
            events.append(run)
            run = []
    if run:
        events.append(run)
    return [
        DroughtEvent(
            start=f"{r[0][0][0]}-{r[0][0][1]:02d}",
            end=f"{r[-1][0][0]}-{r[-1][0][1]:02d}",
            months=len(r),
            min_anomaly_z=round(float(min(v for _, v in r)), 2),
        )
        for r in events
    ]


def water_stress(daily: pd.Series, recent_days: int) -> WaterStress:
    valid = daily.dropna()
    end = valid.index.max()
    start = end - pd.Timedelta(days=recent_days - 1)
    recent = valid[valid.index >= start]
    # misma ventana del calendario en los otros años
    windows = []
    for year in sorted(set(valid.index.year)):
        shift = end.year - year
        if shift <= 0:
            continue
        w_end = end - pd.DateOffset(years=shift)
        w_start = w_end - pd.Timedelta(days=recent_days - 1)
        w = valid[(valid.index >= w_start) & (valid.index <= w_end)]
        if len(w) >= recent_days * 0.5:
            windows.append(float(w.mean()))
    recent_mean = float(recent.mean()) if len(recent) else None
    normal = float(np.mean(windows)) if windows else None
    pct = None
    if recent_mean is not None and len(windows) >= MIN_YEARS_CLIMATOLOGY:
        pct = round(float((np.array(windows) < recent_mean).mean() * 100), 0)
    anomaly = (recent_mean / normal - 1) * 100 if recent_mean is not None and normal else None
    level = None
    if pct is not None and anomaly is not None:
        # el percentil solo no alcanza: con años muy parecidos, diferencias mínimas cambian el ranking
        if pct <= 20 and anomaly <= -STRESS_HIGH_ANOMALY:
            level = Level.ALTO
        elif pct <= 40 and anomaly <= -STRESS_MEDIUM_ANOMALY:
            level = Level.MEDIO
        else:
            level = Level.BAJO
    return WaterStress(
        window_start=start.date(),
        window_end=end.date(),
        recent_mean=f(recent_mean),
        normal_mean=f(normal),
        anomaly_pct=f(anomaly, 1),
        percentile=pct,
        stress_index=None if pct is None else round(1 - pct / 100, 2),
        level=level,
    )


def summarize(
    data: SatelliteData,
    product: Product,
    lat: float,
    lon: float,
    start: date,
    end: date,
    recent_days: int = 90,
    include_series: bool = False,
) -> SoilMoistureSummary:
    daily = data.series.df["value"]
    full = daily.reindex(pd.date_range(start, end, freq="D"))
    min_days = MIN_DAYS_MONTH.get(product.key, DEFAULT_MIN_DAYS)
    table = monthly_table(daily, min_days)
    clim = climatology(table)
    z = anomalies(table, clim)
    valid_months = table["mean"].notna()
    drought = (z <= DROUGHT_Z) & valid_months
    low_threshold = table["mean"].quantile(LOW_PERCENTILE / 100)
    low = (table["mean"] < low_threshold) & valid_months

    months = [
        SoilMoistureMonth(
            year=int(y),
            month=int(m),
            mean=f(r["mean"]),
            days=int(r["days"]),
            anomaly_z=f(z[(y, m)], 2),
            drought=bool(drought[(y, m)]),
            low=bool(low[(y, m)]),
        )
        for (y, m), r in table.iterrows()
    ]
    per_year = table.groupby(level="year")["mean"].agg(["mean", "count"])
    annual = per_year.loc[per_year["count"] >= MIN_MONTHS_YEAR, "mean"]
    clim_valid = clim["mean"].dropna()
    dry = sorted(int(m) for m in clim_valid.nsmallest(4).index) if len(clim_valid) >= 8 else []
    vmin, vmax = daily.idxmin(), daily.idxmax()

    return SoilMoistureSummary(
        variable=product.variable,
        units=product.units,
        trace=build_trace(product, data, lat, lon, start, end),
        quality=quality(data, expected=len(full)),
        mean=f(daily.mean()),
        min=SoilMoisturePoint(date=vmin.date(), value=f(daily[vmin])),
        max=SoilMoisturePoint(date=vmax.date(), value=f(daily[vmax])),
        drought_frequency_pct=f(drought.sum() / valid_months.sum() * 100, 1)
        if valid_months.sum() and z.notna().any()
        else None,
        drought_months=int(drought.sum()),
        drought_events=drought_events(z.where(valid_months)),
        low_moisture_months=[mo for mo in months if mo.low],
        typically_dry_months=dry,
        monthly_climatology=[
            MonthlyClimatologySM(month=int(m), mean=f(r["mean"]), std=f(r["std"]), years=int(r["years"]))
            for m, r in clim.iterrows()
        ],
        monthly=months,
        annual_means={int(y): round(float(v), 4) for y, v in annual.items()},
        trend=trend(annual, tr(f"{product.units} por década", f"{product.units} per decade")),
        water_stress=water_stress(daily, recent_days),
        series=[SoilMoisturePoint(date=d.date(), value=f(v)) for d, v in full.items()] if include_series else None,
        assumptions=assumptions(),
    )


def default_period(
    product: Product, start: date | None, end: date | None, today: date | None = None
) -> tuple[date, date]:
    today = today or date.today()
    end = end or date(today.year - 1, 12, 31)
    start = start or date(end.year - 9, 1, 1)
    return max(start, product.first_date), min(end, today - timedelta(days=1))
