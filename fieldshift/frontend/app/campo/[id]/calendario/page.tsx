"use client";

import { CheckCircle2, Droplet, Info, Layers, OctagonAlert, Satellite, Sprout, Thermometer, TriangleAlert, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { CampaignTimeline, TimelineLegend } from "@/components/calendar/campaign-timeline";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { PageNotes } from "@/components/layout/page-notes";
import { Disclosure } from "@/components/ui/disclosure";
import { WarningsList } from "@/components/provenance/warnings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api";
import { buildCalendar, stepLength } from "@/lib/calendar";
import { MONTHS_LONG, STRATEGY_LABELS, num, rotationTitle } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import { BASE_ID, GROUP_LABELS, GROUP_ORDER, PRESET_SCENARIOS, isBaseline, toRequest } from "@/lib/scenarios";
import { timelineTotals } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { ApiResult, CalendarTimeline, Crop, Level, Rotation, TimelineAdvice, TimelineCampaign } from "@/types/api";

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

const PRIORITY_WORD: Record<Level, string> = { alto: "alta", medio: "media", bajo: "baja" };
const SEVERITY_ICON: Record<Level, typeof TriangleAlert> = { alto: OctagonAlert, medio: TriangleAlert, bajo: Info };
const ADVICE_ICON: Record<TimelineAdvice["kind"], typeof TriangleAlert> = {
  cobertura: Layers, calor: Thermometer, agua: Droplet, siembra: Sprout, rotacion: Trophy, datos: Satellite,
};

function AdviceList({ advice, campaigns }: { advice: TimelineAdvice[]; campaigns: TimelineCampaign[] }) {
  const label = (ids: number[]) =>
    ids.length === campaigns.length ? "Todas las campañas" : ids.map((i) => campaigns.find((c) => c.index === i)?.label ?? i).join(", ");
  return (
    <ul className="space-y-3">
      {advice.map((a, i) => {
        const Icon = ADVICE_ICON[a.kind];
        const Sev = SEVERITY_ICON[a.severity];
        return (
          <li key={i} className={cn("flex gap-3 rounded-lg border p-3", a.severity === "alto" && "border-destructive/50")}>
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p>{a.text}</p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Sev aria-hidden className="size-4" /> Prioridad {PRIORITY_WORD[a.severity]}</span>
                <span>· {label(a.campaigns)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CompareTotals({ a, b }: { a: CalendarTimeline; b: CalendarTimeline }) {
  const ta = timelineTotals(a);
  const tb = timelineTotals(b);
  const rows: [string, number, number, boolean][] = [
    ["Meses con cultivo vivo", ta.covered, tb.covered, true],
    ["Meses de suelo desnudo", ta.bare, tb.bare, false],
    ["Meses con riesgo alto de calor", ta.heat, tb.heat, false],
    ["Meses con riesgo alto de falta de agua", ta.water, tb.water, false],
  ];
  return (
    <Table>
      <TableCaption>Totales de las {ta.campaigns} campañas. Mejor = más meses con cultivo vivo y menos meses con suelo desnudo o riesgo alto.</TableCaption>
      <TableHeader><TableRow><TableHead>Indicador</TableHead><TableHead>{rotationTitle(a.rotation)}</TableHead><TableHead>{rotationTitle(b.rotation)} (actual)</TableHead><TableHead>¿Cuál conviene?</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map(([label, x, y, higher]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell><TableCell className="tabular-nums">{x}</TableCell><TableCell className="tabular-nums">{y}</TableCell>
            <TableCell>{x === y ? "Igual" : (x > y) === higher ? "La elegida" : "La actual"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CalendarioContent() {
  const { fieldId, compare, backendPriorities } = useCampo();
  const router = useRouter();
  const params = useSearchParams();
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const evals = compare.evaluations;
  const wanted = params.get("rotacion");
  const selected = evals.find((e) => e.rotation.id === wanted) ?? evals[0];
  const actual = evals.find((e) => e.rotation.strategy === "actual");
  const scenarioId = PRESET_SCENARIOS.some((p) => p.id === params.get("escenario")) ? params.get("escenario")! : BASE_ID;
  const nCampaigns = Math.min(4, Math.max(2, Number(params.get("campanias")) || 3));
  const [withActual, setWithActual] = useState(false);
  const cropMap = useMemo(() => Object.fromEntries((crops.data ?? []).map((c) => [c.id, c])), [crops.data]);
  const settled = useDebounced(backendPriorities, 800);

  const setParam = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    q.set(key, value);
    router.replace(`/campo/${fieldId}/calendario?${q.toString()}`, { scroll: false });
  };

  const scenario = useMemo(() => {
    const p = PRESET_SCENARIOS.find((x) => x.id === scenarioId)!;
    return isBaseline(p) ? null : toRequest(p);
  }, [scenarioId]);
  const rotationId = selected?.rotation.id;
  const timeline = useAsync<ApiResult<CalendarTimeline>>(
    (signal) => api.calendar({ field_id: fieldId, rotation_id: rotationId, campaigns: nCampaigns, scenario, priorities: settled }, { signal }),
    [fieldId, rotationId, nCampaigns, scenarioId, JSON.stringify(settled)],
    Boolean(rotationId),
  );
  const showActual = withActual && actual && actual.rotation.id !== rotationId;
  const actualTl = useAsync<ApiResult<CalendarTimeline>>(
    (signal) => api.calendar({ field_id: fieldId, rotation_id: actual!.rotation.id, campaigns: nCampaigns, scenario, priorities: settled }, { signal }),
    [fieldId, actual?.rotation.id, nCampaigns, scenarioId, JSON.stringify(settled), showActual],
    Boolean(showActual),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario agrícola"
        description="Cuándo se siembra y se cosecha, y en qué meses hay riesgo."
      >
      </PageHeader>
      {!selected ? (
        compare.error ? (
          <Alert tone="error" title="No pudimos armar las rotaciones"><p>{compare.error}</p></Alert>
        ) : (
          <div role="status" aria-busy="true"><span className="sr-only">Cargando…</span><Skeleton className="h-64 w-full" /></div>
        )
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rot">Rotación</Label>
                <Select id="rot" value={selected.rotation.id} onChange={(e) => setParam("rotacion", e.target.value)}>
                  {evals.map((e) => (
                    <option key={e.rotation.id} value={e.rotation.id}>
                      {e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}: {rotationTitle(e.rotation)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="esc">Escenario climático</Label>
                <Select id="esc" value={scenarioId} onChange={(e) => setParam("escenario", e.target.value)}>
                  {GROUP_ORDER.map((g) => (
                    <optgroup key={g} label={GROUP_LABELS[g]}>
                      {PRESET_SCENARIOS.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Campañas</legend>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <Button key={n} size="sm" variant={n === nCampaigns ? "default" : "outline"} aria-pressed={n === nCampaigns} onClick={() => setParam("campanias", String(n))}>{n}</Button>
                  ))}
                </div>
              </fieldset>
              {actual && actual.rotation.id !== selected.rotation.id && (
                <div className="flex items-center gap-3 md:col-span-3">
                  <Switch id="vs-actual" checked={withActual} onCheckedChange={setWithActual} />
                  <Label htmlFor="vs-actual">Comparar con mi rotación actual</Label>
                </div>
              )}
            </CardContent>
          </Card>

          <AsyncBlock state={timeline} what="el calendario">
            {(r) => {
              const tl = r.data;
              return (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle as="h2">{rotationTitle(tl.rotation)}</CardTitle>
                      <CardDescription>
                        {STRATEGY_LABELS[tl.rotation.strategy]} · {PRESET_SCENARIOS.find((p) => p.id === scenarioId)?.name} · {tl.irrigated ? "con riego" : "secano"} ·{" "}
                        {tl.is_recommended ? "es la recomendada para este escenario" : `${num(tl.score_total)} puntos (la recomendada tiene ${num(tl.recommended_total)})`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Disclosure label="¿Cómo leer el calendario?"><TimelineLegend /></Disclosure>
                      {crops.data ? tl.campaigns.map((c) => <CampaignTimeline key={c.index} campaign={c} crops={cropMap} />) : <Skeleton className="h-48 w-full" />}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle as="h2">Qué tener en cuenta</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <AdviceList advice={tl.advice.slice(0, 3)} campaigns={tl.campaigns} />
                      {tl.advice.length > 3 && (
                        <Disclosure label={`Ver ${tl.advice.length - 3} recomendaciones más`}>
                          <AdviceList advice={tl.advice.slice(3)} campaigns={tl.campaigns} />
                        </Disclosure>
                      )}
                    </CardContent>
                  </Card>

                  {showActual && (
                    <Card>
                      <CardHeader><CardTitle as="h2">Frente a tu rotación actual</CardTitle><CardDescription>Mismo escenario y mismas campañas.</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                        <AsyncBlock state={actualTl} what="el calendario de tu rotación actual">
                          {(a) => (
                            <>
                              <CompareTotals a={tl} b={a.data} />
                              {a.data.campaigns.map((c) => <CampaignTimeline key={c.index} campaign={c} crops={cropMap} rotationName="Tu rotación actual" />)}
                            </>
                          )}
                        </AsyncBlock>
                      </CardContent>
                    </Card>
                  )}

                  <PageNotes>
                    <WarningsList warnings={friendlyWarnings(r.meta.warnings).filter((w) => !/prioridades por defecto/i.test(w))} title="Avisos" />
                    <p>Las fechas son típicas, no una recomendación de siembra: ajustalas con tu ingeniero agrónomo según la variedad, el agua del perfil y el pronóstico.</p>
                    <Disclosure label="Datos usados y supuestos" contentClassName="grid gap-4 lg:grid-cols-2">
                      <div><h3 className="font-medium text-foreground">Datos usados</h3><ul className="mt-1 list-disc space-y-1 pl-5">{tl.data_used.map((d) => <li key={d}>{d}</li>)}</ul></div>
                      <div><h3 className="font-medium text-foreground">Supuestos</h3><ul className="mt-1 list-disc space-y-1 pl-5">{tl.assumptions.map((d) => <li key={d}>{d}</li>)}</ul></div>
                    </Disclosure>
                  </PageNotes>
                </div>
              );
            }}
          </AsyncBlock>

          <Disclosure variant="card" label="¿Las fechas de siembra encajan con la época de cada cultivo?">
            <AsyncBlock state={crops} what="el catálogo de cultivos">
              {() => <WindowsTable rotation={selected.rotation} crops={cropMap} />}
            </AsyncBlock>
          </Disclosure>
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
