"use client";

import { Download, FileJson, Printer, RefreshCw } from "lucide-react";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { ConfidenceBadge, OriginBadge, RiskLevelBadge } from "@/components/provenance/badges";
import { WarningsList } from "@/components/provenance/warnings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DISCLAIMER } from "@/lib/content";
import { buildCsv, buildJson, downloadText, safeFilename } from "@/lib/export";
import { COMPONENT_ORDER, COMPONENTS, SOIL_TEXTURES, STRATEGY_LABELS, num, rotationTitle } from "@/lib/format";
import { PRIORITY_KEYS, PRIORITY_META } from "@/lib/priorities";

export default function ReportePage() {
  const { field, ui, weights, compare } = useCampo();
  const { result, evaluations } = compare;

  if (compare.error && !result) {
    return (
      <Alert tone="error" title="No pudimos armar el reporte">
        <p>{compare.error}</p>
        <Button size="sm" variant="outline" onClick={compare.reload}><RefreshCw aria-hidden /> Reintentar</Button>
      </Alert>
    );
  }
  if (!result || !field) {
    return <div role="status" aria-busy="true" className="space-y-3"><span className="sr-only">Armando el reporte…</span><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  const origin = compare.demo ? "DATOS DE EJEMPLO (SIN CONEXIÓN)" : (compare.originLabel ?? "");
  const best = evaluations[0];
  const actual = evaluations.find((e) => e.rotation.strategy === "actual");
  const file = `fieldshift_${safeFilename(field.name)}`;
  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Reporte del campo" description="Un resumen para guardar, imprimir o compartir con tu ingeniero agrónomo.">
        <Button onClick={() => downloadText(`${file}.csv`, buildCsv(field.name, origin, result, evaluations), "text/csv")}><Download aria-hidden /> Descargar CSV</Button>
        <Button variant="outline" onClick={() => downloadText(`${file}.json`, buildJson(field.name, origin, result, evaluations), "application/json")}><FileJson aria-hidden /> Descargar JSON</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden /> Imprimir o guardar en PDF</Button>
      </PageHeader>

      <article className="space-y-6 print:space-y-4" aria-label="Reporte">
        <header className="space-y-2 border-b pb-4">
          <h2 className="text-2xl font-bold">FieldShift · Reporte de rotaciones: {field.name}</h2>
          <p className="text-muted-foreground">Generado el {today}</p>
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge status={compare.demo ? "demo" : result.inputs.climate.origin} label={origin} />
            <ConfidenceBadge level={result.confidence} />
          </div>
        </header>

        <Alert tone="warning" title="Importante"><p>{DISCLAIMER}</p></Alert>
        <WarningsList warnings={compare.warnings} />

        <section aria-labelledby="r-campo" className="space-y-2">
          <h3 id="r-campo" className="text-xl font-semibold">El campo</h3>
          <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline font-medium">Superficie: </dt><dd className="inline">{num(field.area_ha)} ha</dd></div>
            <div><dt className="inline font-medium">Ubicación: </dt><dd className="inline">{num(field.location.lat, 4)}, {num(field.location.lon, 4)}</dd></div>
            <div><dt className="inline font-medium">Riego: </dt><dd className="inline">{field.irrigated ? "Sí" : "No (secano)"}</dd></div>
            <div><dt className="inline font-medium">Suelo: </dt><dd className="inline">{field.soil_profile?.texture ? SOIL_TEXTURES[field.soil_profile.texture] : "sin dato (se supuso franco arenosa)"}</dd></div>
            <div><dt className="inline font-medium">Cultivo actual: </dt><dd className="inline">{result.inputs.current_crop ?? "sin dato"}</dd></div>
            <div><dt className="inline font-medium">Historial: </dt><dd className="inline">{result.inputs.history.join(" → ") || "sin dato"}</dd></div>
            <div><dt className="inline font-medium">Clima: </dt><dd className="inline">{result.inputs.climate.period}, {num(result.inputs.climate.annual_precip_mm)} mm de lluvia al año</dd></div>
          </dl>
        </section>

        <section aria-labelledby="r-prio" className="space-y-2">
          <h3 id="r-prio" className="text-xl font-semibold">Tus prioridades</h3>
          <ul className="grid gap-x-8 gap-y-0.5 text-sm sm:grid-cols-2">
            {PRIORITY_KEYS.map((k) => <li key={k}>{PRIORITY_META[k].label}: <strong>{ui[k]}/10</strong></li>)}
          </ul>
          <p className="text-sm text-muted-foreground">Peso de cada componente: {COMPONENT_ORDER.map((c) => `${COMPONENTS[c].short} ${num(weights[c] * 100)} %`).join(" · ")}</p>
        </section>

        {best && (
          <section aria-labelledby="r-reco" className="space-y-2 rounded-lg border-2 border-primary p-4">
            <h3 id="r-reco" className="text-xl font-semibold">Recomendación final</h3>
            <p className="text-lg"><strong>{rotationTitle(best.rotation)}</strong> ({STRATEGY_LABELS[best.rotation.strategy]}), con {num(best.score.total)} puntos sobre 100.</p>
            {actual && best.rotation.id !== actual.rotation.id && <p>Tu rotación actual obtiene {num(actual.score.total)} puntos.</p>}
            <p>{best.recommendation.why}</p>
            <p className="text-sm">{best.recommendation.validation_note}</p>
          </section>
        )}

        <section aria-labelledby="r-rank" className="space-y-2">
          <h3 id="r-rank" className="text-xl font-semibold">Ranking completo</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Puesto</TableHead><TableHead>Rotación</TableHead><TableHead>Total</TableHead>
                {COMPONENT_ORDER.map((c) => <TableHead key={c} title={COMPONENTS[c].name}>{c}</TableHead>)}
                <TableHead>Riesgo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((e) => (
                <TableRow key={e.rotation.id}>
                  <TableCell>{e.score.rank}</TableCell>
                  <TableCell className="min-w-56"><strong>{STRATEGY_LABELS[e.rotation.strategy]}</strong><br /><span className="text-sm text-muted-foreground">{rotationTitle(e.rotation)}</span></TableCell>
                  <TableCell className="tabular-nums"><strong>{num(e.score.total, 1)}</strong><br /><span className="text-xs text-muted-foreground">({num(e.score.uncertainty_low)}–{num(e.score.uncertainty_high)})</span></TableCell>
                  {COMPONENT_ORDER.map((c) => <TableCell key={c} className="tabular-nums">{num(e.score.components.find((x) => x.key === c)?.value)}</TableCell>)}
                  <TableCell><RiskLevelBadge level={e.score.risk_level} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">{COMPONENT_ORDER.map((c) => `${c} = ${COMPONENTS[c].name}`).join(" · ")}</p>
        </section>

        <section aria-labelledby="r-por-que" className="space-y-3">
          <h3 id="r-por-que" className="text-xl font-semibold">Por qué cada una</h3>
          {evaluations.map((e) => (
            <Card key={e.rotation.id} className="break-inside-avoid">
              <CardHeader className="pb-1"><CardTitle className="text-base">{e.score.rank}. {STRATEGY_LABELS[e.rotation.strategy]}: {rotationTitle(e.rotation)}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{e.recommendation.why}</p>
                {e.recommendation.risks.length > 0 && <p><strong>Riesgos:</strong> {e.recommendation.risks.join(" ")}</p>}
              </CardContent>
            </Card>
          ))}
        </section>

        <section aria-labelledby="r-sup" className="space-y-2 break-inside-avoid">
          <h3 id="r-sup" className="text-xl font-semibold">Supuestos</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.assumptions.map((a) => <li key={a.id}>{a.text}{a.source ? ` (${a.source})` : ""}{!a.validated && !a.source ? " — a validar" : ""}</li>)}
          </ul>
        </section>

        <section aria-labelledby="r-fuentes" className="space-y-2 break-inside-avoid">
          <h3 id="r-fuentes" className="text-xl font-semibold">Fuentes</h3>
          <ul className="space-y-2 text-sm">
            {result.sources.map((s) => <li key={s.id}><strong>{s.name}</strong> — {s.provider}. {s.spatial_resolution}, {s.temporal_resolution}. {s.citation}</li>)}
          </ul>
        </section>

        <footer className="border-t pt-4 text-sm text-muted-foreground"><p>{DISCLAIMER}</p></footer>
      </article>
    </div>
  );
}
