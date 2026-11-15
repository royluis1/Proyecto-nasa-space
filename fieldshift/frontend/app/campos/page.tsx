"use client";

import Link from "next/link";
import { PROFILES } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";
import { ArrowRight, Droplets, MapPinned, Plus, Ruler, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { PageHeader } from "@/components/page-header";
import { FieldMap } from "@/components/map/field-map-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api, describeError } from "@/lib/api";
import { num, SOIL_TEXTURES } from "@/lib/format";
import { hideExample, isLocalId, listHiddenExamples, showAllExamples } from "@/lib/local-fields";
import { cn } from "@/lib/utils";
import type { ApiResult, FieldOut } from "@/types/api";

export default function CamposPage() {
  const profile = useProfile();
  const state = useAsync<ApiResult<FieldOut[]>>((signal) => api.fields({ signal }), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => setHidden(listHiddenExamples()), []);
  const visible = useMemo(() => (state.data?.data ?? []).filter((f) => !hidden.includes(f.id)), [state.data, hidden]);
  const others = useMemo(() => visible.map((f) => ({ id: f.id, name: f.name, lat: f.location.lat, lon: f.location.lon })), [visible]);

  /** Papelera: los de ejemplo se ocultan solo acá (la página es pública); los cargados se borran de verdad. */
  async function remove(f: FieldOut) {
    if (f.sample_note) {
      if (!window.confirm(`¿Ocultar el campo de ejemplo «${f.name}»? Se oculta solo en este navegador y lo podés volver a mostrar.`)) return;
      hideExample(f.id);
      setHidden(listHiddenExamples());
      setStatus(`Ocultamos «${f.name}».`);
      return;
    }
    if (!window.confirm(`¿Borrar «${f.name}»? No se puede deshacer.`)) return;
    setBusyId(f.id);
    try {
      await api.deleteField(f.id);
      setStatus(`Borramos «${f.name}».`);
      state.reload();
    } catch (e) {
      setStatus(`No se pudo borrar «${f.name}»: ${describeError(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Elegí tu campo" description="Abrí uno de los campos de ejemplo o cargá el tuyo marcándolo en el mapa.">
        <Button asChild size="lg">
          <Link href="/campos/nuevo">
            <Plus aria-hidden /> Cargar mi campo
          </Link>
        </Button>
      </PageHeader>

      <p role="status" className="mb-4 text-sm font-medium empty:hidden">{status}</p>
      {hidden.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          Hay {hidden.length} campo{hidden.length > 1 ? "s" : ""} de ejemplo oculto{hidden.length > 1 ? "s" : ""}.{" "}
          <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => { showAllExamples(); setHidden([]); setStatus("Volvimos a mostrar los campos de ejemplo."); }}>
            Mostrarlos de nuevo
          </button>
        </p>
      )}
      <AsyncBlock state={state} what="los campos" isEmpty={(r) => r.data.filter((f) => !hidden.includes(f.id)).length === 0} emptyMessage="Todavía no cargaste ningún campo.">
        {(r) => (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="lg:order-2">
              <FieldMap mode="overview" others={others} selectedId={selected} onSelectOther={setSelected} />
              <p className="mt-2 text-sm text-muted-foreground">Tocá un marcador para resaltar el campo en la lista.</p>
            </div>
            <ul className="space-y-4 lg:order-1" aria-label="Campos disponibles">
              {r.data.filter((f) => !hidden.includes(f.id)).map((f) => (
                <li key={f.id}>
                  <Card className={cn(selected === f.id && "ring-2 ring-primary")}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle as="h2">{f.name}</CardTitle>
                        {f.sample_note && <Badge variant="tierra">Ejemplo</Badge>}
                        {isLocalId(f.id) && <Badge variant="agua">Guardado en este navegador</Badge>}
                        <Button
                          type="button" variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive"
                          aria-label={f.sample_note ? `Ocultar el campo de ejemplo ${f.name}` : `Borrar ${f.name}`}
                          title={f.sample_note ? "Ocultar este campo de ejemplo" : "Borrar este campo"}
                          disabled={busyId === f.id}
                          onClick={() => void remove(f)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      <CardDescription>{f.farm_name ?? "Sin establecimiento"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-base">
                        <li className="flex items-center gap-1.5"><Ruler aria-hidden className="size-4" /> {num(f.area_ha)} ha</li>
                        <li className="flex items-center gap-1.5"><Droplets aria-hidden className="size-4" /> {f.irrigated ? "Con riego" : "Secano"}</li>
                        <li className="flex items-center gap-1.5"><MapPinned aria-hidden className="size-4" /> {num(f.location.lat, 2)}, {num(f.location.lon, 2)}</li>
                      </ul>
                      <p className="text-sm text-muted-foreground">
                        Suelo: {f.soil_profile?.texture ? SOIL_TEXTURES[f.soil_profile.texture] : "sin dato"}
                        {f.sample_note ? " · datos ilustrativos" : ""}
                      </p>
                      <Button asChild>
                        <Link href={PROFILES[profile ?? "agricultor"].home(f.id)}>
                          {profile === "huerta" ? "Abrir mi huerta" : "Abrir este campo"} <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AsyncBlock>
    </div>
  );
}
