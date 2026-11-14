import { describe, expect, it } from "vitest";
import { closeRing, fromBoundary, parseCoordinates, parseGeoJson, ringAreaHa, ringCentroid, toBoundary, type LngLat } from "@/lib/geometry";

// Cuadrado de ~100 m de lado cerca de Villa Mercedes (lat -33.7)
const lat0 = -33.7, lon0 = -65.4;
const dLat = 100 / 111_320;
const dLon = 100 / (111_320 * Math.cos((lat0 * Math.PI) / 180));
const square: LngLat[] = [[lon0, lat0], [lon0 + dLon, lat0], [lon0 + dLon, lat0 + dLat], [lon0, lat0 + dLat]];

describe("geometría del lote", () => {
  it("un cuadrado de 100 m x 100 m tiene 1 ha", () => {
    expect(ringAreaHa(closeRing(square))).toBeCloseTo(1, 1);
  });
  it("el área no depende de si el anillo está cerrado", () => {
    expect(ringAreaHa(square)).toBeCloseTo(ringAreaHa(closeRing(square)), 6);
  });
  it("el centroide del cuadrado es su centro", () => {
    const c = ringCentroid(closeRing(square));
    expect(c.lat).toBeCloseTo(lat0 + dLat / 2, 5); // 5 decimales = ~1 m
    expect(c.lon).toBeCloseTo(lon0 + dLon / 2, 5);
  });
  it("con pocos puntos devuelve algo razonable y 0 ha", () => {
    expect(ringAreaHa([[lon0, lat0], [lon0, lat0]])).toBe(0);
    expect(ringCentroid([[lon0, lat0]])).toEqual({ lat: lat0, lon: lon0 });
  });
  it("toBoundary cierra el anillo y fromBoundary lo devuelve", () => {
    const b = toBoundary(square);
    const ring = b.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(fromBoundary(b)).toHaveLength(5);
    expect(fromBoundary(null)).toBeNull();
  });
});

describe("GeoJSON", () => {
  const poly = { type: "Polygon", coordinates: [closeRing(square)] };
  it("lee Polygon, Feature, FeatureCollection y MultiPolygon", () => {
    for (const g of [poly, { type: "Feature", geometry: poly, properties: {} }, { type: "FeatureCollection", features: [{ type: "Feature", geometry: poly }] }]) {
      expect(parseGeoJson(JSON.stringify(g))).toHaveLength(5);
    }
    const multi = { type: "MultiPolygon", coordinates: [[closeRing(square)], [closeRing(square.map(([x, y]) => [x + 1, y + 1] as LngLat).map(([x, y]) => [x, y] as LngLat))]] };
    expect(parseGeoJson(JSON.stringify(multi)).length).toBeGreaterThanOrEqual(4);
  });
  it("elige el polígono más grande de un MultiPolygon", () => {
    const big: LngLat[] = square.map(([x, y]) => [lon0 + (x - lon0) * 10, lat0 + (y - lat0) * 10] as LngLat);
    const multi = { type: "MultiPolygon", coordinates: [[closeRing(square)], [closeRing(big)]] };
    expect(ringAreaHa(parseGeoJson(JSON.stringify(multi)))).toBeCloseTo(100, 0);
  });
  it("rechaza JSON roto, sin polígonos o fuera de rango, con mensajes claros", () => {
    expect(() => parseGeoJson("{no es json")).toThrow(/GeoJSON válido/);
    expect(() => parseGeoJson(JSON.stringify({ type: "Point", coordinates: [0, 0] }))).toThrow(/ningún polígono/);
    expect(() => parseGeoJson(JSON.stringify({ type: "Polygon", coordinates: [[[500, 0], [501, 0], [501, 1], [500, 0]]] }))).toThrow(/fuera de rango/);
  });
});

describe("coordenadas escritas a mano", () => {
  it.each([
    ["-33.85, -65.2", -33.85, -65.2],
    ["-33.85,-65.2", -33.85, -65.2],
    ["-33.85;-65.2", -33.85, -65.2],
    ["-33,85 -65,2", -33.85, -65.2],
    ["  -33.85   -65.2 ", -33.85, -65.2],
  ])("%s", (text, lat, lon) => {
    expect(parseCoordinates(text)).toEqual({ lat, lon });
  });
  it.each(["", "hola", "-33.85", "95, 10", "10, 200", "1,2,3"])("rechaza %j", (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});
