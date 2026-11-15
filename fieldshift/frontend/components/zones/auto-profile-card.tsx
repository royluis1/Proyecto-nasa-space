"use client";

import { MapPinned, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AsyncBlock } from "@/components/async-block";
import { WarningsList } from "@/components/provenance/warnings";
import { Disclosure } from "@/components/ui/disclosure";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Swatch, ZonePatternDefs } from "@/components/zones/patterns";
import { SuitabilityList } from "@/components/zones/suitability-list";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { LABEL_INFO, SOIL_TEXTURES, LEVEL_LABELS } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import { LEVEL_STYLES, LEVEL_WORD, ZONE_STYLES, isZoneClass } from "@/lib/zones";
import type { ApiResult, FieldOut, ZoneAt } from "@/types/api";
import { appLocale, tr } from "@/lib/i18n";

function SoilBlock({ field }: { field: FieldOut }) {
  const est = field.auto_profile?.soil_estimate;
  const applied = field.auto_profile?.soil_applied ?? [];
  const sp = field.soil_profile;
  return (
    <section aria-labelledby="ap-suelo" className="space-y-2">
      <h3 id="ap-suelo" className="font-semibold">{tr("Suelo", "Soil")}</h3>
      {sp?.texture ? (
        <p>
          {tr("Se usa:", "In use:")} <strong>{SOIL_TEXTURES[sp.texture]}</strong>
          {sp.organic_matter && <>, {tr("materia orgánica", "organic matter")} {LEVEL_LABELS[sp.organic_matter].toLowerCase()}</>}{" "}
          <Badge variant={sp.provenance.label === "estimado" ? "tierra" : "outline"}>{sp.lab_analysis ? tr("análisis de laboratorio", "lab test") : (LABEL_INFO[sp.provenance.label]?.text.toLowerCase() ?? sp.provenance.label)}</Badge>
        </p>
      ) : (
        <p>{tr("Sin dato de suelo. Cargalo en el formulario de abajo o pedí un análisis.", "No soil data. Enter it in the form below or order a lab test.")}</p>
      )}
      {est && (
        <Disclosure label={tr("Ver la estimación de suelo y su fuente", "See the soil estimate and its source")}>
        <div className="rounded-md bg-muted p-3 text-sm">
          <p>
            <strong>{tr("Estimación:", "Estimate:")}</strong> {est.texture_usda ?? tr("sin textura", "no texture")}
            {est.clay_pct != null && tr(` (arcilla ${est.clay_pct} %, arena ${est.sand_pct} %, limo ${est.silt_pct} %)`, ` (clay ${est.clay_pct} %, sand ${est.sand_pct} %, silt ${est.silt_pct} %)`)}
            {est.organic_matter_pct != null && tr(`, materia orgánica ~${est.organic_matter_pct.toLocaleString(appLocale())} %`, `, organic matter ~${est.organic_matter_pct.toLocaleString(appLocale())} %`)}.
          </p>
          <p>{tr("Fuente", "Source")}: {est.source} · {est.resolution} · {est.depth} · <Badge variant={est.origin === "sample" ? "alerta" : "outline"}>{est.origin_label}</Badge> · {tr("tipo: estimado", "type: estimated")}</p>
          <p className="mt-1">{applied.length ? tr(`Se completó con la estimación: ${applied.join(" y ")}.`, `Filled in from the estimate: ${applied.join(" and ")}.`) : tr("Se usa lo que cargaste: la estimación queda solo como referencia.", "What you entered is used: the estimate is only a reference.")}</p>
        </div>
        </Disclosure>
      )}
    </section>
  );
}

function ZoneBlock({ z }: { z: ZoneAt }) {
  if (!z.zones_available || !z.zone) {
    return <p>{z.province_name}: {tr("zonificación disponible próximamente.", "zoning coming soon.")}</p>;
  }
  const zone = z.zone;
  const t = z.transition;
  return (
    <div className="space-y-4">
      <section aria-labelledby="ap-zona" className="space-y-1">
        <h3 id="ap-zona" className="flex items-center gap-2 font-semibold">{isZoneClass(zone.zone_class) && <Swatch s={ZONE_STYLES[zone.zone_class]} />} {tr(`Zona ${zone.label.toLowerCase()}`, `${zone.label} zone`)} ({z.province_name})</h3>
        <Link className="inline-flex items-center gap-1 text-sm text-primary underline" href={`/zonas?provincia=${z.province_id}&zona=${zone.zone_id}`}><MapPinned aria-hidden className="size-4" /> {tr("Ver en el mapa", "See on the map")}</Link>
        <Disclosure label={tr("Ver los datos de la zona", "See the area data")}>
          {z.cell && (
            <p className="text-sm">
              {tr(
                `Lluvia ${z.cell.climate.precip_mm.toLocaleString(appLocale())} mm/año, déficit ${z.cell.climate.deficit_mm.toLocaleString(appLocale())} mm/año, índice de aridez ${z.cell.climate.aridity_index.toLocaleString(appLocale(), { maximumFractionDigits: 2 })} (celda de NASA POWER de ~55 km).`,
                `Rain ${z.cell.climate.precip_mm.toLocaleString(appLocale())} mm/yr, deficit ${z.cell.climate.deficit_mm.toLocaleString(appLocale())} mm/yr, aridity index ${z.cell.climate.aridity_index.toLocaleString(appLocale(), { maximumFractionDigits: 2 })} (NASA POWER cell of ~55 km).`,
              )}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {tr("Zonas climáticas derivadas de NASA POWER, no oficiales", "Climate zones derived from NASA POWER, not official")} · <Badge variant={zone.origin === "sample" ? "alerta" : "outline"}>{zone.origin_label}</Badge>
          </p>
        </Disclosure>
      </section>

      {t?.is_transition && (
        <section aria-labelledby="ap-trans" className="space-y-3 rounded-[1rem] border-2 border-warn/70 bg-warn/10 p-4">
          <h3 id="ap-trans" className="flex items-center gap-2 text-lg font-semibold"><TriangleAlert aria-hidden className="size-5" /> {tr("Zona de transición", "Transition zone")}</h3>
          <p className="text-lg">{t.message}</p>
          <Disclosure label={tr("Por qué y qué opciones conviene evaluar", "Why, and which options to evaluate")} contentClassName="space-y-3">
          <ul className="list-disc pl-5 text-sm">{t.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div>
            <p className="font-medium">{tr("Opciones para evaluar (que funcionan en los dos escenarios):", "Options to evaluate (that work in both scenarios):")}</p>
            <ul className="mt-1 space-y-2">
              {t.options.map((o) => (
                <li key={o.title} className="text-sm"><strong>{o.title}:</strong> {o.detail}. <span className="text-muted-foreground">{o.reason} {tr("Fuente", "Source")}: {o.source}.</span></li>
              ))}
            </ul>
          </div>
          {t.suitability_other.length > 0 && (
            <details className="rounded-md border bg-card p-3">
              <summary className="cursor-pointer font-medium">{tr(`Aptitud si el año se comporta como zona ${t.other_zone_label?.toLowerCase()}`, `Suitability if the year behaves like a ${t.other_zone_label?.toLowerCase()} zone`)}</summary>
              <div className="mt-3"><SuitabilityList items={t.suitability_other} compact /></div>
            </details>
          )}
          </Disclosure>
        </section>
      )}

      <section aria-labelledby="ap-cultivos" className="space-y-2">
        <h3 id="ap-cultivos" className="font-semibold">{tr("Cultivos más aptos para la zona", "Best-suited crops for the area")}{t?.is_transition ? tr(" (en un año como el promedio)", " (in an average year)") : ""}</h3>
        <ol className="space-y-1">
          {z.top_crops.map((c) => (
            <li key={c.crop_id} className="flex items-start gap-2">
              <Swatch s={LEVEL_STYLES[c.level]} size={18} />
              <span><strong>{c.crop_name}</strong> · {tr(`aptitud ${LEVEL_WORD[c.level]}`, `${LEVEL_WORD[c.level]} suitability`)}</span>
            </li>
          ))}
        </ol>
        <Disclosure label={tr("Por qué estos cultivos", "Why these crops")}>
          <ul className="space-y-1 text-sm">{z.top_crops.map((c) => <li key={c.crop_id}><strong>{c.crop_name}:</strong> {c.reasons[0]}</li>)}</ul>
          <p className="mt-2 text-sm text-muted-foreground">{tr("Orientación por reglas de clima: no es una recomendación de siembra. Requiere validación agronómica local.", "Climate-rule guidance: not a planting recommendation. Requires local agronomic validation.")}</p>
        </Disclosure>
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
        <CardTitle as="h2">{tr("Perfil automático de tu campo", "Your field's automatic profile")}</CardTitle>
        <CardDescription>{tr("Completado solo con la ubicación. Lo que cargues vos tiene prioridad.", "Filled in from the location alone. What you enter takes priority.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SoilBlock field={field} />
        {own ? <ZoneBlock z={own} /> : (
          <AsyncBlock state={zone} what={tr("la zona del campo", "the field's area")}>{(r) => (r ? <ZoneBlock z={r.data} /> : null)}</AsyncBlock>
        )}
        {field.auto_profile && field.auto_profile.warnings.length > 0 && (
          <Disclosure label={tr("Avisos del perfil automático", "Automatic profile warnings")}>
            <WarningsList warnings={friendlyWarnings(field.auto_profile.warnings)} title={tr("Avisos del perfil automático", "Automatic profile warnings")} />
          </Disclosure>
        )}
      </CardContent>
    </Card>
  );
}
