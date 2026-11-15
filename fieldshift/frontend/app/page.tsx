import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartLink } from "@/components/layout/profile-chip";
import { APPROACHES } from "@/lib/sources";
import { cn } from "@/lib/utils";

const steps = [
  { icon: "📍", title: "Marcá tu campo", text: "Elegilo en el mapa, dibujá el lote o cargá las coordenadas." },
  { icon: "🎯", title: "Contanos qué te importa", text: "Tu suelo, si tenés riego, y qué priorizás: agua, suelo, ingreso o riesgo." },
  { icon: "📊", title: "Compará rotaciones", text: "Te mostramos varias opciones con puntaje, riesgos y el porqué de cada una." },
];

type Tone = "good" | "warn" | "bad";
const TONE_BG: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" };
const TONE_RING: Record<Tone, string> = { good: "hsl(var(--good))", warn: "hsl(var(--warn))", bad: "hsl(var(--bad))" };

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

const data = [
  { icon: "🌧️", title: "Clima", source: "NASA POWER", text: "Lluvia, temperatura y evaporación de los últimos 10 años en tu zona." },
  { icon: "💧", title: "Humedad del suelo", source: "NASA SMAP", text: "Cuánta agua hay en las raíces comparado con lo normal, y qué tan seguido hay sequía." },
  { icon: "🛰️", title: "Lo verde del campo", source: "MODIS NDVI", text: "Cuánto verde hubo en cada campaña: cobertura, barbechos y tendencia." },
  { icon: "⛰️", title: "Relieve", source: "NASA SRTM", text: "Altura y pendiente del lote, para medir el riesgo de que el agua se lleve el suelo." },
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
      style={{ background: `conic-gradient(${TONE_RING[tone]} ${value}%, hsl(var(--border)) 0)` }}
      role="img"
      aria-label={`Puntaje ${value} de 100`}
    >
      <span className="grid size-[50px] place-items-center rounded-full bg-card text-xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Satélite mirando un campo sembrado" className="h-auto w-full rounded-[1.25rem] bg-gradient-to-b from-agua-100 to-cultivo-100 dark:from-[#10283a] dark:to-[#1b4a36]">
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
      <section className="bg-hero grid items-center gap-8 rounded-3xl px-5 py-6 sm:px-7 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-4 inline-block rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-primary">🌾 Para productores de San Luis</p>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            ¿Qué sembrar este año? <span className="text-primary">Mirá qué dicen los satélites.</span>
          </h1>
          <p className="my-5 max-w-2xl text-xl text-muted-foreground">
            Compará rotaciones para tu lote con datos de la NASA y de tu propio campo. Todo explicado en palabras simples.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild className="min-h-14 px-6 text-lg font-extrabold">
              <StartLink>📍 Empezar: huerta o campo</StartLink>
            </Button>
            <Button size="lg" variant="outline" asChild className="min-h-14 border-2 border-primary px-6 text-lg font-extrabold text-primary">
              <Link href="/campo/campo-centro/comparador">👀 Ver un ejemplo</Link>
            </Button>
          </div>
        </div>
        <Illustration />
      </section>

      {/* Cómo funciona */}
      <section aria-labelledby="como">
        <h2 id="como" className="text-3xl font-bold tracking-tight">Así de fácil</h2>
        <p className="mb-5 text-muted-foreground">En 3 pasos tenés tu comparación.</p>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-[1.25rem] border bg-card p-6">
              <span aria-hidden className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-primary font-extrabold text-primary-foreground">{i + 1}</span>
              <span aria-hidden className="text-5xl leading-none">{s.icon}</span>
              <h3 className="mb-1 mt-3 text-xl font-bold"><span className="sr-only">Paso {i + 1}: </span>{s.title}</h3>
              <p className="text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tres enfoques */}
      <section aria-labelledby="enfoques">
        <h2 id="enfoques" className="text-3xl font-bold tracking-tight">Tres enfoques</h2>
        <p className="mb-5 text-muted-foreground">Para huertas y para campos: elegís tu perfil y FieldShift te muestra lo que te sirve.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <article key={a.id} className="rounded-[1.25rem] border bg-card p-6">
              <span aria-hidden className="text-4xl">{a.icon}</span>
              <h3 className="mb-1 mt-2 text-xl font-bold">{a.title}</h3>
              <p className="text-muted-foreground">{a.text}</p>
              <p className="mt-2 text-sm">En la app: {a.pages.map((p) => p.label).join(", ")}.</p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.25rem] border bg-secondary p-5">
            <p className="text-lg font-bold"><span aria-hidden>🥬 </span>Huerta</p>
            <p className="text-muted-foreground">Cuánto regar, cuándo hiela, lluvia pasada y futura, y alertas. Sin puntajes ni rotaciones: lo justo para la huerta.</p>
          </div>
          <div className="rounded-[1.25rem] border bg-secondary p-5">
            <p className="text-lg font-bold"><span aria-hidden>🚜 </span>Agricultor</p>
            <p className="text-muted-foreground">Rotaciones con puntaje, escenarios, calendario por campañas, relieve, alertas y reporte para el técnico.</p>
          </div>
        </div>
      </section>

      {/* Ejemplo visual */}
      <section aria-labelledby="ejemplo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ejemplo" className="text-3xl font-bold tracking-tight">Así se ve el resultado</h2>
          <span className="rounded-full border border-warn bg-warn/15 px-3 py-1 text-sm font-bold">Ejemplo con datos simulados</span>
        </div>
        <p className="mb-5 text-muted-foreground">Más barra verde, mejor. Rojo = ojo con eso.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {examples.map((e) => (
            <article key={e.title} className={cn("rounded-[1.25rem] border-2 bg-card p-5", e.best ? "border-good bg-secondary" : "border-border")}>
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
        <h2 id="datos" className="text-3xl font-bold tracking-tight">¿De dónde sale cada dato?</h2>
        <p className="mb-5 text-muted-foreground">Todo viene de la NASA y te decimos su origen.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((d) => (
            <article key={d.title} className="rounded-[1.25rem] border bg-card p-6">
              <span aria-hidden className="text-4xl">{d.icon}</span>
              <h3 className="mb-0.5 mt-2 text-xl font-bold">{d.title}</h3>
              <p className="text-sm font-bold text-agua-700 dark:text-info">{d.source}</p>
              <p className="mt-1.5 text-muted-foreground">{d.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-[1.25rem] border bg-card p-5">
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
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border bg-secondary p-6">
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
