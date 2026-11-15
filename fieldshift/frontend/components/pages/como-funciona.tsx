"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, ClipboardList, CloudSun, Droplets, Leaf, Map, Mountain, Satellite, type LucideIcon } from "lucide-react";
import { StartLink } from "@/components/layout/profile-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APPROACHES } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/lang-provider";
import type { T } from "@/lib/i18n";

const PASOS = (t: T): { icon: LucideIcon; title: string; text: string }[] => [
  { icon: Map, title: t("Elegí tu zona", "Choose your area"), text: t("Buscá tu ciudad o pueblo, o marcá tu campo en el mapa de San Luis.", "Search for your city or town, or mark your field on the San Luis map.") },
  { icon: ClipboardList, title: t("Cargá tu campo", "Add your field"), text: t("Superficie, suelo, riego y qué sembraste las últimas campañas.", "Area, soil, irrigation and what you planted in recent seasons.") },
  { icon: Satellite, title: t("Cruzamos datos", "We combine data"), text: t("Clima, humedad del suelo e índice de vegetación de los satélites de la NASA.", "Weather, soil moisture and vegetation index from NASA satellites.") },
  { icon: BarChart3, title: t("Recibí tu recomendación", "Get your recommendation"), text: t("Tu rotación actual comparada con otras opciones, con sus razones y riesgos.", "Your current rotation compared with other options, with reasons and risks.") },
];

const DATOS = (t: T): { icon: LucideIcon; title: string; source: string; text: string; tone: string }[] => [
  { icon: CloudSun, title: t("Clima", "Weather"), source: "NASA POWER", text: t("Lluvia, temperatura y evaporación de los últimos 10 años en tu zona.", "Rain, temperature and evaporation over the last 10 years in your area."), tone: "bg-sky-soft text-sky" },
  { icon: Droplets, title: t("Humedad del suelo", "Soil moisture"), source: "NASA SMAP", text: t("Cuánta agua hay en las raíces comparado con lo normal, y qué tan seguido hay sequía.", "How much water is in the root zone compared with normal, and how often drought happens."), tone: "bg-sky-soft text-sky" },
  { icon: Leaf, title: t("Lo verde del campo", "How green the field is"), source: t("MODIS y Landsat", "MODIS and Landsat"), text: t("Cuánto verde hubo en cada campaña: cobertura, barbechos y tendencia.", "How much green there was each season: cover, fallows and trend."), tone: "bg-secondary text-primary" },
  { icon: Mountain, title: t("Relieve", "Terrain"), source: "NASA SRTM", text: t("Altura y pendiente del lote, para medir el riesgo de que el agua se lleve el suelo.", "Elevation and slope of the plot, to gauge the risk of water washing the soil away."), tone: "bg-warning-soft text-warning" },
];

const ETIQUETAS = (t: T): { text: string; tone: string }[] => [
  { text: t("Observado", "Observed"), tone: "border-success" },
  { text: t("Modelado", "Modeled"), tone: "border-sky" },
  { text: t("Estimado", "Estimated"), tone: "border-warning" },
  { text: t("Supuesto", "Assumed"), tone: "border-critical" },
];

export function ComoFuncionaView() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl space-y-16 py-6 md:py-10">
      <section>
        <h1 className="text-4xl font-bold">{t("Cómo funciona", "How it works")}</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{t("Cuatro pasos para pasar de la duda a una decisión de siembra.", "Four steps from doubt to a planting decision.")}</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {PASOS(t).map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full">
                <CardContent className="flex gap-4 p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">{t("Paso", "Step")} {i + 1}</p>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className="mt-10">
          <StartLink>{t("Empezar ahora", "Start now")} <ArrowRight aria-hidden /></StartLink>
        </Button>
      </section>

      <section aria-labelledby="enfoques" className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">{t("Para huertas y para campos", "For gardens and for farms")}</p>
          <h2 id="enfoques" className="text-3xl font-bold">{t("Tres enfoques", "Three approaches")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <Card key={a.id} className="h-full">
              <CardContent className="space-y-2 p-6">
                <span aria-hidden className="text-3xl">{a.icon}</span>
                <h3 className="text-lg font-semibold">{a.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.text}</p>
                <p className="text-xs text-muted-foreground">{t("En la app", "In the app")}: {a.pages.map((p) => p.label).join(", ")}.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="datos" className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">{t("Datos de la NASA", "NASA data")}</p>
          <h2 id="datos" className="text-3xl font-bold">{t("¿De dónde sale cada dato?", "Where does each data point come from?")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DATOS(t).map(({ icon: Icon, title, source, text, tone }) => (
            <Card key={title} className="h-full">
              <CardContent className="flex gap-4 p-6">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm font-semibold text-sky">{source}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            <p>{t(<><strong>Cada número tiene una etiqueta</strong> para que no confundas una medición con una suposición:</>, <><strong>Every number has a label</strong> so you don&apos;t mistake a measurement for an assumption:</>)}</p>
            <ul className="flex flex-wrap gap-2.5">
              {ETIQUETAS(t).map((l) => (
                <li key={l.text} className={cn("rounded-full border-2 px-3.5 py-1 text-sm font-semibold", l.tone)}>{l.text}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">{t("Los satélites ven una zona de varios kilómetros, no tu lote exacto.", "Satellites see an area several kilometers wide, not your exact plot.")}</p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-secondary p-6">
        <div>
          <h2 className="text-2xl font-bold">{t("¿Querés saber cómo se calcula?", "Want to know how it is calculated?")}</h2>
          <p className="text-muted-foreground">{t("Fuentes, fórmulas y lo que falta validar con un agrónomo.", "Sources, formulas and what still needs validation by an agronomist.")}</p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/metodologia"><BookOpen aria-hidden /> {t("Metodología y fuentes", "Methodology and sources")}</Link>
        </Button>
      </section>
    </div>
  );
}
