"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Check, ChevronLeft, ChevronRight, Eraser, FileUp, Hexagon, Map as MapIcon, MapPin, Navigation, Orbit, Satellite, Search, Undo2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchPlaces, type Place } from "@/lib/geocode";
import { GIBS_ATTRIBUTION, GIBS_FIRST_DATE, GIBS_MAX_NATIVE_ZOOM, clampGibsDate, defaultGibsDate, gibsUrl, shiftGibsDate } from "@/lib/gibs";
import { closeRing, parseCoordinates, parseGeoJson, ringAreaHa, ringCentroid, type LngLat } from "@/lib/geometry";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export interface MapPoint {
  lat: number;
  lon: number;
}
export interface OtherField {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface FieldMapProps {
  /** "edit": marcar punto y polígono. "overview": solo ver y elegir entre campos existentes. */
  mode?: "edit" | "overview";
  point?: MapPoint | null;
  polygon?: LngLat[] | null;
  onPointChange?: (p: MapPoint) => void;
  onPolygonChange?: (ring: LngLat[] | null) => void;
  others?: OtherField[];
  selectedId?: string | null;
  onSelectOther?: (id: string) => void;
  className?: string;
  /** Capa con la que arranca el mapa. "nasa" = imagen del día de NASA GIBS (MODIS Terra). */
  initialBase?: Base;
  /** Altura del mapa (clases de Tailwind). */
  heightClass?: string;
  /** Zoom inicial (por defecto, según el modo). */
  initialZoom?: number;
  /** Mostrar el buscador de lugares propio del mapa. Se apaga cuando la página ya tiene su buscador de ciudades. */
  showPlaceSearch?: boolean;
}

const SAN_LUIS: [number, number] = [-33.7, -65.8];
const MAX_GEOJSON_BYTES = 2_000_000;

const TILES = {
  mapa: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", get attribution() {
      return tr("© colaboradores de OpenStreetMap", "© OpenStreetMap contributors");
    } },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    get attribution() {
      return tr("Imágenes © Esri, Maxar, Earthstar Geographics y la comunidad GIS", "Imagery © Esri, Maxar, Earthstar Geographics and the GIS community");
    },
  },
} as const;

type Base = "mapa" | "satelite" | "nasa";

const pinHtml = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 1C8.7 1 2 7.5 2 15.6 2 26 17 43 17 43s15-17 15-27.4C32 7.5 25.3 1 17 1z" fill="${color}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="15.5" r="5.5" fill="#fff"/></svg>`;
const makePin = (color: string) => L.divIcon({ className: "", html: pinHtml(color), iconSize: [34, 44], iconAnchor: [17, 43], tooltipAnchor: [0, -38] });
const PIN_SELECTED = makePin("#2f6f40");
const PIN_OTHER = makePin("#8a6234");

function ClickHandler({ mode, drawing, onPoint, onVertex }: { mode: string; drawing: boolean; onPoint: (p: MapPoint) => void; onVertex: (v: LngLat) => void }) {
  useMapEvents({
    click(e) {
      if (mode !== "edit") return;
      if (drawing) onVertex([e.latlng.lng, e.latlng.lat]);
      else onPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

/** Enter en un campo de texto ejecuta la acción sin enviar el formulario del campo que contiene al mapa. */
const onEnter = (fn: () => void | Promise<void>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void fn();
  }
};

type Move = { kind: "fly"; lat: number; lon: number; nonce: number } | { kind: "fit"; ring: LngLat[]; nonce: number } | null;

function Mover({ move }: { move: Move }) {
  const map = useMap();
  useEffect(() => {
    if (!move) return;
    if (move.kind === "fly") map.flyTo([move.lat, move.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
    else map.fitBounds(L.latLngBounds(move.ring.map(([lon, lat]) => [lat, lon] as [number, number])), { maxZoom: 17, padding: [24, 24] });
  }, [move, map]);
  return null;
}

/** Una vez montado, deja que Leaflet recalcule el tamaño (evita el mapa gris si el contenedor cambia de tamaño). */
function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function FieldMap({
  mode = "edit", point = null, polygon = null, onPointChange, onPolygonChange, others = [], selectedId = null, onSelectOther, className,
  initialBase = "mapa", heightClass = "h-[420px] sm:h-[480px]", initialZoom, showPlaceSearch = true,
}: FieldMapProps) {
  const uid = useId();
  const [base, setBase] = useState<Base>(initialBase);
  const [nasaDate, setNasaDate] = useState(() => defaultGibsDate());
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [move, setMove] = useState<Move>(null);
  const nonce = useRef(0);

  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [coords, setCoords] = useState("");
  const [coordsMsg, setCoordsMsg] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);

  const initial = useMemo(() => {
    const first = others[0];
    const c: [number, number] = point ? [point.lat, point.lon] : first ? [first.lat, first.lon] : SAN_LUIS;
    return { center: c, zoom: initialZoom ?? (point ? 13 : mode === "overview" ? 8 : 7) };
    // solo la vista inicial: los cambios posteriores se mueven con `move`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fly = (lat: number, lon: number) => setMove({ kind: "fly", lat, lon, nonce: ++nonce.current });
  const fit = (ring: LngLat[]) => setMove({ kind: "fit", ring, nonce: ++nonce.current });
  // Último punto que puso el propio mapa (clic, arrastre, coordenadas o buscador). Si el punto cambia y no es este,
  // vino de afuera (por ejemplo, el buscador de ciudades): el mapa vuela hasta ahí.
  const emitted = useRef<MapPoint | null>(point);
  const setPoint = (p: MapPoint) => {
    const rounded = { lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4 };
    emitted.current = rounded;
    onPointChange?.(rounded);
  };

  // Sincronización: la casilla de coordenadas siempre muestra el punto actual.
  useEffect(() => {
    if (!point) return;
    setCoords(`${point.lat}, ${point.lon}`);
    setCoordsMsg(null);
    const external = !emitted.current || emitted.current.lat !== point.lat || emitted.current.lon !== point.lon;
    if (external) {
      emitted.current = point;
      fly(point.lat, point.lon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lon]);

  function applyPolygon(ring: LngLat[]) {
    const closed = closeRing(ring);
    onPolygonChange?.(closed);
    setPoint(ringCentroid(closed));
    fit(closed);
  }

  function finishDraft() {
    if (draft.length < 3) return;
    applyPolygon(draft);
    setDraft([]);
    setDrawing(false);
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearchMsg(null);
    setPlaces([]);
    const asCoords = parseCoordinates(q);
    if (asCoords) {
      setPoint(asCoords);
      fly(asCoords.lat, asCoords.lon);
      return;
    }
    setSearching(true);
    try {
      const found = await searchPlaces(q);
      setPlaces(found);
      if (found.length === 0) setSearchMsg(tr("No encontré ese lugar en Argentina. Probá con otro nombre o ingresá las coordenadas.", "I couldn't find that place in Argentina. Try another name or enter the coordinates."));
    } catch {
      setSearchMsg(tr("No se pudo buscar el lugar (sin conexión o servicio no disponible). Podés marcar el punto en el mapa o ingresar las coordenadas.", "The place could not be searched (offline or service unavailable). You can mark the point on the map or enter the coordinates."));
    } finally {
      setSearching(false);
    }
  }

  function goToCoords() {
    const c = parseCoordinates(coords);
    if (!c) {
      setCoordsMsg(tr("No entendí las coordenadas. Escribí latitud y longitud, por ejemplo: -33.85, -65.20", "I couldn't understand the coordinates. Type latitude and longitude, for example: -33.85, -65.20"));
      return;
    }
    setCoordsMsg(null);
    setPoint(c);
    fly(c.lat, c.lon);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileMsg(null);
    if (file.size > MAX_GEOJSON_BYTES) {
      setFileMsg(tr("El archivo es muy grande (máximo 2 MB).", "The file is too large (2 MB max)."));
      return;
    }
    try {
      applyPolygon(parseGeoJson(await file.text()));
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : tr("No se pudo leer el archivo.", "The file could not be read."));
    }
  }

  const ring = polygon && polygon.length >= 4 ? polygon : null;
  const areaHa = ring ? ringAreaHa(ring) : 0;
  const tone = base === "mapa" ? "#2f6f40" : "#ffe066";
  const maxDate = defaultGibsDate();
  const editing = mode === "edit";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr("Tipo de mapa", "Map type")}>
        <Button type="button" size="sm" variant={base === "mapa" ? "default" : "outline"} aria-pressed={base === "mapa"} onClick={() => setBase("mapa")}>
          <MapIcon aria-hidden /> {tr("Mapa", "Map")}
        </Button>
        <Button type="button" size="sm" variant={base === "satelite" ? "default" : "outline"} aria-pressed={base === "satelite"} onClick={() => setBase("satelite")}>
          <Satellite aria-hidden /> {tr("Satélite", "Satellite")}
        </Button>
        <Button type="button" size="sm" variant={base === "nasa" ? "default" : "outline"} aria-pressed={base === "nasa"} onClick={() => setBase("nasa")}>
          <Orbit aria-hidden /> {tr("NASA del día", "NASA of the day")}
        </Button>
        {editing && (
          <>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
            {!drawing ? (
              <Button type="button" size="sm" variant="outline" onClick={() => { setDrawing(true); setDraft([]); }}>
                <Hexagon aria-hidden /> {tr("Dibujar polígono", "Draw polygon")}
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" onClick={finishDraft} disabled={draft.length < 3}>
                  <Check aria-hidden /> {tr(`Terminar (${draft.length} vértices)`, `Finish (${draft.length} vertices)`)}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={draft.length === 0}>
                  <Undo2 aria-hidden /> {tr("Deshacer vértice", "Undo vertex")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setDrawing(false); setDraft([]); }}>
                  {tr("Cancelar", "Cancel")}
                </Button>
              </>
            )}
            {ring && !drawing && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onPolygonChange?.(null)}>
                <Eraser aria-hidden /> {tr("Borrar polígono", "Delete polygon")}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" asChild>
              <label className="cursor-pointer">
                <FileUp aria-hidden /> {tr("Cargar GeoJSON", "Upload GeoJSON")}
                <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="sr-only" onChange={onFile} aria-label={tr("Cargar polígono desde un archivo GeoJSON", "Upload polygon from a GeoJSON file")} />
              </label>
            </Button>
          </>
        )}
      </div>

      {editing && (
        <div className={cn("grid gap-3", showPlaceSearch && "md:grid-cols-2")}>
          {/* Sin <form>: este mapa vive dentro del formulario del campo y los formularios no se pueden anidar. */}
          {showPlaceSearch && (
          <div className="space-y-1.5" role="search">
            <Label htmlFor={`${uid}-q`}>{tr("Buscar un lugar por nombre", "Search for a place by name")}</Label>
            <div className="flex gap-2">
              <Input id={`${uid}-q`} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onEnter(runSearch)} placeholder={tr("Ej.: Villa Mercedes, San Luis", "E.g.: Villa Mercedes, San Luis")} autoComplete="off" />
              <Button type="button" variant="secondary" onClick={() => void runSearch()} disabled={searching || !query.trim()}>
                <Search aria-hidden /> {searching ? tr("Buscando…", "Searching…") : tr("Buscar", "Search")}
              </Button>
            </div>
            {searchMsg && <p role="status" className="text-sm text-muted-foreground">{searchMsg}</p>}
            {places.length > 0 && (
              <ul className="divide-y rounded-md border bg-card" aria-label={tr("Resultados de la búsqueda", "Search results")}>
                {places.map((p) => (
                  <li key={`${p.lat},${p.lon}`}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setPoint(p); fly(p.lat, p.lon); setPlaces([]); }}>
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-c`}>{tr("Coordenadas (latitud, longitud)", "Coordinates (latitude, longitude)")}</Label>
            <div className="flex gap-2">
              <Input id={`${uid}-c`} value={coords} onChange={(e) => setCoords(e.target.value)} onKeyDown={onEnter(goToCoords)} placeholder="-33.85, -65.20" inputMode="decimal" autoComplete="off" />
              <Button type="button" variant="secondary" onClick={goToCoords} disabled={!coords.trim()}>
                <Navigation aria-hidden /> {tr("Ir", "Go")}
              </Button>
            </div>
            {coordsMsg && <p role="alert" className="text-sm text-destructive">{coordsMsg}</p>}
          </div>
        </div>
      )}
      {fileMsg && <p role="alert" className="text-sm text-destructive">{fileMsg}</p>}

      {base === "nasa" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 text-sm">
          <Label htmlFor={`${uid}-gibs`} className="font-medium">{tr("Imagen del día", "Image of the day")}</Label>
          <Button type="button" size="sm" variant="outline" aria-label={tr("Día anterior", "Previous day")} onClick={() => setNasaDate((d) => shiftGibsDate(d, -1))} disabled={nasaDate <= GIBS_FIRST_DATE}>
            <ChevronLeft aria-hidden />
          </Button>
          <Input
            id={`${uid}-gibs`}
            type="date"
            className="h-9 w-auto"
            min={GIBS_FIRST_DATE}
            max={maxDate}
            value={nasaDate}
            onChange={(e) => e.target.value && setNasaDate(clampGibsDate(e.target.value))}
          />
          <Button type="button" size="sm" variant="outline" aria-label={tr("Día siguiente", "Next day")} onClick={() => setNasaDate((d) => shiftGibsDate(d, 1))} disabled={nasaDate >= maxDate}>
            <ChevronRight aria-hidden />
          </Button>
          <p className="basis-full text-muted-foreground">
            {tr(
              "Satélite Terra de la NASA (MODIS, color real, píxel de ~250 m) vía NASA GIBS. Lo blanco son nubes; las franjas negras, zonas que el satélite no cubrió ese día. Si no se ve tu zona, probá con otro día.",
              "NASA's Terra satellite (MODIS, true color, ~250 m pixel) via NASA GIBS. White is clouds; black stripes are areas the satellite did not cover that day. If you can't see your area, try another day.",
            )}
          </p>
        </div>
      )}
      <div
        role="group"
        aria-label={editing ? tr("Mapa interactivo: hacé clic para marcar el campo. También podés usar las coordenadas.", "Interactive map: click to mark the field. You can also use the coordinates.") : tr("Mapa de campos", "Fields map")}
        className="overflow-hidden rounded-lg border"
      >
        <MapContainer center={initial.center} zoom={initial.zoom} scrollWheelZoom className={cn("z-0 w-full", heightClass)}>
          {base === "nasa" ? (
            <TileLayer key={`nasa-${nasaDate}`} url={gibsUrl(nasaDate)} attribution={GIBS_ATTRIBUTION} maxNativeZoom={GIBS_MAX_NATIVE_ZOOM} maxZoom={19} />
          ) : (
            <TileLayer key={base} url={TILES[base].url} attribution={TILES[base].attribution} maxZoom={19} />
          )}
          <ClickHandler mode={mode} drawing={drawing} onPoint={setPoint} onVertex={(v) => setDraft((d) => [...d, v])} />
          <Mover move={move} />
          <SizeFix />
          {ring && <Polygon positions={ring.map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={{ color: tone, weight: 3, fillOpacity: 0.2 }} />}
          {draft.length > 0 && (
            <>
              <Polyline positions={draft.map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={{ color: tone, weight: 3, dashArray: "6 6" }} />
              {draft.map(([lon, lat], i) => (
                <CircleMarker key={`${i}-${lon}-${lat}`} center={[lat, lon]} radius={5} pathOptions={{ color: "#fff", fillColor: tone, fillOpacity: 1, weight: 2 }} />
              ))}
            </>
          )}
          {others.map((o) => (
            <Marker
              key={o.id}
              position={[o.lat, o.lon]}
              icon={o.id === selectedId ? PIN_SELECTED : PIN_OTHER}
              eventHandlers={{ click: () => onSelectOther?.(o.id) }}
              keyboard={false}
            >
              <Tooltip>{o.name}</Tooltip>
            </Marker>
          ))}
          {editing && point && (
            <Marker
              position={[point.lat, point.lon]}
              icon={PIN_SELECTED}
              draggable
              keyboard={false}
              eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); setPoint({ lat: p.lat, lon: p.lng }); } }}
            >
              <Tooltip>{tr("Campo seleccionado (arrastralo para ajustar)", "Selected field (drag it to adjust)")}</Tooltip>
            </Marker>
          )}
        </MapContainer>
      </div>

      {editing && (
        <p role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
          <MapPin aria-hidden className="size-4" />
          {drawing
            ? tr(`Dibujando: hacé clic en cada esquina del lote (${draft.length} vértices) y después tocá “Terminar”.`, `Drawing: click each corner of the plot (${draft.length} vertices) and then tap “Finish”.`)
            : point
              ? tr(`Punto seleccionado: ${num(point.lat, 4)}, ${num(point.lon, 4)}${ring ? ` · Polígono de ${num(areaHa, 1)} ha` : ""}`, `Selected point: ${num(point.lat, 4)}, ${num(point.lon, 4)}${ring ? ` · ${num(areaHa, 1)} ha polygon` : ""}`)
              : tr("Todavía no marcaste el campo: hacé clic en el mapa, buscá un lugar o ingresá las coordenadas.", "You haven't marked the field yet: click the map, search for a place or enter the coordinates.")}
        </p>
      )}
    </div>
  );
}
