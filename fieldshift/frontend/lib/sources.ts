/** Qué fuente de datos se usa para qué, según el perfil, y en qué estado está cada una en FieldShift. */
import type { Profile } from "./profile";

export type SourceStatus = "integrado" | "proximamente";

export interface SourceUse {
  need: string;
  source: string;
  nasa: boolean;
  status: SourceStatus;
  note?: string;
}

export const SOURCE_MAP: Record<Profile, SourceUse[]> = {
  huerta: [
    { need: "Clima y heladas", source: "NASA POWER", nasa: true, status: "integrado" },
    { need: "Riego", source: "NASA POWER", nasa: true, status: "integrado", note: "Evaporación (ET0) y lluvia normal de la época" },
    { need: "Lluvia pasada", source: "NASA POWER", nasa: true, status: "integrado", note: "GPM/IMERG, próximamente" },
    { need: "Lluvia futura", source: "Open-Meteo", nasa: false, status: "integrado", note: "Se aclara en pantalla" },
    { need: "Vegetación de la zona", source: "MODIS (Landsat próximamente)", nasa: true, status: "integrado" },
    { need: "Calor de la zona (extra)", source: "ECOSTRESS", nasa: true, status: "integrado", note: "Temperatura de la superficie, 70 m" },
  ],
  agricultor: [
    { need: "Clima y heladas", source: "NASA POWER", nasa: true, status: "integrado" },
    { need: "Balance de agua (demanda del cultivo)", source: "NASA POWER", nasa: true, status: "integrado" },
    { need: "Lluvia pasada y eventos extremos", source: "GPM/IMERG", nasa: true, status: "proximamente", note: "Mientras tanto, lluvia de NASA POWER" },
    { need: "Lluvia futura", source: "Open-Meteo", nasa: false, status: "integrado", note: "Se aclara en pantalla" },
    { need: "Vigor, barbechos y suelo desnudo por sector del lote", source: "Landsat (HLS, 30 m)", nasa: true, status: "integrado", note: "9 sectores del lote, vía AppEEARS" },
    { need: "Historial largo de vegetación y años secos", source: "MODIS", nasa: true, status: "integrado" },
    { need: "Humedad del suelo", source: "SMAP", nasa: true, status: "integrado" },
    { need: "Calor y estrés de la zona (extra)", source: "ECOSTRESS", nasa: true, status: "integrado", note: "Temperatura de la superficie y estrés evaporativo, 70 m" },
    { need: "Relieve y riesgo de erosión", source: "SRTM", nasa: true, status: "integrado" },
  ],
};

/** Los tres enfoques de FieldShift y dónde está cada uno en la app. */
export const APPROACHES = [
  {
    id: "riesgo",
    icon: "🎲",
    title: "Simulador de riesgo",
    text: "Qué pasa con cada rotación si llueve menos, hace más calor o cambia el riego.",
    pages: [{ slug: "escenarios", label: "Escenarios" }, { slug: "comparador", label: "Comparador" }, { slug: "dashboard", label: "Dashboard" }],
  },
  {
    id: "suelo",
    icon: "🌱",
    title: "Sostenibilidad y salud del suelo",
    text: "Cobertura, barbechos, pendiente y erosión: cuánto cuida el suelo cada rotación.",
    pages: [{ slug: "diagnostico", label: "Diagnóstico" }, { slug: "calendario", label: "Calendario" }],
  },
  {
    id: "alerta",
    icon: "🚨",
    title: "Diagnóstico y alerta temprana",
    text: "Heladas, calor, lluvias fuertes y falta de agua de los próximos días, con qué hacer.",
    pages: [{ slug: "alertas", label: "Alertas" }],
  },
] as const;
