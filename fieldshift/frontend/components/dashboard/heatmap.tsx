import { COMPONENTS, COMPONENT_ORDER, STRATEGY_LABELS, band, num, rotationTitle } from "@/lib/format";
import type { Weights } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { RotationEvaluation } from "@/types/api";

function Cell({ value, strong = false }: { value: number | null; strong?: boolean }) {
  const v = value ?? 0;
  return (
    <td
      className={cn("border border-background px-2 py-2.5 text-center align-middle", strong && "font-bold")}
      // cuanto más oscuro el verde, mejor el puntaje; el número y la palabra dicen lo mismo
      style={{ backgroundColor: `hsl(var(--primary) / ${(0.06 + (v / 100) * 0.5).toFixed(2)})` }}
    >
      <span className="block text-lg font-semibold tabular-nums leading-tight">{num(value)}</span>
      <span className="block text-xs">{band(v)}</span>
    </td>
  );
}

/** Mapa de calor: rotaciones en filas, componentes en columnas. Cada celda lleva el número y la palabra (bajo, medio, alto). */
export function Heatmap({ evaluations, weights }: { evaluations: RotationEvaluation[]; weights: Weights }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Mapa de calor: puntaje de cada rotación en cada componente, de 0 a 100.</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left font-medium text-muted-foreground">Rotación</th>
              {COMPONENT_ORDER.map((k) => (
                <th key={k} scope="col" className="p-2 text-center font-medium" title={COMPONENTS[k].help}>
                  {k} · {COMPONENTS[k].short}
                  <span className="block text-xs font-normal text-muted-foreground">peso {num((weights[k] ?? 0) * 100)} %</span>
                </th>
              ))}
              <th scope="col" className="p-2 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((ev) => (
              <tr key={ev.rotation.id}>
                <th scope="row" className="min-w-44 p-2 text-left font-medium">
                  {ev.score.rank}. {STRATEGY_LABELS[ev.rotation.strategy]}
                  <span className="block text-xs font-normal text-muted-foreground">{rotationTitle(ev.rotation)}</span>
                </th>
                {COMPONENT_ORDER.map((k) => (
                  <Cell key={k} value={ev.score.components.find((c) => c.key === k)?.value ?? null} />
                ))}
                <Cell value={ev.score.total} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">Cuanto más oscuro el verde, mejor el puntaje. El número y la palabra (bajo, medio, alto) dicen lo mismo, por si no distinguís los colores.</p>
    </div>
  );
}
