import type { Boundary } from "@/types/api";
import { tr } from "./i18n";

export type LngLat = [number, number];

const R = 6_371_008.8; // radio medio de la Tierra, en metros
const rad = (d: number) => (d * Math.PI) / 180;

export const isValidLatLon = (lat: number, lon: number) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

export function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

const open = (ring: LngLat[]): LngLat[] => {
  const closed = closeRing(ring);
  return closed.length > 1 ? closed.slice(0, -1) : closed;
};

/** Proyección equirrectangular local: suficiente para lotes de hasta unos pocos km. */
function project(ring: LngLat[], lat0: number): [number, number][] {
  const k = Math.cos(rad(lat0));
  return ring.map(([lon, lat]) => [R * rad(lon) * k, R * rad(lat)]);
}

export function ringAreaHa(ring: LngLat[]): number {
  const pts = open(ring);
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const xy = project(pts, lat0);
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2 / 10_000;
}

export function ringCentroid(ring: LngLat[]): { lat: number; lon: number } {
  const pts = open(ring);
  if (pts.length === 0) throw new Error(tr("El polígono está vacío.", "The polygon is empty."));
  const mean = { lon: pts.reduce((a, p) => a + p[0], 0) / pts.length, lat: pts.reduce((a, p) => a + p[1], 0) / pts.length };
  if (pts.length < 3) return mean;
  const xy = project(pts, mean.lat);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-9) return mean; // vértices alineados
  const k = Math.cos(rad(mean.lat));
  const x = cx / (3 * a);
  const y = cy / (3 * a);
  return { lon: (x / (R * k)) * (180 / Math.PI), lat: (y / R) * (180 / Math.PI) };
}

export function toBoundary(ring: LngLat[]): Boundary {
  return { type: "Polygon", coordinates: [closeRing(ring).map(([lon, lat]) => [round6(lon), round6(lat)] as [number, number])] };
}

export function fromBoundary(b: Boundary | null | undefined): LngLat[] | null {
  const ring = b?.coordinates?.[0];
  return ring && ring.length >= 4 ? (ring.map(([lon, lat]) => [lon, lat]) as LngLat[]) : null;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

function ringFromGeometry(g: unknown): LngLat[][] {
  if (!g || typeof g !== "object") return [];
  const geo = g as { type?: string; coordinates?: unknown; geometries?: unknown[]; features?: unknown[]; geometry?: unknown };
  switch (geo.type) {
    case "Polygon":
      return [((geo.coordinates as number[][][])?.[0] ?? []) as LngLat[]];
    case "MultiPolygon":
      return ((geo.coordinates as number[][][][]) ?? []).map((p) => (p[0] ?? []) as LngLat[]);
    case "Feature":
      return ringFromGeometry(geo.geometry);
    case "FeatureCollection":
      return (geo.features ?? []).flatMap(ringFromGeometry);
    case "GeometryCollection":
      return (geo.geometries ?? []).flatMap(ringFromGeometry);
    default:
      return [];
  }
}

/** Lee un GeoJSON (Polygon, MultiPolygon, Feature o FeatureCollection) y devuelve el borde exterior del polígono más grande. */
export function parseGeoJson(text: string): LngLat[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(tr("El archivo no es un GeoJSON válido (no se pudo leer el JSON).", "The file is not valid GeoJSON (the JSON could not be read)."));
  }
  const rings = ringFromGeometry(json).filter((r) => Array.isArray(r) && r.length >= 3);
  if (rings.length === 0) throw new Error(tr("No encontré ningún polígono en el archivo. Tiene que ser un GeoJSON de tipo Polygon o MultiPolygon.", "No polygon was found in the file. It must be a GeoJSON of type Polygon or MultiPolygon."));
  const best = rings.reduce((a, b) => (ringAreaHa(b) >= ringAreaHa(a) ? b : a));
  const clean = best.map((p) => [Number(p[0]), Number(p[1])] as LngLat);
  if (clean.some(([lon, lat]) => !isValidLatLon(lat, lon))) {
    throw new Error(tr("Las coordenadas del polígono están fuera de rango. El GeoJSON debe estar en WGS84 (longitud, latitud).", "The polygon coordinates are out of range. The GeoJSON must be in WGS84 (longitude, latitude)."));
  }
  return closeRing(clean);
}

/** Acepta "-33.85, -65.2" · "-33.85;-65.2" · "-33,85 -65,2" (coma decimal separada por espacio). */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const t = text.trim();
  if (!t) return null;
  const commas = (t.match(/,/g) ?? []).length;
  let parts: string[];
  if (t.includes(";")) parts = t.split(";");
  else if (commas === 1 && (t.includes(".") || !/\s/.test(t))) parts = t.split(",");
  else parts = t.split(/\s+/);
  if (parts.length !== 2) return null;
  const [lat, lon] = parts.map((p) => Number(p.trim().replace(",", ".")));
  return isValidLatLon(lat, lon) ? { lat, lon } : null;
}
