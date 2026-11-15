"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useCampo } from "@/components/campo/campo-provider";
import { FieldForm } from "@/components/field/field-form";
import { PriorityControls } from "@/components/field/priority-controls";
import { PageHeader } from "@/components/page-header";
import { AutoProfileCard } from "@/components/zones/auto-profile-card";
import { PageNotes } from "@/components/layout/page-notes";
import { Disclosure } from "@/components/ui/disclosure";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STRATEGY_LABELS, num, rotationTitle } from "@/lib/format";

function LivePreview() {
  const { compare, fieldId } = useCampo();
  const best = compare.evaluations[0];
  const actual = compare.evaluations.find((e) => e.rotation.strategy === "actual");
  const bestTotal = best?.score.total ?? null;
  const actualTotal = actual?.score.total ?? null;
  return (
    <Card className="border-primary/40 bg-gradient-to-b from-primary/10 to-card" aria-live="polite">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-xl">
          <Trophy aria-hidden className="size-6 text-primary" /> Con estas prioridades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {best ? (
          <>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Mejor opción para la campaña</p>
              <p className="text-2xl font-bold leading-tight">{rotationTitle(best.rotation)}</p>
              <p className="text-muted-foreground">{STRATEGY_LABELS[best.rotation.strategy]}</p>
            </div>
            <div>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-6xl font-bold tabular-nums leading-none">{num(bestTotal, 0)}</span>
                <span className="text-lg text-muted-foreground">de 100 puntos</span>
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, bestTotal ?? 0))}%` }} />
              </div>
            </div>
            {actual && actual.rotation.id !== best.rotation.id && bestTotal != null && actualTotal != null && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                Tu rotación actual saca <strong>{num(actualTotal, 0)} puntos</strong>: la mejor opción suma{" "}
                <strong>{num(bestTotal - actualTotal, 0)}</strong> más.
              </p>
            )}
            {actual && actual.rotation.id === best.rotation.id && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">Tu rotación actual es la mejor con estas prioridades.</p>
            )}
            <Button asChild size="lg" className="w-full">
              <Link href={`/campo/${fieldId}/comparador`}>
                Ver el comparador completo <ArrowRight aria-hidden />
              </Link>
            </Button>
          </>
        ) : compare.error && /current_crop|rotación actual/i.test(compare.error) ? (
          <Alert tone="info" title="Falta el cultivo actual">
            <p>Para comparar rotaciones necesitamos saber qué tiene sembrado el lote (o qué sembraste la última campaña).</p>
            <Button size="sm" asChild>
              <a href="#editar-campo">Cargar el cultivo actual</a>
            </Button>
          </Alert>
        ) : compare.error ? (
          <Alert tone="error">
            <p>{compare.error}</p>
            <Button size="sm" variant="outline" onClick={compare.reload}>Reintentar</Button>
          </Alert>
        ) : (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Calculando el ranking…</span>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-16 w-1/2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerfilPage() {
  const { field, ui, setUi, reloadField, compare } = useCampo();
  if (!field) return null;
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Tus prioridades para la campaña" description="Mové los controles y el ranking se actualiza al instante." />

      <section aria-labelledby="prioridades" className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" id="prioridades">¿Qué te importa más?</CardTitle>
            <CardDescription>De 0 (no me importa) a 10 (lo más importante).</CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityControls value={ui} onChange={setUi} />
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LivePreview />
        </div>
      </section>

      <Disclosure variant="card" label="Perfil automático del campo: zona climática, transición y cultivos más aptos">
        <AutoProfileCard field={field} />
      </Disclosure>

      <Disclosure id="editar-campo" variant="card" label="Editar los datos del campo (suelo, riego, rotación actual)">
        <FieldForm key={`${field.id}-${field.name}-${field.area_ha}`} mode="edit" initial={field} onSaved={() => { reloadField(); compare.reload(); }} />
      </Disclosure>

      {field.sample_note && (
        <PageNotes>
          <Alert tone="warning" title="Campo de ejemplo">
            <p>{field.sample_note} Si lo editás, los cambios se pierden al reiniciar el servidor.</p>
          </Alert>
        </PageNotes>
      )}
    </div>
  );
}
