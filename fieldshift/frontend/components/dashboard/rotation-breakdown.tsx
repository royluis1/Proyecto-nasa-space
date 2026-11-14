import Link from "next/link";
import { CalendarDays, ThumbsDown, ThumbsUp } from "lucide-react";
import { SeverityBadge, flagIcon } from "@/components/provenance/badges";
import { Term } from "@/components/glossary/term";
import { contributions, favorAndPenalty, type Weights } from "@/lib/dashboard";
import { COMPONENTS, STRATEGY_LABELS, num, rotationTitle } from "@/lib/format";
import { plain } from "@/lib/plain";
import type { RotationEvaluation } from "@/types/api";
import { ImpactList } from "./impact-list";

function Sub({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 id={id} className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  ev: RotationEvaluation;
  actual: RotationEvaluation | undefined;
  weights: Weights;
  fieldId: string;
  defaultOpen?: boolean;
}

/** Análisis completo de una rotación: ventajas, desventajas, desglose del puntaje, explicación, supuestos, riesgos y qué validar. */
export function RotationBreakdown({ ev, actual, weights, fieldId, defaultOpen }: Props) {
  const rows = contributions(ev, weights);
  const total = rows.reduce((a, r) => a + r.points, 0);
  const { favor, penalize, vsActual } = favorAndPenalty(ev, actual, weights, 4);
  const rec = ev.recommendation;
  const id = `rot-${ev.rotation.id}`;
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-4 rounded-lg border bg-card">
      <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-base font-medium">
        <span className="rounded-md bg-secondary px-2 py-0.5 tabular-nums">Puesto {ev.score.rank}</span>
        <span>{STRATEGY_LABELS[ev.rotation.strategy]}</span>
        <span className="font-normal text-muted-foreground">{rotationTitle(ev.rotation)}</span>
        <span className="ml-auto font-bold tabular-nums">{num(ev.score.total, 1)} / 100</span>
      </summary>
      <div className="space-y-6 border-t p-4">
        <div className="grid gap-5 md:grid-cols-2">
          <Sub id={`${id}-pro`} title={<span className="flex items-center gap-2"><ThumbsUp aria-hidden className="size-5" /> Ventajas</span>}>
            <ul className="list-disc space-y-1 pl-5">{(ev.profile.benefits.length ? ev.profile.benefits : ["Es tu rotación actual: no requiere cambios de manejo."]).map((t) => <li key={t}>{t}</li>)}</ul>
          </Sub>
          <Sub id={`${id}-con`} title={<span className="flex items-center gap-2"><ThumbsDown aria-hidden className="size-5" /> Desventajas</span>}>
            {ev.profile.risks.length ? <ul className="list-disc space-y-1 pl-5">{ev.profile.risks.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-muted-foreground">Sin desventajas destacadas.</p>}
          </Sub>
        </div>

        <Sub id={`${id}-desglose`} title="Cómo se arma el puntaje">
          <p className="text-sm text-muted-foreground">
            Cada componente va de 0 a 100. Se multiplica por el peso que le diste y la suma de los cinco aportes es el puntaje total (<Term k="contribucion">más sobre la contribución</Term>).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Desglose del puntaje de {ev.rotation.name}: puntaje, peso y aporte de cada componente.</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-2 font-medium">Componente</th>
                  <th scope="col" className="px-2 font-medium">Puntaje</th>
                  <th scope="col" className="px-2 font-medium">Peso que le diste</th>
                  <th scope="col" className="pl-2 font-medium">Aporte al total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b">
                    <th scope="row" className="py-2 pr-2 text-left font-medium" title={COMPONENTS[r.key].help}>{r.key} · {COMPONENTS[r.key].name}</th>
                    <td className="px-2 tabular-nums">{num(r.value)} / 100</td>
                    <td className="px-2 tabular-nums">{num(r.weight * 100)} %</td>
                    <td className="py-2 pl-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-28 shrink-0 overflow-hidden rounded-full bg-secondary" aria-hidden><span className="block h-full bg-primary" style={{ width: `${Math.min(100, r.points)}%` }} /></span>
                        <strong className="tabular-nums">{num(r.points, 1)} puntos</strong>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="py-2 pr-2 text-left">Total</th>
                  <td /><td className="px-2 tabular-nums">100 %</td>
                  <td className="py-2 pl-2 text-base font-bold tabular-nums">{num(total, 1)} puntos</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Sub>

        <div className="grid gap-5 md:grid-cols-2">
          <Sub id={`${id}-fav`} title="Qué datos la favorecen">
            <ImpactList impacts={favor} vsActual={vsActual} empty="Ningún factor la favorece de forma clara." />
          </Sub>
          <Sub id={`${id}-pen`} title="Qué datos la penalizan">
            <ImpactList impacts={penalize} vsActual={vsActual} empty="Ningún factor la penaliza de forma clara." />
          </Sub>
        </div>

        <Sub id={`${id}-why`} title="Por qué recibe este puntaje">
          <p className="text-lg">{plain(rec.why)}</p>
        </Sub>

        <div className="grid gap-5 md:grid-cols-2">
          <Sub id={`${id}-sup`} title="Qué supuestos se usaron">
            <ul className="list-disc space-y-1 pl-5 text-sm">{rec.assumptions.map((t) => <li key={t}>{plain(t)}</li>)}</ul>
            {rec.uncertainties.length > 0 && (
              <>
                <p className="pt-2 text-sm font-semibold">Incertidumbres</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">{rec.uncertainties.map((t) => <li key={t}>{plain(t)}</li>)}</ul>
              </>
            )}
          </Sub>
          <Sub id={`${id}-risk`} title="Qué riesgos existen">
            {ev.risk_flags.length === 0 ? <p className="text-muted-foreground">Sin riesgos destacados con los datos disponibles.</p> : (
              <ul className="space-y-2">
                {ev.risk_flags.map((f) => {
                  const Icon = flagIcon(f.icon);
                  return (
                    <li key={f.id} className="flex gap-2 text-sm">
                      <Icon aria-hidden className="mt-1 size-4 shrink-0" />
                      <span><SeverityBadge severity={f.severity} /> {plain(f.message)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Sub>
        </div>

        <Sub id={`${id}-val`} title="Qué debe validar un agrónomo local">
          <ul className="list-disc space-y-1 pl-5 text-sm">{rec.evidence.needs_validation.map((t) => <li key={t}>{plain(t)}</li>)}</ul>
          <p className="text-sm text-muted-foreground">{rec.validation_note}</p>
        </Sub>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-primary underline" href={`/campo/${fieldId}/rotacion/${ev.rotation.id}`}>Ver el detalle completo</Link>
          <Link className="inline-flex items-center gap-1 text-primary underline" href={`/campo/${fieldId}/calendario?rotacion=${encodeURIComponent(ev.rotation.id)}`}><CalendarDays aria-hidden className="size-4" /> Calendario</Link>
        </div>
      </div>
    </details>
  );
}
