"use client";

import { ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tr } from "@/lib/i18n";

/** Paleta de gráficos (legible en claro y oscuro). Los datos nunca se distinguen solo por color: hay formas, etiquetas y tabla. */
export const CHART = { agua: "#2f7fb5", cultivo: "#3f8a52", tierra: "#a87a44", alerta: "#c2410c", gris: "#8a8f87" };

interface Props {
  title: string;
  caption?: string;
  /** Alternativa en tabla para quien no puede ver el gráfico. */
  table: { headers: string[]; rows: (string | number)[][] };
  height?: number;
  children: React.ReactElement;
}

export function ChartFrame({ title, caption, table, height = 280, children }: Props) {
  return (
    <figure className="space-y-2">
      <figcaption className="font-medium">{title}</figcaption>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div role="img" aria-label={`${title}. ${caption ?? ""} ${tr("Los datos están en la tabla que sigue al gráfico.", "The data is in the table after the chart.")}`} className="text-muted-foreground" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
          {children}
        </ResponsiveContainer>
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">{tr("Ver los datos en una tabla", "See the data in a table")}</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {table.headers.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((c, j) => (
                    <TableCell key={j} className="py-1.5 tabular-nums">{c}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </figure>
  );
}
