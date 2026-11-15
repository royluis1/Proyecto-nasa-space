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
import { tr } from "@/lib/i18n";

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
      if (!window.confirm(tr(`¿Ocultar el campo de ejemplo «${f.name}»? Se oculta solo en este navegador y lo podés volver a mostrar.`, `Hide the example field “${f.name}”? It is hidden only in this browser and you can show it again.`))) return;
      hideExample(f.id);
      setHidden(listHiddenExamples());
      setStatus(tr(`Ocultamos «${f.name}».`, `We hid “${f.name}”.`));
      return;
    }
    if (!window.confirm(tr(`¿Borrar «${f.name}»? No se puede deshacer.`, `Delete “${f.name}”? This can't be undone.`))) return;
    setBusyId(f.id);
    try {
      await api.deleteField(f.id);
      setStatus(tr(`Borramos «${f.name}».`, `We deleted “${f.name}”.`));
      state.reload();
    } catch (e) {
      setStatus(tr(`No se pudo borrar «${f.name}»: ${describeError(e)}`, `Could not delete “${f.name}”: ${describeError(e)}`));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title={tr("Elegí tu campo", "Choose your field")} description={tr("Abrí uno de los campos de ejemplo o cargá el tuyo marcándolo en el mapa.", "Open one of the example fields or add yours by marking it on the map.")}>
        <Button asChild size="lg">
          <Link href="/campos/nuevo">
            <Plus aria-hidden /> {tr("Cargar mi campo", "Add my field")}
          </Link>
        </Button>
      </PageHeader>

      <p role="status" className="mb-4 text-sm font-medium empty:hidden">{status}</p>
      {hidden.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {tr(
            `Hay ${hidden.length} campo${hidden.length > 1 ? "s" : ""} de ejemplo oculto${hidden.length > 1 ? "s" : ""}.`,
            `${hidden.length} example field${hidden.length > 1 ? "s are" : " is"} hidden.`,
          )}{" "}
          <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => { showAllExamples(); setHidden([]); setStatus(tr("Volvimos a mostrar los campos de ejemplo.", "We're showing the example fields again.")); }}>
            {tr("Mostrarlos de nuevo", "Show them again")}
          </button>
        </p>
      )}
      <AsyncBlock state={state} what={tr("los campos", "the fields")} isEmpty={(r) => r.data.filter((f) => !hidden.includes(f.id)).length === 0} emptyMessage={tr("Todavía no cargaste ningún campo.", "You haven't added any fields yet.")}>
        {(r) => (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="lg:order-2">
              <FieldMap mode="overview" others={others} selectedId={selected} onSelectOther={setSelected} />
              <p className="mt-2 text-sm text-muted-foreground">{tr("Tocá un marcador para resaltar el campo en la lista.", "Tap a marker to highlight the field in the list.")}</p>
            </div>
            <ul className="space-y-4 lg:order-1" aria-label={tr("Campos disponibles", "Available fields")}>
              {r.data.filter((f) => !hidden.includes(f.id)).map((f) => (
                <li key={f.id}>
                  <Card className={cn(selected === f.id && "ring-2 ring-primary")}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle as="h2">{f.name}</CardTitle>
                        {f.sample_note && <Badge variant="tierra">{tr("Ejemplo", "Example")}</Badge>}
                        {isLocalId(f.id) && <Badge variant="agua">{tr("Guardado en este navegador", "Saved in this browser")}</Badge>}
                        <Button
                          type="button" variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive"
                          aria-label={f.sample_note ? tr(`Ocultar el campo de ejemplo ${f.name}`, `Hide the example field ${f.name}`) : tr(`Borrar ${f.name}`, `Delete ${f.name}`)}
                          title={f.sample_note ? tr("Ocultar este campo de ejemplo", "Hide this example field") : tr("Borrar este campo", "Delete this field")}
                          disabled={busyId === f.id}
                          onClick={() => void remove(f)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      <CardDescription>{f.farm_name ?? tr("Sin establecimiento", "No farm name")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-base">
                        <li className="flex items-center gap-1.5"><Ruler aria-hidden className="size-4" /> {num(f.area_ha)} ha</li>
                        <li className="flex items-center gap-1.5"><Droplets aria-hidden className="size-4" /> {f.irrigated ? tr("Con riego", "Irrigated") : tr("Secano", "Rainfed")}</li>
                        <li className="flex items-center gap-1.5"><MapPinned aria-hidden className="size-4" /> {num(f.location.lat, 2)}, {num(f.location.lon, 2)}</li>
                      </ul>
                      <p className="text-sm text-muted-foreground">
                        {tr("Suelo", "Soil")}: {f.soil_profile?.texture ? SOIL_TEXTURES[f.soil_profile.texture] : tr("sin dato", "no data")}
                        {f.sample_note ? tr(" · datos ilustrativos", " · illustrative data") : ""}
                      </p>
                      <Button asChild>
                        <Link href={PROFILES[profile ?? "agricultor"].home(f.id)}>
                          {profile === "huerta" ? tr("Abrir mi huerta", "Open my garden") : tr("Abrir este campo", "Open this field")} <ArrowRight aria-hidden />
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
