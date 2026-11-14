export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Búsqueda de lugares con Nominatim (OpenStreetMap). El pedido sale desde el navegador de quien usa la app
 * y lleva solo el texto buscado. Uso moderado: es un servicio público y gratuito.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Búsqueda no disponible (${res.status}).`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows
    .map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
