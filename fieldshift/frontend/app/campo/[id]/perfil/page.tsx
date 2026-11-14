"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useCampo } from "@/components/campo/campo-provider";
import { FieldForm } from "@/components/field/field-form";
import { PriorityControls } from "@/components/field/priority-controls";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STRATEGY_LABELS, num, rotationTitle } from "@/lib/format";

function LivePreview() {
  const { compare, fieldId } = useCampo();
  const best = compare.evaluations[0];
  return (
    <Card className="border-primary/50 bg-primary/5" aria-live="polite">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-lg">
          <Trophy aria-hidden className="size-5 text-primary" /> Con estas prioridades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {best ? (
          <>
            <p className="text-lg">
              Hoy la mejor opción es <strong>{rotationTitle(best.rotation)}</strong> ({STRATEGY_LABELS[best.rotation.strategy]}), con <strong>{num(best.score.total, 0)} puntos</strong> de 100.
            </p>
            <p className="text-sm text-muted-foreground">Se actualiza solo cuando movés los controles.</p>
            <Button asChild>
              <Link href={`/campo/${fieldId}/comparador`}>
                Ver el comparador completo <ArrowRight aria-hidden />
              </Link>
            </Button>
          </>
        ) : compare.error ? (
          <Alert tone="error">
            <p>{compare.error}</p>
            <Button size="sm" variant="outline" onClick={compare.reload}>Reintentar</Button>
          </Alert>
        ) : (
          <div role="status" aria-busy="true">
            <span className="sr-only">Calculando el ranking…</span>
            <Skeleton className="h-6 w-3/4" />
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
      <PageHeader title="Perfil del campo y prioridades" description="Contanos cómo es tu campo y qué te importa más. El ranking se recalcula mientras movés los controles." />
      {field.sample_note && (
        <Alert tone="warning" title="Campo de ejemplo">
          <p>{field.sample_note} Si lo editás, los cambios se pierden al reiniciar el servidor.</p>
        </Alert>
      )}

      <section aria-labelledby="prioridades" className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
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

      <section aria-labelledby="datos-campo" className="space-y-3">
        <h2 id="datos-campo" className="text-2xl font-semibold">Datos del campo</h2>
        <FieldForm key={`${field.id}-${field.name}-${field.area_ha}`} mode="edit" initial={field} onSaved={() => { reloadField(); compare.reload(); }} />
      </section>
    </div>
  );
}
