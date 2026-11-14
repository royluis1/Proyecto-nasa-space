import { Swatch } from "@/components/zones/patterns";
import { LEVEL_STYLES, groupByLevel } from "@/lib/zones";
import type { CropSuitability } from "@/types/api";

/** Aptitud orientativa agrupada por nivel, con motivos, riesgos y lo que depende del suelo y del manejo. */
export function SuitabilityList({ items, compact = false }: { items: CropSuitability[]; compact?: boolean }) {
  const depends = items[0]?.depends_on ?? [];
  return (
    <div className="space-y-4">
      {groupByLevel(items).map(({ level, items: group }) => (
        <section key={level} aria-label={LEVEL_STYLES[level].label} className="space-y-2">
          <h4 className="flex items-center gap-2 font-semibold"><Swatch s={LEVEL_STYLES[level]} size={18} /> {LEVEL_STYLES[level].label} ({group.length})</h4>
          <ul className="space-y-1">
            {group.map((c) => (
              <li key={c.crop_id}>
                <details className="rounded-md border px-3 py-2">
                  <summary className="cursor-pointer font-medium">{c.crop_name}{!compact && c.reasons[0] ? <span className="font-normal text-muted-foreground"> · {c.reasons[0]}</span> : null}</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {c.reasons.map((x) => <li key={x}>{x}</li>)}
                    {c.risks.map((x) => <li key={x}><strong>Riesgo:</strong> {x}</li>)}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">Confianza {c.confidence}. {c.note}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!compact && depends.length > 0 && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Lo que la zona no captura:</p>
          <ul className="list-disc pl-5">{depends.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      <p className="text-sm font-medium">Requiere validación agronómica local.</p>
    </div>
  );
}
