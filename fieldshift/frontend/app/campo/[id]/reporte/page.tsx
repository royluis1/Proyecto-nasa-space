"use client";

import { Download, FileJson, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { ConfidenceBadge, OriginBadge } from "@/components/provenance/badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api";
import { buildJson, downloadText, safeFilename } from "@/lib/export";
import { ORIGIN_LABELS, rotationTitle } from "@/lib/format";
import { buildReportModel, reportCsv, reportPdf, type ReportModel, type Row } from "@/lib/report";
import { PRESET_SCENARIOS, resilience, scenarioMatrix } from "@/lib/scenarios";
import type { ApiResult, CalendarTimeline, ScenarioResult } from "@/types/api";
import { tr } from "@/lib/i18n";

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline">{v}</dd></div>)}
    </dl>
  );
}

function SimpleTable({ headers, rows, label }: { headers: string[]; rows: Row[]; label: string }) {
  return (
    <div>
      <Table scrollLabel={tr(`${label}: desplazá para ver todas las columnas`, `${label}: scroll to see every column`)}>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 0 || j === 1 ? "min-w-40" : "tabular-nums"}>{c}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2 break-inside-avoid">
      <h3 id={id} className="text-xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ReportView({ m }: { m: ReportModel }) {
  return (
    <>
      <Section id="r-reco" title={tr("Recomendación", "Recommendation")}>
        <div className="space-y-2 rounded-lg border-2 border-primary p-4">
          <p className="text-lg"><strong>{m.recommendation.rotation}</strong></p>
          <p>{m.recommendation.score}</p>
          {m.recommendation.vsActual && <p>{m.recommendation.vsActual}</p>}
          <p>{m.recommendation.why}</p>
          {m.recommendation.risks.length > 0 && <><p className="font-medium">{tr("Riesgos", "Risks")}</p><ul className="list-disc pl-5 text-sm">{m.recommendation.risks.map((r) => <li key={r}>{r}</li>)}</ul></>}
          {m.recommendation.validate.length > 0 && <><p className="font-medium">{tr("Para revisar con el técnico", "To review with your agronomist")}</p><ul className="list-disc pl-5 text-sm">{m.recommendation.validate.map((r) => <li key={r}>{r}</li>)}</ul></>}
          <p className="text-sm">{m.recommendation.note}</p>
        </div>
      </Section>
      <Section id="r-campo" title={tr("Datos del campo", "Field data")}><KV rows={m.field} /></Section>
      <Section id="r-prio" title={tr("Prioridades", "Priorities")}>
        <ul className="grid gap-x-8 gap-y-0.5 text-sm sm:grid-cols-2">{m.priorities.map(([k, v]) => <li key={k}>{k}: <strong>{v}</strong></li>)}</ul>
        <p className="text-sm text-muted-foreground">{tr("Peso de cada componente", "Weight of each component")}: {m.weights}</p>
      </Section>
      <Section id="r-clima" title={tr("Resumen climático", "Climate summary")}><KV rows={m.climate} /></Section>
      <Section id="r-rank" title={tr("Rotaciones comparadas y puntajes", "Rotations compared and scores")}><SimpleTable label={tr("Puntajes", "Scores")} headers={m.ranking.headers} rows={m.ranking.rows} /></Section>
      <Section id="r-por-que" title={tr("Por qué cada una", "Why each one")}>
        {m.explanations.map((e) => (
          <Card key={e.title} className="break-inside-avoid">
            <CardHeader className="pb-1"><CardTitle className="text-base">{e.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm"><p>{e.why}</p>{e.risks.length > 0 && <p><strong>{tr("Riesgos:", "Risks:")}</strong> {e.risks.join(" ")}</p>}</CardContent>
          </Card>
        ))}
      </Section>
      {m.resilience && <Section id="r-res" title={tr("Resistencia a los escenarios climáticos", "Resilience to climate scenarios")}><SimpleTable label={tr("Resistencia a escenarios", "Resilience to scenarios")} headers={m.resilience.headers} rows={m.resilience.rows} /></Section>}
      {m.calendar && (
        <Section id="r-cal" title={tr("Calendario del plan", "Plan calendar")}>
          <p className="font-medium">{m.calendar.title}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">{m.calendar.campaigns.map((c) => <li key={c}>{c}</li>)}</ul>
          {m.calendar.advice.length > 0 && <><p className="font-medium">{tr("Recomendaciones del calendario", "Calendar recommendations")}</p><ul className="list-disc space-y-1 pl-5 text-sm">{m.calendar.advice.map((a) => <li key={a}>{a}</li>)}</ul></>}
        </Section>
      )}
      <Section id="r-sup" title={tr("Supuestos", "Assumptions")}><ul className="list-disc space-y-1 pl-5 text-sm">{m.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></Section>
      <Section id="r-fuentes" title={tr("Fuentes", "Sources")}><ul className="space-y-1 text-sm">{m.sources.map((s) => <li key={s}>{s}</li>)}</ul></Section>
      <Section id="r-adv" title={tr("Advertencias", "Warnings")}><ul className="list-disc space-y-1 pl-5 text-sm">{[...m.warnings, m.disclaimer].map((w) => <li key={w}>{w}</li>)}</ul></Section>
    </>
  );
}

export default function ReportePage() {
  const { fieldId, field, ui, weights, compare, backendPriorities } = useCampo();
  const { result, evaluations } = compare;
  const settled = useDebounced(backendPriorities, 800);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generatedAt] = useState(() => new Date());
  const actualId = evaluations.find((e) => e.rotation.strategy === "actual")?.rotation.id;
  const best = evaluations[0]?.rotation.id;

  const scenarios = useAsync<ApiResult<ScenarioResult[]>>((signal) => api.scenarios(fieldId, PRESET_SCENARIOS, settled, { signal }), [fieldId, JSON.stringify(settled)]);
  const timeline = useAsync<ApiResult<CalendarTimeline>>(
    (signal) => api.calendar({ field_id: fieldId, rotation_id: best, campaigns: 3, priorities: settled }, { signal }),
    [fieldId, best, JSON.stringify(settled)],
    Boolean(best),
  );

  const origin = compare.demo ? ORIGIN_LABELS.demo : (compare.originLabel ?? "");
  const model = useMemo(() => {
    if (!result || !field) return null;
    const res = scenarios.data ? resilience(scenarioMatrix(scenarios.data.data, weights, actualId)) : null;
    return buildReportModel({ field, ui, weights, result, evaluations, origin, generatedAt, resilience: res, timeline: timeline.data?.data ?? null });
  }, [result, field, ui, weights, evaluations, origin, generatedAt, scenarios.data, timeline.data, actualId]);

  if (compare.error && !result) {
    return (
      <Alert tone="error" title={tr("No pudimos armar el reporte", "We couldn't build the report")}>
        <p>{compare.error}</p>
        <Button size="sm" variant="outline" onClick={compare.reload}><RefreshCw aria-hidden /> {tr("Reintentar", "Retry")}</Button>
      </Alert>
    );
  }
  if (!model || !field || !result) {
    return <div role="status" aria-busy="true" className="space-y-3"><span className="sr-only">{tr("Armando el reporte…", "Building the report…")}</span><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  const file = `fieldshift_${safeFilename(field.name)}`;
  const extrasLoading = scenarios.loading || timeline.loading;
  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      (await reportPdf(model)).save(`${file}.pdf`);
    } catch {
      setPdfError(tr("No se pudo generar el PDF. Probá con “Imprimir o guardar en PDF”.", "The PDF could not be generated. Try “Print”."));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={tr("Reporte del campo", "Field report")} description={tr("El plan para revisar con tu ingeniero agrónomo: datos del campo, prioridades, clima, rotaciones, puntajes, recomendación, calendario y supuestos.", "The plan to review with your agronomist: field data, priorities, weather, rotations, scores, recommendation, calendar and assumptions.")}>
        <Button onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? <Loader2 aria-hidden className="animate-spin" /> : <FileText aria-hidden />} {tr("Descargar PDF", "Download PDF")}</Button>
        <Button variant="outline" onClick={() => downloadText(`${file}.csv`, reportCsv(model), "text/csv")}><Download aria-hidden /> {tr("Descargar CSV", "Download CSV")}</Button>
        <Button variant="outline" onClick={() => downloadText(`${file}.json`, buildJson(field.name, origin, result, evaluations), "application/json")}><FileJson aria-hidden /> JSON</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden /> {tr("Imprimir", "Print")}</Button>
      </PageHeader>
      {pdfError && <Alert tone="error" title="PDF"><p>{pdfError}</p></Alert>}
      {extrasLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" /> {tr("Sumando la resistencia a escenarios y el calendario…", "Adding scenario resilience and the calendar…")}</p>
      )}

      <article className="space-y-6 print:space-y-4" aria-label={tr("Reporte", "Report")}>
        <header className="space-y-2 border-b pb-4">
          <h2 className="text-2xl font-bold">{model.title}</h2>
          <p className="text-muted-foreground">{tr("Generado el", "Generated on")} {model.generated} · {tr("Escenario", "Scenario")}: {model.scenario}</p>
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge status={compare.demo ? "demo" : result.inputs.climate.origin} label={origin} />
            <ConfidenceBadge level={result.confidence} />
          </div>
          {evaluations[0] && <p className="text-sm text-muted-foreground">{tr("Rotación recomendada", "Recommended rotation")}: {rotationTitle(evaluations[0].rotation)}</p>}
        </header>
        <Alert tone="warning" title={tr("Importante", "Important")}><p>{model.disclaimer}</p></Alert>
        <ReportView m={model} />
        <footer className="border-t pt-4 text-sm text-muted-foreground"><p>{model.disclaimer}</p></footer>
      </article>
    </div>
  );
}
