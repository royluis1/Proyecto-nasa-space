"use client";

import { ArrowDown, ArrowUp, Equal, FlaskConical, Minus, Play, ShieldCheck, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { useCampo } from "@/components/campo/campo-provider";
import { CHART, ChartFrame } from "@/components/charts/chart-frame";
import { PageHeader } from "@/components/page-header";
import { WarningsList } from "@/components/provenance/warnings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { STRATEGY_LABELS, num, signed } from "@/lib/format";
import { scenarioTable } from "@/lib/ranking";
import { CUSTOM_ID, PRESET_SCENARIOS, customScenario, type CustomScenario } from "@/lib/scenarios";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiResult, ScenarioResult } from "@/types/api";

export default function EscenariosPage() {
  const { fieldId, backendPriorities, weights, compare } = useCampo();
  const [chosen, setChosen] = useState<string[]>(["seco-20", "calor-2", "anio-seco"]);
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom] = useState<CustomScenario>({ rain: -30, temp: 1, dry: false, irrigation: false });
  const [runKey, setRunKey] = useState(1);
  const [submitted, setSubmitted] = useState({ chosen: ["seco-20", "calor-2", "anio-seco"], custom: null as CustomScenario | null });

  const scenarios = useMemo(() => {
    const base = PRESET_SCENARIOS.find((p) => p.id === "base")!;
    const picked = PRESET_SCENARIOS.filter((p) => submitted.chosen.includes(p.id));
    return [base, ...picked, ...(submitted.custom ? [customScenario(submitted.custom)] : [])].map((s) => ({
      id: s.id, name: s.name, rain_delta_pct: s.rain_delta_pct, temp_delta_c: s.temp_delta_c, dry_year: s.dry_year, irrigation: s.irrigation,
    }));
  }, [submitted]);

  const state = useAsync<ApiResult<ScenarioResult[]>>(
    (signal) => api.scenarios(fieldId, scenarios, backendPriorities, { signal }),
    [fieldId, runKey],
  );

  const names = useMemo(() => Object.fromEntries(compare.evaluations.map((e) => [e.rotation.id, e.rotation.name])), [compare.evaluations]);
  const strategies = useMemo(() => Object.fromEntries(compare.evaluations.map((e) => [e.rotation.id, e.rotation.strategy])), [compare.evaluations]);
  const actualId = compare.evaluations.find((e) => e.rotation.strategy === "actual")?.rotation.id;

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const run = () => {
    setSubmitted({ chosen, custom: useCustom ? custom : null });
    setRunKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escenarios climáticos"
        description="Probá qué pasa con el ranking si llueve menos, hace más calor o tenés riego. Sirve para ver qué rotaciones aguantan mejor, no para predecir el clima."
      />
      <Alert tone="info" title="Son pruebas de sensibilidad, no pronósticos">
        <p>Cada escenario cambia la lluvia y la temperatura del clima de referencia con valores simples. Si querés saber cómo viene el clima, consultá el pronóstico oficial.</p>
      </Alert>

      <Card>
        <CardHeader><CardTitle as="h2">Elegí qué comparar</CardTitle><CardDescription>El clima del período siempre se incluye como punto de partida.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <fieldset>
            <legend className="mb-2 font-medium">Escenarios predefinidos</legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {PRESET_SCENARIOS.filter((p) => p.id !== "base").map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent">
                    <input type="checkbox" className="mt-1 size-5 accent-[hsl(var(--primary))]" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span><span className="font-medium">{p.name}</span><span className="block text-sm text-muted-foreground">{p.help}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="custom-switch">Armar mi propio escenario</Label>
                <p className="text-sm text-muted-foreground">Elegí cuánto cambia la lluvia y la temperatura.</p>
              </div>
              <Switch id="custom-switch" checked={useCustom} onCheckedChange={setUseCustom} />
            </div>
            {useCustom && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex justify-between"><Label id="rain-l">Cambio en la lluvia</Label><output className="tabular-nums font-medium">{signed(custom.rain)} %</output></div>
                  <Slider min={-50} max={30} step={5} value={[custom.rain]} onValueChange={([v]) => setCustom((c) => ({ ...c, rain: v }))} thumbLabel="Cambio en la lluvia, de menos 50 a más 30 por ciento" aria-labelledby="rain-l" />
                  <p className="text-sm text-muted-foreground">De −50 % a +30 %.</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><Label id="temp-l">Aumento de temperatura</Label><output className="tabular-nums font-medium">+{num(custom.temp, 1)} °C</output></div>
                  <Slider min={0} max={3} step={0.5} value={[custom.temp]} onValueChange={([v]) => setCustom((c) => ({ ...c, temp: v }))} thumbLabel="Aumento de temperatura, de 0 a 3 grados" aria-labelledby="temp-l" />
                  <p className="text-sm text-muted-foreground">De 0 a +3 °C.</p>
                </div>
                <div className="flex items-center justify-between gap-3"><Label htmlFor="dry">Usar el año más seco observado</Label><Switch id="dry" checked={custom.dry} onCheckedChange={(v) => setCustom((c) => ({ ...c, dry: v }))} /></div>
                <div className="flex items-center justify-between gap-3"><Label htmlFor="irr">Evaluar con riego</Label><Switch id="irr" checked={custom.irrigation} onCheckedChange={(v) => setCustom((c) => ({ ...c, irrigation: v }))} /></div>
              </div>
            )}
          </div>
          <Button size="lg" onClick={run} disabled={state.loading}><Play aria-hidden /> {state.loading ? "Simulando…" : "Simular"}</Button>
        </CardContent>
      </Card>

      <AsyncBlock state={state} what="los escenarios">
        {(r) => {
          const results = r.data;
          const tables = results.map((res) => ({ res, cells: scenarioTable(res.ranking, weights, actualId) }));
          const base = tables[0];
          const ids = Object.keys(base.cells).sort((a, b) => base.cells[a].rank - base.cells[b].rank);
          const bestOf = (cells: Record<string, { rank: number }>) => Object.keys(cells).find((id) => cells[id].rank === 1)!;
          const baseBest = bestOf(base.cells);
          const robust = ids
            .map((id) => ({ id, worst: Math.max(...tables.map((t) => t.cells[id]?.rank ?? 99)), mean: tables.reduce((a, t) => a + (t.cells[id]?.total ?? 0), 0) / tables.length }))
            .sort((a, b) => a.worst - b.worst || b.mean - a.mean)[0];
          const chartRows: Record<string, string | number | undefined>[] = tables.map(({ res, cells }) => ({
            escenario: res.scenario.name,
            [`Mejor con el clima del período: ${STRATEGY_LABELS[strategies[baseBest]] ?? ""}`]: cells[baseBest]?.total,
            ...(actualId ? { "Tu rotación actual": cells[actualId]?.total } : {}),
          }));
          const keys = Object.keys(chartRows[0]).filter((k) => k !== "escenario");
          const dashes = [undefined, "8 4"];
          const colors = [CHART.cultivo, CHART.tierra];
          return (
            <div className="space-y-6">
              <WarningsList warnings={r.meta.warnings.filter((w) => !w.startsWith("Prioridades por defecto"))} title="Avisos" />
              <Card>
                <CardHeader><CardTitle as="h2">En pocas palabras</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-lg">
                  <p>Con el clima del período, la mejor opción es <strong>{names[baseBest] ?? baseBest}</strong>.</p>
                  <ul className="space-y-2">
                    {tables.slice(1).map(({ res, cells }) => {
                      const b = bestOf(cells);
                      const changed = b !== baseBest;
                      return (
                        <li key={res.scenario.id} className="flex gap-2">
                          {changed ? <ArrowUp aria-hidden className="mt-1.5 size-5 shrink-0" /> : <Equal aria-hidden className="mt-1.5 size-5 shrink-0" />}
                          <span>
                            <strong>{res.scenario.name}:</strong>{" "}
                            {changed ? <>la mejor pasa a ser <strong>{names[b] ?? b}</strong>.</> : "la mejor opción no cambia."}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {robust && (
                    <p className="flex gap-2 rounded-md bg-primary/10 p-3 text-base">
                      <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
                      <span>La opción más estable es <strong>{names[robust.id] ?? robust.id}</strong>: en el peor de los escenarios queda en el puesto {robust.worst}.</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle as="h2">Puntaje en cada escenario</CardTitle><CardDescription>Con tus prioridades actuales. Entre paréntesis, la diferencia frente al clima del período.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <Table>
                    <TableCaption>Puntaje (0 a 100) de cada rotación según el escenario. El trofeo marca la mejor de cada columna.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rotación</TableHead>
                        {tables.map(({ res }) => <TableHead key={res.scenario.id}>{res.scenario.id === CUSTOM_ID ? <FlaskConical aria-hidden className="mr-1 inline size-4" /> : null}{res.scenario.name}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ids.map((id) => (
                        <TableRow key={id}>
                          <TableCell className="min-w-48 font-medium">
                            {names[id] ?? id}
                            {id === actualId && <Badge variant="tierra" className="ml-2">Actual</Badge>}
                          </TableCell>
                          {tables.map(({ res, cells }, i) => {
                            const c = cells[id];
                            const d = c && i > 0 ? c.total - base.cells[id].total : null;
                            return (
                              <TableCell key={res.scenario.id} className="tabular-nums">
                                <span className="inline-flex flex-wrap items-center gap-1">
                                  {c?.rank === 1 && <Trophy aria-label="Mejor de este escenario" className="size-4 text-primary" />}
                                  <strong>{num(c?.total, 1)}</strong>
                                  {d !== null && (
                                    <span className="inline-flex items-center text-sm text-muted-foreground">
                                      ({d > 0.04 ? <ArrowUp aria-hidden className="size-3" /> : d < -0.04 ? <ArrowDown aria-hidden className="size-3" /> : <Minus aria-hidden className="size-3" />}{signed(d, 1)})
                                    </span>
                                  )}
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ChartFrame
                    title="La mejor opción y tu rotación actual, escenario por escenario"
                    caption="Si una línea cae mucho en un escenario, esa rotación es más sensible a ese cambio."
                    table={{ headers: ["Escenario", ...keys], rows: chartRows.map((row) => [String(row.escenario), ...keys.map((k) => num(Number(row[k]), 1))]) }}
                  >
                    <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />
                      <XAxis dataKey="escenario" tick={{ fill: "currentColor", fontSize: 11, angle: -18, textAnchor: "end" }} interval={0} height={72} />
                      <YAxis tick={{ fill: "currentColor", fontSize: 12 }} width={36} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                      <Legend />
                      {keys.map((k, i) => (
                        <Line isAnimationActive={false} key={k} dataKey={k} stroke={colors[i % 2]} strokeDasharray={dashes[i % 2]} strokeWidth={3} dot={{ r: 5 }} />
                      ))}
                    </LineChart>
                  </ChartFrame>
                </CardContent>
              </Card>
            </div>
          );
        }}
      </AsyncBlock>
    </div>
  );
}
