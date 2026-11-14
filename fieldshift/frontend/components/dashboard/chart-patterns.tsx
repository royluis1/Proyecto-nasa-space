import { CHART } from "@/components/charts/chart-frame";

/** Colores y tramas de las series: se distinguen por la trama aunque no se vean los colores. */
export const SERIES_STYLE = [
  { color: CHART.cultivo, kind: "liso" },
  { color: CHART.agua, kind: "rayas" },
  { color: CHART.tierra, kind: "puntos" },
  { color: "#6b7c93", kind: "cuadrícula" },
] as const;

type Kind = (typeof SERIES_STYLE)[number]["kind"];

function PatternBody({ color, kind }: { color: string; kind: Kind }) {
  switch (kind) {
    case "liso":
      return <rect width="8" height="8" fill={color} />;
    case "rayas":
      return (
        <>
          <rect width="8" height="8" fill={color} fillOpacity={0.28} />
          <path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" stroke={color} strokeWidth="2.2" />
        </>
      );
    case "puntos":
      return (
        <>
          <rect width="8" height="8" fill={color} fillOpacity={0.28} />
          <circle cx="4" cy="4" r="1.9" fill={color} />
        </>
      );
    default:
      return (
        <>
          <rect width="8" height="8" fill={color} fillOpacity={0.28} />
          <path d="M0 4 H8 M4 0 V8" stroke={color} strokeWidth="1.6" />
        </>
      );
  }
}

/** Definiciones para usar dentro de un gráfico de Recharts: fill={`url(#${prefix}-0)`}. */
export function PatternDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {SERIES_STYLE.map((s, i) => (
        <pattern key={i} id={`${prefix}-${i}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <PatternBody color={s.color} kind={s.kind} />
        </pattern>
      ))}
    </defs>
  );
}

/** Muestra de una serie para la leyenda (HTML), con la misma trama que las barras. */
export function Swatch({ index, id }: { index: number; id: string }) {
  const s = SERIES_STYLE[index % SERIES_STYLE.length];
  return (
    <svg width="22" height="16" aria-hidden className="shrink-0 rounded-sm border border-border">
      <defs>
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <PatternBody color={s.color} kind={s.kind} />
        </pattern>
      </defs>
      <rect width="22" height="16" fill={`url(#${id})`} />
    </svg>
  );
}
