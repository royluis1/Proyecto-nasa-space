import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, ClipboardList, CloudSun, Droplets, Leaf, Map, Mountain, Satellite, type LucideIcon } from "lucide-react";
import { StartLink } from "@/components/layout/profile-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APPROACHES } from "@/lib/sources";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "En cuatro pasos, AgroOrbit cruza datos de la NASA, tu suelo y tus prioridades para comparar qué sembrar.",
};

const PASOS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Map, title: "Elegí tu zona", text: "Buscá tu ciudad o pueblo, o marcá tu campo en el mapa de San Luis." },
  { icon: ClipboardList, title: "Cargá tu campo", text: "Superficie, suelo, riego y qué sembraste las últimas campañas." },
  { icon: Satellite, title: "Cruzamos datos", text: "Clima, humedad del suelo e índice de vegetación de los satélites de la NASA." },
  { icon: BarChart3, title: "Recibí tu recomendación", text: "Tu rotación actual comparada con otras opciones, con sus razones y riesgos." },
];

const DATOS: { icon: LucideIcon; title: string; source: string; text: string; tone: string }[] = [
  { icon: CloudSun, title: "Clima", source: "NASA POWER", text: "Lluvia, temperatura y evaporación de los últimos 10 años en tu zona.", tone: "bg-sky-soft text-sky" },
  { icon: Droplets, title: "Humedad del suelo", source: "NASA SMAP", text: "Cuánta agua hay en las raíces comparado con lo normal, y qué tan seguido hay sequía.", tone: "bg-sky-soft text-sky" },
  { icon: Leaf, title: "Lo verde del campo", source: "MODIS y Landsat", text: "Cuánto verde hubo en cada campaña: cobertura, barbechos y tendencia.", tone: "bg-secondary text-primary" },
  { icon: Mountain, title: "Relieve", source: "NASA SRTM", text: "Altura y pendiente del lote, para medir el riesgo de que el agua se lleve el suelo.", tone: "bg-warning-soft text-warning" },
];

const ETIQUETAS: { text: string; tone: string }[] = [
  { text: "Observado", tone: "border-success" },
  { text: "Modelado", tone: "border-sky" },
  { text: "Estimado", tone: "border-warning" },
  { text: "Supuesto", tone: "border-critical" },
];

export default function ComoFuncionaPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 py-6 md:py-10">
      <section>
        <h1 className="text-4xl font-bold">Cómo funciona</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">Cuatro pasos para pasar de la duda a una decisión de siembra.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {PASOS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full">
                <CardContent className="flex gap-4 p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Paso {i + 1}</p>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className="mt-10">
          <StartLink>Empezar ahora <ArrowRight aria-hidden /></StartLink>
        </Button>
      </section>

      <section aria-labelledby="enfoques" className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">Para huertas y para campos</p>
          <h2 id="enfoques" className="text-3xl font-bold">Tres enfoques</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <Card key={a.id} className="h-full">
              <CardContent className="space-y-2 p-6">
                <span aria-hidden className="text-3xl">{a.icon}</span>
                <h3 className="text-lg font-semibold">{a.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.text}</p>
                <p className="text-xs text-muted-foreground">En la app: {a.pages.map((p) => p.label).join(", ")}.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="datos" className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">Datos de la NASA</p>
          <h2 id="datos" className="text-3xl font-bold">¿De dónde sale cada dato?</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DATOS.map(({ icon: Icon, title, source, text, tone }) => (
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
            <p><strong>Cada número tiene una etiqueta</strong> para que no confundas una medición con una suposición:</p>
            <ul className="flex flex-wrap gap-2.5">
              {ETIQUETAS.map((l) => (
                <li key={l.text} className={cn("rounded-full border-2 px-3.5 py-1 text-sm font-semibold", l.tone)}>{l.text}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">Los satélites ven una zona de varios kilómetros, no tu lote exacto.</p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-secondary p-6">
        <div>
          <h2 className="text-2xl font-bold">¿Querés saber cómo se calcula?</h2>
          <p className="text-muted-foreground">Fuentes, fórmulas y lo que falta validar con un agrónomo.</p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/metodologia"><BookOpen aria-hidden /> Metodología y fuentes</Link>
        </Button>
      </section>
    </div>
  );
}
