import Link from "next/link";
import { ArrowRight, BookOpen, CloudSun, Compass, Leaf, MapPinned, Satellite, Sprout, ListChecks, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LabelBadge } from "@/components/provenance/badges";

const steps = [
  { icon: MapPinned, title: "Marcá tu campo", text: "Elegí el lugar en el mapa, dibujá el lote o cargá las coordenadas." },
  { icon: ListChecks, title: "Contanos qué te importa", text: "Tu suelo, si tenés riego y qué querés priorizar: agua, suelo, ingreso, riesgo…" },
  { icon: Scale, title: "Compará rotaciones", text: "Te mostramos al menos tres opciones, con el puntaje, los riesgos y el porqué de cada una." },
];

const data = [
  { icon: CloudSun, title: "Clima: NASA POWER", text: "Lluvia, temperatura y evapotranspiración de los últimos 10 años en tu zona." },
  { icon: Satellite, title: "Humedad del suelo: NASA SMAP", text: "Cuánta agua hay en la zona de raíces frente a lo normal, y qué tan seguido hay sequías." },
  { icon: Leaf, title: "Vegetación: MODIS NDVI", text: "Cuánto verde hubo en cada campaña: cobertura, barbechos y tendencia de la biomasa." },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 py-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            <Sprout aria-hidden className="size-4" /> Para productores de San Luis
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Decidí qué sembrar con datos de la NASA y de tu propio campo</h1>
          <p className="max-w-2xl text-xl text-muted-foreground">
            FieldShift compara rotaciones de cultivos para tu lote. Mira el clima, la humedad del suelo y la vegetación desde el espacio, y te explica cada
            recomendación en palabras simples.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/campos">
                Elegir mi campo <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/campo/campo-centro/comparador">
                <Compass aria-hidden /> Ver un ejemplo
              </Link>
            </Button>
          </div>
        </div>
        <Card className="bg-secondary/50">
          <CardHeader>
            <CardTitle as="h2">Antes de empezar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base">
            <p>
              <strong>FieldShift ayuda a decidir, no decide por vos.</strong> No reemplaza a un ingeniero agrónomo, al análisis de suelo ni a tu conocimiento del lote.
            </p>
            <p>Los satélites ven una zona de varios kilómetros, no tu lote. Por eso siempre te decimos de dónde sale cada dato y qué tan confiable es.</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="como">
        <h2 id="como" className="mb-4 text-2xl font-semibold">Cómo funciona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
                    <Icon aria-hidden className="size-6 text-primary" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="datos">
        <h2 id="datos" className="mb-1 text-2xl font-semibold">Qué datos usamos</h2>
        <p className="mb-4 text-muted-foreground">Todo dato viene con su origen. Así sabés cuánto confiar en cada número.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {data.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardHeader>
                <Icon aria-hidden className="size-6 text-agua-600" />
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Cada número tiene una etiqueta</CardTitle>
            <CardDescription>Para que no confundas una medición con una suposición.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-3">
            {(["observado", "modelado", "estimado", "supuesto"] as const).map((l) => (
              <LabelBadge key={l} label={l} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-6">
        <div>
          <h2 className="text-xl font-semibold">¿Querés saber cómo se calcula todo?</h2>
          <p className="text-muted-foreground">Las fuentes, las fórmulas y lo que todavía hay que validar con un agrónomo.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/metodologia">
            <BookOpen aria-hidden /> Metodología y fuentes
          </Link>
        </Button>
      </section>
    </div>
  );
}
