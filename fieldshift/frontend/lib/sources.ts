/** Qué fuente de datos se usa para qué, según el perfil, y en qué estado está cada una en AgroOrbit. */
import type { Profile } from "./profile";
import { L, localize } from "./i18n";

export type SourceStatus = "integrado" | "proximamente";

export interface SourceUse {
  need: string;
  source: string;
  nasa: boolean;
  status: SourceStatus;
  note?: string;
}

export const SOURCE_MAP: Record<Profile, SourceUse[]> = localize({
  huerta: [
    { need: L("Clima y heladas", "Weather and frost"), source: "NASA POWER", nasa: true, status: "integrado" },
    { need: L("Riego", "Irrigation"), source: "NASA POWER", nasa: true, status: "integrado", note: L("Evaporación (ET0) y lluvia normal de la época", "Evaporation (ET0) and normal rainfall for the season") },
    { need: L("Lluvia pasada", "Past rainfall"), source: "NASA POWER", nasa: true, status: "integrado", note: L("GPM/IMERG, próximamente", "GPM/IMERG, coming soon") },
    { need: L("Lluvia futura", "Upcoming rainfall"), source: "Open-Meteo", nasa: false, status: "integrado", note: L("Se aclara en pantalla", "Labeled on screen") },
    { need: L("Vegetación de la zona", "Vegetation in the area"), source: L("MODIS (Landsat próximamente)", "MODIS (Landsat coming soon)"), nasa: true, status: "integrado" },
    { need: L("Calor de la zona (extra)", "Heat in the area (extra)"), source: "ECOSTRESS", nasa: true, status: "integrado", note: L("Temperatura de la superficie, 70 m", "Land surface temperature, 70 m") },
  ],
  agricultor: [
    { need: L("Clima y heladas", "Weather and frost"), source: "NASA POWER", nasa: true, status: "integrado" },
    { need: L("Balance de agua (demanda del cultivo)", "Water balance (crop demand)"), source: "NASA POWER", nasa: true, status: "integrado" },
    { need: L("Lluvia pasada y eventos extremos", "Past rainfall and extreme events"), source: "GPM/IMERG", nasa: true, status: "proximamente", note: L("Mientras tanto, lluvia de NASA POWER", "Meanwhile, rainfall from NASA POWER") },
    { need: L("Lluvia futura", "Upcoming rainfall"), source: "Open-Meteo", nasa: false, status: "integrado", note: L("Se aclara en pantalla", "Labeled on screen") },
    { need: L("Vigor, barbechos y suelo desnudo por sector del lote", "Vigor, fallows and bare soil per plot sector"), source: "Landsat (HLS, 30 m)", nasa: true, status: "integrado", note: L("9 sectores del lote, vía AppEEARS", "9 plot sectors, via AppEEARS") },
    { need: L("Historial largo de vegetación y años secos", "Long vegetation record and dry years"), source: "MODIS", nasa: true, status: "integrado" },
    { need: L("Humedad del suelo", "Soil moisture"), source: "SMAP", nasa: true, status: "integrado" },
    { need: L("Calor y estrés de la zona (extra)", "Heat and stress in the area (extra)"), source: "ECOSTRESS", nasa: true, status: "integrado", note: L("Temperatura de la superficie y estrés evaporativo, 70 m", "Land surface temperature and evaporative stress, 70 m") },
    { need: L("Relieve y riesgo de erosión", "Terrain and erosion risk"), source: "SRTM", nasa: true, status: "integrado" },
  ],
});

/** Los tres enfoques de AgroOrbit y dónde está cada uno en la app. */
export const APPROACHES = localize([
  {
    id: "riesgo",
    icon: "🎲",
    title: L("Simulador de riesgo", "Risk simulator"),
    text: L("Qué pasa con cada rotación si llueve menos, hace más calor o cambia el riego.", "What happens to each rotation if it rains less, gets hotter or irrigation changes."),
    pages: [{ slug: "escenarios", label: L("Escenarios", "Scenarios") }, { slug: "comparador", label: L("Comparador", "Comparison") }, { slug: "dashboard", label: L("Dashboard", "Dashboard") }],
  },
  {
    id: "suelo",
    icon: "🌱",
    title: L("Sostenibilidad y salud del suelo", "Sustainability and soil health"),
    text: L("Cobertura, barbechos, pendiente y erosión: cuánto cuida el suelo cada rotación.", "Cover, fallows, slope and erosion: how well each rotation protects the soil."),
    pages: [{ slug: "diagnostico", label: L("Diagnóstico", "Diagnosis") }, { slug: "calendario", label: L("Calendario", "Calendar") }],
  },
  {
    id: "alerta",
    icon: "🚨",
    title: L("Diagnóstico y alerta temprana", "Diagnosis and early warning"),
    text: L("Heladas, calor, lluvias fuertes y falta de agua de los próximos días, con qué hacer.", "Frost, heat, heavy rain and water shortage in the coming days, with what to do."),
    pages: [{ slug: "alertas", label: L("Alertas", "Alerts") }],
  },
]);
