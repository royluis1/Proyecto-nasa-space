import { CloudRain, Droplets, Info, OctagonAlert, Snowflake, Sprout, Thermometer, TriangleAlert, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/api";

const KIND_ICON: Record<Alert["kind"], LucideIcon> = {
  helada: Snowflake, calor: Thermometer, lluvia_intensa: CloudRain, falta_de_agua: Droplets, suelo_seco: Sprout, viento: Wind,
};
const SEV: Record<Alert["severity"], { icon: LucideIcon; text: string; cls: string }> = {
  alta: { icon: OctagonAlert, text: "Importante", cls: "border-destructive/60 bg-destructive/10" },
  media: { icon: TriangleAlert, text: "Atención", cls: "border-warn/70 bg-warn/10" },
  info: { icon: Info, text: "Para tener en cuenta", cls: "border-info/50 bg-info/10" },
};

/** Alertas tempranas: cada una con ícono, gravedad en texto, qué hacer y de dónde sale. */
export function AlertList({ alerts, empty }: { alerts: Alert[]; empty: string }) {
  if (!alerts.length) {
    return <p className="flex items-center gap-2 rounded-[1rem] border p-4 text-lg"><span aria-hidden>✅</span> {empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {alerts.map((a) => {
        const Icon = KIND_ICON[a.kind];
        const sev = SEV[a.severity];
        return (
          <li key={a.id} className={cn("flex gap-3 rounded-[1rem] border-2 p-4", sev.cls)}>
            <Icon aria-hidden className="mt-1 size-7 shrink-0" />
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold"><sev.icon aria-hidden className="size-4" /> {sev.text}</p>
              <p className="text-lg font-semibold">{a.title}</p>
              <p>{a.message}</p>
              <p className="text-sm text-muted-foreground">Fuente: {a.source}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
