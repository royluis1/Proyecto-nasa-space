import { Layers, Leaf, Sprout, Wheat, Flower2, type LucideIcon } from "lucide-react";
import { buildCalendar } from "@/lib/calendar";
import { MONTHS, MONTHS_LONG } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Crop, CropGroup, Rotation } from "@/types/api";

export const GROUP_INFO: Record<CropGroup, { label: string; icon: LucideIcon; cls: string }> = {
  cereal: { label: "Cereal", icon: Wheat, cls: "bg-tierra-100 text-tierra-900 dark:bg-tierra-900/70 dark:text-tierra-50" },
  oleaginosa: { label: "Oleaginosa", icon: Flower2, cls: "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-50" },
  leguminosa: { label: "Leguminosa", icon: Sprout, cls: "bg-cultivo-100 text-cultivo-900 dark:bg-cultivo-900/60 dark:text-cultivo-50" },
  forrajera: { label: "Forrajera", icon: Leaf, cls: "bg-agua-100 text-agua-900 dark:bg-agua-900/60 dark:text-agua-50" },
  cobertura: { label: "Cobertura", icon: Layers, cls: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50" },
};

const FALLOW_STYLE = { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, hsl(var(--border)) 6px 8px)" };

interface Props {
  rotation: Pick<Rotation, "id" | "name" | "duration_years" | "steps">;
  crops: Record<string, Crop>;
  heading?: string;
  /** Versión más baja y chica, para mostrar varias rotaciones juntas. */
  compact?: boolean;
}

/** Calendario mensual: una fila por año del ciclo. Cada cultivo lleva ícono y nombre; el barbecho, rayado y texto. */
export function RotationCalendar({ rotation, crops, heading, compact = false }: Props) {
  const cal = buildCalendar(rotation);
  const rows = Array.from({ length: cal.years }, (_, y) => {
    const cells: { owner: number | null; span: number; start: number }[] = [];
    for (let c = 0; c < 12; c++) {
      const owner = cal.owner[y * 12 + c];
      const last = cells[cells.length - 1];
      if (last && last.owner === owner) last.span += 1;
      else cells.push({ owner, span: 1, start: c });
    }
    return cells;
  });
  return (
    <div className="space-y-2">
      {heading && <h3 className="text-lg font-semibold">{heading}</h3>}
      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-[44rem] border-separate border-spacing-1", compact ? "text-xs" : "text-sm")}>
          <caption className="sr-only">Calendario de {rotation.name}: qué ocupa el lote en cada mes de cada año del ciclo.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16 text-left font-medium text-muted-foreground">Año</th>
              {MONTHS.map((m, i) => (
                <th key={m} scope="col" abbr={MONTHS_LONG[i]} className="text-center font-medium text-muted-foreground">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, y) => (
              <tr key={y}>
                <th scope="row" className="text-left font-medium">Año {y + 1}</th>
                {cells.map((cell, i) => {
                  if (cell.owner === null) {
                    return (
                      <td key={i} colSpan={cell.span} style={FALLOW_STYLE} className={cn(compact ? "h-9 text-xs" : "h-14", "rounded-md border border-dashed text-center align-middle text-muted-foreground")}>
                        Barbecho
                      </td>
                    );
                  }
                  const step = cal.steps[cell.owner];
                  const crop = crops[step.step.crop_id];
                  const info = crop ? GROUP_INFO[crop.group] : GROUP_INFO.cereal;
                  const Icon = info.icon;
                  return (
                    <td
                      key={i}
                      colSpan={cell.span}
                      title={`${crop?.name ?? step.step.crop_id}: siembra en ${MONTHS_LONG[step.step.start_month - 1]}, hasta ${MONTHS_LONG[step.step.end_month - 1]}`}
                      className={cn(compact ? "h-9 text-xs" : "h-14", "rounded-md px-1 text-center align-middle font-medium", info.cls)}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        <Icon aria-hidden className="size-4 shrink-0" />
                        <span className="truncate">{crop?.name ?? step.step.crop_id}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cal.conflicts.length > 0 && <p role="alert" className="text-sm font-medium text-destructive">Hay cultivos que se superponen en esta rotación: revisá las fechas.</p>}
    </div>
  );
}

export function CalendarLegend({ groups }: { groups: CropGroup[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm" aria-label="Referencias del calendario">
      {groups.map((g) => {
        const info = GROUP_INFO[g];
        const Icon = info.icon;
        return (
          <li key={g} className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1", info.cls)}>
            <Icon aria-hidden className="size-4" /> {info.label}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-muted-foreground" style={FALLOW_STYLE}>Barbecho (sin cultivo)</li>
    </ul>
  );
}
