"use client";

import { MapPinned, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AsyncBlock } from "@/components/async-block";
import { WarningsList } from "@/components/provenance/warnings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Swatch, ZonePatternDefs } from "@/components/zones/patterns";
import { SuitabilityList } from "@/components/zones/suitability-list";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { SOIL_TEXTURES, LEVEL_LABELS } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import { LEVEL_STYLES, LEVEL_WORD, ZONE_STYLES, isZoneClass } from "@/lib/zones";
import type { ApiResult, FieldOut, ZoneAt } from "@/types/api";

function SoilBlock({ field }: { field: FieldOut }) {
  const est = field.auto_profile?.soil_estimate;
  const applied = field.auto_profile?.soil_applied ?? [];
  const sp = field.soil_profile;
  return (
    <section aria-labelledby="ap-suelo" className="space-y-2">
      <h3 id="ap-suelo" className="font-semibold">Suelo</h3>
      {sp?.texture ? (
        <p>
          Se usa: <strong>{SOIL_TEXTURES[sp.texture]}</strong>
          {sp.organic_matter && <>, materia orgánica {LEVEL_LABELS[sp.organic_matter].toLowerCase()}</>}{" "}
          <Badge variant={sp.provenance.label === "estimado" ? "tierra" : "outline"}>{sp.lab_analysis ? "análisis de laboratorio" : sp.provenance.label}</Badge>
        </p>
      ) : (
        <p>Sin dato de suelo. Cargalo en el formulario de abajo o pedí un análisis.</p>
      )}
      {est && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p>
            <strong>Estimación:</strong> {est.texture_usda ?? "sin textura"}
            {est.clay_pct != null && ` (arcilla ${est.clay_pct} %, arena ${est.sand_pct} %, limo ${est.silt_pct} %)`}
            {est.organic_matter_pct != null && `, materia orgánica ~${est.organic_matter_pct.toLocaleString("es-AR")} %`}.
          </p>
          <p>Fuente: {est.source} · {est.resolution} · {est.depth} · <Badge variant={est.origin === "sample" ? "alerta" : "outline"}>{est.origin_label}</Badge> · tipo: estimado</p>
          <p className="mt-1">{applied.length ? `Se completó con la estimación: ${applied.join(" y ")}.` : "Se usa lo que cargaste: la estimación queda solo como referencia."}</p>
        </div>
      )}
    </section>
  );
}

function ZoneBlock({ z }: { z: ZoneAt }) {
  if (!z.zones_available || !z.zone) {
    return <p>{z.province_name}: zonificación disponible próximamente.</p>;
  }
  const zone = z.zone;
  const t = z.transition;
  return (
    <div className="space-y-4">
      <section aria-labelledby="ap-zona" className="space-y-1">
        <h3 id="ap-zona" className="flex items-center gap-2 font-semibold">{isZoneClass(zone.zone_class) && <Swatch s={ZONE_STYLES[zone.zone_class]} />} Zona {zone.label.toLowerCase()} ({z.province_name})</h3>
        {z.cell && (
          <p className="text-sm">
            Lluvia {z.cell.climate.precip_mm.toLocaleString("es-AR")} mm/año, déficit {z.cell.climate.deficit_mm.toLocaleString("es-AR")} mm/año, índice de aridez {z.cell.climate.aridity_index.toLocaleString("es-AR", { maximumFractionDigits: 2 })} (celda de NASA POWER de ~55 km).
          </p>
        )}
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Zonas climáticas derivadas de NASA POWER, no oficiales · <Badge variant={zone.origin === "sample" ? "alerta" : "outline"}>{zone.origin_label}</Badge>
          <Link className="inline-flex items-center gap-1 text-primary underline" href={`/zonas?provincia=${z.province_id}&zona=${zone.zone_id}`}><MapPinned aria-hidden className="size-4" /> Ver en el mapa</Link>
        </p>
      </section>

      {t?.is_transition && (
        <section aria-labelledby="ap-trans" className="space-y-3 rounded-[1rem] border-2 border-warn/70 bg-warn/10 p-4">
          <h3 id="ap-trans" className="flex items-center gap-2 text-lg font-semibold"><TriangleAlert aria-hidden className="size-5" /> Zona de transición</h3>
          <p className="text-lg">{t.message}</p>
          <ul className="list-disc pl-5 text-sm">{t.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div>
            <p className="font-medium">Opciones para evaluar (que funcionan en los dos escenarios):</p>
            <ul className="mt-1 space-y-2">
              {t.options.map((o) => (
                <li key={o.title} className="text-sm"><strong>{o.title}:</strong> {o.detail}. <span className="text-muted-foreground">{o.reason} Fuente: {o.source}.</span></li>
              ))}
            </ul>
          </div>
          {t.suitability_other.length > 0 && (
            <details className="rounded-md border bg-card p-3">
              <summary className="cursor-pointer font-medium">Aptitud si el año se comporta como zona {t.other_zone_label?.toLowerCase()}</summary>
              <div className="mt-3"><SuitabilityList items={t.suitability_other} compact /></div>
            </details>
          )}
        </section>
      )}

      <section aria-labelledby="ap-cultivos" className="space-y-2">
        <h3 id="ap-cultivos" className="font-semibold">Cultivos más aptos para la zona{t?.is_transition ? " (en un año como el promedio)" : ""}</h3>
        <ol className="space-y-1">
          {z.top_crops.map((c) => (
            <li key={c.crop_id} className="flex items-start gap-2">
              <Swatch s={LEVEL_STYLES[c.level]} size={18} />
              <span><strong>{c.crop_name}</strong> · aptitud {LEVEL_WORD[c.level]}<span className="block text-sm text-muted-foreground">{c.reasons[0]}</span></span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">Orientación por reglas de clima: no es una recomendación de siembra. Requiere validación agronómica local.</p>
      </section>
    </div>
  );
}

/** Perfil automático del campo: suelo estimado, zona climática, cultivos más aptos y aviso de transición. */
export function AutoProfileCard({ field }: { field: FieldOut }) {
  const own = field.auto_profile?.zone ?? null;
  const zone = useAsync<ApiResult<ZoneAt> | null>(
    async (signal) => (own ? null : api.zoneAt(field.id, field.location.lat, field.location.lon, { signal })),
    [field.id, own ? "own" : "fetch"],
  );
  return (
    <Card>
      <ZonePatternDefs />
      <CardHeader>
        <CardTitle as="h2">Perfil automático de tu campo</CardTitle>
        <CardDescription>Lo que FieldShift completó solo a partir de la ubicación. Lo que cargues vos siempre tiene prioridad.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SoilBlock field={field} />
        {field.auto_profile && field.auto_profile.warnings.length > 0 && (
          <WarningsList warnings={friendlyWarnings(field.auto_profile.warnings)} title="Avisos del perfil automático" />
        )}
        {own ? <ZoneBlock z={own} /> : (
          <AsyncBlock state={zone} what="la zona del campo">{(r) => (r ? <ZoneBlock z={r.data} /> : null)}</AsyncBlock>
        )}
      </CardContent>
    </Card>
  );
}
