import type { ScenarioInput } from "@/types/api";

/** Escenarios predefinidos (los mismos que usa el modo demostración). Son pruebas de sensibilidad, no pronósticos. */
export const PRESET_SCENARIOS: (ScenarioInput & { help: string })[] = [
  { id: "base", name: "Clima del período", rain_delta_pct: 0, temp_delta_c: 0, dry_year: false, irrigation: false, help: "El clima promedio de los últimos 10 años." },
  { id: "seco-20", name: "Lluvia -20 %", rain_delta_pct: -20, temp_delta_c: 0, dry_year: false, irrigation: false, help: "Un período en el que llueve una quinta parte menos." },
  { id: "calor-2", name: "+2 °C", rain_delta_pct: 0, temp_delta_c: 2, dry_year: false, irrigation: false, help: "Más calor: los cultivos necesitan más agua y hay más días de calor extremo." },
  { id: "seco-20-calor-2", name: "Lluvia -20 % y +2 °C", rain_delta_pct: -20, temp_delta_c: 2, dry_year: false, irrigation: false, help: "Menos lluvia y más calor a la vez." },
  { id: "anio-seco", name: "Año más seco observado", rain_delta_pct: 0, temp_delta_c: 0, dry_year: true, irrigation: false, help: "Repite el año más seco de los últimos 10." },
  { id: "con-riego", name: "Con riego", rain_delta_pct: 0, temp_delta_c: 0, dry_year: false, irrigation: true, help: "Como si el lote tuviera riego." },
];

export const CUSTOM_ID = "personalizado";

export interface CustomScenario {
  rain: number;
  temp: number;
  dry: boolean;
  irrigation: boolean;
}

export function customScenario(c: CustomScenario): ScenarioInput {
  const parts = [
    c.rain !== 0 ? `lluvia ${c.rain > 0 ? "+" : ""}${c.rain} %` : null,
    c.temp > 0 ? `+${String(c.temp).replace(".", ",")} °C` : null,
    c.dry ? "año seco" : null,
    c.irrigation ? "con riego" : null,
  ].filter(Boolean);
  return { id: CUSTOM_ID, name: parts.length ? `Mi escenario: ${parts.join(", ")}` : "Mi escenario", rain_delta_pct: c.rain, temp_delta_c: c.temp, dry_year: c.dry, irrigation: c.irrigation };
}
