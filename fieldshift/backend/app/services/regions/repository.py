"""Provincias y zonas precalculadas (GeoJSON en data/samples), zona de un punto y transición húmedo/seco.

Orden de respaldo de las zonas de una provincia: zonas_<provincia>.geojson (calculadas con NASA POWER por
scripts/build_zones.py --live) -> zonas_<provincia>_muestra.geojson (DATO DE MUESTRA) -> "zonificación próximamente".
"""

from __future__ import annotations

import json
from collections import Counter
from functools import cached_property
from pathlib import Path

from app.models.enums import Confidence, DataStatus, Level
from app.schemas.crop import Crop
from app.schemas.regions import (
    CropSuitability,
    Transition,
    TransitionOption,
    ZoneAt,
    ZoneCell,
    ZoneClimate,
    ZonesOut,
    ZoneSuitability,
    ZoneSummary,
)
from app.services.regions import geo
from app.services.regions.suitability import rank
from app.services.regions.zoning import LABELS, LIMITS
from app.services.regions.zoning import ORDER as ZONE_ORDER
from app.utils.exceptions import NotFoundError

TRANSITION_KM = 25.0  # cerca del borde con otra zona (media celda de POWER)
AI_MARGIN = 0.05  # índice de aridez a esta distancia o menos de un límite de clase
OTHER_YEARS_PCT = 30.0  # 3 de cada 10 años o más en otra clase
TOP_CROPS = 5


class ZoneNotFoundError(NotFoundError):
    code = "ZONE_NOT_FOUND"


class RegionRepository:
    def __init__(self, folder: Path, crops: dict[str, Crop]) -> None:
        self.folder = folder
        self.crops = crops
        self._zones: dict[str, dict | None] = {}

    # --- carga ---
    @cached_property
    def provinces(self) -> dict:
        path = self.folder / "provincias_argentina.geojson"
        if not path.exists():
            raise NotFoundError("No están los límites provinciales (data/samples/provincias_argentina.geojson).")
        return json.loads(path.read_text(encoding="utf-8"))

    def province(self, province_id: str) -> dict:
        for f in self.provinces["features"]:
            if f["properties"]["id"] == province_id:
                return f
        raise NotFoundError(f"No existe la provincia '{province_id}'.")

    def zones_file(self, province_id: str) -> dict | None:
        if province_id not in self._zones:
            stem = province_id.replace("-", "_")
            data = None
            for name in (f"zonas_{stem}.geojson", f"zonas_{stem}_muestra.geojson"):
                path = self.folder / name
                if path.exists():
                    data = json.loads(path.read_text(encoding="utf-8"))
                    break
            self._zones[province_id] = data
        return self._zones[province_id]

    @staticmethod
    def _origin(meta: dict) -> DataStatus:
        # Calculadas con POWER y guardadas (con fecha de cálculo): son datos reales, pero no "en vivo".
        return DataStatus.CACHED if meta.get("origin") == "live" else DataStatus.SAMPLE

    def confidence(self, meta: dict) -> Confidence:
        return Confidence.MEDIA if meta.get("origin") == "live" else Confidence.BAJA

    # --- provincias ---
    def provinces_out(self) -> list[dict]:
        out = []
        for f in self.provinces["features"]:
            pid = f["properties"]["id"]
            z = self.zones_file(pid)
            props = {**f["properties"], "has_zones": z is not None,
                     "zones_origin": self._origin(z["fieldshift"]).value if z else None}
            out.append({"type": "Feature", "properties": props, "geometry": f["geometry"]})
        return out

    def province_at(self, lat: float, lon: float) -> dict | None:
        for f in self.provinces["features"]:
            if geo.contains(f["geometry"], lat, lon):
                return f
        return None

    # --- zonas ---
    def _summary(self, feature: dict, meta: dict) -> ZoneSummary:
        p = feature["properties"]
        origin = self._origin(meta)
        return ZoneSummary(
            zone_id=p["zone_id"], zone_class=p["zone_class"], label=p["zone_label"], province_id=p["province_id"],
            climate=climate_of(p), cells=p["cells"], area_km2=p["area_km2"], origin=origin, origin_label=origin.origin_label,
            period=meta.get("period", ""), method=meta.get("method", ""), generated_at=meta.get("generated_at"),
        )

    def zones_out(self, province_id: str) -> ZonesOut:
        prov = self.province(province_id)
        name = prov["properties"]["name"]
        data = self.zones_file(province_id)
        if data is None:
            return ZonesOut(province_id=province_id, province_name=name, available=False,
                            warning="Zonificación disponible próximamente para esta provincia.")
        meta = data["fieldshift"]
        conf = self.confidence(meta)
        zones = []
        for f in data["features"]:
            if f["properties"]["kind"] != "zone":
                continue
            suit = rank(list(self.crops.values()), climate_of(f["properties"]), conf)
            props = {**f["properties"], "suitability": [{"crop_id": s.crop_id, "crop_name": s.crop_name, "level": s.level.value} for s in suit]}
            zones.append({"type": "Feature", "properties": props, "geometry": f["geometry"]})
        cells = [f for f in data["features"] if f["properties"]["kind"] == "cell"]
        origin = self._origin(meta)
        return ZonesOut(
            province_id=province_id, province_name=name, available=True, title=meta.get("title"), origin=origin,
            origin_label=origin.origin_label, period=meta.get("period"), method=meta.get("method"),
            thresholds=meta.get("thresholds"), generated_at=meta.get("generated_at"), warning=meta.get("warning"),
            zones=zones, cells=cells,
        )

    def _find_zone(self, zone_id: str) -> tuple[dict, dict]:
        province_id = zone_id.rsplit("-", 1)[0]
        for cls in ZONE_ORDER:
            if zone_id.endswith(f"-{cls}"):
                province_id = zone_id[: -len(cls) - 1]
        data = self.zones_file(province_id) if province_id else None
        if data:
            for f in data["features"]:
                if f["properties"]["kind"] == "zone" and f["properties"]["zone_id"] == zone_id:
                    return f, data["fieldshift"]
        raise ZoneNotFoundError(f"No existe la zona '{zone_id}'.")

    def suitability(self, zone_id: str) -> ZoneSuitability:
        f, meta = self._find_zone(zone_id)
        summary = self._summary(f, meta)
        return ZoneSuitability(zone=summary, crops=rank(list(self.crops.values()), summary.climate, self.confidence(meta)))

    # --- un punto ---
    def zone_at(self, lat: float, lon: float) -> ZoneAt:
        prov = self.province_at(lat, lon)
        if prov is None:
            raise NotFoundError("El punto está fuera de las provincias de Argentina cargadas.")
        pid, pname = prov["properties"]["id"], prov["properties"]["name"]
        data = self.zones_file(pid)
        if data is None:
            return ZoneAt(latitude=lat, longitude=lon, province_id=pid, province_name=pname, zones_available=False,
                          note="Zonificación disponible próximamente para esta provincia.")
        meta = data["fieldshift"]
        conf = self.confidence(meta)
        cells = [f for f in data["features"] if f["properties"]["kind"] == "cell"]
        cell = next((c for c in cells if geo.contains(c["geometry"], lat, lon)), None)
        if cell is None:  # borde simplificado: la celda más cercana
            cell = min(cells, key=lambda c: geo.distance_km(c["geometry"], lat, lon))
        cp = cell["properties"]
        zone_f, _ = self._find_zone(cp["zone_id"])
        clim = climate_of(cp)
        crops = list(self.crops.values())
        suit = rank(crops, clim, conf)
        transition = self.transition(lat, lon, cp, data, clim, conf, suit)
        return ZoneAt(
            latitude=lat, longitude=lon, province_id=pid, province_name=pname, zones_available=True,
            zone=self._summary(zone_f, meta),
            cell=ZoneCell(cell_id=cp["cell_id"], center_lat=cp["center_lat"], center_lon=cp["center_lon"], climate=clim),
            transition=transition,
            top_crops=[s for s in suit if not self.crops[s.crop_id].is_cover_crop and s.level != Level.BAJO][:TOP_CROPS],
            note=meta.get("warning"),
        )

    def transition(self, lat, lon, cp: dict, data: dict, clim: ZoneClimate, conf, suit: list[CropSuitability]) -> Transition:
        cls = cp["zone_class"]
        reasons: list[str] = []
        other: str | None = None

        # a) cerca del borde con otra zona
        dist = None
        for f in data["features"]:
            p = f["properties"]
            if p["kind"] != "zone" or p["zone_class"] == cls:
                continue
            d = geo.distance_km(f["geometry"], lat, lon)
            if dist is None or d < dist:
                dist, near = d, p["zone_class"]
        if dist is not None and dist <= TRANSITION_KM:
            reasons.append(f"Está a {dist:.0f} km del borde con la zona {LABELS[near].lower()} (umbral: {TRANSITION_KM:.0f} km).")
            other = near

        # b) índice de aridez cerca de un límite
        ai = clim.aridity_index
        limit = min(LIMITS, key=lambda x: abs(ai - x))
        margin = round(abs(ai - limit), 3)
        if margin <= AI_MARGIN:
            reasons.append(f"Su índice de aridez ({ai:.2f}) está a {margin:.2f} del límite {limit:.2f} entre dos zonas.")
            other = other or ZONE_ORDER[ZONE_ORDER.index(cls) + (1 if ai < limit else -1)]

        # c) años que cambian de zona
        pct = cp.get("years_other_class_pct")
        if pct is not None and pct >= OTHER_YEARS_PCT:
            counts = Counter(y["zone_class"] for y in cp.get("yearly", []) if y["zone_class"] != cls)
            freq = counts.most_common(1)[0][0] if counts else None
            years = round(pct / 10)
            reasons.append(f"En {pct:.0f} % de los años (unos {years} de cada 10) se comportó como otra zona.")
            other = other or freq

        if not reasons or other is None:
            return Transition(is_transition=False, reasons=reasons, message=None, other_zone_class=None, other_zone_label=None,
                              distance_to_border_km=round(dist, 1) if dist is not None else None, aridity_margin=margin,
                              years_other_class_pct=pct)
        a, b = sorted([cls, other], key=ZONE_ORDER.index, reverse=True)
        message = (f"Tu campo está en una zona de transición entre {LABELS[a].lower()} y {LABELS[b].lower()}: "
                   "según el año, se comporta como una u otra.")
        other_clim = shifted_climate(clim, other)
        suit_other = rank(list(self.crops.values()), other_clim, conf)
        return Transition(
            is_transition=True, reasons=reasons, message=message, other_zone_class=other, other_zone_label=LABELS[other],
            distance_to_border_km=round(dist, 1) if dist is not None else None, aridity_margin=margin, years_other_class_pct=pct,
            options=self.options(suit, suit_other), suitability_other=suit_other,
        )

    def options(self, here: list[CropSuitability], other: list[CropSuitability]) -> list[TransitionOption]:
        lv = {s.crop_id: s.level for s in other}
        both = [s.crop_name for s in here if not self.crops[s.crop_id].is_cover_crop and s.level != Level.BAJO
                and lv.get(s.crop_id) != Level.BAJO and self.crops[s.crop_id].drought_tolerance == Level.ALTO]
        covers = [c.name for c in self.crops.values() if c.is_cover_crop]
        src = "Catálogo de cultivos de FieldShift (tolerancias a validar con INTA)"
        return [
            TransitionOption(
                title="Cultivos más tolerantes a sequía",
                detail=", ".join(both) if both else "Ningún cultivo del catálogo queda con aptitud media o alta en las dos zonas.",
                reason="Tienen aptitud media o alta en las dos zonas: rinden menos en el año húmedo, pero se caen menos en el seco.",
                source=src,
            ),
            TransitionOption(
                title="Cultivos de cobertura",
                detail=", ".join(covers),
                reason="Protegen el suelo del viento en los años secos y aprovechan el agua de los húmedos. En años secos, secarlos temprano para no gastar el agua del cultivo siguiente.",
                source=src + "; FAO, agricultura de conservación",
            ),
            TransitionOption(
                title="Flexibilidad en la fecha de siembra",
                detail="Decidir la fecha y el cultivo con el agua que hay en el perfil al momento de sembrar.",
                reason="En transición, el año define el comportamiento: medir el perfil (y mirar SMAP como contexto) antes de decidir.",
                source="NASA SMAP (contexto regional) y medición en el lote",
            ),
            TransitionOption(
                title="Barbecho para acumular agua",
                detail="Barbecho limpio y con rastrojo antes del cultivo más exigente.",
                reason="Guarda en el perfil parte de la lluvia del barbecho para el cultivo siguiente (eficiencia de barbecho: supuesto del motor).",
                source="Motor de FieldShift, eficiencia de barbecho (docs/assumptions.md)",
            ),
        ]


def climate_of(p: dict) -> ZoneClimate:
    return ZoneClimate(
        precip_mm=p["precip_mm"], et0_mm=p["et0_mm"], deficit_mm=p["deficit_mm"], aridity_index=p["aridity_index"],
        hot_days=p["hot_days"], frost_days=p["frost_days"], precip_cv_pct=p.get("precip_cv_pct"),
        years_other_class_pct=p.get("years_other_class_pct", 0.0),
    )


def shifted_climate(clim: ZoneClimate, target: str) -> ZoneClimate:
    """El mismo lugar en un año que se comporta como la otra zona: la lluvia que lleva el índice de aridez al centro
    de esa clase, con la misma ET0. Es un supuesto para comparar, no un pronóstico."""
    mid = {"arido": 0.15, "semiarido": 0.35, "subhumedo_seco": 0.575, "humedo": 0.75}[target]
    precip = mid * clim.et0_mm
    return clim.model_copy(update={"precip_mm": round(precip), "deficit_mm": round(clim.et0_mm - precip), "aridity_index": mid})
