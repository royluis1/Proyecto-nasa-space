"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ANIMATED_LAYERS, frameLabel, frameUrl, frames, type AnimatedLayerId } from "@/lib/gibs-animation";
import { cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { tr } from "@/lib/i18n";

const PIN = L.divIcon({
  className: "",
  html:
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">' +
    '<path d="M17 1C8.7 1 2 7.5 2 15.6 2 26 17 43 17 43s15-17 15-27.4C32 7.5 25.3 1 17 1z" fill="#2f6f40" stroke="#fff" stroke-width="2.5"/>' +
    '<circle cx="17" cy="15.5" r="5.5" fill="#fff"/></svg>',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

const MS_PER_FRAME = 600;

/**
 * Mapa animado de la NASA: pasa las imágenes de las últimas horas (o días) como una película.
 * Las capas vienen de GIBS, que es público. La lluvia es del satélite GPM (IMERG).
 */
export function WeatherAnimation({ lat, lon, layerId = "lluvia" }: { lat: number; lon: number; layerId?: AnimatedLayerId }) {
  const [id, setId] = useState<AnimatedLayerId>(layerId);
  const layer = ANIMATED_LAYERS[id];
  // Los momentos se calculan una vez por capa: si se recalcularan en cada dibujo, la animación saltaría.
  const list = useMemo(() => frames(layer), [layer]);
  const [i, setI] = useState(list.length - 1);
  const [playing, setPlaying] = useState(true);

  useEffect(() => setI(list.length - 1), [list]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((v) => (v + 1) % list.length), MS_PER_FRAME);
    return () => clearInterval(t);
  }, [playing, list.length]);

  // Si la persona prefiere menos movimiento, no se reproduce sola.
  const reduced = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    if (mq.matches) setPlaying(false);
  }, []);

  const frame = list[i] ?? list[list.length - 1];
  const zoom = id === "lluvia" ? 5 : 8;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("Qué mostrar en el mapa", "What to show on the map")}>
        {(Object.keys(ANIMATED_LAYERS) as AnimatedLayerId[]).map((k) => (
          <Button key={k} type="button" size="sm" variant={k === id ? "default" : "outline"} aria-pressed={k === id} onClick={() => setId(k)}>
            {ANIMATED_LAYERS[k].label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{layer.help}</p>

      <div className="overflow-hidden rounded-lg border">
        <MapContainer center={[lat, lon]} zoom={zoom} scrollWheelZoom={false} className="h-[340px] w-full sm:h-[420px]">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
            maxZoom={19}
          />
          <TileLayer
            key={`${layer.layer}-${frame.toISOString()}`}
            url={frameUrl(layer, frame)}
            attribution={layer.attribution}
            maxNativeZoom={layer.maxNativeZoom}
            maxZoom={19}
            opacity={id === "lluvia" ? 0.75 : 1}
          />
          <Marker position={[lat, lon]} icon={PIN} interactive={false} keyboard={false} />
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? <><Pause aria-hidden /> {tr("Pausar", "Pause")}</> : <><Play aria-hidden /> {tr("Reproducir", "Play")}</>}
        </Button>
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <Label htmlFor="momento" className="sr-only">{tr("Momento de la animación", "Animation moment")}</Label>
          <input
            id="momento"
            type="range"
            min={0}
            max={list.length - 1}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            className="h-2 w-full cursor-pointer accent-primary"
            aria-valuetext={frameLabel(layer, frame)}
          />
        </div>
        <output className="min-w-40 text-right font-medium tabular-nums" aria-live="off">{frameLabel(layer, frame)}</output>
      </div>

      {layer.legend.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={tr("Referencias de color", "Color legend")}>
          {layer.legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("inline-block size-4 rounded border")} style={{ backgroundColor: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">{layer.source}. {layer.limits}</p>
    </div>
  );
}
