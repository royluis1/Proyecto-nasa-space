"use client";

import { Droplets } from "lucide-react";
import { PriorityControls } from "@/components/field/priority-controls";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import type { UiPriorities } from "@/lib/priorities";
import { GROUP_LABELS, GROUP_ORDER, IRRIGATION_LABELS, PRESET_SCENARIOS } from "@/lib/scenarios";
import type { IrrigationLevel, RotationEvaluation } from "@/types/api";

export const MAX_COMPARED = 4;
/** El riego se elige con su propio control. */
const SCENARIO_OPTIONS = PRESET_SCENARIOS.filter((s) => s.group !== "riego");
const IRRIGATION_HELP: Record<IrrigationLevel, string> = {
  lote: "Se evalúa con el riego que tiene tu campo hoy.",
  sin_riego: "Como si no pudieras regar: solo lluvia y el agua guardada en el suelo.",
  limitado: "Con la mitad del agua de riego: cubre parte de lo que le falta al cultivo.",
  disponible: "Con riego pleno. Se descuenta el costo del agua aplicada.",
};

interface Props {
  ui: UiPriorities;
  onUi: (p: UiPriorities) => void;
  scenarioId: string;
  onScenario: (id: string) => void;
  irrigation: IrrigationLevel;
  onIrrigation: (v: IrrigationLevel) => void;
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
          {GROUP_ORDER.filter((g) => g !== "riego").map((g) => (
            <optgroup key={g} label={GROUP_LABELS[g]}>
              {SCENARIO_OPTIONS.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">{scenario?.help}</p>
        {demo && <p className="text-sm text-muted-foreground">Sin conexión solo están los escenarios predefinidos.</p>}
      </section>

      <section aria-labelledby="ctl-riego" className="space-y-2">
        <h3 id="ctl-riego" className="font-semibold">Disponibilidad de riego</h3>
        <Label htmlFor="dash-riego" className="flex items-center gap-2"><Droplets aria-hidden className="size-5" /> Agua de riego</Label>
        <Select id="dash-riego" value={irrigation} onChange={(e) => onIrrigation(e.target.value as IrrigationLevel)}>
          {(Object.keys(IRRIGATION_LABELS) as IrrigationLevel[]).map((k) => (
            <option key={k} value={k}>{k === "lote" ? `${IRRIGATION_LABELS[k]} (${fieldIrrigated ? "con riego" : "secano"})` : IRRIGATION_LABELS[k]}</option>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">{IRRIGATION_HELP[irrigation]}</p>
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
