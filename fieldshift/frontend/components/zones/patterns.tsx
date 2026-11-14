import { LEVEL_STYLES, ZONE_STYLES, type MapStyle } from "@/lib/zones";

function PatternDef({ s }: { s: MapStyle }) {
  return (
    <pattern id={s.id} patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill={s.color} />
      {s.pattern === "puntos" && <circle cx="5" cy="5" r="1.6" fill={s.ink} />}
      {s.pattern === "diagonal" && <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke={s.ink} strokeWidth="1.4" />}
      {s.pattern === "cruzado" && <path d="M0,0 l10,10 M10,0 l-10,10" stroke={s.ink} strokeWidth="1.1" />}
      {s.pattern === "horizontal" && <path d="M0,3 h10 M0,8 h10" stroke={s.ink} strokeWidth="1.2" />}
    </pattern>
  );
}

/** Definiciones SVG de los patrones (una vez por página). Las capas del mapa los usan con `fill: url(#id)`. */
export function ZonePatternDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }} focusable="false">
      <defs>
        {[...Object.values(ZONE_STYLES), ...Object.values(LEVEL_STYLES)].map((s) => <PatternDef key={s.id} s={s} />)}
      </defs>
    </svg>
  );
}

/** Muestra del patrón para la leyenda. */
export function Swatch({ s, size = 22 }: { s: MapStyle; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} className="shrink-0 rounded border border-foreground/30">
      <rect width={size} height={size} fill={`url(#${s.id})`} />
    </svg>
  );
}
