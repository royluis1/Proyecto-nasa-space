"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { mapLabel, styleFor } from "@/lib/zones";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Level } from "@/types/api";

export interface ZonesMapProps {
  provinces: Feature[];
  selectedProvince: string | null;
  zones: Feature[];
  cells: Feature[];
  showCells: boolean;
  cropId: string | null;
  cropName?: string;
  selectedZone: string | null;
  onProvince: (id: string) => void;
  onZone: (id: string) => void;
}

const ARGENTINA: L.LatLngBoundsExpression = [[-55.2, -73.6], [-21.7, -53.6]];

type ZoneProps = { zone_id: string; zone_class: string; zone_label: string; suitability?: { crop_id: string; crop_name?: string; level: Level }[] };

function FitTo({ feature }: { feature: Feature | null }) {
  const map = useMap();
  useEffect(() => {
    if (feature) map.fitBounds(L.geoJSON(feature as Feature<Geometry>).getBounds(), { padding: [20, 20] });
    else map.fitBounds(ARGENTINA);
  }, [feature, map]);
  return null;
}

/** Mapa de Argentina por provincias; en la provincia elegida, sus zonas climáticas con color, patrón y rótulo. */
export default function ZonesMap({ provinces, selectedProvince, zones, cells, showCells, cropId, cropName, selectedZone, onProvince, onZone }: ZonesMapProps) {
  const selected = provinces.find((f) => (f.properties as { id: string }).id === selectedProvince) ?? null;
  return (
    <MapContainer bounds={ARGENTINA} scrollWheelZoom className="z-0 h-[460px] w-full sm:h-[560px]">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© colaboradores de OpenStreetMap" maxZoom={12} opacity={0.6} />
      <GeoJSON
        key={`prov-${selectedProvince}`}
        data={{ type: "FeatureCollection", features: provinces } as FeatureCollection}
        style={(f) => {
          const p = f?.properties as { id: string; has_zones: boolean };
          const isSel = p.id === selectedProvince;
          return { color: "#33433a", weight: isSel ? 3 : 1, fillColor: p.has_zones ? "#5fa05f" : "#9aa59c", fillOpacity: isSel ? 0.02 : p.has_zones ? 0.25 : 0.12, dashArray: p.has_zones ? undefined : "4 4" };
        }}
        onEachFeature={(f, layer) => {
          const p = f.properties as { id: string; name: string; has_zones: boolean };
          layer.bindTooltip(`${p.name}${p.has_zones ? " · con zonas" : " · zonificación próximamente"}`, { sticky: true });
          layer.on("click", () => onProvince(p.id));
        }}
      />
      {zones.length > 0 && (
        <GeoJSON
          key={`zones-${selectedProvince}-${cropId}-${selectedZone}`}
          data={{ type: "FeatureCollection", features: zones } as FeatureCollection}
          style={(f) => {
            const p = f?.properties as ZoneProps;
            const s = styleFor(p, cropId);
            const isSel = p.zone_id === selectedZone;
            return { color: isSel ? "#0e1712" : s.ink, weight: isSel ? 4 : 1.5, fillColor: `url(#${s.id})`, fillOpacity: 0.85 };
          }}
          onEachFeature={(f, layer) => {
            const p = f.properties as ZoneProps;
            layer.bindTooltip(mapLabel(p, cropId, cropName), { permanent: true, direction: "center", className: "fs-zone-label" });
            layer.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              onZone(p.zone_id);
            });
          }}
        />
      )}
      {showCells && cells.length > 0 && (
        <GeoJSON
          key={`cells-${selectedProvince}`}
          data={{ type: "FeatureCollection", features: cells } as FeatureCollection}
          style={() => ({ color: "#0e1712", weight: 1, dashArray: "3 3", fillOpacity: 0 })}
          interactive={false}
        />
      )}
      <FitTo feature={selected} />
    </MapContainer>
  );
}
