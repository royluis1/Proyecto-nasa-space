import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, CloudSun, Droplets, Leaf, MapPin, Mountain, Satellite, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { HeroAccount } from "@/components/home/hero-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APPROACHES } from "@/lib/sources";
import { cn } from "@/lib/utils";

const steps: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: MapPin, title: "Ubicá tu campo", text: "Buscá tu ciudad o pueblo, o marcá el lote en el mapa.", tone: "bg-secondary text-primary" },
  { icon: SlidersHorizontal, title: "Contanos qué te importa", text: "Tu suelo, si tenés riego, y qué priorizás: agua, suelo, ingreso o riesgo.", tone: "bg-accent/50 text-accent-foreground" },
  { icon: BarChart3, title: "Compará rotaciones", text: "Varias opciones con puntaje, riesgos y el porqué de cada una.", tone: "bg-sky-soft text-sky" },
];

type Tone = "good" | "warn" | "bad";
const TONE_BG: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" };
const TONE_RING: Record<Tone, string> = { good: "oklch(var(--good))", warn: "oklch(var(--warn))", bad: "oklch(var(--bad))" };

interface Example {
  title: string;
  crops: string;
  score: number;
  tone: Tone;
  best?: boolean;
  meters: { icon: string; name: string; value: number; tone: Tone; label: string }[];
  why: string;
}

/** Ejemplo ilustrativo (datos simulados): muestra cómo se leen los resultados. */
const examples: Example[] = [
  {
    title: "Soja → Maíz → Cobertura", crops: "🫘 🌽 🌿", score: 82, tone: "good", best: true,
    meters: [
      { icon: "💧", name: "Agua", value: 80, tone: "good", label: "Bueno" },
      { icon: "🟤", name: "Suelo", value: 85, tone: "good", label: "Bueno" },
      { icon: "💰", name: "Ingreso", value: 70, tone: "warn", label: "Medio" },
      { icon: "⚠️", name: "Riesgo", value: 25, tone: "good", label: "Riesgo bajo" },
    ],
    why: "la cobertura cuida la humedad del suelo en años secos.",
  },
  {
    title: "Maíz → Soja", crops: "🌽 🫘", score: 68, tone: "warn",
    meters: [
      { icon: "💧", name: "Agua", value: 55, tone: "warn", label: "Medio" },
      { icon: "🟤", name: "Suelo", value: 60, tone: "warn", label: "Medio" },
      { icon: "💰", name: "Ingreso", value: 85, tone: "good", label: "Bueno" },
      { icon: "⚠️", name: "Riesgo", value: 50, tone: "warn", label: "Riesgo medio" },
    ],
    why: "buen ingreso, pero usa más agua.",
  },
  {
    title: "Soja → Soja", crops: "🫘 🫘", score: 45, tone: "bad",
    meters: [
      { icon: "💧", name: "Agua", value: 40, tone: "bad", label: "Bajo" },
      { icon: "🟤", name: "Suelo", value: 35, tone: "bad", label: "Bajo" },
      { icon: "💰", name: "Ingreso", value: 65, tone: "warn", label: "Medio" },
      { icon: "⚠️", name: "Riesgo", value: 80, tone: "bad", label: "Riesgo alto" },
    ],
    why: "desgasta el suelo y depende mucho de la lluvia.",
  },
];

const data: { icon: LucideIcon; title: string; source: string; text: string; tone: string }[] = [
  { icon: CloudSun, title: "Clima", source: "NASA POWER", text: "Lluvia, temperatura y evaporación de los últimos 10 años en tu zona.", tone: "bg-sky-soft text-sky" },
  { icon: Droplets, title: "Humedad del suelo", source: "NASA SMAP", text: "Cuánta agua hay en las raíces comparado con lo normal, y qué tan seguido hay sequía.", tone: "bg-sky-soft text-sky" },
  { icon: Leaf, title: "Lo verde del campo", source: "MODIS y Landsat", text: "Cuánto verde hubo en cada campaña: cobertura, barbechos y tendencia.", tone: "bg-secondary text-primary" },
  { icon: Mountain, title: "Relieve", source: "NASA SRTM", text: "Altura y pendiente del lote, para medir el riesgo de que el agua se lleve el suelo.", tone: "bg-warning-soft text-warning" },
];

const labels: { icon: string; text: string; tone: string }[] = [
  { icon: "✅", text: "Observado", tone: "border-good" },
  { icon: "🧮", text: "Modelado", tone: "border-info" },
  { icon: "📐", text: "Estimado", tone: "border-warn" },
  { icon: "❓", text: "Supuesto", tone: "border-bad" },
];

function ScoreRing({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div
      className="grid size-16 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${TONE_RING[tone]} ${value}%, oklch(var(--border)) 0)` }}
      role="img"
      aria-label={`Puntaje ${value} de 100`}
    >
      <span className="grid size-[50px] place-items-center rounded-full bg-card text-xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Satélite mirando un campo sembrado" className="aspect-[16/10] h-auto w-full bg-gradient-to-b from-agua-100 to-cultivo-100 dark:from-[#10283a] dark:to-[#1b4a36]" preserveAspectRatio="xMidYMid slice">
      <circle cx="320" cy="55" r="26" fill="#f2c94c" />
      <g transform="translate(95 60) rotate(-20)">
        <rect x="-16" y="-9" width="32" height="18" rx="3" fill="#cfd8dc" />
        <rect x="-60" y="-7" width="38" height="14" fill="#2f7fb5" />
        <rect x="22" y="-7" width="38" height="14" fill="#2f7fb5" />
      </g>
      <path d="M95 75 L150 200 L40 200 Z" fill="#6cb8ff" opacity=".25" />
      <polygon points="0,300 0,215 400,190 400,300" fill="#2f7d4a" />
      <polygon points="0,300 40,225 140,215 120,300" fill="#3b9a5a" />
      <polygon points="120,300 140,215 250,205 260,300" fill="#d9b44a" />
      <polygon points="260,300 250,205 360,198 400,300" fill="#7c5a36" />
      <g stroke="#0e1712" strokeOpacity=".25" strokeWidth="2">
        <line x1="40" y1="260" x2="125" y2="250" />
        <line x1="150" y1="260" x2="255" y2="248" />
        <line x1="290" y1="260" x2="380" y2="245" />
      </g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-14">
      {/* Portada */}
      <section className="bg-hero rounded-3xl">
        <div className="grid grid-cols-1 gap-10 px-5 py-10 sm:px-8 md:py-14 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="animate-rise space-y-6 lg:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-soft">
              <MapPin aria-hidden className="size-3.5" /> San Luis, Argentina
            </span>
            <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">
              ¿Qué sembrar este año? <span className="text-primary-glow">Mirá qué dicen los satélites.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              FieldShift compara rotaciones para tu lote con datos de la NASA, tu suelo y lo que te importa. Todo explicado en palabras simples.
            </p>
            <div className="relative overflow-hidden rounded-3xl shadow-lift">
              <Illustration />
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-2">
                {[
                  { icon: Satellite, label: "Datos de la NASA" },
                  { icon: CloudSun, label: "Pronóstico local" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
                    <Icon aria-hidden className="size-3.5 text-sky" /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:order-1">
            <HeroAccount />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section aria-labelledby="como">
        <div className="mb-8 max-w-xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">Así de fácil</p>
          <h2 id="como" className="text-3xl font-bold sm:text-4xl">En 3 pasos tenés tu comparación</h2>
        </div>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text, tone }, i) => (
            <li key={title}>
              <Card className="h-full transition-shadow hover:shadow-lift">
                <CardContent className="space-y-4 p-7">
                  <div className="flex items-center justify-between">
                    <span className={cn("grid size-12 place-items-center rounded-2xl", tone)}>
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span aria-hidden className="font-display text-sm font-semibold text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold"><span className="sr-only">Paso {i + 1}: </span>{title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Tres enfoques */}
      <section aria-labelledby="enfoques">
        <h2 id="enfoques" className="text-3xl font-bold sm:text-4xl">Tres enfoques</h2>
        <p className="mb-5 text-muted-foreground">Para huertas y para campos: elegís tu perfil y FieldShift te muestra lo que te sirve.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <article key={a.id} className="rounded-xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift">
              <span aria-hidden className="text-4xl">{a.icon}</span>
              <h3 className="mb-1 mt-2 text-xl font-bold">{a.title}</h3>
              <p className="text-muted-foreground">{a.text}</p>
              <p className="mt-2 text-sm">En la app: {a.pages.map((p) => p.label).join(", ")}.</p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-secondary p-5">
            <p className="text-lg font-bold"><span aria-hidden>🥬 </span>Huerta</p>
            <p className="text-muted-foreground">Cuánto regar, cuándo hiela, lluvia pasada y futura, y alertas. Sin puntajes ni rotaciones: lo justo para la huerta.</p>
          </div>
          <div className="rounded-xl border bg-secondary p-5">
            <p className="text-lg font-bold"><span aria-hidden>🚜 </span>Agricultor</p>
            <p className="text-muted-foreground">Rotaciones con puntaje, escenarios, calendario por campañas, relieve, alertas y reporte para el técnico.</p>
          </div>
        </div>
      </section>

      {/* Ejemplo visual */}
      <section aria-labelledby="ejemplo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ejemplo" className="text-3xl font-bold sm:text-4xl">Así se ve el resultado</h2>
          <span className="rounded-full border border-warn bg-warn/15 px-3 py-1 text-sm font-bold">Ejemplo con datos simulados</span>
        </div>
        <p className="mb-5 text-muted-foreground">Más barra verde, mejor. Rojo = ojo con eso.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {examples.map((e) => (
            <article key={e.title} className={cn("rounded-xl border-2 bg-card p-5 shadow-soft", e.best ? "border-good bg-secondary" : "border-border")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {e.best && <span className="mb-1.5 inline-block rounded-full bg-primary px-2.5 py-0.5 text-xs font-extrabold text-primary-foreground">⭐ La mejor para vos</span>}
                  <h3 className="text-xl font-bold leading-tight">{e.title}</h3>
                </div>
                <ScoreRing value={e.score} tone={e.tone} />
              </div>
              <p aria-hidden className="my-2 text-3xl tracking-[4px]">{e.crops}</p>
              <dl className="space-y-2.5">
                {e.meters.map((m) => (
                  <div key={m.name} className="grid grid-cols-[26px_1fr_auto] items-center gap-2">
                    <dt><span aria-hidden>{m.icon}</span><span className="sr-only">{m.name}</span></dt>
                    <dd className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <i className={cn("block h-full rounded-full", TONE_BG[m.tone])} style={{ width: `${m.value}%` }} />
                    </dd>
                    <dd className="min-w-[90px] text-right text-sm font-bold">{m.label}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-dashed pt-3 text-muted-foreground"><b className="text-foreground">Por qué:</b> {e.why}</p>
            </article>
          ))}
        </div>
        <Button size="lg" asChild className="mt-5 min-h-14 px-6 text-lg font-extrabold">
          <Link href="/campo/campo-centro/comparador">Ver el ejemplo completo <ArrowRight aria-hidden /></Link>
        </Button>
      </section>

      {/* Datos */}
      <section aria-labelledby="datos">
        <h2 id="datos" className="text-3xl font-bold sm:text-4xl">¿De dónde sale cada dato?</h2>
        <p className="mb-5 text-muted-foreground">Todo viene de la NASA y te decimos su origen.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((d) => (
            <article key={d.title} className="rounded-xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift">
              <span className={cn("grid size-11 place-items-center rounded-xl", d.tone)}><d.icon aria-hidden className="size-5" /></span>
              <h3 className="mb-0.5 mt-3 text-xl font-bold">{d.title}</h3>
              <p className="text-sm font-bold text-sky">{d.source}</p>
              <p className="mt-1.5 text-muted-foreground">{d.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-xl border bg-card p-5 shadow-soft">
          <p className="mb-3"><b>Cada número tiene una etiqueta</b> para que no confundas una medición con una suposición:</p>
          <ul className="flex flex-wrap gap-2.5">
            {labels.map((l) => (
              <li key={l.text} className={cn("rounded-full border-2 px-3.5 py-1.5 font-bold", l.tone)}><span aria-hidden>{l.icon} </span>{l.text}</li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-muted-foreground">Los satélites ven una zona de varios kilómetros, no tu lote exacto.</p>
      </section>

      {/* Metodología */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-secondary p-6">
        <div>
          <h2 className="text-2xl font-bold">¿Querés saber cómo se calcula?</h2>
          <p className="text-muted-foreground">Fuentes, fórmulas y lo que falta validar con un agrónomo.</p>
        </div>
        <Button size="lg" variant="outline" asChild className="border-2 border-primary font-extrabold text-primary">
          <Link href="/metodologia"><BookOpen aria-hidden /> Metodología y fuentes</Link>
        </Button>
      </section>
    </div>
  );
}
