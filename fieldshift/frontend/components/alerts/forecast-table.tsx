import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { num } from "@/lib/format";
import type { Forecast } from "@/types/api";
import { appLocale, tr } from "@/lib/i18n";

const dayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(appLocale(), { weekday: "short", day: "numeric", month: "numeric" });

/** Pronóstico día por día (Open-Meteo), con heladas y calor marcados con texto además de color. */
export function ForecastTable({ forecast }: { forecast: Forecast }) {
  return (
    <Table scrollLabel={tr("Pronóstico: desplazá para ver todos los días", "Forecast: scroll to see every day")}>
      <TableCaption>{tr("Pronóstico de Open-Meteo (no es un dato de la NASA). Lluvia en mm; 1 mm = 1 litro por m².", "Open-Meteo forecast (not NASA data). Rain in mm; 1 mm = 1 liter per m².")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{tr("Día", "Day")}</TableHead><TableHead>{tr("Mínima", "Low")}</TableHead><TableHead>{tr("Máxima", "High")}</TableHead><TableHead>{tr("Lluvia", "Rain")}</TableHead><TableHead>{tr("Prob. de lluvia", "Chance of rain")}</TableHead><TableHead>{tr("Evaporación (ET0)", "Evaporation (ET0)")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {forecast.days.map((d) => {
          const frost = d.tmin_c != null && d.tmin_c <= 2;
          const hot = d.tmax_c != null && d.tmax_c >= 35;
          return (
            <TableRow key={d.date}>
              <TableCell className="font-medium capitalize">{dayName(d.date)}</TableCell>
              <TableCell className={frost ? "font-bold text-agua-700 dark:text-info" : "tabular-nums"}>{num(d.tmin_c)} °C{frost && <span> ❄️ <span className="sr-only">{tr("posible", "possible")} </span>{tr("helada", "frost")}</span>}</TableCell>
              <TableCell className={hot ? "font-bold text-destructive" : "tabular-nums"}>{num(d.tmax_c)} °C{hot && <span> 🔥 {tr("calor", "heat")}</span>}</TableCell>
              <TableCell className="tabular-nums">{num(d.precip_mm, 1)} mm</TableCell>
              <TableCell className="tabular-nums">{d.precip_probability_pct == null ? "—" : `${num(d.precip_probability_pct)} %`}</TableCell>
              <TableCell className="tabular-nums">{d.et0_mm == null ? "—" : `${num(d.et0_mm, 1)} mm`}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
