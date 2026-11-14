"use client";

import Link from "next/link";
import { ArrowRight, Droplets, MapPinned, Plus, Ruler } from "lucide-react";
import { useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { PageHeader } from "@/components/page-header";
import { FieldMap } from "@/components/map/field-map-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { num, SOIL_TEXTURES } from "@/lib/format";
import { isLocalId } from "@/lib/local-fields";
import { cn } from "@/lib/utils";
import type { ApiResult, FieldOut } from "@/types/api";

export default function CamposPage() {
  const state = useAsync<ApiResult<FieldOut[]>>((signal) => api.fields({ signal }), []);
  const [selected, setSelected] = useState<string | null>(null);
  const others = useMemo(() => (state.data?.data ?? []).map((f) => ({ id: f.id, name: f.name, lat: f.location.lat, lon: f.location.lon })), [state.data]);

  return (
    <div>
      <PageHeader title="Elegí tu campo" description="Abrí uno de los campos de ejemplo o cargá el tuyo marcándolo en el mapa.">
        <Button asChild size="lg">
          <Link href="/campos/nuevo">
            <Plus aria-hidden /> Cargar mi campo
          </Link>
        </Button>
      </PageHeader>

      <AsyncBlock state={state} what="los campos" isEmpty={(r) => r.data.length === 0} emptyMessage="Todavía no cargaste ningún campo.">
        {(r) => (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="lg:order-2">
              <FieldMap mode="overview" others={others} selectedId={selected} onSelectOther={setSelected} />
              <p className="mt-2 text-sm text-muted-foreground">Tocá un marcador para resaltar el campo en la lista.</p>
            </div>
            <ul className="space-y-4 lg:order-1" aria-label="Campos disponibles">
              {r.data.map((f) => (
                <li key={f.id}>
                  <Card className={cn(selected === f.id && "ring-2 ring-primary")}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle as="h2">{f.name}</CardTitle>
                        {f.sample_note && <Badge variant="tierra">Ejemplo</Badge>}
                        {isLocalId(f.id) && <Badge variant="agua">Guardado en este navegador</Badge>}
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
                        <Link href={`/campo/${f.id}/perfil`}>
                          Abrir este campo <ArrowRight aria-hidden />
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
