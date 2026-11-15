"""Arma la respuesta de /climate-summary a partir de la serie diaria normalizada."""

from datetime import date

import pandas as pd

from app.schemas.climate import (
    AnnualRecord,
    ClimateSource,
    ClimateSummary,
    DailyRecord,
    DateRange,
    Extreme,
    HeatSummary,
    MissingDataReport,
    MonthlyClimatology,
    MonthlyRecord,
    ParameterInfo,
    PrecipitationSummary,
    SeasonalSummary,
    TrendResult,
    Trends,
    Variability,
    VariableStats,
    WaterDeficit,
)
from app.services import climate_analysis as ca
from app.services.et0 import compute_et0
from app.services.power.service import ClimateData
from app.i18n import tr


def limitations() -> list[str]:
    return [
        tr("NASA POWER describe el entorno regional (~50 km), no el lote: no reemplaza un pluviómetro ni una estación propia.",
           "NASA POWER describes the regional environment (~50 km), not the field: it does not replace a rain gauge or your own station."),
        tr("La meteorología de POWER es un reanálisis (MERRA-2 / GEOS): son datos modelados con asimilación de observaciones.",
           "POWER meteorology is a reanalysis (MERRA-2 / GEOS): modeled data with observation assimilation."),
        tr("Los datos de los últimos días o meses provienen de productos preliminares y pueden corregirse.",
           "Data from the last few days or months comes from preliminary products and may be corrected."),
        tr("La ET0 es una estimación FAO-56 con datos regionales; el déficit es climático (ET0 - lluvia), no del cultivo.",
           "ET0 is a FAO-56 estimate with regional data; the deficit is climatic (ET0 - rain), not of the crop."),
        tr("Años secos, húmedos y con estrés térmico se definen relativos al período pedido (|z| >= 1), no a una normal oficial.",
           "Dry, wet and heat-stress years are defined relative to the requested period (|z| >= 1), not to an official normal."),
        tr("El umbral de día caluroso (Tmax > 35 °C) es un supuesto a validar con un agrónomo local.",
           "The hot-day threshold (Tmax > 35 °C) is an assumption to validate with a local agronomist."),
    ]


def labels() -> dict[str, str]:
    return {
        "serie_diaria": tr("modelado (reanálisis NASA POWER)", "modeled (NASA POWER reanalysis)"),
        "resumenes_y_tendencias": tr("estimado (calculado a partir de la serie)", "estimated (computed from the series)"),
        "et0_y_deficit": tr("estimado (FAO-56)", "estimated (FAO-56)"),
        "clasificacion_de_años": tr("supuesto (criterio z-score sobre el período)", "assumed (z-score criterion over the period)"),
    }


def _f(x) -> float | None:
    return ca._f(x)


def _extreme(series: pd.Series, kind: str) -> Extreme:
    s = series.dropna()
    if s.empty:
        return Extreme(value=None)
    idx = s.idxmax() if kind == "max" else s.idxmin()
    return Extreme(value=_f(s[idx]), date=idx.date())


def build_summary(
    data: ClimateData,
    lat: float,
    lon: float,
    start: date,
    end: date,
    community: str,
    endpoint: str,
    include_daily: bool,
    field_id: str | None = None,
) -> ClimateSummary:
    df = data.df.copy()
    df["ET0"], method = compute_et0(df, lat)

    monthly = ca.monthly_table(df)
    clim = ca.monthly_climatology(monthly)
    annual = ca.classify_years(ca.annual_table(df))
    annual["deficit_mm"] = ca.annual_deficit(monthly)
    complete = annual[annual["complete"]]

    p_trend = ca.mann_kendall_sen(complete["precip_mm"])
    t_trend = ca.mann_kendall_sen(complete["t2m_mean"])
    valid_months = monthly[monthly["valid"]]
    deficit_months = (valid_months["et0_mm"] > valid_months["precip_mm"]).mean() * 100 if len(valid_months) else None
    et0_days = method.notna().sum()

    daily = None
    if include_daily:
        out = df.round(2).assign(ET0_method=method).reset_index()
        cols = [c for c in DailyRecord.model_fields if c in out.columns or c == "date"]
        out = out.rename(columns={out.columns[0]: "date"})[cols]
        out = out.astype(object).where(out.notna(), None)
        daily = [DailyRecord(**{**r, "date": r["date"].date()}) for r in out.to_dict("records")]

    return ClimateSummary(
        latitude=lat,
        longitude=lon,
        field_id=field_id,
        grid_elevation_m=data.elevation_m,
        period=DateRange(start=start, end=end),
        source=ClimateSource(
            community=community,
            endpoint=endpoint,
            origin=data.status,
            origin_label=data.status.origin_label,
            retrieved_at=data.retrieved_at,
            sample_site=data.sample_site,
        ),
        parameters={
            p: ParameterInfo(units=data.units.get(p, ""), longname=data.longnames.get(p, p), missing_days=data.missing.get(p, 0))
            for p in data.df.columns
        },
        labels=labels(),
        stats={
            "T2M": VariableStats(mean=_f(df["T2M"].mean()), min=_extreme(df["T2M"], "min"), max=_extreme(df["T2M"], "max"), units="°C"),
            "T2M_MAX": VariableStats(mean=_f(df["T2M_MAX"].mean()), min=_extreme(df["T2M_MAX"], "min"), max=_extreme(df["T2M_MAX"], "max"), units="°C"),
            "T2M_MIN": VariableStats(mean=_f(df["T2M_MIN"].mean()), min=_extreme(df["T2M_MIN"], "min"), max=_extreme(df["T2M_MIN"], "max"), units="°C"),
            "PRECTOTCORR": VariableStats(mean=_f(df["PRECTOTCORR"].mean()), min=_extreme(df["PRECTOTCORR"], "min"), max=_extreme(df["PRECTOTCORR"], "max"), units=tr("mm/día", "mm/day")),
        },
        precipitation=PrecipitationSummary(
            total_mm=_f(df["PRECTOTCORR"].sum(min_count=1)),
            mean_annual_mm=_f(complete["precip_mm"].mean()),
            max_daily=_extreme(df["PRECTOTCORR"], "max"),
            dry_years=[int(y) for y in annual.index[annual["classification"] == "seco"]],
            wet_years=[int(y) for y in annual.index[annual["classification"] == "húmedo"]],
        ),
        heat=HeatSummary(
            threshold_c=ca.HEAT_THRESHOLD_C,
            mean_days_per_year=_f(complete["heat_days"].mean()),
            frequency_pct_by_month=ca.heat_frequency_by_month(df),
            heat_stress_years=[int(y) for y in annual.index[annual["heat_stress"].astype(bool)]],
        ),
        trends=Trends(
            precipitation=TrendResult(units=tr("mm/año por década", "mm/yr per decade"), **vars(p_trend)),
            temperature=TrendResult(units=tr("°C por década", "°C per decade"), **vars(t_trend)),
        ),
        variability=Variability(
            annual_precip_cv_pct=ca.coefficient_of_variation(complete["precip_mm"]),
            annual_temp_cv_pct=ca.coefficient_of_variation(complete["t2m_mean"]),
        ),
        water_deficit=WaterDeficit(
            mean_annual_et0_mm=_f(complete["et0_mm"].mean()),
            mean_annual_precip_mm=_f(complete["precip_mm"].mean()),
            mean_annual_deficit_mm=_f(complete["deficit_mm"].mean()),
            months_with_deficit_pct=_f(deficit_months),
            method=tr("ET0 FAO-56 Penman-Monteith (Hargreaves si faltan datos) menos lluvia, por mes",
                      "ET0 FAO-56 Penman-Monteith (Hargreaves if data is missing) minus rain, by month"),
            pm_days_pct=_f((method == "PM").sum() / et0_days * 100) if et0_days else None,
        ),
        annual=[
            AnnualRecord(
                year=int(y), complete=bool(r["complete"]), precip_mm=_f(r["precip_mm"]),
                precip_anomaly_pct=_f(r["precip_anomaly_pct"]), t2m_mean=_f(r["t2m_mean"]),
                tmax_max=_f(r["tmax_max"]), tmin_min=_f(r["tmin_min"]), heat_days=int(r["heat_days"]),
                et0_mm=_f(r["et0_mm"]), deficit_mm=_f(r["deficit_mm"]),
                classification=r["classification"], heat_stress=bool(r["heat_stress"]),
            )
            for y, r in annual.iterrows()
        ],
        seasonal=[SeasonalSummary(**s) for s in ca.seasonal_climatology(monthly)],
        monthly_climatology=[
            MonthlyClimatology(
                month=int(m), precip_mm=_f(r["precip_mm"]), t2m_mean=_f(r["t2m_mean"]), tmax_mean=_f(r["tmax_mean"]),
                tmin_mean=_f(r["tmin_mean"]), heat_days=_f(r["heat_days"]), et0_mm=_f(r["et0_mm"]), years=int(r["years"]),
            )
            for m, r in clim.iterrows()
        ],
        monthly=[
            MonthlyRecord(
                year=int(y), month=int(m), precip_mm=_f(r["precip_mm"]), t2m_mean=_f(r["t2m_mean"]),
                tmax_mean=_f(r["tmax_mean"]), tmin_mean=_f(r["tmin_mean"]), heat_days=int(r["heat_days"]),
                et0_mm=_f(r["et0_mm"]), balance_mm=_f(r["balance_mm"]),
                missing_precip_days=int(r["missing_precip"]), valid=bool(r["valid"]),
            )
            for (y, m), r in monthly.iterrows()
        ],
        daily=daily,
        missing=MissingDataReport(
            total_days=int(len(df)),
            missing_by_parameter=data.missing,
            invalid_months=int((~monthly["valid"]).sum()),
            incomplete_years=[int(y) for y in annual.index[~annual["complete"]]],
        ),
        limitations=limitations(),
    )


def missing_warnings(summary: ClimateSummary) -> list[str]:
    """Advertencias legibles sobre datos faltantes."""
    out = []
    for p, n in summary.missing.missing_by_parameter.items():
        if n:
            pct = n / summary.missing.total_days * 100 if summary.missing.total_days else 0
            out.append(tr(f"{p}: {n} días sin dato ({pct:.1f} %).", f"{p}: {n} days with no data ({pct:.1f} %)."))
    if summary.missing.invalid_months:
        out.append(tr(
            f"{summary.missing.invalid_months} meses con más de {ca.MAX_MISSING_MONTH_PCT:.0f} % de días sin lluvia registrada: no se usan.",
            f"{summary.missing.invalid_months} months with more than {ca.MAX_MISSING_MONTH_PCT:.0f} % of days with no recorded rain: not used."))
    if summary.missing.incomplete_years:
        out.append(tr(
            f"Años incompletos (excluidos de tendencias y clasificación): {summary.missing.incomplete_years}.",
            f"Incomplete years (excluded from trends and classification): {summary.missing.incomplete_years}."))
    if summary.trends.precipitation.slope_per_decade is None:
        out.append(tr(
            f"Se necesitan al menos {ca.MIN_YEARS_TREND} años completos para calcular tendencias.",
            f"At least {ca.MIN_YEARS_TREND} complete years are needed to compute trends."))
    return out
