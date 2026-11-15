import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LabelBadge } from "@/components/provenance/badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/content";
import { GLOSSARY, GLOSSARY_KEYS } from "@/lib/glossary";
import { COMPONENTS, COMPONENT_ORDER, AGGREGATION_NOTE } from "@/lib/format";
import { GROUPS, PRIORITY_META, type GroupKey } from "@/lib/priorities";
import { SourceMap } from "@/components/sources/source-map";
import { SoilRolesGuide } from "@/components/agronomy/soil-roles";
import { APPROACHES } from "@/lib/sources";
import type { DataLabel } from "@/types/api";

export const metadata: Metadata = { title: "Metodología y fuentes" };

const HARMONIZE: { name: string; native: string; how: string }[] = [
  { name: "NASA POWER (clima)", native: "~50 km · diario", how: "Se suma o promedia por mes y por campaña (julio a junio). La ET₀ se calcula por día con FAO-56 y se suma por mes." },
  { name: "NASA SMAP L4 (zona de raíces)", native: "9 km · cada 3 horas", how: "Promedio por mes y comparación con lo normal del mismo mes (anomalía)." },
  { name: "NASA SMAP L3 (superficie)", native: "9 km · diario", how: "Se muestra la última observación disponible, como contexto regional." },
  { name: "NASA MODIS NDVI", native: "250 m · cada 16 días", how: "Píxel del lote, resumido por mes y por campaña: cobertura, barbechos y biomasa." },
  { name: "Landsat/Sentinel (HLS)", native: "30 m · cada pocos días", how: "Una grilla de 3 × 3 sectores dentro del lote para comparar zonas del mismo campo." },
  { name: "NASA ECOSTRESS", native: "70 m · irregular", how: "Píxel del lote en verano: temperatura de la superficie y estrés hídrico." },
  { name: "NASA SRTM (relieve)", native: "30 m · año 2000", how: "Todos los píxeles dentro del lote, suavizados: pendiente media y de las zonas más inclinadas." },
  { name: "SoilGrids (suelo estimado)", native: "250 m", how: "Punto del lote: textura y materia orgánica, solo si no cargaste tu análisis." },
];


const DOCS = "https://github.com/royluis1/Proyecto-nasa-space/blob/main/fieldshift/docs";

const SOURCES: { name: string; label: DataLabel; what: string; res: string; use: string; limits: string }[] = [
  {
    name: "NASA POWER",
    label: "modelado",
    what: "Clima diario: lluvia, temperaturas, humedad del aire, viento y radiación.",
    res: "Una celda de unos 50 km, todos los días desde 1981.",
    use: "Lluvia, calor, heladas, años secos y la demanda de agua de la atmósfera (evapotranspiración).",
    limits: "Describe la zona, no tu lote. Es un reanálisis: un modelo que combina observaciones. No reemplaza un pluviómetro propio.",
  },
  {
    name: "NASA SMAP (humedad del suelo)",
    label: "modelado",
    what: "Cuánta agua hay en el suelo. Usamos el producto de zona de raíces (hasta 1 m), que es modelado; el de la superficie (5 cm) se mide directamente.",
    res: "Píxeles de 9 km, datos cada 3 horas desde 2015.",
    use: "Si la humedad reciente está por debajo o por encima de lo normal, qué tan seguido hay sequías y el estrés hídrico relativo.",
    limits: "Un píxel de 9 km son unas 8.000 hectáreas: sirve como contexto de la zona, no como la humedad de tu lote.",
  },
  {
    name: "NASA MODIS (NDVI)",
    label: "observado",
    what: "El “verdor” de la vegetación visto desde el satélite.",
    res: "Píxeles de 250 m, un dato cada 16 días desde el año 2000.",
    use: "Cobertura vegetal, períodos de barbecho, tendencia de la biomasa y comparación entre campañas.",
    limits: "En lotes de menos de unas 25 ha mezcla a los vecinos. Las nubes dejan huecos. Mide verdor, no materia orgánica del suelo.",
  },
  {
    name: "NASA SRTM (relieve)",
    label: "observado",
    what: "Altura del terreno medida por radar desde el transbordador espacial en el año 2000.",
    res: "Píxeles de 30 m. Se descarga con una cuenta de NASA Earthdata.",
    use: "Pendiente del lote y riesgo de erosión por agua en el puntaje de suelo.",
    limits: "No ve cambios posteriores al 2000 ni microrrelieve; en montes puede medir la copa de los árboles.",
  },
  {
    name: "Open-Meteo (pronóstico, no es NASA)",
    label: "estimado",
    what: "Pronóstico del tiempo de los próximos días: temperaturas, lluvia, viento y evaporación.",
    res: "Celdas de 1 a 11 km según la zona, hasta 16 días.",
    use: "Lluvia futura, alertas de helada, calor y tormentas, y el riego de la semana.",
    limits: "Es un pronóstico: pierde precisión después de 3 a 5 días. No es un producto de la NASA.",
  },
  {
    name: "FAO (Kc, Ky, agua útil) y USDA (lluvia efectiva)",
    label: "estimado",
    what: "Tablas y fórmulas publicadas para estimar cuánta agua necesita cada cultivo y cuánta de la lluvia aprovecha.",
    res: "No aplica.",
    use: "Demanda de agua de cada cultivo, caída del rendimiento por falta de agua y reserva de agua del suelo según su textura.",
    limits: "Son valores estándar: no consideran tu variedad, tu fecha de siembra ni tu manejo. Algunos valores hay que verificarlos contra las tablas originales.",
  },
  {
    name: "Catálogo de cultivos de AgroOrbit",
    label: "supuesto",
    what: "Características de 16 cultivos y coberturas de San Luis: tolerancia a sequía y calor, raíces, aporte de materia orgánica, ingreso relativo, plagas.",
    res: "No aplica.",
    use: "Todo el puntaje de suelo, riesgo, ingreso y sostenibilidad.",
    limits: "Son categorías (bajo, medio, alto) cargadas de forma provisoria: hay que validarlas con INTA y con agrónomos de la zona.",
  },
  {
    name: "Lo que cargás vos",
    label: "estimado",
    what: "Tipo de suelo, profundidad, materia orgánica, pendiente, riego e historial de cultivos.",
    res: "Tu lote.",
    use: "Reserva de agua, erosión, antecesores y monocultivo.",
    limits: "Es tan bueno como lo que sepas del lote. Un análisis de suelo de laboratorio mejora mucho la confianza.",
  },
];


export default function MetodologiaPage() {
  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader title="Metodología y fuentes" description="Cómo funciona AgroOrbit, de dónde salen los datos y qué todavía hay que validar." />

      <Alert tone="warning" title="Antes de leer"><p>{DISCLAIMER}</p></Alert>

      <section aria-labelledby="que-hace" className="space-y-3">
        <h2 id="que-hace" className="text-2xl font-semibold">Qué hace AgroOrbit</h2>
        <ol className="list-decimal space-y-2 pl-6 text-lg">
          <li>Toma el clima, la humedad del suelo y la vegetación de la zona de tu campo.</li>
          <li>Arma al menos tres rotaciones: tu rotación actual, una conservadora, una diversificada, una que ahorra agua, una que cuida el suelo, una de mayor ingreso y una mixta.</li>
          <li>Calcula mes por mes cuánta agua necesita cada rotación y cuánta tiene.</li>
          <li>Le pone puntaje a cada una en cinco aspectos y los combina según lo que vos priorices.</li>
          <li>Te explica el resultado, los riesgos y qué conviene validar con un profesional.</li>
        </ol>
      </section>

      <section aria-labelledby="puntaje" className="space-y-4">
        <h2 id="puntaje" className="text-2xl font-semibold">Cómo se calcula el puntaje</h2>
        <p className="text-lg">Cada rotación recibe cinco puntajes de 0 a 100. El total es la suma de cada uno multiplicado por el peso que le diste:</p>
        <p className="rounded-lg bg-muted p-4 font-mono text-base">Total = peso agua × A + peso suelo × S + peso riesgo × R + peso ingreso × I + peso sostenibilidad × E</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COMPONENT_ORDER.map((k) => (
            <li key={k}>
              <Card className="h-full">
                <CardHeader className="pb-1"><CardTitle className="text-lg">{k} · {COMPONENTS[k].name}</CardTitle></CardHeader>
                <CardContent><p>{COMPONENTS[k].help}</p></CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <p>Cada puntaje suma y resta puntos por motivos concretos (por ejemplo, “monocultivo: −10” o “cobertura todo el año: +40”) y la pantalla de detalle de cada rotación muestra todos esos motivos.</p>
        <p>El <strong>rango probable</strong> es lo que podría variar el puntaje si llueve 15 % más o menos, y suma un margen según la confianza en los datos.</p>
      </section>

      <section aria-labelledby="prioridades" className="space-y-3">
        <h2 id="prioridades" className="text-2xl font-semibold">Tus 11 prioridades y los 5 componentes</h2>
        <p>{AGGREGATION_NOTE} Estos son los grupos:</p>
        <ul className="space-y-2">
          {(Object.keys(GROUPS) as GroupKey[]).map((g) => (
            <li key={g} className="rounded-lg border p-3">
              <strong className="capitalize">{g === "water" ? "Agua (A)" : g === "soil" ? "Suelo (S)" : g === "risk" ? "Riesgo climático (R)" : g === "income" ? "Ingreso (I)" : "Sostenibilidad (E)"}</strong>
              <span>: {GROUPS[g].map((k) => PRIORITY_META[k].label).join(", ")}.</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">“Producir forraje” y “reducir las plagas” todavía no tienen un puntaje propio: hoy suman a Ingreso y a Sostenibilidad respectivamente.</p>
      </section>

      <section aria-labelledby="etiquetas" className="space-y-3">
        <h2 id="etiquetas" className="text-2xl font-semibold">Qué significa cada etiqueta</h2>
        <ul className="space-y-2">
          {(["observado", "modelado", "estimado", "supuesto"] as const).map((l) => (
            <li key={l} className="flex flex-wrap items-center gap-3"><LabelBadge label={l} />
              <span>{l === "observado" ? "Lo midió un satélite o un instrumento." : l === "modelado" ? "Sale de un modelo que combina observaciones." : l === "estimado" ? "Lo calculó AgroOrbit a partir de otros datos." : "Es un valor asumido, sin dato medido: hay que validarlo."}</span>
            </li>
          ))}
        </ul>
        <p>Además, cada bloque de datos indica su origen: <Badge variant="cultivo">DATO NASA EN VIVO</Badge> <Badge variant="agua">DATO CACHEADO</Badge> <Badge variant="tierra">DATO DE MUESTRA</Badge> <Badge variant="alerta">DATOS DE EJEMPLO (SIN CONEXIÓN)</Badge>. Los de muestra y los de ejemplo son <strong>simulados</strong>: sirven para probar la app, no para decidir.</p>
      </section>

      <section aria-labelledby="fuentes" className="space-y-4">
        <h2 id="fuentes" className="text-2xl font-semibold">Fuentes de datos</h2>
        {SOURCES.map((s) => (
          <Card key={s.name}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-xl">{s.name}</CardTitle><LabelBadge label={s.label} /></div>
              <CardDescription>{s.what}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p><strong>Resolución:</strong> {s.res}</p>
              <p><strong>Para qué lo usamos:</strong> {s.use}</p>
              <p><strong>Límites:</strong> {s.limits}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="armonizar" className="space-y-3">
        <h2 id="armonizar" className="text-2xl font-semibold">Cómo juntamos datos de distinta escala</h2>
        <p className="text-lg">
          Cada fuente mide a una escala distinta: de 30 m a 50 km, y de cada 3 horas a una sola vez. Para compararlas, todas se llevan a la misma
          unidad: <strong>el lote</strong> en el espacio y <strong>el mes y la campaña</strong> en el tiempo. Así se combinan en el puntaje de cada rotación.
        </p>
        <div className="relative overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Tabla de armonización de datos: desplazá para ver todo">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Escala original de cada fuente y cómo se lleva al lote y al mes</caption>
            <thead className="bg-muted text-left"><tr><th scope="col" className="p-3">Fuente</th><th scope="col" className="p-3">Escala original</th><th scope="col" className="p-3">Cómo se lleva al lote y al mes</th></tr></thead>
            <tbody>
              {HARMONIZE.map((h) => (
                <tr key={h.name} className="border-t"><th scope="row" className="p-3 text-left font-medium">{h.name}</th><td className="whitespace-nowrap p-3">{h.native}</td><td className="p-3">{h.how}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Llevar un dato de 9 km o 50 km al lote no lo hace más preciso: por eso cada pantalla muestra la escala original y aclara cuándo un dato es de la zona y no de tu lote.
        </p>
      </section>

      <section aria-labelledby="papeles" className="space-y-3">
        <h2 id="papeles" className="text-2xl font-semibold">Qué aporta cada tipo de cultivo al suelo</h2>
        <p className="text-lg">Las rotaciones combinan cultivos con papeles distintos. Estos cuatro son los que más pesan en la salud del suelo a largo plazo:</p>
        <SoilRolesGuide />
      </section>

      <section aria-labelledby="enfoques" className="space-y-3">
        <h2 id="enfoques" className="text-2xl font-semibold">Tres enfoques</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <Card key={a.id}>
              <CardHeader><CardTitle className="text-lg"><span aria-hidden>{a.icon} </span>{a.title}</CardTitle><CardDescription>{a.text}</CardDescription></CardHeader>
              <CardContent><p className="text-sm">Pantallas: {a.pages.map((x) => x.label).join(", ")}.</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="perfiles" className="space-y-3">
        <h2 id="perfiles" className="text-2xl font-semibold">Fuentes según el perfil</h2>
        <p>
          NASA POWER se consulta en vivo (API pública, sin cuenta). Si no responde, se usa el último dato guardado y, si no hay, un
          archivo de NASA POWER descargado antes (campo1.csv, datos reales). En POWER, -999 significa “sin dato”. Siempre se muestra la
          fuente, la fecha de consulta y el tipo (modelado). El pronóstico es de Open-Meteo, que no es de la NASA: se aclara en pantalla.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2"><h3 className="font-semibold">🥬 Huerta</h3><SourceMap profile="huerta" /></div>
          <div className="min-w-0 space-y-2"><h3 className="font-semibold">🚜 Agricultor</h3><SourceMap profile="agricultor" /></div>
        </div>
      </section>

      <section aria-labelledby="umbrales" className="space-y-3">
        <h2 id="umbrales" className="text-2xl font-semibold">Cuándo se activa una alerta</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Helada:</strong> mínima pronosticada de 0 °C o menos (importante); de 0 a 2 °C, posible helada. Es la temperatura del aire a 2 m: en el suelo y en las hojas puede helar con 2 o 3 °C en el aire.</li>
          <li><strong>Calor fuerte:</strong> máxima de 35 °C o más; importante desde 38 °C o con 3 días seguidos.</li>
          <li><strong>Lluvia intensa:</strong> 30 mm o más en un día; importante desde 50 mm.</li>
          <li><strong>Viento:</strong> ráfagas de 60 km/h o más.</li>
          <li><strong>Falta de agua:</strong> menos de 5 mm de lluvia en los próximos 10 días con más de 30 mm de evaporación; importante si además el último mes llovió menos de la mitad de lo normal (NASA POWER).</li>
          <li><strong>Suelo seco:</strong> humedad de suelo SMAP 20 % o más por debajo de lo normal para la época.</li>
          <li><strong>Riego de la huerta:</strong> evaporación de referencia (ET0) de NASA POWER × 1,0 (huerta en producción) menos el 80 % de la lluvia. 1 mm = 1 litro por m².</li>
          <li><strong>Fechas de heladas:</strong> última helada de primavera que 8 de cada 10 años ya pasó, y primera de otoño que 8 de cada 10 años todavía no llegó (NASA POWER, 10 años).</li>
        </ul>
      </section>

      <section aria-labelledby="glosario" className="space-y-3">
        <h2 id="glosario" className="text-2xl font-semibold">Glosario sin vueltas</h2>
        <dl className="space-y-3">
          {GLOSSARY_KEYS.map((k) => (
            <div key={k} className="rounded-lg border p-3"><dt className="font-semibold">{GLOSSARY[k].term}</dt><dd className="text-muted-foreground">{GLOSSARY[k].long}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limites" className="space-y-3">
        <h2 id="limites" className="text-2xl font-semibold">Lo que todavía no sabemos</h2>
        <ul className="list-disc space-y-2 pl-6 text-lg">
          <li>El clima y los datos satelitales describen una zona, no tu lote.</li>
          <li>El ingreso es un índice relativo: no usa precios, costos ni fletes.</li>
          <li>Los atributos de los cultivos son provisorios y deben validarse con INTA y agrónomos locales.</li>
          <li>Sin conexión, o sin las credenciales de la NASA, la app usa datos simulados y lo avisa.</li>
          <li>Los escenarios son pruebas de sensibilidad, no pronósticos.</li>
          <li>La erosión se estima con el tiempo que el suelo queda sin cultivo y la época de viento; no hay datos de viento de tu lote.</li>
        </ul>
      </section>

      <section aria-labelledby="mas" className="space-y-2">
        <h2 id="mas" className="text-2xl font-semibold">Más detalle técnico</h2>
        <ul className="space-y-1">
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/scoring.md`} target="_blank" rel="noreferrer">Cómo se calcula cada puntaje <ExternalLink aria-hidden className="size-4" /></a></li>
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/satellite.md`} target="_blank" rel="noreferrer">SMAP y MODIS: productos, métricas y limitaciones <ExternalLink aria-hidden className="size-4" /></a></li>
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/assumptions.md`} target="_blank" rel="noreferrer">Todos los supuestos <ExternalLink aria-hidden className="size-4" /></a></li>
        </ul>
        <p><Link href="/campos" className="text-primary underline">Volver a elegir mi campo</Link></p>
      </section>
    </div>
  );
}
