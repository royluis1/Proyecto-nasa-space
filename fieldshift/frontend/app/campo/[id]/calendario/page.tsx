"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AsyncBlock } from "@/components/async-block";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { CalendarLegend, RotationCalendar } from "@/components/score/rotation-calendar";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { buildCalendar, stepLength } from "@/lib/calendar";
import { MONTHS_LONG, STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import type { Crop, CropGroup, Rotation } from "@/types/api";

function WindowsTable({ rotation, crops }: { rotation: Rotation; crops: Record<string, Crop> }) {
  const cal = buildCalendar(rotation);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cultivo</TableHead><TableHead>Año</TableHead><TableHead>Siembra</TableHead><TableHead>Hasta</TableHead><TableHead>Época habitual de siembra</TableHead><TableHead>¿Encaja?</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cal.steps.map(({ step }) => {
          const crop = crops[step.crop_id];
          const inWindow = crop ? crop.sowing_months.includes(step.start_month) : null;
          const len = stepLength(step);
          const okLen = crop ? crop.cycle === "perenne" || (len >= crop.cycle_months.min && len <= crop.cycle_months.max) : null;
          return (
            <TableRow key={`${step.crop_id}-${step.year}-${step.start_month}`}>
              <TableCell className="font-medium">{crop?.name ?? step.crop_id}</TableCell>
              <TableCell>{step.year}</TableCell>
              <TableCell>{MONTHS_LONG[step.start_month - 1]}</TableCell>
              <TableCell>{MONTHS_LONG[step.end_month - 1]}</TableCell>
              <TableCell className="max-w-64 text-sm">{crop?.sowing_window ?? "—"}</TableCell>
              <TableCell>
                {inWindow === null ? "—" : inWindow && okLen ? (
                  <span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden className="size-4" /> Sí</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><TriangleAlert aria-hidden className="size-4" /> {inWindow ? "Ciclo fuera de lo habitual" : "Siembra fuera de la época habitual"}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CalendarioContent() {
  const { fieldId, compare } = useCampo();
  const router = useRouter();
  const params = useSearchParams();
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const evals = compare.evaluations;
  const wanted = params.get("rotacion");
  const selected = evals.find((e) => e.rotation.id === wanted) ?? evals[0];
  const actual = evals.find((e) => e.rotation.strategy === "actual");
  const cropMap = useMemo(() => Object.fromEntries((crops.data ?? []).map((c) => [c.id, c])), [crops.data]);

  const groups = useMemo(() => {
    const ids = new Set([...(selected?.rotation.steps ?? []), ...(actual?.rotation.steps ?? [])].map((s) => s.crop_id));
    return [...new Set([...ids].map((id) => cropMap[id]?.group).filter((g): g is CropGroup => Boolean(g)))];
  }, [selected, actual, cropMap]);

  return (
    <div className="space-y-6">
      <PageHeader title="Calendario agrícola" description="Qué ocupa el lote en cada mes, y si las fechas de siembra encajan con la época habitual de cada cultivo." />
      {!selected ? (
        compare.error ? (
          <Alert tone="error" title="No pudimos armar las rotaciones"><p>{compare.error}</p></Alert>
        ) : (
          <div role="status" aria-busy="true"><span className="sr-only">Cargando…</span><Skeleton className="h-64 w-full" /></div>
        )
      ) : (
        <>
          <div className="max-w-xl space-y-1.5">
            <Label htmlFor="rot">Rotación</Label>
            <Select id="rot" value={selected.rotation.id} onChange={(e) => router.replace(`/campo/${fieldId}/calendario?rotacion=${encodeURIComponent(e.target.value)}`, { scroll: false })}>
              {evals.map((e) => (
                <option key={e.rotation.id} value={e.rotation.id}>
                  {e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}: {rotationTitle(e.rotation)}
                </option>
              ))}
            </Select>
          </div>
          <AsyncBlock state={crops} what="el catálogo de cultivos">
            {() => (
              <div className="space-y-6">
                <CalendarLegend groups={groups} />
                <Card>
                  <CardHeader>
                    <CardTitle>{selected.rotation.name}</CardTitle>
                    <CardDescription>{STRATEGY_LABELS[selected.rotation.strategy]} · ciclo de {selected.rotation.duration_years} {selected.rotation.duration_years === 1 ? "año" : "años"}; después se repite.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <RotationCalendar rotation={selected.rotation} crops={cropMap} />
                    <WindowsTable rotation={selected.rotation} crops={cropMap} />
                  </CardContent>
                </Card>
                {actual && actual.rotation.id !== selected.rotation.id && (
                  <Card>
                    <CardHeader><CardTitle>Para comparar: tu rotación actual</CardTitle><CardDescription>{actual.rotation.name}</CardDescription></CardHeader>
                    <CardContent><RotationCalendar rotation={actual.rotation} crops={cropMap} /></CardContent>
                  </Card>
                )}
                <Alert tone="warning" title="Las fechas son típicas, no una recomendación de siembra">
                  <p>Las fechas salen del catálogo de cultivos y son orientativas. Ajustalas con tu ingeniero agrónomo según la variedad, el agua del perfil y la campaña.</p>
                </Alert>
              </div>
            )}
          </AsyncBlock>
        </>
      )}
    </div>
  );
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CalendarioContent />
    </Suspense>
  );
}
