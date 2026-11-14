"use client";

import { Droplets } from "lucide-react";
import { PriorityControls } from "@/components/field/priority-controls";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import type { UiPriorities } from "@/lib/priorities";
import { PRESET_SCENARIOS } from "@/lib/scenarios";
import type { RotationEvaluation } from "@/types/api";

export const MAX_COMPARED = 4;
/** El riego se elige con su propio interruptor. */
const SCENARIO_OPTIONS = PRESET_SCENARIOS.filter((s) => s.id !== "con-riego");

interface Props {
  ui: UiPriorities;
  onUi: (p: UiPriorities) => void;
  scenarioId: string;
  onScenario: (id: string) => void;
  irrigation: boolean;
  onIrrigation: (v: boolean) => void;
  fieldIrrigated: boolean;
  demo: boolean;
  evaluations: RotationEvaluation[];
  selected: string[];
  onSelected: (ids: string[]) => void;
}

/** Todo lo que se puede cambiar en el dashboard: prioridades, escenario climático, riego y qué rotaciones comparar. */
export function DashboardControls({ ui, onUi, scenarioId, onScenario, irrigation, onIrrigation, fieldIrrigated, demo, evaluations, selected, onSelected }: Props) {
  const scenario = SCENARIO_OPTIONS.find((s) => s.id === scenarioId);
  const toggle = (id: string) => {
    if (selected.includes(id)) onSelected(selected.filter((x) => x !== id));
    else if (selected.length < MAX_COMPARED) onSelected([...selected, id]);
  };
  return (
    <div className="space-y-6">
      <section aria-labelledby="ctl-esc" className="space-y-2">
        <h3 id="ctl-esc" className="font-semibold">Escenario climático</h3>
        <Select aria-label="Elegir el escenario climático" value={scenarioId} onChange={(e) => onScenario(e.target.value)}>
          {SCENARIO_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <p className="text-sm text-muted-foreground">{scenario?.help}</p>
        {demo && <p className="text-sm text-muted-foreground">Sin conexión solo están los escenarios predefinidos.</p>}
      </section>

      <section aria-labelledby="ctl-riego" className="space-y-2">
        <h3 id="ctl-riego" className="font-semibold">Disponibilidad de riego</h3>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="dash-riego" className="flex items-center gap-2"><Droplets aria-hidden className="size-5" /> {fieldIrrigated ? "Tu campo tiene riego" : "Evaluar con riego"}</Label>
          <Switch id="dash-riego" checked={fieldIrrigated || irrigation} disabled={fieldIrrigated} onCheckedChange={onIrrigation} />
        </div>
        <p className="text-sm text-muted-foreground">
          {fieldIrrigated ? "Se evalúa con el riego que ya tenés." : "Prendelo para ver cómo cambia el ranking si pudieras regar. Se descuenta el costo del agua aplicada."}
        </p>
      </section>

      <section aria-labelledby="ctl-comp" className="space-y-2">
        <h3 id="ctl-comp" className="font-semibold">Rotaciones para comparar en los gráficos</h3>
        <p className="text-sm text-muted-foreground">Elegí hasta {MAX_COMPARED}. El ranking siempre muestra todas.</p>
        <ul className="space-y-1">
          {evaluations.map((e) => {
            const checked = selected.includes(e.rotation.id);
            const disabled = !checked && selected.length >= MAX_COMPARED;
            return (
              <li key={e.rotation.id}>
                <label className={`flex min-h-11 items-start gap-3 rounded-md border p-2 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-accent"}`}>
                  <input type="checkbox" className="mt-1 size-5 accent-[hsl(var(--primary))]" checked={checked} disabled={disabled} onChange={() => toggle(e.rotation.id)} />
                  <span className="text-sm"><strong>{e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}</strong><span className="block text-muted-foreground">{rotationTitle(e.rotation)}</span></span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="ctl-prio" className="space-y-2">
        <h3 id="ctl-prio" className="font-semibold">Tus prioridades</h3>
        <p className="text-sm text-muted-foreground">Movelas y todo el dashboard se recalcula al instante.</p>
        <PriorityControls value={ui} onChange={onUi} />
      </section>
    </div>
  );
}
