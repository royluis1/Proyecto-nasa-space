"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AsyncBlock } from "@/components/async-block";
import { PageHeader } from "@/components/page-header";
import { WarningsList } from "@/components/provenance/warnings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Swatch, ZonePatternDefs } from "@/components/zones/patterns";
import { SuitabilityList } from "@/components/zones/suitability-list";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { friendlyWarnings } from "@/lib/plain";
import { LEVEL_STYLES, LEVEL_WORD, ZONE_STYLES, climateRows, isZoneClass, levelFor } from "@/lib/zones";
import type { Feature } from "geojson";
import type { ApiResult, Crop, Level, ProvincesOut, ZoneSuitability, ZonesOut } from "@/types/api";

const ZonesMap = dynamic(() => import("@/components/zones/zones-map"), { ssr: false, loading: () => <Skeleton className="h-[460px] w-full sm:h-[560px]" /> });

type ProvinceProps = { id: string; name: string; has_zones: boolean; zones_origin: string | null };
type ZoneProps = { zone_id: string; zone_class: string; zone_label: string; area_km2: number; cells: number; precip_mm: number; aridity_index: number; suitability: { crop_id: string; crop_name: string; level: Level }[] };

function Legend({ cropName }: { cropName: string | null }) {
  const items = cropName ? Object.values(LEVEL_STYLES) : Object.values(ZONE_STYLES);
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Referencias del mapa">
      {items.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-2"><Swatch s={s} /> {cropName ? `${cropName}: ${s.label.toLowerCase()}` : `Zona ${s.label.toLowerCase()}`}</li>
      ))}
      <li className="inline-flex items-center gap-2"><span aria-hidden className="inline-block h-0 w-6 border-t-2 border-dashed border-foreground/60" /> Provincia sin zonificación todavía</li>
    </ul>
  );
}

function ZonePanel({ zoneId }: { zoneId: string }) {
  const s = useAsync<ApiResult<ZoneSuitability>>((signal) => api.suitability(zoneId, { signal }), [zoneId]);
  return (
    <AsyncBlock state={s} what="la aptitud de la zona">
      {(r) => {
        const z = r.data.zone;
        return (
          <div className="space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold">{isZoneClass(z.zone_class) && <Swatch s={ZONE_STYLES[z.zone_class]} />} Zona {z.label.toLowerCase()}</h3>
              <p className="text-sm text-muted-foreground">{z.cells} celdas de NASA POWER · {z.area_km2.toLocaleString("es-AR")} km² · {z.period}</p>
            </div>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {climateRows(z.climate).map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline">{v}</dd></div>)}
            </dl>
            <SuitabilityList items={r.data.crops} />
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Fuente: NASA POWER · tipo: modelado · <Badge variant={z.origin === "sample" ? "alerta" : "outline"}>{z.origin_label}</Badge>
              {z.generated_at && <span>· calculado el {new Date(z.generated_at).toLocaleDateString("es-AR")}</span>}
            </p>
            <p className="text-sm text-muted-foreground">{z.method}</p>
            <WarningsList warnings={friendlyWarnings(r.meta.warnings)} />
          </div>
        );
      }}
    </AsyncBlock>
  );
}

function ZonasContent() {
  const router = useRouter();
  const params = useSearchParams();
  const province = params.get("provincia") ?? "san-luis";
  const cropId = params.get("cultivo") || null;
  const zoneId = params.get("zona");
  const [showCells, setShowCells] = useState(false);
  const setParam = (updates: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    router.replace(`/zonas?${q.toString()}`, { scroll: false });
  };

  const provinces = useAsync<ApiResult<ProvincesOut>>((signal) => api.provinces({ signal }), []);
  const zones = useAsync<ApiResult<ZonesOut>>((signal) => api.zones(province, { signal }), [province]);
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const cropName = crops.data?.find((c) => c.id === cropId)?.name ?? null;
  const provFeatures = useMemo(() => (provinces.data?.data.features ?? []) as unknown as Feature[], [provinces.data]);
  const provList = useMemo(() => provFeatures.map((f) => f.properties as ProvinceProps).sort((a, b) => a.name.localeCompare(b.name, "es")), [provFeatures]);
  const z = zones.data?.data;
  const zoneFeatures = (z?.zones ?? []) as unknown as Feature[];

  return (
    <div className="space-y-6">
      <ZonePatternDefs />
      <PageHeader
        title="Mapa de zonas climáticas"
        description="Zonas derivadas de NASA POWER con el índice de aridez (lluvia / evaporación). Tocá una provincia y después una zona para ver su clima y qué cultivos se adaptan mejor."
      />
      <Alert tone="info" title="Cómo leer este mapa">
        <p>No son zonas agroecológicas oficiales: son zonas climáticas derivadas de NASA POWER, con celdas de unos 55 km. La aptitud de cada cultivo es una orientación por reglas, no una recomendación de siembra, y no tiene en cuenta tu suelo ni tu manejo. Requiere validación agronómica local.</p>
      </Alert>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="prov">Provincia</Label>
            <Select id="prov" value={province} onChange={(e) => setParam({ provincia: e.target.value, zona: null })}>
              {provList.map((p) => <option key={p.id} value={p.id}>{p.name}{p.has_zones ? " (con zonas)" : ""}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cultivo">Ver aptitud de un cultivo</Label>
            <Select id="cultivo" value={cropId ?? ""} onChange={(e) => setParam({ cultivo: e.target.value || null })}>
              <option value="">— Zonas climáticas —</option>
              {(crops.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="flex items-end gap-3 pb-2">
            <Switch id="celdas" checked={showCells} onCheckedChange={setShowCells} />
            <Label htmlFor="celdas">Mostrar las celdas de NASA POWER</Label>
          </div>
        </CardContent>
      </Card>

      <AsyncBlock state={provinces} what="las provincias">
        {(r) => (
          <div className="space-y-3">
            <div role="region" aria-label="Mapa de Argentina con zonas climáticas. Hay una tabla con los mismos datos debajo." className="overflow-hidden rounded-[1rem] border">
              <ZonesMap
                provinces={provFeatures} selectedProvince={province} zones={zoneFeatures} cells={(z?.cells ?? []) as unknown as Feature[]} showCells={showCells}
                cropId={cropId} cropName={cropName ?? undefined} selectedZone={zoneId}
                onProvince={(id) => setParam({ provincia: id, zona: null })} onZone={(id) => setParam({ zona: id })}
              />
            </div>
            <Legend cropName={cropName} />
            <p className="text-xs text-muted-foreground">Límites provinciales: {r.data.source} ({r.data.license}). {r.data.note}</p>
          </div>
        )}
      </AsyncBlock>

      <AsyncBlock state={zones} what="las zonas">
        {(r) =>
          !r.data.available ? (
            <Alert tone="info" title={`${r.data.province_name}: zonificación disponible próximamente`}>
              <p>Por ahora hay zonas detalladas solo para San Luis. Elegí San Luis en el selector o tocála en el mapa.</p>
            </Alert>
          ) : (
            <div className="space-y-6">
              {r.data.warning && <Alert tone="warning" title="Datos de muestra"><p>{r.data.warning}</p></Alert>}
              <Table scrollLabel="Zonas de la provincia">
                <TableCaption>Zonas de {r.data.province_name} ({r.data.title}). Elegí una para ver el detalle.</TableCaption>
                <TableHeader>
                  <TableRow><TableHead>Zona</TableHead><TableHead>Superficie</TableHead><TableHead>Lluvia</TableHead><TableHead>Índice de aridez</TableHead>{cropName && <TableHead>{cropName}</TableHead>}<TableHead><span className="sr-only">Acción</span></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {zoneFeatures.map((f) => {
                    const p = f.properties as ZoneProps;
                    const lvl = cropId ? levelFor(p, cropId) : null;
                    return (
                      <TableRow key={p.zone_id} aria-selected={p.zone_id === zoneId}>
                        <TableCell className="font-medium"><span className="inline-flex items-center gap-2">{isZoneClass(p.zone_class) && <Swatch s={ZONE_STYLES[p.zone_class]} />}{p.zone_label}</span></TableCell>
                        <TableCell className="tabular-nums">{p.area_km2.toLocaleString("es-AR")} km²</TableCell>
                        <TableCell className="tabular-nums">{p.precip_mm.toLocaleString("es-AR")} mm/año</TableCell>
                        <TableCell className="tabular-nums">{p.aridity_index.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</TableCell>
                        {cropName && <TableCell>{lvl ? <span className="inline-flex items-center gap-2"><Swatch s={LEVEL_STYLES[lvl]} size={16} /> {LEVEL_WORD[lvl]}</span> : "—"}</TableCell>}
                        <TableCell><button type="button" className="min-h-11 text-primary underline" onClick={() => setParam({ zona: p.zone_id })}>Ver detalle</button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {zoneId && (
                <Card>
                  <CardHeader><CardTitle as="h2">Detalle de la zona</CardTitle><CardDescription>Clima de la zona y aptitud orientativa de cada cultivo.</CardDescription></CardHeader>
                  <CardContent><ZonePanel zoneId={zoneId} /></CardContent>
                </Card>
              )}
            </div>
          )
        }
      </AsyncBlock>
    </div>
  );
}

export default function ZonasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ZonasContent />
    </Suspense>
  );
}
