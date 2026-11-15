"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LabelBadge } from "@/components/provenance/badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disclaimer } from "@/lib/content";
import { GLOSSARY, GLOSSARY_KEYS } from "@/lib/glossary";
import { COMPONENTS, COMPONENT_ORDER, ORIGIN_LABELS, aggregationNote } from "@/lib/format";
import { GROUPS, PRIORITY_META, type GroupKey } from "@/lib/priorities";
import { SourceMap } from "@/components/sources/source-map";
import { SoilRolesGuide } from "@/components/agronomy/soil-roles";
import { APPROACHES } from "@/lib/sources";
import type { DataLabel } from "@/types/api";
import { useT } from "@/components/i18n/lang-provider";
import { L, localize, type T } from "@/lib/i18n";


const HARMONIZE: { name: string; native: string; how: string }[] = localize([
  { name: L("NASA POWER (clima)", "NASA POWER (weather)"), native: L("~50 km · diario", "~50 km · daily"), how: L("Se suma o promedia por mes y por campaña (julio a junio). La ET₀ se calcula por día con FAO-56 y se suma por mes.", "Summed or averaged per month and per season (July to June). ET₀ is computed daily with FAO-56 and summed per month.") },
  { name: L("NASA SMAP L4 (zona de raíces)", "NASA SMAP L4 (root zone)"), native: L("9 km · cada 3 horas", "9 km · every 3 hours"), how: L("Promedio por mes y comparación con lo normal del mismo mes (anomalía).", "Monthly average compared with the normal for the same month (anomaly).") },
  { name: L("NASA SMAP L3 (superficie)", "NASA SMAP L3 (surface)"), native: L("9 km · diario", "9 km · daily"), how: L("Se muestra la última observación disponible, como contexto regional.", "The latest available observation is shown, as regional context.") },
  { name: "NASA MODIS NDVI", native: L("250 m · cada 16 días", "250 m · every 16 days"), how: L("Píxel del lote, resumido por mes y por campaña: cobertura, barbechos y biomasa.", "The plot's pixel, summarized per month and per season: cover, fallows and biomass.") },
  { name: "Landsat/Sentinel (HLS)", native: L("30 m · cada pocos días", "30 m · every few days"), how: L("Una grilla de 3 × 3 sectores dentro del lote para comparar zonas del mismo campo.", "A 3 × 3 grid of sectors inside the plot to compare areas of the same field.") },
  { name: "NASA ECOSTRESS", native: "70 m · irregular", how: L("Píxel del lote en verano: temperatura de la superficie y estrés hídrico.", "The plot's pixel in summer: land surface temperature and water stress.") },
  { name: L("NASA SRTM (relieve)", "NASA SRTM (terrain)"), native: L("30 m · año 2000", "30 m · year 2000"), how: L("Todos los píxeles dentro del lote, suavizados: pendiente media y de las zonas más inclinadas.", "All pixels inside the plot, smoothed: mean slope and slope of the steepest areas.") },
  { name: L("SoilGrids (suelo estimado)", "SoilGrids (estimated soil)"), native: "250 m", how: L("Punto del lote: textura y materia orgánica, solo si no cargaste tu análisis.", "A point in the plot: texture and organic matter, only if you did not enter your own test.") },
]);


const DOCS = "https://github.com/royluis1/Proyecto-nasa-space/blob/main/fieldshift/docs";

const SOURCES: { name: string; label: DataLabel; what: string; res: string; use: string; limits: string }[] = localize([
  {
    name: "NASA POWER",
    label: "modelado",
    what: L("Clima diario: lluvia, temperaturas, humedad del aire, viento y radiación.", "Daily weather: rain, temperatures, air humidity, wind and radiation."),
    res: L("Una celda de unos 50 km, todos los días desde 1981.", "A cell about 50 km wide, every day since 1981."),
    use: L("Lluvia, calor, heladas, años secos y la demanda de agua de la atmósfera (evapotranspiración).", "Rain, heat, frost, dry years and the atmosphere's water demand (evapotranspiration)."),
    limits: L("Describe la zona, no tu lote. Es un reanálisis: un modelo que combina observaciones. No reemplaza un pluviómetro propio.", "It describes the area, not your plot. It is a reanalysis: a model that combines observations. It does not replace your own rain gauge."),
  },
  {
    name: L("NASA SMAP (humedad del suelo)", "NASA SMAP (soil moisture)"),
    label: "modelado",
    what: L("Cuánta agua hay en el suelo. Usamos el producto de zona de raíces (hasta 1 m), que es modelado; el de la superficie (5 cm) se mide directamente.", "How much water is in the soil. We use the root-zone product (down to 1 m), which is modeled; the surface product (5 cm) is measured directly."),
    res: L("Píxeles de 9 km, datos cada 3 horas desde 2015.", "9 km pixels, data every 3 hours since 2015."),
    use: L("Si la humedad reciente está por debajo o por encima de lo normal, qué tan seguido hay sequías y el estrés hídrico relativo.", "Whether recent moisture is below or above normal, how often droughts happen and relative water stress."),
    limits: L("Un píxel de 9 km son unas 8.000 hectáreas: sirve como contexto de la zona, no como la humedad de tu lote.", "A 9 km pixel covers about 8,000 hectares: it is context for the area, not the moisture of your plot."),
  },
  {
    name: "NASA MODIS (NDVI)",
    label: "observado",
    what: L("El “verdor” de la vegetación visto desde el satélite.", "The “greenness” of vegetation seen from the satellite."),
    res: L("Píxeles de 250 m, un dato cada 16 días desde el año 2000.", "250 m pixels, one value every 16 days since 2000."),
    use: L("Cobertura vegetal, períodos de barbecho, tendencia de la biomasa y comparación entre campañas.", "Plant cover, fallow periods, biomass trend and comparison between seasons."),
    limits: L("En lotes de menos de unas 25 ha mezcla a los vecinos. Las nubes dejan huecos. Mide verdor, no materia orgánica del suelo.", "On plots smaller than about 25 ha it mixes in the neighbors. Clouds leave gaps. It measures greenness, not soil organic matter."),
  },
  {
    name: L("NASA SRTM (relieve)", "NASA SRTM (terrain)"),
    label: "observado",
    what: L("Altura del terreno medida por radar desde el transbordador espacial en el año 2000.", "Ground elevation measured by radar from the Space Shuttle in 2000."),
    res: L("Píxeles de 30 m. Se descarga con una cuenta de NASA Earthdata.", "30 m pixels. Downloaded with a NASA Earthdata account."),
    use: L("Pendiente del lote y riesgo de erosión por agua en el puntaje de suelo.", "Plot slope and water-erosion risk in the soil score."),
    limits: L("No ve cambios posteriores al 2000 ni microrrelieve; en montes puede medir la copa de los árboles.", "It does not see changes after 2000 or micro-relief; in woodland it may measure the tree canopy."),
  },
  {
    name: L("Open-Meteo (pronóstico, no es NASA)", "Open-Meteo (forecast, not NASA)"),
    label: "estimado",
    what: L("Pronóstico del tiempo de los próximos días: temperaturas, lluvia, viento y evaporación.", "Weather forecast for the coming days: temperatures, rain, wind and evaporation."),
    res: L("Celdas de 1 a 11 km según la zona, hasta 16 días.", "Cells of 1 to 11 km depending on the area, up to 16 days."),
    use: L("Lluvia futura, alertas de helada, calor y tormentas, y el riego de la semana.", "Upcoming rain, frost, heat and storm alerts, and the week's irrigation."),
    limits: L("Es un pronóstico: pierde precisión después de 3 a 5 días. No es un producto de la NASA.", "It is a forecast: it loses accuracy after 3 to 5 days. It is not a NASA product."),
  },
  {
    name: L("FAO (Kc, Ky, agua útil) y USDA (lluvia efectiva)", "FAO (Kc, Ky, available water) and USDA (effective rainfall)"),
    label: "estimado",
    what: L("Tablas y fórmulas publicadas para estimar cuánta agua necesita cada cultivo y cuánta de la lluvia aprovecha.", "Published tables and formulas to estimate how much water each crop needs and how much rain it can use."),
    res: L("No aplica.", "Not applicable."),
    use: L("Demanda de agua de cada cultivo, caída del rendimiento por falta de agua y reserva de agua del suelo según su textura.", "Each crop's water demand, yield loss from water shortage and soil water storage by texture."),
    limits: L("Son valores estándar: no consideran tu variedad, tu fecha de siembra ni tu manejo. Algunos valores hay que verificarlos contra las tablas originales.", "These are standard values: they do not account for your variety, planting date or management. Some values still need checking against the original tables."),
  },
  {
    name: L("Catálogo de cultivos de AgroOrbit", "AgroOrbit crop catalog"),
    label: "supuesto",
    what: L("Características de 16 cultivos y coberturas de San Luis: tolerancia a sequía y calor, raíces, aporte de materia orgánica, ingreso relativo, plagas.", "Traits of 16 crops and cover crops in San Luis: drought and heat tolerance, roots, organic matter input, relative income, pests."),
    res: L("No aplica.", "Not applicable."),
    use: L("Todo el puntaje de suelo, riesgo, ingreso y sostenibilidad.", "The entire soil, risk, income and sustainability score."),
    limits: L("Son categorías (bajo, medio, alto) cargadas de forma provisoria: hay que validarlas con INTA y con agrónomos de la zona.", "These are provisional categories (low, medium, high): they must be validated with INTA and local agronomists."),
  },
  {
    name: L("Lo que cargás vos", "What you enter"),
    label: "estimado",
    what: L("Tipo de suelo, profundidad, materia orgánica, pendiente, riego e historial de cultivos.", "Soil type, depth, organic matter, slope, irrigation and crop history."),
    res: L("Tu lote.", "Your plot."),
    use: L("Reserva de agua, erosión, antecesores y monocultivo.", "Water storage, erosion, previous crops and monoculture."),
    limits: L("Es tan bueno como lo que sepas del lote. Un análisis de suelo de laboratorio mejora mucho la confianza.", "It is only as good as what you know about the plot. A laboratory soil test greatly improves confidence."),
  },
]);


const THRESHOLDS = (t: T): [string, string][] => [
  [t("Helada", "Frost"), t("mínima pronosticada de 0 °C o menos (importante); de 0 a 2 °C, posible helada. Es la temperatura del aire a 2 m: en el suelo y en las hojas puede helar con 2 o 3 °C en el aire.", "forecast low of 0 °C or less (important); 0 to 2 °C, possible frost. This is air temperature at 2 m: the ground and leaves can freeze with 2 or 3 °C in the air.")],
  [t("Calor fuerte", "Strong heat"), t("máxima de 35 °C o más; importante desde 38 °C o con 3 días seguidos.", "high of 35 °C or more; important from 38 °C or with 3 days in a row.")],
  [t("Lluvia intensa", "Heavy rain"), t("30 mm o más en un día; importante desde 50 mm.", "30 mm or more in one day; important from 50 mm.")],
  [t("Viento", "Wind"), t("ráfagas de 60 km/h o más.", "gusts of 60 km/h or more.")],
  [t("Falta de agua", "Water shortage"), t("menos de 5 mm de lluvia en los próximos 10 días con más de 30 mm de evaporación; importante si además el último mes llovió menos de la mitad de lo normal (NASA POWER).", "less than 5 mm of rain in the next 10 days with more than 30 mm of evaporation; important if the last month also had less than half the normal rain (NASA POWER).")],
  [t("Suelo seco", "Dry soil"), t("humedad de suelo SMAP 20 % o más por debajo de lo normal para la época.", "SMAP soil moisture 20 % or more below normal for the season.")],
  [t("Riego de la huerta", "Garden irrigation"), t("evaporación de referencia (ET0) de NASA POWER × 1,0 (huerta en producción) menos el 80 % de la lluvia. 1 mm = 1 litro por m².", "NASA POWER reference evaporation (ET0) × 1.0 (producing garden) minus 80 % of the rain. 1 mm = 1 liter per m².")],
  [t("Fechas de heladas", "Frost dates"), t("última helada de primavera que 8 de cada 10 años ya pasó, y primera de otoño que 8 de cada 10 años todavía no llegó (NASA POWER, 10 años).", "the last spring frost that has already passed in 8 out of 10 years, and the first autumn frost that has not yet arrived in 8 out of 10 years (NASA POWER, 10 years).")],
];

export function MetodologiaView() {
  const t = useT();
  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader
        title={t("Metodología y fuentes", "Methodology and sources")}
        description={t("Cómo funciona AgroOrbit, de dónde salen los datos y qué todavía hay que validar.", "How AgroOrbit works, where the data comes from and what still needs validation.")}
      />

      <Alert tone="warning" title={t("Antes de leer", "Before you read")}><p>{disclaimer()}</p></Alert>

      <section aria-labelledby="que-hace" className="space-y-3">
        <h2 id="que-hace" className="text-2xl font-semibold">{t("Qué hace AgroOrbit", "What AgroOrbit does")}</h2>
        <ol className="list-decimal space-y-2 pl-6 text-lg">
          <li>{t("Toma el clima, la humedad del suelo y la vegetación de la zona de tu campo.", "It takes the weather, soil moisture and vegetation of your field's area.")}</li>
          <li>{t("Arma al menos tres rotaciones: tu rotación actual, una conservadora, una diversificada, una que ahorra agua, una que cuida el suelo, una de mayor ingreso y una mixta.", "It builds at least three rotations: your current one, a conservative one, a diversified one, a water-saving one, a soil-friendly one, a higher-income one and a mixed one.")}</li>
          <li>{t("Calcula mes por mes cuánta agua necesita cada rotación y cuánta tiene.", "It calculates month by month how much water each rotation needs and how much it has.")}</li>
          <li>{t("Le pone puntaje a cada una en cinco aspectos y los combina según lo que vos priorices.", "It scores each one on five aspects and combines them according to your priorities.")}</li>
          <li>{t("Te explica el resultado, los riesgos y qué conviene validar con un profesional.", "It explains the result, the risks and what to validate with a professional.")}</li>
        </ol>
      </section>

      <section aria-labelledby="puntaje" className="space-y-4">
        <h2 id="puntaje" className="text-2xl font-semibold">{t("Cómo se calcula el puntaje", "How the score is calculated")}</h2>
        <p className="text-lg">{t("Cada rotación recibe cinco puntajes de 0 a 100. El total es la suma de cada uno multiplicado por el peso que le diste:", "Each rotation gets five scores from 0 to 100. The total is the sum of each one multiplied by the weight you gave it:")}</p>
        <p className="rounded-lg bg-muted p-4 font-mono text-base">{t("Total = peso agua × A + peso suelo × S + peso riesgo × R + peso ingreso × I + peso sostenibilidad × E", "Total = water weight × A + soil weight × S + risk weight × R + income weight × I + sustainability weight × E")}</p>
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
        <p>{t("Cada puntaje suma y resta puntos por motivos concretos (por ejemplo, “monocultivo: −10” o “cobertura todo el año: +40”) y la pantalla de detalle de cada rotación muestra todos esos motivos.", "Each score adds and subtracts points for concrete reasons (for example, “monoculture: −10” or “year-round cover: +40”), and each rotation's detail screen lists all of them.")}</p>
        <p>{t(<>El <strong>rango probable</strong> es lo que podría variar el puntaje si llueve 15 % más o menos, y suma un margen según la confianza en los datos.</>, <>The <strong>likely range</strong> is how much the score could change if it rains 15 % more or less, plus a margin based on confidence in the data.</>)}</p>
      </section>

      <section aria-labelledby="prioridades" className="space-y-3">
        <h2 id="prioridades" className="text-2xl font-semibold">{t("Tus 11 prioridades y los 5 componentes", "Your 11 priorities and the 5 components")}</h2>
        <p>{aggregationNote()} {t("Estos son los grupos:", "These are the groups:")}</p>
        <ul className="space-y-2">
          {(Object.keys(GROUPS) as GroupKey[]).map((g) => (
            <li key={g} className="rounded-lg border p-3">
              <strong className="capitalize">{g === "water" ? t("Agua (A)", "Water (A)") : g === "soil" ? t("Suelo (S)", "Soil (S)") : g === "risk" ? t("Riesgo climático (R)", "Climate risk (R)") : g === "income" ? t("Ingreso (I)", "Income (I)") : t("Sostenibilidad (E)", "Sustainability (E)")}</strong>
              <span>: {GROUPS[g].map((k) => PRIORITY_META[k].label).join(", ")}.</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("“Producir forraje” y “reducir las plagas” todavía no tienen un puntaje propio: hoy suman a Ingreso y a Sostenibilidad respectivamente.", "“Produce forage” and “reduce pests” do not have their own score yet: today they add to Income and Sustainability respectively.")}</p>
      </section>

      <section aria-labelledby="etiquetas" className="space-y-3">
        <h2 id="etiquetas" className="text-2xl font-semibold">{t("Qué significa cada etiqueta", "What each label means")}</h2>
        <ul className="space-y-2">
          {(["observado", "modelado", "estimado", "supuesto"] as const).map((l) => (
            <li key={l} className="flex flex-wrap items-center gap-3"><LabelBadge label={l} />
              <span>{l === "observado" ? t("Lo midió un satélite o un instrumento.", "Measured by a satellite or an instrument.") : l === "modelado" ? t("Sale de un modelo que combina observaciones.", "Comes from a model that combines observations.") : l === "estimado" ? t("Lo calculó AgroOrbit a partir de otros datos.", "Calculated by AgroOrbit from other data.") : t("Es un valor asumido, sin dato medido: hay que validarlo.", "An assumed value with no measured data: it must be validated.")}</span>
            </li>
          ))}
        </ul>
        <p>{t("Además, cada bloque de datos indica su origen:", "Each data block also shows its origin:")} <Badge variant="cultivo">{ORIGIN_LABELS.live}</Badge> <Badge variant="agua">{ORIGIN_LABELS.cached}</Badge> <Badge variant="tierra">{ORIGIN_LABELS.sample}</Badge> <Badge variant="alerta">{ORIGIN_LABELS.demo}</Badge>. {t(<>Los de muestra y los de ejemplo son <strong>simulados</strong>: sirven para probar la app, no para decidir.</>, <>Sample and example data are <strong>simulated</strong>: they are for trying the app, not for making decisions.</>)}</p>
      </section>

      <section aria-labelledby="fuentes" className="space-y-4">
        <h2 id="fuentes" className="text-2xl font-semibold">{t("Fuentes de datos", "Data sources")}</h2>
        {SOURCES.map((s) => (
          <Card key={s.name}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-xl">{s.name}</CardTitle><LabelBadge label={s.label} /></div>
              <CardDescription>{s.what}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p><strong>{t("Resolución:", "Resolution:")}</strong> {s.res}</p>
              <p><strong>{t("Para qué lo usamos:", "What we use it for:")}</strong> {s.use}</p>
              <p><strong>{t("Límites:", "Limits:")}</strong> {s.limits}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="armonizar" className="space-y-3">
        <h2 id="armonizar" className="text-2xl font-semibold">{t("Cómo juntamos datos de distinta escala", "How we combine data at different scales")}</h2>
        <p className="text-lg">
          {t(
            <>Cada fuente mide a una escala distinta: de 30 m a 50 km, y de cada 3 horas a una sola vez. Para compararlas, todas se llevan a la misma unidad: <strong>el lote</strong> en el espacio y <strong>el mes y la campaña</strong> en el tiempo. Así se combinan en el puntaje de cada rotación.</>,
            <>Each source measures at a different scale: from 30 m to 50 km, and from every 3 hours to just once. To compare them, all are brought to the same unit: <strong>the plot</strong> in space and <strong>the month and season</strong> in time. That is how they combine in each rotation&apos;s score.</>,
          )}
        </p>
        <div className="relative overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label={t("Tabla de armonización de datos: desplazá para ver todo", "Data harmonization table: scroll to see everything")}>
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{t("Escala original de cada fuente y cómo se lleva al lote y al mes", "Original scale of each source and how it is brought to the plot and the month")}</caption>
            <thead className="bg-muted text-left"><tr><th scope="col" className="p-3">{t("Fuente", "Source")}</th><th scope="col" className="p-3">{t("Escala original", "Original scale")}</th><th scope="col" className="p-3">{t("Cómo se lleva al lote y al mes", "How it is brought to the plot and the month")}</th></tr></thead>
            <tbody>
              {HARMONIZE.map((h) => (
                <tr key={h.name} className="border-t"><th scope="row" className="p-3 text-left font-medium">{h.name}</th><td className="whitespace-nowrap p-3">{h.native}</td><td className="p-3">{h.how}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            "Llevar un dato de 9 km o 50 km al lote no lo hace más preciso: por eso cada pantalla muestra la escala original y aclara cuándo un dato es de la zona y no de tu lote.",
            "Bringing 9 km or 50 km data down to the plot does not make it more precise: that is why each screen shows the original scale and says when a value is for the area rather than your plot.",
          )}
        </p>
      </section>

      <section aria-labelledby="papeles" className="space-y-3">
        <h2 id="papeles" className="text-2xl font-semibold">{t("Qué aporta cada tipo de cultivo al suelo", "What each crop type contributes to the soil")}</h2>
        <p className="text-lg">{t("Las rotaciones combinan cultivos con papeles distintos. Estos cuatro son los que más pesan en la salud del suelo a largo plazo:", "Rotations combine crops with different roles. These four matter most for long-term soil health:")}</p>
        <SoilRolesGuide />
      </section>

      <section aria-labelledby="enfoques" className="space-y-3">
        <h2 id="enfoques" className="text-2xl font-semibold">{t("Tres enfoques", "Three approaches")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {APPROACHES.map((a) => (
            <Card key={a.id}>
              <CardHeader><CardTitle className="text-lg"><span aria-hidden>{a.icon} </span>{a.title}</CardTitle><CardDescription>{a.text}</CardDescription></CardHeader>
              <CardContent><p className="text-sm">{t("Pantallas", "Screens")}: {a.pages.map((x) => x.label).join(", ")}.</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="perfiles" className="space-y-3">
        <h2 id="perfiles" className="text-2xl font-semibold">{t("Fuentes según el perfil", "Sources by profile")}</h2>
        <p>
          {t(
            "NASA POWER se consulta en vivo (API pública, sin cuenta). Si no responde, se usa el último dato guardado y, si no hay, un archivo de NASA POWER descargado antes (campo1.csv, datos reales). En POWER, -999 significa “sin dato”. Siempre se muestra la fuente, la fecha de consulta y el tipo (modelado). El pronóstico es de Open-Meteo, que no es de la NASA: se aclara en pantalla.",
            "NASA POWER is queried live (public API, no account). If it does not respond, the last saved value is used and, failing that, a NASA POWER file downloaded earlier (campo1.csv, real data). In POWER, -999 means “no data”. The source, query date and type (modeled) are always shown. The forecast comes from Open-Meteo, which is not NASA: this is stated on screen.",
          )}
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2"><h3 className="font-semibold">🥬 {t("Huerta", "Garden")}</h3><SourceMap profile="huerta" /></div>
          <div className="min-w-0 space-y-2"><h3 className="font-semibold">🚜 {t("Agricultor", "Farmer")}</h3><SourceMap profile="agricultor" /></div>
        </div>
      </section>

      <section aria-labelledby="umbrales" className="space-y-3">
        <h2 id="umbrales" className="text-2xl font-semibold">{t("Cuándo se activa una alerta", "When an alert is triggered")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {THRESHOLDS(t).map(([k, v]) => (
            <li key={k}><strong>{k}:</strong> {v}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="glosario" className="space-y-3">
        <h2 id="glosario" className="text-2xl font-semibold">{t("Glosario sin vueltas", "Plain-language glossary")}</h2>
        <dl className="space-y-3">
          {GLOSSARY_KEYS.map((k) => (
            <div key={k} className="rounded-lg border p-3"><dt className="font-semibold">{GLOSSARY[k].term}</dt><dd className="text-muted-foreground">{GLOSSARY[k].long}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limites" className="space-y-3">
        <h2 id="limites" className="text-2xl font-semibold">{t("Lo que todavía no sabemos", "What we don't know yet")}</h2>
        <ul className="list-disc space-y-2 pl-6 text-lg">
          <li>{t("El clima y los datos satelitales describen una zona, no tu lote.", "Weather and satellite data describe an area, not your plot.")}</li>
          <li>{t("El ingreso es un índice relativo: no usa precios, costos ni fletes.", "Income is a relative index: it does not use prices, costs or freight.")}</li>
          <li>{t("Los atributos de los cultivos son provisorios y deben validarse con INTA y agrónomos locales.", "Crop traits are provisional and must be validated with INTA and local agronomists.")}</li>
          <li>{t("Sin conexión, o sin las credenciales de la NASA, la app usa datos simulados y lo avisa.", "Without a connection, or without NASA credentials, the app uses simulated data and says so.")}</li>
          <li>{t("Los escenarios son pruebas de sensibilidad, no pronósticos.", "Scenarios are sensitivity tests, not forecasts.")}</li>
          <li>{t("La erosión se estima con el tiempo que el suelo queda sin cultivo y la época de viento; no hay datos de viento de tu lote.", "Erosion is estimated from how long the soil stays without a crop and the windy season; there is no wind data for your plot.")}</li>
        </ul>
      </section>

      <section aria-labelledby="mas" className="space-y-2">
        <h2 id="mas" className="text-2xl font-semibold">{t("Más detalle técnico", "More technical detail")}</h2>
        <ul className="space-y-1">
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/scoring.md`} target="_blank" rel="noreferrer">{t("Cómo se calcula cada puntaje", "How each score is calculated")} <ExternalLink aria-hidden className="size-4" /></a></li>
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/satellite.md`} target="_blank" rel="noreferrer">{t("SMAP y MODIS: productos, métricas y limitaciones", "SMAP and MODIS: products, metrics and limitations")} <ExternalLink aria-hidden className="size-4" /></a></li>
          <li><a className="inline-flex items-center gap-1 text-primary underline" href={`${DOCS}/assumptions.md`} target="_blank" rel="noreferrer">{t("Todos los supuestos", "All assumptions")} <ExternalLink aria-hidden className="size-4" /></a></li>
        </ul>
        <p><Link href="/campos" className="text-primary underline">{t("Volver a elegir mi campo", "Back to choosing my field")}</Link></p>
      </section>
    </div>
  );
}
