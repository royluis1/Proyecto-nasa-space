"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, CheckCircle2, Flag, Minus, ShieldAlert, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { ConfidenceBadge, LabelBadge, RiskLevelBadge, SeverityBadge, flagIcon } from "@/components/provenance/badges";
import { ScoreBars } from "@/components/score/score-bars";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMPONENTS, COMPONENT_ORDER, LEVEL_LABELS, STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import type { RotationEvaluation, ScoreDriver } from "@/types/api";

const IMPACT_ICON = { mejora: TrendingUp, empeora: TrendingDown, neutro: Minus, linea_base: Flag } as const;
const IMPACT_TEXT = { mejora: "Mejora", empeora: "Empeora", neutro: "Similar", linea_base: "Punto de partida" } as const;

function Impact({ label, impact }: { label: string; impact: { direction: keyof typeof IMPACT_ICON; detail: string } }) {
  const Icon = IMPACT_ICON[impact.direction];
  return (
    <div className="flex gap-3">
      <Icon aria-hidden className="mt-1 size-5 shrink-0" />
      <div>
        <p className="font-medium">{label}: {IMPACT_TEXT[impact.direction]}</p>
        <p className="text-sm text-muted-foreground">{impact.detail}</p>
      </div>
    </div>
  );
}

const EFFECT = { sube: { Icon: ArrowUp, text: "Suma" }, baja: { Icon: ArrowDown, text: "Resta" }, neutro: { Icon: Minus, text: "Informa" } } as const;

function DriverRow({ d }: { d: ScoreDriver }) {
  const e = EFFECT[d.effect as keyof typeof EFFECT] ?? EFFECT.neutro;
  return (
    <TableRow>
      <TableCell className="min-w-40 font-medium">{d.factor}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1"><e.Icon aria-hidden className="size-4" /> {e.text} {d.points != null && d.effect !== "neutro" ? `${signed(d.points, 1)} pts` : ""}</span>
      </TableCell>
      <TableCell className="min-w-64 text-sm">{d.detail}</TableCell>
      <TableCell><LabelBadge label={d.provenance.label} /></TableCell>
    </TableRow>
  );
}

function Detail({ ev, fieldId }: { ev: RotationEvaluation; fieldId: string }) {
  const { compare } = useCampo();
  const result = compare.result;
  const { rotation: r, profile: p, score, recommendation: rec } = ev;
  const sources = result?.sources.filter((s) => ev.source_ids.includes(s.id)) ?? [];
  const e4 = rec.evidence;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-base">Puesto {score.rank} de {compare.evaluations.length}</Badge>
        <Badge variant="outline">{STRATEGY_LABELS[r.strategy]}</Badge>
        <RiskLevelBadge level={score.risk_level} />
        <ConfidenceBadge level={ev.confidence} />
        <Badge variant="outline">{r.origin === "declarada" ? "Rotación declarada" : "Generada por FieldShift"}</Badge>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-5">
          <p><span className="text-6xl font-bold tabular-nums">{num(score.total)}</span><span className="text-xl text-muted-foreground"> / 100</span></p>
          <div className="min-w-64 flex-1"><ScoreBars components={score.components} showWeights /></div>
        </CardContent>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          Rango probable: {num(score.uncertainty_low)} a {num(score.uncertainty_high)}. Cambia con la lluvia (±15 %) y con la calidad de los datos.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Por qué</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-lg">
          <p>{rec.why}</p>
          {r.description && <p className="text-base text-muted-foreground">{r.description}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><CheckCircle2 aria-hidden className="size-5 text-cultivo-600" /> Beneficios</CardTitle></CardHeader>
          <CardContent>
            {rec.benefits.length ? <ul className="list-disc space-y-1.5 pl-5">{rec.benefits.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="text-muted-foreground">No mejora ningún aspecto clave frente a la rotación actual.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><TriangleAlert aria-hidden className="size-5 text-tierra-600" /> Riesgos</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {ev.risk_flags.length === 0 && <li className="text-muted-foreground">Sin riesgos destacados con los datos disponibles.</li>}
              {ev.risk_flags.map((f) => {
                const Icon = flagIcon(f.icon);
                return (
                  <li key={f.id} className="flex gap-3">
                    <Icon aria-hidden className="mt-1 size-5 shrink-0" />
                    <div className="space-y-1">
                      <SeverityBadge severity={f.severity} />
                      <p>{f.message}</p>
                      {f.evidence.length > 0 && <p className="text-sm text-muted-foreground">{f.evidence.join(" ")}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Qué implica</CardTitle>
          <CardDescription>{p.sequence.join(" → ")} · ciclo de {p.duration_years} {p.duration_years === 1 ? "año" : "años"} · {p.distinct_crops} cultivos distintos</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium">Agua</p>
            <p>Demanda estimada de los cultivos: <strong>{num(p.water_demand_mm_year)} mm por año</strong> (requerimiento {LEVEL_LABELS[p.water_requirement].toLowerCase()}).</p>
            <p>La lluvia y el agua guardada en el suelo cubren el <strong>{num(p.rain_coverage_pct)} %</strong>; falta cubrir {num(p.deficit_mm_year)} mm por año{p.irrigation_mm_year ? `, y con riego se aplican unos ${num(p.irrigation_mm_year)} mm` : ""}.</p>
            {p.relative_water_demand != null && r.strategy !== "actual" && <p className="text-sm text-muted-foreground">Es el {num(p.relative_water_demand * 100)} % de la demanda de tu rotación actual.</p>}
          </div>
          <div className="space-y-1">
            <p className="font-medium">Cobertura del suelo</p>
            <p>Hay cultivo vivo el <strong>{num(p.covered_months_pct)} %</strong> del tiempo; el suelo queda sin cultivo <strong>{num(p.bare_months_per_year, 1)} meses por año</strong>.</p>
            <p className="text-sm text-muted-foreground">Ingreso relativo: <strong>{LEVEL_LABELS[p.relative_income]}</strong> · Complejidad de implementación: <strong>{LEVEL_LABELS[p.implementation_complexity]}</strong> · Riesgo de erosión: <strong>{LEVEL_LABELS[p.erosion_risk]}</strong></p>
          </div>
          <Impact label="Suelo" impact={p.soil_impact} />
          <Impact label="Erosión" impact={p.erosion_impact} />
          <Impact label="Biodiversidad" impact={p.biodiversity_impact} />
          <div>
            <Button asChild variant="outline">
              <Link href={`/campo/${fieldId}/calendario?rotacion=${encodeURIComponent(r.id)}`}><CalendarDays aria-hidden /> Ver el calendario de siembra</Link>
            </Button>
          </div>
        </CardContent>
        {r.management.length > 0 && (
          <CardContent>
            <p className="font-medium">Para implementarla hace falta:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{r.management.map((m) => <li key={m}>{m}</li>)}</ul>
          </CardContent>
        )}
      </Card>

      <section aria-labelledby="desglose" className="space-y-4">
        <h2 id="desglose" className="text-2xl font-semibold">Cómo se armó el puntaje</h2>
        <p className="text-muted-foreground">Cada componente parte de datos y suma o resta puntos por motivos concretos. El total es la suma ponderada con tus prioridades.</p>
        {COMPONENT_ORDER.map((k) => {
          const c = score.components.find((x) => x.key === k);
          if (!c) return null;
          return (
            <Card key={k}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <span>{k} · {COMPONENTS[k].name}</span>
                  <span className="tabular-nums">{num(c.value)}/100</span>
                  <span className="text-sm font-normal text-muted-foreground">peso {num(c.weight * 100)} % → aporta {num((c.value ?? 0) * c.weight, 1)} puntos al total</span>
                </CardTitle>
                <CardDescription>{COMPONENTS[k].help}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Factor</TableHead><TableHead>Efecto</TableHead><TableHead>Detalle</TableHead><TableHead>Tipo de dato</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>{c.drivers.map((d, i) => <DriverRow key={`${d.factor}-${i}`} d={d} />)}</TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="evidencia" className="space-y-4">
        <h2 id="evidencia" className="text-2xl font-semibold">De dónde sale cada cosa</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {([
            ["Lo que muestran los datos de la NASA", e4.nasa_data],
            ["Lo que depende de tu suelo", e4.local_soil],
            ["Lo que depende de vos", e4.producer],
            ["Lo que hay que validar con un agrónomo", e4.needs_validation],
          ] as const).map(([title, items]) => (
            <Card key={title}>
              <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
              <CardContent><ul className="list-disc space-y-1.5 pl-5">{items.map((t) => <li key={t}>{t}</li>)}</ul></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="limites" className="grid gap-4 md:grid-cols-3">
        <h2 id="limites" className="sr-only">Supuestos e incertidumbres</h2>
        <Card><CardHeader><CardTitle className="text-lg">Supuestos</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{rec.assumptions.map((t) => <li key={t}>{t}</li>)}</ul></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Incertidumbres</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{rec.uncertainties.map((t) => <li key={t}>{t}</li>)}</ul></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Datos que mejorarían el resultado</CardTitle></CardHeader><CardContent>{rec.information_gaps.length ? <ul className="list-disc space-y-1.5 pl-5 text-sm">{rec.information_gaps.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-muted-foreground">No faltan datos clave.</p>}</CardContent></Card>
      </section>

      {ev.confidence_reasons.length > 0 && (
        <Alert tone="info" title={`Por qué la confianza es ${ev.confidence}`}>
          <ul className="list-disc space-y-1 pl-5">{ev.confidence_reasons.map((t) => <li key={t}>{t}</li>)}</ul>
        </Alert>
      )}
      <Alert tone="warning" title="Validá esto con un profesional">
        <p>{rec.validation_note}</p>
        <p className="text-sm">{rec.disclaimer}</p>
      </Alert>

      {sources.length > 0 && (
        <details className="rounded-lg border p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-medium"><ShieldAlert aria-hidden className="size-4" /> Fuentes usadas ({sources.length})</summary>
          <ul className="mt-3 space-y-3 text-sm">
            {sources.map((s) => (
              <li key={s.id}>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground">{s.provider}{s.product ? ` · ${s.product}` : ""} · {s.spatial_resolution} · {s.temporal_resolution}</p>
                <p className="text-muted-foreground">{s.citation}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function RotacionPage() {
  const params = useParams<{ id: string; rid: string }>();
  const { fieldId, compare } = useCampo();
  const rid = decodeURIComponent(params.rid);
  const ev = compare.evaluations.find((e) => e.rotation.id === rid);

  return (
    <div className="max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-3">
        <Link href={`/campo/${fieldId}/comparador`}><ArrowLeft aria-hidden /> Volver al comparador</Link>
      </Button>
      {!ev && compare.error && !compare.result && <Alert tone="error" title="No pudimos calcular esta rotación"><p>{compare.error}</p><Button size="sm" variant="outline" onClick={compare.reload}>Reintentar</Button></Alert>}
      {!ev && !compare.error && !compare.result && <div role="status" aria-busy="true"><span className="sr-only">Cargando la rotación…</span><Skeleton className="h-96 w-full" /></div>}
      {!ev && compare.result && (
        <Alert tone="warning" title="No encontramos esta rotación">
          <p>Puede que ya no esté entre las opciones con tus datos actuales.</p>
          <Button size="sm" variant="outline" asChild><Link href={`/campo/${fieldId}/comparador`}>Ver las rotaciones disponibles</Link></Button>
        </Alert>
      )}
      {ev && (
        <>
          <PageHeader title={rotationTitle(ev.rotation)} description="Detalle de la rotación: qué implica, por qué recibe este puntaje y qué hay que validar." />
          <Detail ev={ev} fieldId={fieldId} />
        </>
      )}
    </div>
  );
}
