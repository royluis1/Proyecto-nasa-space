/**
 * Cliente de la API de AgroOrbit: tipado, con tiempo máximo, reintentos con espera creciente,
 * errores normalizados y paso automático a datos de ejemplo si el servidor no responde.
 */
import type {
  AlertsResult,
  ApiEnvelope,
  ApiResult,
  CalendarRequest,
  CalendarTimeline,
  ClimateSummary,
  ClimateSummaryRequest,
  CompareRequest,
  CompareResult,
  Crop,
  FieldCreate,
  FieldHeatStress,
  FieldOut,
  FieldSectors,
  FieldSoilMoisture,
  HuertaPanel,
  LocalitySearch,
  NearestLocality,
  ProvincesOut,
  ResponseMeta,
  ScenarioInput,
  ScenarioResult,
  PointSoilEstimate,
  SoilMoistureRequest,
  SoilMoistureSummary,
  TerrainRequest,
  TerrainSummary,
  VegetationRequest,
  VegetationSummary,
  ZoneAt,
  ZoneSuitability,
  ZonesOut,
} from "@/types/api";
import { API_URL, DEMO_FALLBACK, REQUEST_TIMEOUT_MS } from "./config";
import * as demo from "./demo";
import { enrichAlerts, enrichHuerta, withBrowserForecast } from "./live-forecast";
import { toRequest } from "./scenarios";
import { deleteLocalField, getLocalField, isLocalId, listLocalFields, newLocalId, saveLocalField } from "./local-fields";
import { demoNotice } from "./content";
import { ORIGIN_LABELS } from "./format";
import { currentLang, tr } from "./i18n";

/* ------------------------------ errores ------------------------------ */

export class ApiError extends Error {
  constructor(
    message: string,
    /** Código HTTP; 0 = no hubo respuesta (sin red, tiempo agotado). */
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
    readonly requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isNetwork() {
    return this.status === 0;
  }
  /** Vale la pena reintentar: fallas de red o del servidor, no errores del pedido ni falta de datos. */
  get retryable() {
    if (this.status === 0 || this.status === 429 || this.status === 502 || this.status === 504) return true;
    return this.status === 503 && this.code !== "NO_DATA_AVAILABLE";
  }
}

export const retryConfig = { retries: 2, backoffMs: 500 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  retries?: number;
  timeoutMs?: number;
}

async function once<T>(path: string, opts: RequestOptions): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      // Accept-Language es un encabezado "simple": no agrega una consulta previa de CORS.
      headers: opts.body === undefined ? { "Accept-Language": currentLang() } : { "Content-Type": "application/json", "Accept-Language": currentLang() },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as ApiEnvelope<T>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (opts.signal?.aborted) throw e; // cancelado por quien llamó: no es un error del servidor
    if (timedOut) throw new ApiError(tr("El servidor tardó demasiado en responder.", "The server took too long to respond."), 0, "TIMEOUT");
    throw new ApiError(tr("No se pudo conectar con el servidor de AgroOrbit.", "Could not connect to the AgroOrbit server."), 0, "NETWORK");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown; request_id?: string } } | undefined;
  try {
    body = await res.json();
  } catch {
    /* respuesta sin JSON (por ejemplo, un proxy) */
  }
  const e = body?.error;
  return new ApiError(e?.message ?? tr(`El servidor respondió con un error (${res.status}).`, `The server returned an error (${res.status}).`), res.status, e?.code ?? `HTTP_${res.status}`, e?.details, e?.request_id);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const retries = opts.retries ?? retryConfig.retries;
  for (let attempt = 0; ; attempt++) {
    try {
      return await once<T>(path, opts);
    } catch (e) {
      if (!(e instanceof ApiError) || !e.retryable || attempt >= retries || opts.signal?.aborted) throw e;
      await sleep(retryConfig.backoffMs * 2 ** attempt);
    }
  }
}

/** Mensaje claro para el productor (sin códigos ni rastros técnicos). */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return `${e.message} ${tr("Revisá tu conexión y volvé a intentar.", "Check your connection and try again.")}`;
    if (e.code === "NO_DATA_AVAILABLE") return `${e.message}`;
    if (e.code === "VALIDATION_ERROR" && Array.isArray(e.details)) {
      const first = e.details[0] as { campo?: string; mensaje?: string } | undefined;
      return first?.mensaje ? `${tr("Revisá los datos", "Check the data")}: ${first.campo ? `${first.campo}: ` : ""}${first.mensaje}` : e.message;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : tr("Ocurrió un error inesperado.", "An unexpected error occurred.");
}

/* ------------------------ estado del servidor ------------------------ */

interface BackendState {
  demo: boolean;
  lastError: string | null;
}
let backendState: BackendState = { demo: false, lastError: null };
const listeners = new Set<() => void>();
const setBackend = (next: BackendState) => {
  if (next.demo === backendState.demo && next.lastError === backendState.lastError) return;
  backendState = next;
  listeners.forEach((l) => l());
};
export const getBackendState = () => backendState;
export const subscribeBackend = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const resetBackendState = () => setBackend({ demo: false, lastError: null });

const shouldFallback = (e: unknown): boolean =>
  DEMO_FALLBACK && e instanceof ApiError && (e.status === 0 || (e.status >= 500 && e.code !== "NO_DATA_AVAILABLE"));

const demoMeta = (meta: ResponseMeta): ResponseMeta => ({ ...meta, origin_label: ORIGIN_LABELS.demo, warnings: meta.warnings.includes(demoNotice()) ? meta.warnings : [demoNotice(), ...meta.warnings] });

/** Llama al servidor; si no responde, usa los datos de ejemplo (con aviso). */
export async function call<T>(real: () => Promise<ApiEnvelope<T>>, fallback: (() => Promise<ApiEnvelope<T>>) | null): Promise<ApiResult<T>> {
  try {
    const r = await real();
    setBackend({ demo: false, lastError: null });
    return { ...r, demo: false };
  } catch (e) {
    if (fallback && shouldFallback(e)) {
      const d = await fallback();
      setBackend({ demo: true, lastError: (e as ApiError).message });
      return { data: d.data, meta: demoMeta(d.meta), demo: true };
    }
    throw e;
  }
}

/** Los campos guardados solo en el navegador no existen en el servidor: se resuelven siempre con datos de ejemplo. */
async function viaDemo<T>(fn: () => Promise<ApiEnvelope<T>>): Promise<ApiResult<T>> {
  const d = await fn();
  return { data: d.data, meta: demoMeta(d.meta), demo: true };
}

/* ------------------------------ endpoints ------------------------------ */

type Opts = { signal?: AbortSignal };
const fieldIdOf = (req: { field_id?: string | null }) => req.field_id ?? "";

export const api = {
  health: (o: Opts = {}) => request<{ status: string }>("/health", { ...o, retries: 0, timeoutMs: 5000 }),

  async crops(o: Opts = {}): Promise<ApiResult<Crop[]>> {
    return call(() => request<Crop[]>("/crops", o), demo.demoCrops);
  },

  async fields(o: Opts = {}): Promise<ApiResult<FieldOut[]>> {
    const r = await call(() => request<FieldOut[]>("/fields", o), demo.demoFields);
    const local = listLocalFields().filter((f) => !r.data.some((x) => x.id === f.id));
    return { ...r, data: [...r.data, ...local] };
  },

  async field(id: string, o: Opts = {}): Promise<ApiResult<FieldOut>> {
    if (isLocalId(id)) {
      const d = await demo.demoField(id);
      if (!d) throw new ApiError(tr("Ese campo no existe en este navegador.", "That field does not exist in this browser."), 404, "FIELD_NOT_FOUND");
      return { ...d, demo: true };
    }
    return call(() => request<FieldOut>(`/fields/${encodeURIComponent(id)}`, o), async () => {
      const d = await demo.demoField(id);
      if (!d) throw new ApiError(tr("No existe ese campo de ejemplo.", "That example field does not exist."), 404, "FIELD_NOT_FOUND");
      return d;
    });
  },

  /** Crea el campo en el servidor; si no responde, lo guarda en este navegador. */
  async createField(body: FieldCreate): Promise<ApiResult<FieldOut>> {
    return call(() => request<FieldOut>("/fields", { method: "POST", body, retries: 1 }), async () => {
      const field = { ...body, id: newLocalId(), current_rotation_id: null, sample_note: null } as FieldOut;
      saveLocalField(field);
      return { data: field, meta: { data_status: "sample", warnings: [tr("El campo se guardó solo en este navegador.", "The field was saved only in this browser.")], disclaimer: "" } };
    });
  },

  async updateField(id: string, body: FieldCreate): Promise<ApiResult<FieldOut>> {
    if (isLocalId(id)) {
      const field = { ...(getLocalField(id) as FieldOut), ...body, id } as FieldOut;
      saveLocalField(field);
      return { data: field, meta: { data_status: "sample", warnings: [tr("Cambios guardados solo en este navegador.", "Changes saved only in this browser.")], disclaimer: "" }, demo: true };
    }
    return call(() => request<FieldOut>(`/fields/${encodeURIComponent(id)}`, { method: "PUT", body, retries: 1 }), null);
  },

  /**
   * Borra un campo. Los guardados en este navegador se borran acá; los del servidor, en el servidor.
   * Los de ejemplo no se borran (el servidor responde 409): la pantalla los oculta solo en este navegador.
   */
  async deleteField(id: string): Promise<void> {
    if (isLocalId(id)) {
      deleteLocalField(id);
      return;
    }
    await request<{ id: string; deleted: boolean }>(`/fields/${encodeURIComponent(id)}`, { method: "DELETE", retries: 0 });
  },

  async compare(req: CompareRequest, o: Opts = {}): Promise<ApiResult<CompareResult>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoCompare(id, req.scenario));
    return call(() => request<CompareResult>("/rotations/compare", { method: "POST", body: req, ...o }), () => demo.demoCompare(id, req.scenario));
  },

  async scenarios(fieldId: string, scenarios: ScenarioInput[], priorities?: CompareRequest["priorities"], o: Opts = {}): Promise<ApiResult<ScenarioResult[]>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoScenarios(fieldId, scenarios));
    return call(
      () => request<ScenarioResult[]>("/scenarios", { method: "POST", body: { field_id: fieldId, scenarios: scenarios.map(toRequest), priorities }, ...o }),
      () => demo.demoScenarios(fieldId, scenarios),
    );
  },

  async calendar(req: CalendarRequest, o: Opts = {}): Promise<ApiResult<CalendarTimeline>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoCalendar(id, req));
    const body = { ...req, scenario: req.scenario ? toRequest(req.scenario) : null };
    return call(() => request<CalendarTimeline>("/calendar", { method: "POST", body, ...o }), () => demo.demoCalendar(id, req));
  },

  /** Panel de huerta. Si no trae pronóstico, se completa con Open-Meteo desde el navegador. */
  async huerta(fieldId: string, o: Opts = {}): Promise<ApiResult<HuertaPanel>> {
    const r = isLocalId(fieldId)
      ? await viaDemo(() => demo.demoHuerta(fieldId))
      : await call(() => request<HuertaPanel>("/huerta", { method: "POST", body: { field_id: fieldId }, ...o }), () => demo.demoHuerta(fieldId));
    return withBrowserForecast(r, enrichHuerta);
  },

  /** Alertas tempranas. Si no traen pronóstico, se completan con Open-Meteo desde el navegador. */
  async alerts(fieldId: string, profile: "huerta" | "agricultor", o: Opts = {}): Promise<ApiResult<AlertsResult>> {
    const r = isLocalId(fieldId)
      ? await viaDemo(() => demo.demoAlerts(fieldId, profile))
      : await call(
          () => request<AlertsResult>("/alerts", { method: "POST", body: { field_id: fieldId, profile }, ...o }),
          () => demo.demoAlerts(fieldId, profile),
        );
    return withBrowserForecast(r, enrichAlerts);
  },

  async provinces(o: Opts = {}): Promise<ApiResult<ProvincesOut>> {
    return call(() => request<ProvincesOut>("/regions/provinces", o), demo.demoProvinces);
  },

  async zones(provinceId: string, o: Opts = {}): Promise<ApiResult<ZonesOut>> {
    return call(() => request<ZonesOut>(`/regions/${encodeURIComponent(provinceId)}/zones`, o), () => demo.demoZones(provinceId));
  },

  async suitability(zoneId: string, o: Opts = {}): Promise<ApiResult<ZoneSuitability>> {
    return call(() => request<ZoneSuitability>(`/crops/suitability?zone_id=${encodeURIComponent(zoneId)}`, o), () => demo.demoSuitability(zoneId));
  },

  /** Zona, transición y cultivos más aptos en la ubicación del campo. */
  async zoneAt(fieldId: string, lat: number, lon: number, o: Opts = {}): Promise<ApiResult<ZoneAt>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoZoneAt(fieldId));
    return call(() => request<ZoneAt>(`/zones/at?lat=${lat}&lon=${lon}`, o), () => demo.demoZoneAt(fieldId));
  },

  /**
   * Suelo ESTIMADO de un punto (SoilGrids), para completar el formulario antes de guardar.
   * Sin backend lanza error: el formulario sigue funcionando y el suelo queda para cargar a mano.
   */
  async soilEstimate(lat: number, lon: number, o: Opts = {}): Promise<ApiEnvelope<PointSoilEstimate>> {
    return request<PointSoilEstimate>(`/soil/estimate?lat=${lat}&lon=${lon}`, { ...o, retries: 0, timeoutMs: 100_000 }); // SoilGrids tarda de 5 a 45 s por consulta, y puede hacer falta una segunda (alrededores)
  },

  /** Busca ciudades y pueblos por nombre (IGN). Sin backend lanza error: el buscador lo muestra. */
  async searchLocalities(q: string, o: Opts = {}): Promise<LocalitySearch> {
    return (await request<LocalitySearch>(`/localidades?q=${encodeURIComponent(q)}&limit=8`, { ...o, retries: 0 })).data;
  },

  /** Ciudad o pueblo más cercano a un punto, para decir dónde está el campo o la huerta. */
  async nearestLocality(lat: number, lon: number, o: Opts = {}): Promise<NearestLocality> {
    return (await request<NearestLocality>(`/localidades/cerca?lat=${lat}&lon=${lon}`, { ...o, retries: 0 })).data;
  },

  async fieldSectors(fieldId: string, o: Opts = {}): Promise<ApiResult<FieldSectors>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoSectors(fieldId));
    return call(() => request<FieldSectors>(`/fields/${encodeURIComponent(fieldId)}/sectors`, o), () => demo.demoSectors(fieldId));
  },

  async fieldHeatStress(fieldId: string, o: Opts = {}): Promise<ApiResult<FieldHeatStress>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoHeatStress(fieldId));
    return call(() => request<FieldHeatStress>(`/fields/${encodeURIComponent(fieldId)}/heat-stress`, o), () => demo.demoHeatStress(fieldId));
  },

  async fieldSoilMoisture(fieldId: string, o: Opts = {}): Promise<ApiResult<FieldSoilMoisture>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoFieldSoilMoisture(fieldId));
    return call(
      () => request<FieldSoilMoisture>(`/fields/${encodeURIComponent(fieldId)}/soil-moisture`, o),
      () => demo.demoFieldSoilMoisture(fieldId),
    );
  },

  async terrain(req: TerrainRequest, o: Opts = {}): Promise<ApiResult<TerrainSummary>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoTerrain(id));
    return call(() => request<TerrainSummary>("/terrain", { method: "POST", body: req, ...o }), () => demo.demoTerrain(id));
  },

  async climate(req: ClimateSummaryRequest, o: Opts = {}): Promise<ApiResult<ClimateSummary>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoClimate(id));
    return call(() => request<ClimateSummary>("/climate-summary", { method: "POST", body: req, ...o }), () => demo.demoClimate(id));
  },

  async soilMoisture(req: SoilMoistureRequest, o: Opts = {}): Promise<ApiResult<SoilMoistureSummary>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoSoilMoisture(id));
    return call(() => request<SoilMoistureSummary>("/soil-moisture", { method: "POST", body: req, ...o }), () => demo.demoSoilMoisture(id));
  },

  async vegetation(req: VegetationRequest, o: Opts = {}): Promise<ApiResult<VegetationSummary>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoVegetation(id));
    return call(() => request<VegetationSummary>("/vegetation-index", { method: "POST", body: req, ...o }), () => demo.demoVegetation(id));
  },
};
