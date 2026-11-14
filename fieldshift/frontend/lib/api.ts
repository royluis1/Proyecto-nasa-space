/**
 * Cliente de la API de FieldShift: tipado, con tiempo máximo, reintentos con espera creciente,
 * errores normalizados y paso automático a datos de ejemplo si el servidor no responde.
 */
import type {
  ApiEnvelope, ApiResult, ClimateSummary, ClimateSummaryRequest, CompareRequest, CompareResult, Crop, FieldCreate, FieldOut,
  ResponseMeta, ScenarioInput, ScenarioResult, SoilMoistureRequest, SoilMoistureSummary, VegetationRequest, VegetationSummary,
} from "@/types/api";
import { API_URL, DEMO_FALLBACK, REQUEST_TIMEOUT_MS } from "./config";
import * as demo from "./demo";
import { getLocalField, isLocalId, listLocalFields, newLocalId, saveLocalField } from "./local-fields";
import { DEMO_NOTICE } from "./content";
import { ORIGIN_LABELS } from "./format";

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
  method?: "GET" | "POST" | "PUT";
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
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as ApiEnvelope<T>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (opts.signal?.aborted) throw e; // cancelado por quien llamó: no es un error del servidor
    if (timedOut) throw new ApiError("El servidor tardó demasiado en responder.", 0, "TIMEOUT");
    throw new ApiError("No se pudo conectar con el servidor de FieldShift.", 0, "NETWORK");
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
  return new ApiError(e?.message ?? `El servidor respondió con un error (${res.status}).`, res.status, e?.code ?? `HTTP_${res.status}`, e?.details, e?.request_id);
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
    if (e.isNetwork) return `${e.message} Revisá tu conexión y volvé a intentar.`;
    if (e.code === "NO_DATA_AVAILABLE") return `${e.message}`;
    if (e.code === "VALIDATION_ERROR" && Array.isArray(e.details)) {
      const first = e.details[0] as { campo?: string; mensaje?: string } | undefined;
      return first?.mensaje ? `Revisá los datos: ${first.campo ? `${first.campo}: ` : ""}${first.mensaje}` : e.message;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
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

const demoMeta = (meta: ResponseMeta): ResponseMeta => ({ ...meta, origin_label: ORIGIN_LABELS.demo, warnings: meta.warnings.includes(DEMO_NOTICE) ? meta.warnings : [DEMO_NOTICE, ...meta.warnings] });

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
      if (!d) throw new ApiError("Ese campo no existe en este navegador.", 404, "FIELD_NOT_FOUND");
      return { ...d, demo: true };
    }
    return call(() => request<FieldOut>(`/fields/${encodeURIComponent(id)}`, o), async () => {
      const d = await demo.demoField(id);
      if (!d) throw new ApiError("No existe ese campo de ejemplo.", 404, "FIELD_NOT_FOUND");
      return d;
    });
  },

  /** Crea el campo en el servidor; si no responde, lo guarda en este navegador. */
  async createField(body: FieldCreate): Promise<ApiResult<FieldOut>> {
    return call(() => request<FieldOut>("/fields", { method: "POST", body, retries: 1 }), async () => {
      const field = { ...body, id: newLocalId(), current_rotation_id: null, sample_note: null } as FieldOut;
      saveLocalField(field);
      return { data: field, meta: { data_status: "sample", warnings: ["El campo se guardó solo en este navegador."], disclaimer: "" } };
    });
  },

  async updateField(id: string, body: FieldCreate): Promise<ApiResult<FieldOut>> {
    if (isLocalId(id)) {
      const field = { ...(getLocalField(id) as FieldOut), ...body, id } as FieldOut;
      saveLocalField(field);
      return { data: field, meta: { data_status: "sample", warnings: ["Cambios guardados solo en este navegador."], disclaimer: "" }, demo: true };
    }
    return call(() => request<FieldOut>(`/fields/${encodeURIComponent(id)}`, { method: "PUT", body, retries: 1 }), null);
  },

  async compare(req: CompareRequest, o: Opts = {}): Promise<ApiResult<CompareResult>> {
    const id = fieldIdOf(req);
    if (isLocalId(id)) return viaDemo(() => demo.demoCompare(id, req.scenario));
    return call(() => request<CompareResult>("/rotations/compare", { method: "POST", body: req, ...o }), () => demo.demoCompare(id, req.scenario));
  },

  async scenarios(fieldId: string, scenarios: ScenarioInput[], priorities?: CompareRequest["priorities"], o: Opts = {}): Promise<ApiResult<ScenarioResult[]>> {
    if (isLocalId(fieldId)) return viaDemo(() => demo.demoScenarios(fieldId, scenarios));
    return call(
      () => request<ScenarioResult[]>("/scenarios", { method: "POST", body: { field_id: fieldId, scenarios, priorities }, ...o }),
      () => demo.demoScenarios(fieldId, scenarios),
    );
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
