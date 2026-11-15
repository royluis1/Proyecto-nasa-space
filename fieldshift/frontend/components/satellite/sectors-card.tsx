"use client";

import { TriangleAlert } from "lucide-react";
import { AsyncBlock } from "@/components/async-block";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResult, FieldSectors, Sector } from "@/types/api";
import { L, appLocale, localize, tr } from "@/lib/i18n";

// Los nombres y el vigor vienen del backend como códigos en español; acá se muestran en el idioma elegido.
const GRID = [["Noroeste", "Norte", "Noreste"], ["Oeste", "Centro", "Este"], ["Suroeste", "Sur", "Sureste"]];
const SECTOR_NAME: Record<string, string> = localize({
  Noroeste: L("Noroeste", "Northwest"), Norte: L("Norte", "North"), Noreste: L("Noreste", "Northeast"),
  Oeste: L("Oeste", "West"), Centro: L("Centro", "Center"), Este: L("Este", "East"),
  Suroeste: L("Suroeste", "Southwest"), Sur: L("Sur", "South"), Sureste: L("Sureste", "Southeast"),
});
const VIGOR: Record<string, string> = localize({ "más débil": L("más débil", "weaker"), parecido: L("parecido", "similar"), "más vigoroso": L("más vigoroso", "more vigorous") });
const sectorName = (n: string) => SECTOR_NAME[n] ?? n;
const vigorWord = (v: string | null | undefined) => (v ? (VIGOR[v] ?? v) : null);
const n2 = (x: number | null) => (x == null ? "—" : x.toLocaleString(appLocale(), { maximumFractionDigits: 2, minimumFractionDigits: 2 }));
const n0 = (x: number | null) => (x == null ? "—" : `${x.toLocaleString(appLocale(), { maximumFractionDigits: 0 })} %`);

function Cell({ s }: { s?: Sector }) {
  if (!s) return <div className="grid min-h-24 place-items-center rounded-md border border-dashed text-xs text-muted-foreground">{tr("Fuera del lote", "Outside the plot")}</div>;
  const weak = s.vigor === "más débil";
  const strong = s.vigor === "más vigoroso";
  return (
    <div className={cn("min-h-24 rounded-md border-2 p-2 text-xs", weak ? "border-destructive/70 bg-destructive/10" : strong ? "border-good bg-good/15" : "border-border bg-card")}>
      <p className="font-semibold">{sectorName(s.name)}</p>
      <p className="tabular-nums">NDVI {n2(s.mean_ndvi)}</p>
      <p className="tabular-nums">{tr("Suelo desnudo", "Bare soil")} {n0(s.bare_pct)}</p>
      <p className={cn("mt-1 inline-flex items-center gap-1 font-semibold", weak && "text-destructive")}>
        {weak && <TriangleAlert aria-hidden className="size-3.5" />}{vigorWord(s.vigor) ?? tr("sin datos", "no data")}
      </p>
    </div>
  );
}

/** Vigor y suelo desnudo por sector del lote (Landsat HLS, 30 m). */
export function SectorsCard({ fieldId }: { fieldId: string }) {
  const s = useAsync<ApiResult<FieldSectors>>((signal) => api.fieldSectors(fieldId, { signal }), [fieldId]);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{tr("Vigor y suelo desnudo por sector (Landsat, 30 m)", "Vigor and bare soil per sector (Landsat, 30 m)")}</CardTitle>
        <CardDescription>{tr("El lote dividido en 9 sectores; en cada uno, el verdor (NDVI) de Landsat de los últimos 2 años.", "The plot split into 9 sectors; in each, Landsat greenness (NDVI) over the last 2 years.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBlock state={s} what={tr("los sectores del lote", "the plot sectors")}>
          {(r) => {
            const d = r.data;
            const byName = Object.fromEntries(d.sectors.map((x) => [x.name, x]));
            return (
              <div className="space-y-4">
                <p className="text-lg">{d.reading}</p>
                <div className="grid max-w-xl grid-cols-3 gap-2" aria-hidden>
                  {GRID.flat().map((name) => <Cell key={name} s={byName[name]} />)}
                </div>
                <Table scrollLabel={tr("Sectores del lote", "Plot sectors")}>
                  <TableCaption>{tr(`Sectores de norte a sur. «Más débil» o «más vigoroso»: 10 % o más de diferencia con la mediana del lote. Suelo desnudo: NDVI menor a ${d.bare_threshold.toLocaleString(appLocale())}.`, `Sectors from north to south. “Weaker” or “more vigorous”: 10 % or more difference from the plot median. Bare soil: NDVI below ${d.bare_threshold.toLocaleString(appLocale())}.`)}</TableCaption>
                  <TableHeader><TableRow><TableHead>{tr("Sector", "Sector")}</TableHead><TableHead>{tr("NDVI medio", "Mean NDVI")}</TableHead><TableHead>{tr("Pico", "Peak")}</TableHead><TableHead>{tr("Tiempo con poca vegetación", "Time with little vegetation")}</TableHead><TableHead>{tr("Frente al lote", "Vs. the plot")}</TableHead><TableHead>{tr("Datos", "Data")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.sectors.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="font-medium">{sectorName(x.name)}</TableCell>
                        <TableCell className="tabular-nums">{n2(x.mean_ndvi)}</TableCell>
                        <TableCell className="tabular-nums">{n2(x.peak_ndvi)}</TableCell>
                        <TableCell className="tabular-nums">{n0(x.bare_pct)}</TableCell>
                        <TableCell>{x.vs_field_pct == null ? "—" : `${x.vs_field_pct > 0 ? "+" : ""}${x.vs_field_pct.toLocaleString(appLocale())} % (${vigorWord(x.vigor)})`}</TableCell>
                        <TableCell className="tabular-nums">{x.observations}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  Fuente: NASA HLS (Landsat 8 y 9), {d.resolution} · tipo: observado · {d.period}
                  <Badge variant={r.demo || d.origin === "sample" ? "alerta" : "outline"}>{r.demo ? tr("DATOS DE EJEMPLO", "SAMPLE DATA") : d.origin_label}</Badge>
                </p>
                <details className="text-sm"><summary className="cursor-pointer font-medium">{tr("Cómo se calcula y limitaciones", "How it's calculated and limitations")}</summary><p className="mt-1">{d.method}</p><ul className="mt-1 list-disc pl-5">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></details>
              </div>
            );
          }}
        </AsyncBlock>
      </CardContent>
    </Card>
  );
}
