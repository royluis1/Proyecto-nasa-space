"use client";

import { Download, FileJson, Printer, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { useCampo } from "@/components/campo/campo-provider";
import { RadarCompare } from "@/components/charts/radar-compare";
import { ComponentBars } from "@/components/dashboard/component-bars";
import { DashboardControls, MAX_COMPARED } from "@/components/dashboard/controls";
import { ContributionChart } from "@/components/dashboard/contribution-chart";
import { FinalRecommendation } from "@/components/dashboard/final-recommendation";
import { Heatmap } from "@/components/dashboard/heatmap";
import { IndicatorGrid } from "@/components/dashboard/indicators";
import { RankingList } from "@/components/dashboard/ranking-list";
import { RotationBreakdown } from "@/components/dashboard/rotation-breakdown";
import { Timeline } from "@/components/dashboard/timeline";
import { PageHeader } from "@/components/page-header";
import { PageNotes } from "@/components/layout/page-notes";
import { CollapsibleSection } from "@/components/ui/disclosure";
import { ConfidenceBadge, OriginBadge } from "@/components/provenance/badges";
import { WarningsList } from "@/components/provenance/warnings";
import { Term } from "@/components/glossary/term";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDashboardCompare } from "@/hooks/use-dashboard-compare";
import { api } from "@/lib/api";
import { describeScenario } from "@/lib/dashboard";
import { buildCsv, buildJson, downloadText, safeFilename } from "@/lib/export";
import { STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import { PRESET_SCENARIOS, isBaseline, toRequest, withIrrigationLevel } from "@/lib/scenarios";
import type { Crop, IrrigationLevel, ScenarioInput } from "@/types/api";

export default function DashboardPage() {
  const { field, fieldId, ui, setUi, weights } = useCampo();
  const [scenarioId, setScenarioId] = useState("base");
  const [irrigation, setIrrigation] = useState<IrrigationLevel>("lote");
  const [custom, setCustom] = useState<string[] | null>(null);
  const [pair, setPair] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });

  const scenario = useMemo<ScenarioInput | null>(() => {
    const p = PRESET_SCENARIOS.find((s) => s.id === scenarioId) ?? PRESET_SCENARIOS[0];
    const eff = withIrrigationLevel(toRequest(p), irrigation);
    return isBaseline(eff) ? null : eff;
  }, [scenarioId, irrigation]);

  const d = useDashboardCompare(scenario);
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const cropMap = useMemo(() => Object.fromEntries((crops.data ?? []).map((c) => [c.id, c])), [crops.data]);
  const evals = d.evaluations;
  const actual = evals.find((e) => e.rotation.strategy === "actual");
  const best = evals[0];

  const defaultSelected = useMemo(() => [...new Set([...evals.slice(0, 3).map((e) => e.rotation.id), ...(actual ? [actual.rotation.id] : [])])].slice(0, MAX_COMPARED), [evals, actual]);
  const selectedIds = custom ?? defaultSelected;
  const selected = evals.filter((e) => selectedIds.includes(e.rotation.id));
  const chartEvals = selected.length >= 2 ? selected : evals.slice(0, 2);

  const a = evals.find((e) => e.rotation.id === (pair.a ?? actual?.rotation.id)) ?? actual ?? evals[0];
  const b = evals.find((e) => e.rotation.id === (pair.b ?? best?.rotation.id)) ?? best;

  const origin = d.demo ? "DATOS DE EJEMPLO (SIN CONEXIÓN)" : (d.originLabel ?? "");
  const clim = d.result?.inputs.climate;
  const scenarioText = describeScenario(d.result?.scenario ?? scenario, { rainMm: clim?.annual_precip_mm ?? 0, scenarioRainMm: clim?.scenario_precip_mm ?? 0 });

  const wide = useMediaQuery("(min-width: 1024px)");
  const controls = (
    <DashboardControls
      ui={ui} onUi={setUi} scenarioId={scenarioId} onScenario={setScenarioId} irrigation={irrigation} onIrrigation={setIrrigation}
      fieldIrrigated={Boolean(field?.irrigated)} demo={d.demo} evaluations={evals} selected={selectedIds} onSelected={setCustom}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard comparativo"
        description="Qué rotación conviene según tu zona y tus prioridades."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8 lg:order-1">
          {!d.result ? (
            d.error ? (
              <Alert tone="error" title="No pudimos armar el dashboard">
                <p>{d.error}</p>
                <Button size="sm" variant="outline" onClick={d.reload}><RefreshCw aria-hidden /> Reintentar</Button>
              </Alert>
            ) : (
              <div role="status" aria-busy="true" className="space-y-4"><span className="sr-only">Armando el dashboard…</span><Skeleton className="h-80 w-full" /><Skeleton className="h-64 w-full" /></div>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                <OriginBadge status={d.demo ? "demo" : d.result.inputs.climate.origin} label={origin} />
                <ConfidenceBadge level={d.result.confidence} />
                {d.loading && <span className="text-sm text-muted-foreground">Actualizando…</span>}
                {d.error && <span role="alert" className="text-sm text-destructive">No se pudo actualizar: {d.error}</span>}
              </div>
              {best && <FinalRecommendation best={best} actual={actual} weights={weights} fieldId={fieldId} scenarioText={scenarioText} />}

              <CollapsibleSection title="Ranking de rotaciones" summary={`Tu rotación actual y ${Math.max(0, evals.length - 1)} alternativas, de 0 a 100 puntos.`}>
                <RankingList evaluations={evals} />
              </CollapsibleSection>

              <CollapsibleSection title="Compará visualmente" summary="Aporte al puntaje, barras, araña, mapa de calor y línea de tiempo.">
                <Card>
                  <CardContent className="pt-5">
                    <Tabs defaultValue="aporte">
                      <TabsList aria-label="Tipo de gráfico">
                        <TabsTrigger value="aporte">Aporte al puntaje</TabsTrigger>
                        <TabsTrigger value="componentes">Barras por componente</TabsTrigger>
                        <TabsTrigger value="arana">Gráfico de araña</TabsTrigger>
                        <TabsTrigger value="calor">Mapa de calor</TabsTrigger>
                        <TabsTrigger value="tiempo">Línea de tiempo</TabsTrigger>
                      </TabsList>
                      <TabsContent value="aporte"><ContributionChart evaluations={evals} weights={weights} /></TabsContent>
                      <TabsContent value="componentes"><ComponentBars evaluations={chartEvals} /></TabsContent>
                      <TabsContent value="arana"><RadarCompare evaluations={chartEvals} pick="all" /></TabsContent>
                      <TabsContent value="calor"><Heatmap evaluations={evals} weights={weights} /></TabsContent>
                      <TabsContent value="tiempo">
                        <AsyncBlock state={crops} what="el catálogo de cultivos">{() => <Timeline evaluations={chartEvals} crops={cropMap} />}</AsyncBlock>
                      </TabsContent>
                    </Tabs>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Barras, araña y línea de tiempo: las rotaciones elegidas en el panel (hasta {MAX_COMPARED}). El <Term k="rango">rango probable</Term> está en el ranking.
                    </p>
                  </CardContent>
                </Card>
              </CollapsibleSection>

              {a && b && (
                <CollapsibleSection title="Agua, suelo, riesgo e ingreso" summary="Compará dos rotaciones en lo concreto (el ingreso es relativo, no precios).">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([["a", "Comparar esta rotación…", a], ["b", "…con esta otra", b]] as const).map(([k, label, ev]) => (
                      <div key={k} className="space-y-1.5">
                        <Label htmlFor={`pair-${k}`}>{label}</Label>
                        <Select id={`pair-${k}`} value={ev.rotation.id} onChange={(e) => setPair((p) => ({ ...p, [k]: e.target.value }))}>
                          {evals.map((e) => <option key={e.rotation.id} value={e.rotation.id}>{e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}: {rotationTitle(e.rotation)}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                  <IndicatorGrid a={a} b={b} />
                  <p className="text-sm text-muted-foreground">
                    Para la falta de agua usamos el <Term k="estres">estrés hídrico</Term> estimado con la <Term k="et0">evapotranspiración</Term>; el clima viene de NASA POWER (<Term k="reanalisis">reanálisis</Term>), la humedad del suelo de <Term k="smap">SMAP</Term> y el verdor de <Term k="ndvi">NDVI</Term>.
                  </p>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Rotación por rotación" summary="Cómo se arma cada puntaje, supuestos, riesgos y qué validar.">
                <div className="space-y-3">
                  {evals.map((ev, i) => <RotationBreakdown key={ev.rotation.id} ev={ev} actual={actual} weights={weights} fieldId={fieldId} defaultOpen={i === 0} />)}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Exportar el reporte" summary="PDF, CSV o JSON para llevarle a tu ingeniero agrónomo." className="print:hidden">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => downloadText(`fieldshift_${safeFilename(field?.name ?? "campo")}.csv`, buildCsv(field?.name ?? "", origin, d.result!, evals), "text/csv")}><Download aria-hidden /> Descargar CSV</Button>
                    <Button variant="outline" onClick={() => downloadText(`fieldshift_${safeFilename(field?.name ?? "campo")}.json`, buildJson(field?.name ?? "", origin, d.result!, evals), "application/json")}><FileJson aria-hidden /> Descargar JSON</Button>
                    <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden /> Imprimir o guardar en PDF</Button>
                  </div>
              </CollapsibleSection>

              <PageNotes>
                <WarningsList warnings={friendlyWarnings(d.warnings)} />
                <p>El puntaje es una guía para comparar opciones, no una recomendación de siembra. Validalo con tu ingeniero agrónomo.</p>
              </PageNotes>
            </>
          )}
        </div>

        <aside className="lg:order-2" aria-label="Controles del dashboard">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {wide ? (
              <Card>
                <CardHeader><CardTitle as="h2" className="flex items-center gap-2 text-lg"><SlidersHorizontal aria-hidden className="size-5" /> Qué cambiar</CardTitle></CardHeader>
                <CardContent>{controls}</CardContent>
              </Card>
            ) : (
              <details>
                <summary className="mb-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 font-medium"><SlidersHorizontal aria-hidden className="size-5" /> Qué cambiar: prioridades, clima y riego</summary>
                <Card><CardContent className="pt-5">{controls}</CardContent></Card>
              </details>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
