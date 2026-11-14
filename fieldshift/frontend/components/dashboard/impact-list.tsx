import { LabelBadge } from "@/components/provenance/badges";
import { signed } from "@/lib/format";
import type { Impact } from "@/lib/dashboard";
import { plain } from "@/lib/plain";

/** Lista de factores con los puntos que suman o restan al total. Siempre con el signo escrito. */
export function ImpactList({ impacts, vsActual, empty }: { impacts: Impact[]; vsActual: boolean; empty: string }) {
  if (impacts.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {impacts.map((i) => (
        <li key={`${i.component}-${i.factor}`} className="space-y-0.5">
          <p className="font-medium">
            {i.factor}: <span className="tabular-nums">{signed(i.delta, 1)} puntos</span>
            <span className="font-normal text-muted-foreground">{vsActual ? " frente a tu rotación actual" : " al total"}</span>
          </p>
          <p className="text-sm text-muted-foreground">{plain(i.detail)}</p>
          <LabelBadge label={i.label} />
        </li>
      ))}
    </ul>
  );
}
