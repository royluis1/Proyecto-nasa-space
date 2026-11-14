import { COMPONENTS, COMPONENT_ORDER, band, num } from "@/lib/format";
import type { ScoreComponent } from "@/types/api";

/** Los 5 componentes del puntaje con su valor escrito y una barra. */
export function ScoreBars({ components, showWeights = false }: { components: ScoreComponent[]; showWeights?: boolean }) {
  const byKey = Object.fromEntries(components.map((c) => [c.key, c]));
  return (
    <ul className="space-y-1.5">
      {COMPONENT_ORDER.map((k) => {
        const c = byKey[k];
        if (!c) return null;
        const v = c.value ?? 0;
        return (
          <li key={k} className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-2 text-sm" title={COMPONENTS[k].help}>
            <span className="truncate font-medium">
              {k} · {COMPONENTS[k].short}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
            </span>
            <span className="text-right tabular-nums">
              <strong>{num(c.value)}</strong>/100 <span className="text-muted-foreground">{band(v)}</span>
              {showWeights && <span className="block text-xs text-muted-foreground">peso {num(c.weight * 100)} %</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
