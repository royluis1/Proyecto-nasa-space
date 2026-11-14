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

const GRID = [["Noroeste", "Norte", "Noreste"], ["Oeste", "Centro", "Este"], ["Suroeste", "Sur", "Sureste"]];
const n2 = (x: number | null) => (x == null ? "—" : x.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }));
const n0 = (x: number | null) => (x == null ? "—" : `${x.toLocaleString("es-AR", { maximumFractionDigits: 0 })} %`);

function Cell({ s }: { s?: Sector }) {
  if (!s) return <div className="grid min-h-24 place-items-center rounded-md border border-dashed text-xs text-muted-foreground">Fuera del lote</div>;
  const weak = s.vigor === "más débil";
  const strong = s.vigor === "más vigoroso";
  return (
    <div className={cn("min-h-24 rounded-md border-2 p-2 text-xs", weak ? "border-destructive/70 bg-destructive/10" : strong ? "border-good bg-good/15" : "border-border bg-card")}>
      <p className="font-semibold">{s.name}</p>
      <p className="tabular-nums">NDVI {n2(s.mean_ndvi)}</p>
      <p className="tabular-nums">Suelo desnudo {n0(s.bare_pct)}</p>
      <p className={cn("mt-1 inline-flex items-center gap-1 font-semibold", weak && "text-destructive")}>
        {weak && <TriangleAlert aria-hidden className="size-3.5" />}{s.vigor ?? "sin datos"}
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
        <CardTitle as="h2">Vigor y suelo desnudo por sector (Landsat, 30 m)</CardTitle>
        <CardDescription>El lote dividido en 9 sectores; en cada uno, el verdor (NDVI) de Landsat de los últimos 2 años.</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBlock state={s} what="los sectores del lote">
          {(r) => {
            const d = r.data;
            const byName = Object.fromEntries(d.sectors.map((x) => [x.name, x]));
            return (
              <div className="space-y-4">
                <p className="text-lg">{d.reading}</p>
                <div className="grid max-w-xl grid-cols-3 gap-2" aria-hidden>
                  {GRID.flat().map((name) => <Cell key={name} s={byName[name]} />)}
                </div>
                <Table scrollLabel="Sectores del lote">
                  <TableCaption>Sectores de norte a sur. «Más débil» o «más vigoroso»: 10 % o más de diferencia con la mediana del lote. Suelo desnudo: NDVI menor a {d.bare_threshold.toLocaleString("es-AR")}.</TableCaption>
                  <TableHeader><TableRow><TableHead>Sector</TableHead><TableHead>NDVI medio</TableHead><TableHead>Pico</TableHead><TableHead>Tiempo con poca vegetación</TableHead><TableHead>Frente al lote</TableHead><TableHead>Datos</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.sectors.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="font-medium">{x.name}</TableCell>
                        <TableCell className="tabular-nums">{n2(x.mean_ndvi)}</TableCell>
                        <TableCell className="tabular-nums">{n2(x.peak_ndvi)}</TableCell>
                        <TableCell className="tabular-nums">{n0(x.bare_pct)}</TableCell>
                        <TableCell>{x.vs_field_pct == null ? "—" : `${x.vs_field_pct > 0 ? "+" : ""}${x.vs_field_pct.toLocaleString("es-AR")} % (${x.vigor})`}</TableCell>
                        <TableCell className="tabular-nums">{x.observations}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  Fuente: NASA HLS (Landsat 8 y 9), {d.resolution} · tipo: observado · {d.period}
                  <Badge variant={r.demo || d.origin === "sample" ? "alerta" : "outline"}>{r.demo ? "DATOS DE EJEMPLO" : d.origin_label}</Badge>
                </p>
                <details className="text-sm"><summary className="cursor-pointer font-medium">Cómo se calcula y limitaciones</summary><p className="mt-1">{d.method}</p><ul className="mt-1 list-disc pl-5">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul></details>
              </div>
            );
          }}
        </AsyncBlock>
      </CardContent>
    </Card>
  );
}
