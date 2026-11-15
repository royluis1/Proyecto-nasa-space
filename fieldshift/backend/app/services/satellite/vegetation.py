"""Métricas de NDVI MODIS (funciones puras sobre la serie de compuestos de 16 días)."""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.schemas.satellite import Campaign, FallowPeriod, NdviPoint, VegetationSummary
from app.services.satellite.common import build_trace, f, quality, trend
from app.services.satellite.products import Product
from app.services.satellite.provider import SatelliteData
from app.i18n import tr

NDVI_SOIL = 0.15  # NDVI de suelo desnudo (supuesto regional)
NDVI_VEG = 0.85  # NDVI de cobertura completa (supuesto)
COMPOSITE_DAYS = 16
MIN_FALLOW_COMPOSITES = 2  # ~1 mes
MIN_VALID_CAMPAIGN = 18  # de ~23 compuestos
PEAK_MIN = 0.45
PEAK_DROP = 0.15
RECENT_CAMPAIGNS = 3

def cover_method() -> str:
    return tr(
        f"Modelo de píxel dimidiado (Gutman e Ignatov, 1998): (NDVI - {NDVI_SOIL}) / ({NDVI_VEG} - {NDVI_SOIL}), limitado a 0-1.",
        f"Dimidiate pixel model (Gutman and Ignatov, 1998): (NDVI - {NDVI_SOIL}) / ({NDVI_VEG} - {NDVI_SOIL}), clamped to 0-1.",
    )


def assumptions() -> list[str]:
    return [
    tr(f"NDVI de suelo desnudo {NDVI_SOIL} y de cobertura completa {NDVI_VEG} (valores típicos; calibrar con el lote).",
       f"Bare-soil NDVI {NDVI_SOIL} and full-cover NDVI {NDVI_VEG} (typical values; calibrate with the field)."),
    tr("Barbecho o suelo desnudo: al menos 2 compuestos seguidos (~1 mes) con NDVI bajo el umbral.",
       "Fallow or bare soil: at least 2 consecutive composites (~1 month) with NDVI below the threshold."),
    tr("Se interpola linealmente un compuesto faltante aislado (marcado como interpolado); huecos más largos quedan sin dato.",
       "An isolated missing composite is linearly interpolated (marked as interpolated); longer gaps are left empty."),
    tr("Campaña agrícola: de julio a junio. Completa con al menos 18 de ~23 compuestos válidos.",
       "Crop season: July to June. Complete with at least 18 of ~23 valid composites."),
    tr(f"NDVI integrado: suma de (NDVI - {NDVI_SOIL}) x 16 días, proxy de la biomasa producida.",
       f"Integrated NDVI: sum of (NDVI - {NDVI_SOIL}) x 16 days, a proxy for biomass produced."),
    tr(f"Ciclo de crecimiento: pico con NDVI >= {PEAK_MIN} separado del anterior por una caída de al menos {PEAK_DROP}.",
       f"Growth cycle: a peak with NDVI >= {PEAK_MIN} separated from the previous one by a drop of at least {PEAK_DROP}."),
]


def cover_fraction(ndvi: pd.Series) -> pd.Series:
    return ((ndvi - NDVI_SOIL) / (NDVI_VEG - NDVI_SOIL)).clip(0, 1)


def campaign_of(ts: pd.Timestamp) -> int:
    return ts.year if ts.month >= 7 else ts.year - 1


def campaign_label(start_year: int) -> str:
    return f"{start_year}/{(start_year + 1) % 100:02d}"


def fallow_periods(filled: pd.Series, threshold: float) -> list[FallowPeriod]:
    out, run = [], []
    for d, v in filled.items():
        if pd.notna(v) and v < threshold:
            run.append((d, v))
            continue
        if len(run) >= MIN_FALLOW_COMPOSITES:
            out.append(run)
        run = []
    if len(run) >= MIN_FALLOW_COMPOSITES:
        out.append(run)
    return [
        FallowPeriod(
            start=r[0][0].date(),
            end=(r[-1][0] + timedelta(days=COMPOSITE_DAYS - 1)).date(),
            days=(r[-1][0] - r[0][0]).days + COMPOSITE_DAYS,
            mean_ndvi=round(float(np.mean([v for _, v in r])), 3),
        )
        for r in out
    ]


def growth_cycles(values: pd.Series) -> int:
    """Cuenta picos >= PEAK_MIN separados por una caída de al menos PEAK_DROP.

    Un pico en el borde de la ventana no se cuenta: si está en el primer compuesto, el máximo real
    pudo ser antes; si está en el último, el cultivo sigue creciendo y es de la campaña siguiente.
    """
    v = values.dropna().to_numpy()
    last = len(v) - 1
    cycles, armed = 0, True
    high, high_i, low = -np.inf, -1, np.inf
    for i, x in enumerate(v):
        if armed:
            if x > high:
                high, high_i = x, i
            if high >= PEAK_MIN and high - x >= PEAK_DROP:
                cycles += int(high_i > 0)
                armed, low = False, x
        else:
            low = min(low, x)
            if x - low >= PEAK_DROP:
                armed, high, high_i = True, x, i
    if armed and high >= PEAK_MIN and 0 < high_i < last:
        cycles += 1  # pico ya pasado, pero sin la caída completa antes del cierre
    return cycles


def campaigns(observed: pd.Series, filled: pd.Series, threshold: float, start: date, end: date) -> list[Campaign]:
    out = []
    years = sorted({campaign_of(d) for d in filled.index})
    for c in years:
        lo, hi = pd.Timestamp(c, 7, 1), pd.Timestamp(c + 1, 6, 30)
        obs = observed[(observed.index >= lo) & (observed.index <= hi)]
        fil = filled[(filled.index >= lo) & (filled.index <= hi)]
        valid = obs.dropna()
        inside = lo.date() >= start and hi.date() <= end
        complete = inside and len(valid) >= MIN_VALID_CAMPAIGN
        peak_date = fil.idxmax() if fil.notna().any() else None
        out.append(
            Campaign(
                campaign=campaign_label(c),
                complete=complete,
                valid_composites=len(valid),
                mean_ndvi=f(valid.mean(), 3),
                peak_ndvi=f(fil.max(), 3),
                peak_date=peak_date.date() if peak_date is not None else None,
                integrated_ndvi=f(((fil - NDVI_SOIL).clip(lower=0) * COMPOSITE_DAYS).sum(), 1)
                if fil.notna().any()
                else None,
                cover_fraction=f(cover_fraction(valid).mean(), 3),
                bare_fraction=f((valid < threshold).mean(), 3) if len(valid) else None,
                growth_cycles=growth_cycles(fil),
                anomaly_pct=None,
            )
        )
    full = [x for x in out if x.complete and x.integrated_ndvi is not None]
    if full:
        avg = float(np.mean([x.integrated_ndvi for x in full]))
        for x in out:
            if x.complete and x.integrated_ndvi is not None and avg:
                x.anomaly_pct = round((x.integrated_ndvi / avg - 1) * 100, 1)
    return out


def summarize(
    data: SatelliteData,
    product: Product,
    lat: float,
    lon: float,
    start: date,
    end: date,
    threshold: float = 0.3,
    include_series: bool = False,
) -> VegetationSummary:
    observed = data.series.df["value"]
    filled = observed.interpolate(limit=1, limit_area="inside")
    interpolated = observed.isna() & filled.notna()
    valid = observed.dropna()
    camps = campaigns(observed, filled, threshold, start, end)
    complete = [c for c in camps if c.complete]
    recent = complete[-RECENT_CAMPAIGNS:]
    recent_valid = valid[valid.index >= pd.Timestamp(int(recent[0].campaign[:4]), 7, 1)] if recent else valid
    integ = pd.Series({int(c.campaign[:4]): c.integrated_ndvi for c in complete}, dtype="float64")
    t = trend(integ, tr("NDVI·día por década", "NDVI·day per decade"), scale=1.0, decimals=1)
    pct = round(t.slope_per_decade / integ.mean() * 100, 1) if t.slope_per_decade is not None and integ.mean() else None
    ranked = sorted(complete, key=lambda c: c.integrated_ndvi)
    clim = valid.groupby(valid.index.month).mean()
    expected = int(((pd.Timestamp(end) - pd.Timestamp(start)).days + 1) / COMPOSITE_DAYS)

    return VegetationSummary(
        trace=build_trace(product, data, lat, lon, start, end),
        quality=quality(data, expected=expected),
        mean_ndvi=f(valid.mean(), 3),
        cover_fraction_mean=f(cover_fraction(valid).mean(), 3),
        cover_method=cover_method(),
        bare_threshold=threshold,
        bare_soil_fraction=f((valid < threshold).mean(), 3) if len(valid) else None,
        recent_bare_soil_fraction=f((recent_valid < threshold).mean(), 3) if len(recent_valid) else None,
        fallow_periods=fallow_periods(filled, threshold),
        monthly_climatology={m: f(clim.get(m), 3) for m in range(1, 13)},
        campaigns=camps,
        best_campaign=ranked[-1].campaign if ranked else None,
        worst_campaign=ranked[0].campaign if ranked else None,
        biomass_trend=t,
        biomass_trend_pct_per_decade=pct,
        series=[
            NdviPoint(
                date=d.date(),
                ndvi=f(v, 3),
                cover_fraction=f(cover_fraction(pd.Series([v])).iloc[0], 3) if pd.notna(v) else None,
                interpolated=bool(interpolated[d]),
            )
            for d, v in filled.items()
        ]
        if include_series
        else None,
        assumptions=assumptions(),
    )


def default_period(
    product: Product, start: date | None, end: date | None, today: date | None = None
) -> tuple[date, date]:
    """Por defecto, 10 campañas completas (julio a junio) hasta el último junio cerrado."""
    today = today or date.today()
    last_june = date(today.year if today.month >= 7 else today.year - 1, 6, 30)
    end = end or last_june
    start = start or date(end.year - 10, 7, 1)
    return max(start, product.first_date), min(end, today - timedelta(days=1))
