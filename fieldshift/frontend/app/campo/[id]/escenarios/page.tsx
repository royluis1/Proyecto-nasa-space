"use client";

import { ArrowDown, ArrowUp, CalendarDays, FlaskConical, Minus, Play, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { useCampo } from "@/components/campo/campo-provider";
import { CHART, ChartFrame } from "@/components/charts/chart-frame";
import { PageHeader } from "@/components/page-header";
import { RiskLevelBadge } from "@/components/provenance/badges";
import { WarningsList } from "@/components/provenance/warnings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api";
import { STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import {
  BASE_ID, CUSTOM_ID, DEFAULT_CUSTOM, GROUP_LABELS, GROUP_ORDER, IRRIGATION_LABELS, PRESET_SCENARIOS, bestOf, customScenario, impact,
  resilience, scenarioMatrix, scenarioParts, type CustomScenario, type ScenarioCells,
} from "@/lib/scenarios";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiResult, IrrigationLevel, RotationEvaluation, ScenarioResult } from "@/types/api";

function Delta({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const Icon = value > 0.04 ? ArrowUp : value < -0.04 ? ArrowDown : Minus;
  const word = value > 0.04 ? "sube" : value < -0.04 ? "baja" : "igual";
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{word} </span>
      {signed(value, decimals)}
    </span>
  );
}

/** Lo que cambia con el escenario elegido, frente al año normal. */
function ImpactCard({ base, sel, result, names, evals, actualId }: {
  base: ScenarioCells; sel: ScenarioCells; result: ScenarioResult | undefined; names: Record<string, string>;
  evals: RotationEvaluation[]; actualId?: string;
}) {
  const baseBest = bestOf(base.cells);
  const best = bestOf(sel.cells);
  const parts = scenarioParts(sel.scenario);
  const notes = Object.fromEntries((result?.rotations ?? []).map((n) => [n.rotation_id, n]));
  const actual = actualId ? impact(base, sel, actualId) : null;
  const bestImpact = best ? impact(base, sel, best) : null;
  const ids = Object.keys(sel.cells).sort((a, b) => sel.cells[a].rank - sel.cells[b].rank);
  const strategy = Object.fromEntries(evals.map((e) => [e.rotation.id, e.rotation.strategy]));
  const isBase = sel.scenario.id === BASE_ID;
  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle as="h2">{sel.scenario.name}: qué cambia</CardTitle>
        <CardDescription>{isBase ? "El clima promedio de los últimos 10 años: es el punto de comparación." : `Frente al año normal, ${parts.join(", ")}.`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border-2 border-primary p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Trophy aria-hidden className="size-4 text-primary" /> Mejor opción en este escenario</p>
            <p className="mt-1 text-lg font-semibold">{best ? names[best] : "—"}</p>
            {best && <p className="tabular-nums">{num(sel.cells[best].total, 1)} puntos{bestImpact && !isBase ? <> (<Delta value={bestImpact.delta} /> frente al año normal)</> : null}</p>}
            {!isBase && best && baseBest && (
              <p className="mt-2 text-sm">{best === baseBest ? "Es la misma que en un año normal: la recomendación se sostiene." : <>Cambia: en un año normal la mejor es <strong>{names[baseBest]}</strong>.</>}</p>
            )}
          </div>
          {actualId && sel.cells[actualId] && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Tu rotación actual</p>
              <p className="mt-1 text-lg font-semibold">{names[actualId]}</p>
              <p className="tabular-nums">Puesto {sel.cells[actualId].rank} · {num(sel.cells[actualId].total, 1)} puntos{actual && !isBase ? <> (<Delta value={actual.delta} />)</> : null}</p>
              {notes[actualId]?.risk_level && <div className="mt-2"><RiskLevelBadge level={notes[actualId].risk_level} /></div>}
            </div>
          )}
        </div>

        <Table>
          <TableCaption>Ranking recalculado para «{sel.scenario.name}» con tus prioridades. Abrí cada fila para ver riesgos y explicación.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Puesto</TableHead><TableHead>Rotación</TableHead><TableHead>Puntaje</TableHead>
              {!isBase && <TableHead>Frente al año normal</TableHead>}<TableHead>Riesgo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ids.map((id) => {
              const c = sel.cells[id];
              const d = impact(base, sel, id);
              const note = notes[id];
              return (
                <TableRow key={id} className="align-top">
                  <TableCell className="tabular-nums">{c.rank === 1 ? <Trophy aria-label="Primera" className="inline size-4 text-primary" /> : null} {c.rank}</TableCell>
                  <TableCell className="min-w-64">
                    <strong>{STRATEGY_LABELS[strategy[id]] ?? ""}</strong>{id === actualId && <Badge variant="tierra" className="ml-2">Actual</Badge>}
                    <span className="block text-sm text-muted-foreground">{names[id]}</span>
                    {note && (
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer font-medium text-primary">Riesgos y por qué</summary>
                        <p className="mt-1">{note.why}</p>
                        {note.risks.length > 0 && <ul className="mt-1 list-disc pl-5">{note.risks.map((r) => <li key={r}>{r}</li>)}</ul>}
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums font-semibold">{num(c.total, 1)}</TableCell>
                  {!isBase && (
                    <TableCell className="text-sm">
                      {d && <><Delta value={d.delta} /> pts{d.rankDelta !== 0 && <span className="block text-muted-foreground">{d.rankDelta > 0 ? `sube ${d.rankDelta}` : `baja ${-d.rankDelta}`} {Math.abs(d.rankDelta) === 1 ? "puesto" : "puestos"}</span>}</>}
                    </TableCell>
                  )}
                  <TableCell>{note?.risk_level ? <RiskLevelBadge level={note.risk_level} /> : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {result && result.warnings.length > 0 && <WarningsList warnings={friendlyWarnings(result.warnings).filter((w) => !/prioridades por defecto/i.test(w))} title="Avisos de este escenario" />}
      </CardContent>
    </Card>
  );
}

/** Qué rotación aguanta mejor todos los escenarios. */
function ResilienceCard({ matrix, names, actualId }: { matrix: ScenarioCells[]; names: Record<string, string>; actualId?: string }) {
  const res = resilience(matrix);
  const top = res[0];
  const ids = res.map((r) => r.id);
  const winners = matrix.filter((m) => m.scenario.id !== BASE_ID).map((m) => ({ s: m.scenario, best: bestOf(m.cells) }));
  const chartIds = [...new Set([top?.id, actualId].filter((x): x is string => Boolean(x)))];
  const chartRows = matrix.map((m) => ({ escenario: m.scenario.name, ...Object.fromEntries(chartIds.map((id) => [names[id] ?? id, m.cells[id]?.total])) }));
  const keys = chartIds.map((id) => names[id] ?? id);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">¿Qué rotación resiste mejor?</CardTitle>
        <CardDescription>Todas las rotaciones en todos los escenarios, con tus prioridades. Gana la que nunca cae al fondo del ranking.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {top && (
          <p className="flex gap-2 rounded-md bg-primary/10 p-3 text-lg">
            <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
            <span>
              La más resistente es <strong>{names[top.id]}</strong>: en el peor escenario ({top.worstScenario}) queda en el puesto {top.worstRank} con {num(top.worst, 1)} puntos,
              y es la mejor en {top.wins} de {matrix.length} escenarios.
            </span>
          </p>
        )}
        <div>
          <h3 className="mb-2 font-semibold">La mejor de cada escenario</h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {winners.map(({ s, best }) => (
              <li key={s.id} className="text-sm"><strong>{s.name}:</strong> {best ? names[best] : "—"}</li>
            ))}
          </ul>
        </div>
        <Table scrollLabel="Tabla de puntajes por escenario: desplazá para ver todas las columnas">
            <TableCaption>Puntaje (0 a 100) de cada rotación en cada escenario. El trofeo marca la mejor de cada columna y la flecha hacia abajo, el peor escenario de cada rotación.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Rotación</TableHead>
                {matrix.map((m) => <TableHead key={m.scenario.id} className="min-w-24">{m.scenario.id === CUSTOM_ID && <FlaskConical aria-hidden className="mr-1 inline size-4" />}{m.scenario.name}</TableHead>)}
                <TableHead>Mayor caída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ids.map((id) => {
                const r = res.find((x) => x.id === id)!;
                return (
                  <TableRow key={id}>
                    <TableCell className="sticky left-0 min-w-48 bg-card font-medium">{names[id] ?? id}{id === actualId && <Badge variant="tierra" className="ml-2">Actual</Badge>}</TableCell>
                    {matrix.map((m) => {
                      const c = m.cells[id];
                      const worst = c && c.total === r.worst && m.scenario.name === r.worstScenario;
                      return (
                        <TableCell key={m.scenario.id} className="tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            {c?.rank === 1 && <Trophy aria-label="Mejor de este escenario" className="size-4 text-primary" />}
                            {worst && <ArrowDown aria-label="Su peor escenario" className="size-4" />}
                            {num(c?.total, 1)}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="tabular-nums">−{num(r.maxDrop, 1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
        <ChartFrame
          title="La más resistente y tu rotación actual, escenario por escenario"
          caption="Si una línea cae mucho en un escenario, esa rotación es sensible a ese cambio."
          table={{ headers: ["Escenario", ...keys], rows: chartRows.map((row) => [String(row.escenario), ...keys.map((k) => num(Number((row as Record<string, unknown>)[k]), 1))]) }}
        >
          <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="escenario" tick={{ fill: "currentColor", fontSize: 11, angle: -25, textAnchor: "end" }} interval={0} height={90} />
            <YAxis tick={{ fill: "currentColor", fontSize: 12 }} width={36} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "oklch(var(--card))", border: "1px solid oklch(var(--border))", borderRadius: 8, color: "oklch(var(--foreground))" }} />
            <Legend />
            {keys.map((k, i) => (
              <Line isAnimationActive={false} key={k} dataKey={k} stroke={[CHART.cultivo, CHART.tierra][i % 2]} strokeDasharray={i ? "8 4" : undefined} strokeWidth={3} dot={{ r: 5 }} />
            ))}
          </LineChart>
        </ChartFrame>
      </CardContent>
    </Card>
  );
}

function CustomBuilder({ value, onChange, onRun, running }: { value: CustomScenario; onChange: (c: CustomScenario) => void; onRun: () => void; running: boolean }) {
  const set = (p: Partial<CustomScenario>) => onChange({ ...value, ...p });
  return (
    <Card>
      <CardHeader><CardTitle as="h2">Armar mi propio escenario</CardTitle><CardDescription>Combiná cambios y sumalo a la comparación.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex justify-between"><Label id="rain-l">Cambio en la lluvia</Label><output className="tabular-nums font-medium">{signed(value.rain)} %</output></div>
            <Slider min={-50} max={30} step={5} value={[value.rain]} onValueChange={([v]) => set({ rain: v })} thumbLabel="Cambio en la lluvia, de menos 50 a más 30 por ciento" aria-labelledby="rain-l" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><Label id="temp-l">Aumento de temperatura</Label><output className="tabular-nums font-medium">+{num(value.temp, 1)} °C</output></div>
            <Slider min={0} max={3} step={0.5} value={[value.temp]} onValueChange={([v]) => set({ temp: v })} thumbLabel="Aumento de temperatura, de 0 a 3 grados" aria-labelledby="temp-l" />
          </div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="c-dry">Repetir el año más seco</Label><Switch id="c-dry" checked={value.dry} onCheckedChange={(v) => set({ dry: v })} /></div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="c-wet">Lluvias intensas</Label><Switch id="c-wet" checked={value.heavyRain} onCheckedChange={(v) => set({ heavyRain: v })} /></div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="c-hot">Olas de calor</Label><Switch id="c-hot" checked={value.heatWave} onCheckedChange={(v) => set({ heatWave: v })} /></div>
          <div className="space-y-1">
            <Label htmlFor="c-irr">Riego</Label>
            <Select id="c-irr" value={value.irrigation} onChange={(e) => set({ irrigation: e.target.value as IrrigationLevel })}>
              {(Object.keys(IRRIGATION_LABELS) as IrrigationLevel[]).map((k) => <option key={k} value={k}>{IRRIGATION_LABELS[k]}</option>)}
            </Select>
          </div>
        </div>
        <Button size="lg" onClick={onRun} disabled={running}><Play aria-hidden /> {running ? "Simulando…" : "Simular mi escenario"}</Button>
      </CardContent>
    </Card>
  );
}

export default function EscenariosPage() {
  const { fieldId, backendPriorities, weights, compare } = useCampo();
  const settled = useDebounced(backendPriorities, 800);
  const [selectedId, setSelectedId] = useState("anio-seco");
  const [custom, setCustom] = useState<CustomScenario>(DEFAULT_CUSTOM);
  const [customRun, setCustomRun] = useState<CustomScenario | null>(null);

  const presets = useAsync<ApiResult<ScenarioResult[]>>(
    (signal) => api.scenarios(fieldId, PRESET_SCENARIOS, settled, { signal }),
    [fieldId, JSON.stringify(settled)],
  );
  const customState = useAsync<ApiResult<ScenarioResult[]> | null>(
    async (signal) => (customRun ? api.scenarios(fieldId, [customScenario(customRun)], settled, { signal }) : null),
    [fieldId, JSON.stringify(customRun), JSON.stringify(settled)],
  );

  const evals = compare.evaluations;
  const names = useMemo(() => Object.fromEntries(evals.map((e) => [e.rotation.id, rotationTitle(e.rotation)])), [evals]);
  const actualId = evals.find((e) => e.rotation.strategy === "actual")?.rotation.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escenarios climáticos"
        description="Elegí un escenario y mirá al instante cómo cambian el puntaje, el ranking, los riesgos y la recomendación. Sirve para ver qué rotaciones aguantan mejor, no para predecir el clima."
      >
        <Button asChild variant="outline"><Link href={`/campo/${fieldId}/calendario?escenario=${encodeURIComponent(selectedId)}`}><CalendarDays aria-hidden /> Ver en el calendario</Link></Button>
      </PageHeader>
      <Alert tone="info" title="Son pruebas de sensibilidad, no pronósticos">
        <p>Cada escenario cambia la lluvia, la temperatura o el riego del clima de referencia (NASA POWER, últimos 10 años) con supuestos simples. Para saber cómo viene la campaña, consultá el pronóstico oficial.</p>
      </Alert>

      <AsyncBlock state={presets} what="los escenarios">
        {(r) => {
          const results = [...r.data, ...(customState.data?.data ?? [])];
          const matrix = scenarioMatrix(results, weights, actualId);
          const base = matrix.find((m) => m.scenario.id === BASE_ID) ?? matrix[0];
          const sel = matrix.find((m) => m.scenario.id === selectedId) ?? base;
          const selResult = results.find((x) => x.scenario.id === sel.scenario.id);
          return (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle as="h2">Elegí un escenario</CardTitle><CardDescription>Todos ya están calculados: el cambio es inmediato. Si movés tus prioridades, los puntajes se actualizan solos.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  {GROUP_ORDER.map((g) => (
                    <fieldset key={g}>
                      <legend className="mb-2 text-sm font-semibold text-muted-foreground">{GROUP_LABELS[g]}</legend>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_SCENARIOS.filter((p) => p.group === g).map((p) => (
                          <Button key={p.id} variant={sel.scenario.id === p.id ? "default" : "outline"} aria-pressed={sel.scenario.id === p.id} onClick={() => setSelectedId(p.id)} title={p.help}>
                            {p.name}
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  {customState.data?.data[0] && (
                    <Button variant={sel.scenario.id === CUSTOM_ID ? "default" : "outline"} aria-pressed={sel.scenario.id === CUSTOM_ID} onClick={() => setSelectedId(CUSTOM_ID)}>
                      <FlaskConical aria-hidden /> {customState.data.data[0].scenario.name}
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">{PRESET_SCENARIOS.find((p) => p.id === sel.scenario.id)?.help}</p>
                </CardContent>
              </Card>
              <WarningsList warnings={friendlyWarnings(r.meta.warnings).filter((w) => !/prioridades por defecto/i.test(w))} title="Avisos" />
              <ImpactCard base={base} sel={sel} result={selResult} names={names} evals={evals} actualId={actualId} />
              <ResilienceCard matrix={matrix} names={names} actualId={actualId} />
            </div>
          );
        }}
      </AsyncBlock>

      <CustomBuilder value={custom} onChange={setCustom} onRun={() => { setCustomRun(custom); setSelectedId(CUSTOM_ID); }} running={customState.loading} />
      {customState.error && <Alert tone="error" title="No pudimos simular tu escenario"><p>{customState.error}</p></Alert>}
    </div>
  );
}
