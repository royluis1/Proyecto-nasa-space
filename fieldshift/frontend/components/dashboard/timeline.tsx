import { CalendarLegend, RotationCalendar } from "@/components/score/rotation-calendar";
import { STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import type { Crop, CropGroup, RotationEvaluation } from "@/types/api";

/** Línea de tiempo: el calendario de cada rotación elegida, una debajo de la otra, para ver qué cambia mes a mes. */
export function Timeline({ evaluations, crops }: { evaluations: RotationEvaluation[]; crops: Record<string, Crop> }) {
  const groups = [...new Set(evaluations.flatMap((e) => e.rotation.steps.map((s) => crops[s.crop_id]?.group)).filter((g): g is CropGroup => Boolean(g)))];
  return (
    <div className="space-y-5">
      <CalendarLegend groups={groups} />
      {evaluations.map((ev) => (
        <section key={ev.rotation.id} aria-label={`Calendario de ${ev.rotation.name}`}>
          <h3 className="mb-1 text-base font-semibold">
            {ev.score.rank}. {STRATEGY_LABELS[ev.rotation.strategy]}
            <span className="ml-2 font-normal text-muted-foreground">{rotationTitle(ev.rotation)} · ciclo de {ev.rotation.duration_years} {ev.rotation.duration_years === 1 ? "año" : "años"}</span>
          </h3>
          <RotationCalendar rotation={ev.rotation} crops={crops} compact />
        </section>
      ))}
    </div>
  );
}
