"""Diagnóstico y alerta temprana, y panel de huerta.

Combina:
- NASA POWER (modelado): clima de los últimos 10 años (heladas, calor, ET0 para el riego) y lluvia reciente.
- Open-Meteo (pronóstico, NO es NASA): lluvia y temperaturas de los próximos días.
- NASA SMAP (si está): humedad del suelo frente a lo normal.
- MODIS NDVI: verdor de la zona (solo en el panel de huerta).

Los umbrales son supuestos de diseño, simples y explicables; se muestran en la documentación.
"""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone

import pandas as pd

from app.models.enums import DataLabel, DataStatus, Severity
from app.schemas.forecast import (
    Alert,
    AlertsResult,
    Forecast,
    FrostInfo,
    HeatInfo,
    HuertaPanel,
    IrrigationInfo,
    Profile,
    RainSummary,
    SourceInfo,
    VegetationInfo,
)
from app.schemas.satellite import SoilMoistureRequest, VegetationRequest
from app.services.climate_summary import build_summary
from app.services.engine.service import climate_period
from app.services.forecast.open_meteo import ForecastService
from app.services.power.service import PowerService, resolve_parameters
from app.utils.exceptions import InvalidInputError, NoDataError

logger = logging.getLogger("fieldshift.alerts")

# --- umbrales (supuestos de diseño) ---
FROST_C = 0.0  # helada meteorológica (aire a 2 m). En el suelo y en hojas puede helar con 2-3 °C en el aire.
FROST_RISK_C = 2.0  # "posible helada"
HOT_C, VERY_HOT_C = 35.0, 38.0
HEAVY_RAIN_MM, VERY_HEAVY_RAIN_MM = 30.0, 50.0
DRY_WINDOW_DAYS, DRY_RAIN_MM, DRY_ET0_MM = 10, 5.0, 30.0
PAST_DAYS = 30
POWER_LATENCY_DAYS = 3  # POWER publica con unos días de atraso
DRY_PAST_PCT = 50.0
SMAP_DRY_PCT = -20.0
WIND_KMH = 60.0
HUERTA_KC = 1.0  # huerta en plena producción, promedio de hortalizas (FAO-56, supuesto)
EFFECTIVE_RAIN = 0.8  # parte de la lluvia que aprovecha la huerta (supuesto)

FMT = "%d/%m"


def power_source(status: DataStatus, retrieved_at: datetime | None, detail: str | None = None) -> SourceInfo:
    return SourceInfo(name="NASA POWER", is_nasa=True, kind=DataLabel.MODELADO.value, retrieved_at=retrieved_at,
                      origin=status, origin_label=status.origin_label, detail=detail)


def trace_source(name: str, trace) -> SourceInfo:
    return SourceInfo(name=name, is_nasa=True, kind=trace.label.value, retrieved_at=trace.retrieved_at, origin=trace.status,
                      origin_label=trace.status_label,
                      detail=trace.product_name if trace.spatial_resolution in trace.product_name else f"{trace.product_name}, {trace.spatial_resolution}")


# ------------------------------------------------------------------ cálculos puros


def frost_stats(df: pd.DataFrame, lat: float) -> tuple[float | None, list[int], str | None, str | None]:
    """Días con helada por año, meses con heladas (1 de cada 5 años) y fechas típicas de última y primera helada."""
    tmin = df["T2M_MIN"].dropna()
    if tmin.empty:
        return None, [], None, None
    years = sorted(set(tmin.index.year))
    full = [y for y in years if (tmin.index.year == y).sum() >= 300]
    if not full:
        return None, [], None, None
    t = tmin[tmin.index.year.isin(full)]
    frost = t <= FROST_C
    per_year = frost.groupby(t.index.year).sum()
    months = [m for m in range(1, 13) if (frost[t.index.month == m].groupby(t[t.index.month == m].index.year).any()).mean() >= 0.2]

    south = lat < 0
    spring = (7, 12) if south else (1, 6)  # meses donde termina el período de heladas
    autumn = (1, 6) if south else (7, 12)  # meses donde empieza
    last, first = [], []
    for y in full:
        fy = frost[t.index.year == y]
        sp = fy[(fy.index.month >= spring[0]) & (fy.index.month <= spring[1]) & fy]
        au = fy[(fy.index.month >= autumn[0]) & (fy.index.month <= autumn[1]) & fy]
        if len(sp):
            last.append(sp.index.max().day_of_year)
        if len(au):
            first.append(au.index.min().day_of_year)

    def doy(n: float) -> str:
        return (date(2001, 1, 1) + timedelta(days=int(round(n)) - 1)).strftime(FMT)

    last_s = doy(pd.Series(last).quantile(0.8)) if last else None  # 8 de cada 10 años, la última fue antes
    first_s = doy(pd.Series(first).quantile(0.2)) if first else None  # 8 de cada 10 años, la primera fue después
    return round(float(per_year.mean()), 1), months, last_s, first_s


def heat_stats(df: pd.DataFrame) -> tuple[float | None, list[int]]:
    tmax = df["T2M_MAX"].dropna()
    if tmax.empty:
        return None, []
    years = max(1, len(set(tmax.index.year)))
    hot = tmax > HOT_C
    months = [m for m in range(1, 13) if hot[tmax.index.month == m].sum() / years >= 1]
    return round(float(hot.sum() / years), 1), months


def normal_rain(df: pd.DataFrame, start: date, end: date) -> float | None:
    """Lluvia media de esas mismas fechas en los años del período (sin el año en curso)."""
    rain = df["PRECTOTCORR"].dropna()
    if rain.empty:
        return None
    totals = []
    for y in sorted(set(rain.index.year)):
        try:
            s, e = start.replace(year=y), end.replace(year=y + (end.year - start.year))
        except ValueError:
            continue
        chunk = rain.loc[pd.Timestamp(s) : pd.Timestamp(e)]
        if len(chunk) >= 0.9 * ((e - s).days + 1):
            totals.append(float(chunk.sum()))
    return round(sum(totals) / len(totals), 1) if totals else None


def forecast_window(fc: Forecast | None, days: int):
    return fc.days[:days] if fc else []


def build_alerts(
    profile: Profile,
    forecast: Forecast | None,
    past: RainSummary | None,
    smap_anomaly_pct: float | None,
) -> list[Alert]:
    """Alertas tempranas con mensajes según el perfil. Ordenadas por gravedad y fecha."""
    out: list[Alert] = []
    huerta = profile == "huerta"
    src_fc = "Open-Meteo (pronóstico, no es NASA)"
    days = forecast.days if forecast else []

    def spans(pred) -> list[list]:
        groups, cur = [], []
        for d in days:
            if pred(d):
                cur.append(d)
            elif cur:
                groups.append(cur)
                cur = []
        if cur:
            groups.append(cur)
        return groups

    for g in spans(lambda d: d.tmin_c is not None and d.tmin_c <= FROST_RISK_C):
        low = min(d.tmin_c for d in g)
        hard = low <= FROST_C
        when = g[0].date.strftime(FMT) + (f" al {g[-1].date.strftime(FMT)}" if len(g) > 1 else "")
        out.append(Alert(
            id=f"helada-{g[0].date}", kind="helada", severity=Severity.ALTA if hard else Severity.MEDIA,
            title=f"{'Helada' if hard else 'Posible helada'} el {when} (mínima {low:.0f} °C)",
            message=(
                "Cubrí las plantas sensibles (tomate, pimiento, zapallo, albahaca) con manta antihelada o nylon esa noche "
                "y regá a la tarde: el suelo húmedo guarda calor. No trasplantes hasta que pase."
                if huerta
                else "Puede dañar cultivos recién emergidos o en floración. Postergá siembras sensibles al frío y revisá "
                "el lote después de la helada."
            ),
            start=g[0].date, end=g[-1].date, source=src_fc,
        ))

    for g in spans(lambda d: d.tmax_c is not None and d.tmax_c >= HOT_C):
        top = max(d.tmax_c for d in g)
        out.append(Alert(
            id=f"calor-{g[0].date}", kind="calor", severity=Severity.ALTA if top >= VERY_HOT_C or len(g) >= 3 else Severity.MEDIA,
            title=f"Calor fuerte: {len(g)} {'día' if len(g) == 1 else 'días'} con más de {HOT_C:.0f} °C desde el {g[0].date.strftime(FMT)} (máxima {top:.0f} °C)",
            message=(
                "Regá temprano a la mañana o al atardecer, poné media sombra a las hojas tiernas y cubrí el suelo con paja "
                "para que no se seque."
                if huerta
                else "Golpe de calor: si coincide con la floración de maíz o soja puede bajar el rendimiento. Revisá el agua "
                "del perfil y evitá pulverizar en las horas de más calor."
            ),
            start=g[0].date, end=g[-1].date, source=src_fc,
        ))

    for d in days:
        if d.precip_mm is not None and d.precip_mm >= HEAVY_RAIN_MM:
            out.append(Alert(
                id=f"lluvia-{d.date}", kind="lluvia_intensa",
                severity=Severity.ALTA if d.precip_mm >= VERY_HEAVY_RAIN_MM else Severity.MEDIA,
                title=f"Lluvia intensa el {d.date.strftime(FMT)} (~{d.precip_mm:.0f} mm)",
                message=(
                    "No riegues esos días, revisá que el agua escurra y no se encharquen los canteros; protegé los almácigos."
                    if huerta
                    else "Riesgo de erosión y encharcamiento en lotes con suelo desnudo. Evitá pulverizar antes de la lluvia "
                    "y revisá caminos y bajos."
                ),
                start=d.date, end=d.date, source=src_fc,
            ))

    for d in days:
        if d.wind_max_kmh is not None and d.wind_max_kmh >= WIND_KMH:
            out.append(Alert(
                id=f"viento-{d.date}", kind="viento", severity=Severity.MEDIA,
                title=f"Viento fuerte el {d.date.strftime(FMT)} (ráfagas de ~{d.wind_max_kmh:.0f} km/h)",
                message=("Atá tutores y cubrí almácigos." if huerta
                         else "Más erosión eólica en lotes sin cobertura; no pulverices."),
                start=d.date, end=d.date, source=src_fc,
            ))
            break

    window = days[:DRY_WINDOW_DAYS]
    if len(window) >= 7:
        rain = sum(d.precip_mm or 0 for d in window)
        et0 = sum(d.et0_mm or 0 for d in window)
        past_dry = past is not None and past.pct_of_normal is not None and past.pct_of_normal < DRY_PAST_PCT
        if rain < DRY_RAIN_MM and et0 > DRY_ET0_MM:
            need = max(0.0, et0 * HUERTA_KC - EFFECTIVE_RAIN * rain) / len(window) * 7
            out.append(Alert(
                id="falta-de-agua", kind="falta_de_agua", severity=Severity.ALTA if past_dry else Severity.MEDIA,
                title=f"Sin lluvia los próximos {len(window)} días" + (" y el último mes llovió poco" if past_dry else ""),
                message=(
                    f"Vas a tener que regar: unos {need:.0f} litros por m² por semana, repartidos en 2 o 3 riegos."
                    if huerta
                    else f"Se pronostican {rain:.0f} mm contra {et0:.0f} mm de evaporación: el perfil se va a secar. "
                    "Medí la humedad antes de sembrar y ajustá la densidad."
                ),
                start=window[0].date, end=window[-1].date,
                source=src_fc + (" y NASA POWER (lluvia del último mes)" if past_dry else ""),
            ))
    elif past is not None and past.pct_of_normal is not None and past.pct_of_normal < DRY_PAST_PCT:
        out.append(Alert(
            id="falta-de-agua", kind="falta_de_agua", severity=Severity.MEDIA,
            title=f"El último mes llovió el {past.pct_of_normal:.0f} % de lo normal",
            message=("Revisá la humedad de la tierra antes de cada riego." if huerta
                     else "El perfil puede estar más seco que lo habitual: medilo antes de sembrar."),
            start=past.start, end=past.end, source="NASA POWER",
        ))

    if smap_anomaly_pct is not None and smap_anomaly_pct <= SMAP_DRY_PCT:
        out.append(Alert(
            id="suelo-seco", kind="suelo_seco", severity=Severity.MEDIA,
            title=f"Suelo más seco que lo normal ({smap_anomaly_pct:.0f} %)",
            message=("La tierra de la zona está más seca que otros años: regá más seguido y cubrí el suelo." if huerta
                     else "SMAP muestra la zona de raíces más seca que lo habitual para la época. Es un dato regional (9 km): "
                     "confirmalo en el lote."),
            source="NASA SMAP",
        ))

    order = {Severity.ALTA: 0, Severity.MEDIA: 1, Severity.INFO: 2}
    return sorted(out, key=lambda a: (order[a.severity], a.start or date.max))


# ------------------------------------------------------------------ servicio


class EarlyWarningService:
    def __init__(self, repo, power: PowerService, forecast: ForecastService, satellite=None,
                 today: date | None = None) -> None:
        self.repo = repo
        self.power = power
        self.forecast_service = forecast
        self.satellite = satellite
        self.today = today or datetime.now(timezone.utc).date()

    def place(self, field_id: str | None, lat: float | None, lon: float | None):
        if field_id:
            f = self.repo.get_field(field_id)
            return f, f.location.lat, f.location.lon
        if lat is None or lon is None:
            raise InvalidInputError("Indicá field_id, o latitude y longitude.")
        return None, lat, lon

    def history(self, lat: float, lon: float):
        start, end = climate_period(None, None, self.today)
        params = resolve_parameters(None)
        return self.power.get_daily(lat, lon, start, end, params, "AG"), start, end, params

    def past_rain(self, lat: float, lon: float, hist_df: pd.DataFrame) -> tuple[RainSummary | None, list[str]]:
        end = self.today - timedelta(days=POWER_LATENCY_DAYS)
        start = end - timedelta(days=PAST_DAYS - 1)
        try:
            data = self.power.get_daily(lat, lon, start, end, ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR"], "AG")
        except NoDataError as exc:
            return None, [f"Lluvia reciente no disponible: {exc.message}"]
        rain = data.df["PRECTOTCORR"].dropna()
        warnings = [f"Lluvia reciente: {w}" for w in data.warnings]
        if rain.empty:
            return None, [*warnings, "NASA POWER todavía no tiene la lluvia de las últimas semanas."]
        first, last = rain.index.min().date(), rain.index.max().date()
        total = round(float(rain.sum()), 1)
        normal = normal_rain(hist_df, first, last)
        pct = round(100 * total / normal, 0) if normal else None
        detail = f"Lluvia del {first:%d/%m} al {last:%d/%m}" + (" (POWER publica con unos días de atraso)" if last < end else "")
        return RainSummary(days=(last - first).days + 1, total_mm=total, normal_mm=normal, pct_of_normal=pct, start=first,
                           end=last, source=power_source(data.status, data.retrieved_at, detail)), warnings

    def _forecast(self, lat: float, lon: float, days: int = 10) -> tuple[Forecast | None, list[str]]:
        try:
            return self.forecast_service.get(lat, lon, days), []
        except NoDataError as exc:
            return None, [exc.message]

    def _smap(self, field_id, lat, lon) -> tuple[float | None, SourceInfo | None, list[str]]:
        if self.satellite is None:
            return None, None, []
        try:
            req = SoilMoistureRequest(field_id=field_id) if field_id else SoilMoistureRequest(latitude=lat, longitude=lon)
            summary, w = self.satellite.soil_moisture(req)
        except (NoDataError, InvalidInputError) as exc:
            return None, None, [f"SMAP no disponible: {exc.message}"]
        anomaly = summary.water_stress.anomaly_pct
        src = trace_source("NASA SMAP", summary.trace)
        return anomaly, src, [f"SMAP: {x}" for x in w]

    def alerts(self, profile: Profile, field_id=None, lat=None, lon=None) -> AlertsResult:
        field, lat, lon = self.place(field_id, lat, lon)
        warnings: list[str] = []
        hist, *_ = self.history(lat, lon)
        warnings += hist.warnings
        past, w = self.past_rain(lat, lon, hist.df)
        warnings += w
        fc, w = self._forecast(lat, lon)
        warnings += w
        anomaly, smap_src, w = self._smap(field.id if field else None, lat, lon)
        warnings += w
        sources = [power_source(hist.status, hist.retrieved_at, "Clima de los últimos 10 años y lluvia reciente")]
        if fc:
            sources.append(fc.source)
        if smap_src:
            sources.append(smap_src)
        return AlertsResult(
            profile=profile,
            alerts=build_alerts(profile, fc, past, anomaly),
            forecast=fc,
            past_rain=past,
            future_rain_mm=round(sum(d.precip_mm or 0 for d in fc.days), 1) if fc else None,
            sources=sources,
            warnings=list(dict.fromkeys(warnings)),
        )

    def huerta(self, field_id=None, lat=None, lon=None) -> HuertaPanel:
        field, lat, lon = self.place(field_id, lat, lon)
        warnings: list[str] = []
        hist, start, end, _ = self.history(lat, lon)
        warnings += hist.warnings
        src = power_source(hist.status, hist.retrieved_at, f"Promedio {start.year}-{end.year}")
        summary = build_summary(hist, lat, lon, start, end, "AG", "power", include_daily=False, field_id=field_id)

        fdays, fmonths, last, first = frost_stats(hist.df, lat)
        frost = FrostInfo(frost_days_per_year=fdays, frost_months=fmonths, last_frost_typical=last,
                          first_frost_typical=first, source=src)

        month = self.today.month
        clim = {c.month: c for c in summary.monthly_climatology}
        c = clim.get(month)
        days_in_month = 30.4
        et0_w = (c.et0_mm or 0) / days_in_month * 7 if c else 0.0
        rain_w = (c.precip_mm or 0) / days_in_month * 7 if c else 0.0
        weekly = max(0.0, et0_w * HUERTA_KC - EFFECTIVE_RAIN * rain_w)

        fc, w = self._forecast(lat, lon, 10)
        warnings += w
        with_fc = None
        nxt = forecast_window(fc, 7)
        if len(nxt) == 7 and all(d.et0_mm is not None for d in nxt):
            with_fc = round(max(0.0, sum(d.et0_mm for d in nxt) * HUERTA_KC - EFFECTIVE_RAIN * sum(d.precip_mm or 0 for d in nxt)), 0)
        irrigation = IrrigationInfo(
            weekly_l_per_m2=round(weekly, 0), daily_l_per_m2=round(weekly / 7, 1),
            with_forecast_l_per_m2=with_fc,
            basis=(f"En {MONTHS[month - 1]} la evaporación normal es de ~{et0_w:.0f} mm por semana y llueven ~{rain_w:.0f} mm "
                   f"(NASA POWER). Se repone lo que falta para una huerta en producción (Kc {HUERTA_KC:g}); "
                   "1 mm = 1 litro por m²."),
            et0_weekly_mm=round(et0_w, 1), rain_weekly_mm=round(rain_w, 1), source=src,
        )

        hot_year, hot_months = heat_stats(hist.df)
        heat = HeatInfo(hot_days_per_year=hot_year, hot_months=hot_months,
                        next_hot_days=sum(1 for d in (fc.days if fc else []) if d.tmax_c is not None and d.tmax_c >= HOT_C),
                        source=src)

        past, w = self.past_rain(lat, lon, hist.df)
        warnings += w
        anomaly, smap_src, w = self._smap(field.id if field else None, lat, lon)
        warnings += w

        vegetation = None
        if self.satellite is not None:
            try:
                vreq = VegetationRequest(field_id=field.id) if field else VegetationRequest(latitude=lat, longitude=lon)
                v, vw = self.satellite.vegetation(vreq)
                level = ("poca vegetación" if (v.mean_ndvi or 0) < 0.3 else "vegetación moderada" if (v.mean_ndvi or 0) < 0.5
                         else "mucha vegetación")
                cover = round(v.cover_fraction_mean * 100, 0) if v.cover_fraction_mean is not None else None
                vegetation = VegetationInfo(
                    mean_ndvi=v.mean_ndvi, cover_pct=cover,
                    text=f"La zona alrededor tiene {level} (NDVI medio {v.mean_ndvi:.2f}). Es un píxel de 250 m: describe el "
                         "entorno, no tu huerta." if v.mean_ndvi is not None else "Sin datos de verdor para la zona.",
                    source=trace_source("NASA MODIS (NDVI)", v.trace),
                )
                warnings += [f"NDVI: {x}" for x in vw]
            except (NoDataError, InvalidInputError) as exc:
                warnings.append(f"NDVI no disponible: {exc.message}")

        tips = huerta_tips(frost, heat, irrigation, month, lat)
        sources = [src] + ([fc.source] if fc else []) + ([smap_src] if smap_src else []) + ([vegetation.source] if vegetation else [])
        return HuertaPanel(
            field_id=field.id if field else None, name=field.name if field else None, latitude=lat, longitude=lon,
            frost=frost, irrigation=irrigation, heat=heat, past_rain=past, forecast=fc, vegetation=vegetation,
            alerts=build_alerts("huerta", fc, past, anomaly), tips=tips, sources=sources, warnings=list(dict.fromkeys(warnings)),
        )


MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def huerta_tips(frost: FrostInfo, heat: HeatInfo, irr: IrrigationInfo, month: int, lat: float) -> list[str]:
    tips = []
    if month in frost.frost_months:
        tips.append("En este mes suele helar: tené a mano manta antihelada y sembrá verduras de hoja resistentes (acelga, lechuga, espinaca, haba).")
    elif frost.last_frost_typical:
        tips.append(f"Las heladas suelen terminar hacia el {frost.last_frost_typical}: después de esa fecha es seguro trasplantar tomate, pimiento y zapallo.")
    if month in heat.hot_months:
        tips.append("Es época de calor fuerte: regá temprano o al atardecer y cubrí el suelo con paja o pasto seco.")
    if irr.weekly_l_per_m2 >= 25:
        tips.append("La demanda de agua es alta: el riego por goteo y la cobertura del suelo ahorran hasta la mitad del agua.")
    elif irr.weekly_l_per_m2 <= 5:
        tips.append("En esta época la lluvia y el rocío cubren casi todo: regá solo si la tierra está seca a 5 cm de profundidad.")
    tips.append("Rotá las familias de cultivos entre canteros cada temporada (hojas, frutos, raíces, legumbres) para cuidar el suelo.")
    return tips
