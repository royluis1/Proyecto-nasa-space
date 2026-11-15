"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { COMPONENTS, AGGREGATION_NOTE, COMPONENT_ORDER, num } from "@/lib/format";
import {
  PRIORITY_KEYS, PRIORITY_META, PRIORITY_PRESETS, componentWeights, presetValues, toBackendPriorities, type PriorityKey, type UiPriorities,
} from "@/lib/priorities";

const intensity = (v: number) => (v === 0 ? "No me importa" : v <= 3 ? "Poco" : v <= 6 ? "Importante" : v <= 9 ? "Muy importante" : "Lo más importante");

const sameAsPreset = (value: UiPriorities, id: string) => {
  const p = presetValues(id);
  return PRIORITY_KEYS.every((k) => p[k] === value[k]);
};

interface Props {
  value: UiPriorities;
  onChange: (next: UiPriorities) => void;
  /** Deshabilita los controles (por ejemplo, mientras se guarda). */
  disabled?: boolean;
}

export function PriorityControls({ value, onChange, disabled }: Props) {
  const weights = componentWeights(toBackendPriorities(value));
  const set = (k: PriorityKey, v: number) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Combinaciones predefinidas" className="flex flex-wrap gap-2">
        {PRIORITY_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={sameAsPreset(value, p.id) ? "default" : "outline"}
            aria-pressed={sameAsPreset(value, p.id)}
            title={p.description}
            disabled={disabled}
            onClick={() => onChange(presetValues(p.id))}
          >
            {p.name}
          </Button>
        ))}
      </div>

      <ul className="space-y-4">
        {PRIORITY_KEYS.map((k) => {
          const meta = PRIORITY_META[k];
          const id = `prio-${k}`;
          return (
            <li key={k} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <label id={`${id}-label`} className="font-medium">
                  {meta.label} <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-normal text-secondary-foreground">{meta.group}</span>
                </label>
                <output aria-live="off" className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  <strong className="text-base text-foreground">{value[k]}</strong>/10 · {intensity(value[k])}
                </output>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[value[k]]}
                onValueChange={([v]) => set(k, v)}
                thumbLabel={`${meta.label}: de 0 a 10`}
                aria-labelledby={`${id}-label`}
                disabled={disabled}
              />
              <p className="text-sm text-muted-foreground">{meta.help}</p>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="reparto-titulo" className="rounded-xl border bg-muted/40 p-5">
        <h3 id="reparto-titulo" className="mb-3 text-lg font-semibold">
          Cómo se reparte el puntaje
        </h3>
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {COMPONENT_ORDER.map((c) => (
            <li key={c} className="space-y-1">
              <div className="flex justify-between text-base">
                <span>
                  <strong>{c}</strong> · {COMPONENTS[c].name}
                </span>
                <span className="font-semibold tabular-nums">{num(weights[c] * 100)} %</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${weights[c] * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{AGGREGATION_NOTE}</p>
      </section>
    </div>
  );
}
