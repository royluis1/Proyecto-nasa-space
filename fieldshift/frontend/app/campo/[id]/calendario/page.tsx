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
import { L, localize, tr } from "@/lib/i18n";

function WindowsTable({ rotation, crops }: { rotation: Rotation; crops: Record<string, Crop> }) {
  const cal = buildCalendar(rotation);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tr("Cultivo", "Crop")}</TableHead><TableHead>{tr("Año", "Year")}</TableHead><TableHead>{tr("Siembra", "Planting")}</TableHead><TableHead>{tr("Hasta", "Until")}</TableHead><TableHead>{tr("Época habitual de siembra", "Usual planting season")}</TableHead><TableHead>{tr("¿Encaja?", "Does it fit?")}</TableHead>
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
                  <span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden className="size-4" /> {tr("Sí", "Yes")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><TriangleAlert aria-hidden className="size-4" /> {inWindow ? tr("Ciclo fuera de lo habitual", "Unusual cycle length") : tr("Siembra fuera de la época habitual", "Planting outside the usual season")}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const PRIORITY_WORD: Record<Level, string> = localize({ alto: L("alta", "high"), medio: L("media", "medium"), bajo: L("baja", "low") });
const SEVERITY_ICON: Record<Level, typeof TriangleAlert> = { alto: OctagonAlert, medio: TriangleAlert, bajo: Info };
const ADVICE_ICON: Record<TimelineAdvice["kind"], typeof TriangleAlert> = {
  cobertura: Layers, calor: Thermometer, agua: Droplet, siembra: Sprout, rotacion: Trophy, datos: Satellite,
};

function AdviceList({ advice, campaigns }: { advice: TimelineAdvice[]; campaigns: TimelineCampaign[] }) {
  const label = (ids: number[]) =>
    ids.length === campaigns.length ? tr("Todas las campañas", "All seasons") : ids.map((i) => campaigns.find((c) => c.index === i)?.label ?? i).join(", ");
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
                <span className="inline-flex items-center gap-1"><Sev aria-hidden className="size-4" /> {tr(`Prioridad ${PRIORITY_WORD[a.severity]}`, `${PRIORITY_WORD[a.severity][0].toUpperCase()}${PRIORITY_WORD[a.severity].slice(1)} priority`)}</span>
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
    [tr("Meses con cultivo vivo", "Months with a living crop"), ta.covered, tb.covered, true],
    [tr("Meses de suelo desnudo", "Months of bare soil"), ta.bare, tb.bare, false],
    [tr("Meses con riesgo alto de calor", "Months with high heat risk"), ta.heat, tb.heat, false],
    [tr("Meses con riesgo alto de falta de agua", "Months with high water-shortage risk"), ta.water, tb.water, false],
  ];
  return (
    <Table>
      <TableCaption>{tr(`Totales de las ${ta.campaigns} campañas. Mejor = más meses con cultivo vivo y menos meses con suelo desnudo o riesgo alto.`, `Totals for the ${ta.campaigns} seasons. Better = more months with a living crop and fewer months of bare soil or high risk.`)}</TableCaption>
      <TableHeader><TableRow><TableHead>{tr("Indicador", "Indicator")}</TableHead><TableHead>{rotationTitle(a.rotation)}</TableHead><TableHead>{rotationTitle(b.rotation)} ({tr("actual", "current")})</TableHead><TableHead>{tr("¿Cuál conviene?", "Which is better?")}</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map(([label, x, y, higher]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell><TableCell className="tabular-nums">{x}</TableCell><TableCell className="tabular-nums">{y}</TableCell>
            <TableCell>{x === y ? tr("Igual", "Same") : (x > y) === higher ? tr("La elegida", "The chosen one") : tr("La actual", "The current one")}</TableCell>
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
        title={tr("Calendario agrícola", "Farm calendar")}
        description={tr("Cuándo se siembra y se cosecha, y en qué meses hay riesgo.", "When to plant and harvest, and which months carry risk.")}
      >
      </PageHeader>
      {!selected ? (
        compare.error ? (
          <Alert tone="error" title={tr("No pudimos armar las rotaciones", "We couldn't build the rotations")}><p>{compare.error}</p></Alert>
        ) : (
          <div role="status" aria-busy="true"><span className="sr-only">{tr("Cargando…", "Loading…")}</span><Skeleton className="h-64 w-full" /></div>
        )
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rot">{tr("Rotación", "Rotation")}</Label>
                <Select id="rot" value={selected.rotation.id} onChange={(e) => setParam("rotacion", e.target.value)}>
                  {evals.map((e) => (
                    <option key={e.rotation.id} value={e.rotation.id}>
                      {e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}: {rotationTitle(e.rotation)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="esc">{tr("Escenario climático", "Climate scenario")}</Label>
                <Select id="esc" value={scenarioId} onChange={(e) => setParam("escenario", e.target.value)}>
                  {GROUP_ORDER.map((g) => (
                    <optgroup key={g} label={GROUP_LABELS[g]}>
                      {PRESET_SCENARIOS.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">{tr("Campañas", "Seasons")}</legend>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <Button key={n} size="sm" variant={n === nCampaigns ? "default" : "outline"} aria-pressed={n === nCampaigns} onClick={() => setParam("campanias", String(n))}>{n}</Button>
                  ))}
                </div>
              </fieldset>
              {actual && actual.rotation.id !== selected.rotation.id && (
                <div className="flex items-center gap-3 md:col-span-3">
                  <Switch id="vs-actual" checked={withActual} onCheckedChange={setWithActual} />
                  <Label htmlFor="vs-actual">{tr("Comparar con mi rotación actual", "Compare with my current rotation")}</Label>
                </div>
              )}
            </CardContent>
          </Card>

          <AsyncBlock state={timeline} what={tr("el calendario", "the calendar")}>
            {(r) => {
              const tl = r.data;
              return (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle as="h2">{rotationTitle(tl.rotation)}</CardTitle>
                      <CardDescription>
                        {STRATEGY_LABELS[tl.rotation.strategy]} · {PRESET_SCENARIOS.find((p) => p.id === scenarioId)?.name} · {tl.irrigated ? tr("con riego", "irrigated") : tr("secano", "rainfed")} ·{" "}
                        {tl.is_recommended ? tr("es la recomendada para este escenario", "it is the recommended one for this scenario") : tr(`${num(tl.score_total)} puntos (la recomendada tiene ${num(tl.recommended_total)})`, `${num(tl.score_total)} points (the recommended one has ${num(tl.recommended_total)})`)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Disclosure label={tr("¿Cómo leer el calendario?", "How to read the calendar?")}><TimelineLegend /></Disclosure>
                      {crops.data ? tl.campaigns.map((c) => <CampaignTimeline key={c.index} campaign={c} crops={cropMap} />) : <Skeleton className="h-48 w-full" />}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle as="h2">{tr("Qué tener en cuenta", "What to keep in mind")}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <AdviceList advice={tl.advice.slice(0, 3)} campaigns={tl.campaigns} />
                      {tl.advice.length > 3 && (
                        <Disclosure label={tr(`Ver ${tl.advice.length - 3} recomendaciones más`, `See ${tl.advice.length - 3} more recommendations`)}>
                          <AdviceList advice={tl.advice.slice(3)} campaigns={tl.campaigns} />
                        </Disclosure>
                      )}
                    </CardContent>
                  </Card>

                  {showActual && (
                    <Card>
                      <CardHeader><CardTitle as="h2">{tr("Frente a tu rotación actual", "Vs. your current rotation")}</CardTitle><CardDescription>{tr("Mismo escenario y mismas campañas.", "Same scenario and same seasons.")}</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                        <AsyncBlock state={actualTl} what={tr("el calendario de tu rotación actual", "your current rotation's calendar")}>
                          {(a) => (
                            <>
                              <CompareTotals a={tl} b={a.data} />
                              {a.data.campaigns.map((c) => <CampaignTimeline key={c.index} campaign={c} crops={cropMap} rotationName={tr("Tu rotación actual", "Your current rotation")} />)}
                            </>
                          )}
                        </AsyncBlock>
                      </CardContent>
                    </Card>
                  )}

                  <PageNotes>
                    <WarningsList warnings={friendlyWarnings(r.meta.warnings).filter((w) => !/prioridades por defecto|default priorities/i.test(w))} title={tr("Avisos", "Notices")} />
                    <p>{tr("Las fechas son típicas, no una recomendación de siembra: ajustalas con tu ingeniero agrónomo según la variedad, el agua del perfil y el pronóstico.", "The dates are typical, not a planting recommendation: adjust them with your agronomist based on the variety, soil-profile water and the forecast.")}</p>
                    <Disclosure label={tr("Datos usados y supuestos", "Data used and assumptions")} contentClassName="grid gap-4 lg:grid-cols-2">
                      <div><h3 className="font-medium text-foreground">{tr("Datos usados", "Data used")}</h3><ul className="mt-1 list-disc space-y-1 pl-5">{tl.data_used.map((d) => <li key={d}>{d}</li>)}</ul></div>
                      <div><h3 className="font-medium text-foreground">{tr("Supuestos", "Assumptions")}</h3><ul className="mt-1 list-disc space-y-1 pl-5">{tl.assumptions.map((d) => <li key={d}>{d}</li>)}</ul></div>
                    </Disclosure>
                  </PageNotes>
                </div>
              );
            }}
          </AsyncBlock>

          <Disclosure variant="card" label={tr("¿Las fechas de siembra encajan con la época de cada cultivo?", "Do the planting dates fit each crop's season?")}>
            <AsyncBlock state={crops} what={tr("el catálogo de cultivos", "the crop catalog")}>
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
