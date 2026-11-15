import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, call, describeError, getBackendState, request, resetBackendState, retryConfig } from "@/lib/api";
import { setCurrentLang } from "@/lib/i18n";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const envelope = <T,>(data: T) => ({ data, meta: { data_status: "live", warnings: [], disclaimer: "x", origin_label: "DATO NASA EN VIVO" } });
const errorBody = (code: string, message: string, details?: unknown) => ({ error: { code, message, details, request_id: "abc" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  retryConfig.backoffMs = 0;
  resetBackendState();
});
afterEach(() => vi.unstubAllGlobals());

describe("cliente de la API", () => {
  it("devuelve los datos del servidor", async () => {
    fetchMock.mockResolvedValueOnce(json(envelope([{ id: "soja" }])));
    const r = await api.crops();
    expect(r.demo).toBe(false);
    expect(r.data).toEqual([{ id: "soja" }]);
    expect(getBackendState().demo).toBe(false);
  });

  it("manda el cuerpo como JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(envelope({ ok: true })));
    await request("/x", { method: "POST", body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", "Accept-Language": "es" });
    expect(init.body).toBe('{"a":1}');
  });

  it("pide los textos en el idioma elegido", async () => {
    setCurrentLang("en");
    try {
      fetchMock.mockResolvedValueOnce(json(envelope([])));
      await request("/x");
      expect(fetchMock.mock.calls[0][1].headers).toEqual({ "Accept-Language": "en" });
    } finally {
      setCurrentLang("es");
    }
  });

  it("reintenta ante un error 502 y termina bien", async () => {
    fetchMock.mockResolvedValueOnce(json(errorBody("UPSTREAM_ERROR", "falló"), 502)).mockResolvedValueOnce(json(envelope([])));
    const r = await api.crops();
    expect(r.demo).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta errores del pedido (404) ni usa datos de ejemplo", async () => {
    fetchMock.mockResolvedValue(json(errorBody("FIELD_NOT_FOUND", "No existe el lote 'x'."), 404));
    await expect(api.field("x")).rejects.toMatchObject({ status: 404, code: "FIELD_NOT_FOUND" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getBackendState().demo).toBe(false);
  });

  it("no reintenta ni cae a ejemplo cuando el servidor funciona pero no hay datos (503 NO_DATA_AVAILABLE)", async () => {
    fetchMock.mockResolvedValue(json(errorBody("NO_DATA_AVAILABLE", "Sin datos para este punto."), 503));
    await expect(api.climate({ field_id: "campo-este", start_date: "2016-01-01", end_date: "2025-12-31" })).rejects.toMatchObject({ code: "NO_DATA_AVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin conexión: reintenta y usa los datos de ejemplo, avisando", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await api.compare({ field_id: "campo-este" });
    expect(fetchMock).toHaveBeenCalledTimes(1 + retryConfig.retries);
    expect(r.demo).toBe(true);
    expect(r.meta.origin_label).toBe("DATOS DE EJEMPLO (SIN CONEXIÓN)");
    expect(r.meta.warnings[0]).toMatch(/MODO DEMOSTRACIÓN/);
    expect(r.data.evaluations.length).toBeGreaterThanOrEqual(3);
    expect(r.data.ranking).toHaveLength(r.data.evaluations.length);
    expect(getBackendState().demo).toBe(true);
  });

  it("cuando el servidor vuelve, el aviso de demostración se apaga", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await api.crops();
    expect(getBackendState().demo).toBe(true);
    fetchMock.mockReset().mockResolvedValue(json(envelope([])));
    await api.crops();
    expect(getBackendState().demo).toBe(false);
  });

  it("errores 500 del servidor también usan ejemplo", async () => {
    fetchMock.mockResolvedValue(json(errorBody("INTERNAL_ERROR", "boom"), 500));
    const r = await api.fields();
    expect(r.demo).toBe(true);
    expect(r.data.map((f) => f.id)).toEqual(expect.arrayContaining(["campo-este", "campo-centro", "campo-conlara"]));
  });

  it("devuelve datos de ejemplo para clima, humedad, vegetación y escenarios", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await api.climate({ field_id: "campo-centro", start_date: "2016-01-01", end_date: "2025-12-31" })).data.monthly_climatology).toHaveLength(12);
    expect((await api.soilMoisture({ field_id: "campo-centro" })).data.trace.status).toBe("sample");
    expect((await api.vegetation({ field_id: "campo-centro" })).data.campaigns.length).toBeGreaterThan(3);
    const sc = await api.scenarios("campo-centro", [{ id: "lluvia-20", name: "x", rain_delta_pct: -20 }]);
    expect(sc.data[0].scenario.id).toBe("lluvia-20");
    expect(sc.meta.warnings.join(" ")).toMatch(/modo demostración|MODO DEMOSTRACIÓN/i);
  });

  it("un campo que no existe como ejemplo da error claro, no datos de otro", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.field("campo-inexistente")).rejects.toMatchObject({ status: 404 });
  });

  it("al crear un campo sin conexión, se guarda localmente", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await api.createField({ name: "Mío", location: { lat: -33.7, lon: -65.4 }, area_ha: 50, irrigated: false, crop_history: [] });
    expect(r.demo).toBe(true);
    expect(r.data.id.startsWith("local-")).toBe(true);
  });

  it("guardar cambios sin conexión no inventa un éxito", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.updateField("campo-este", { name: "x", location: { lat: -33, lon: -65 }, area_ha: 1, irrigated: false, crop_history: [] })).rejects.toBeInstanceOf(ApiError);
  });

  it("cancelar un pedido no cuenta como error del servidor", async () => {
    const ctrl = new AbortController();
    fetchMock.mockImplementation((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("Abort", "AbortError")))));
    const p = request("/x", { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("call() sin alternativa deja pasar el error", async () => {
    await expect(call(() => Promise.reject(new ApiError("x", 0, "NETWORK")), null)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("mensajes de error para el productor", () => {
  it("sin red", () => expect(describeError(new ApiError("No se pudo conectar con el servidor de AgroOrbit.", 0, "NETWORK"))).toMatch(/Revisá tu conexión/));
  it("validación", () =>
    expect(describeError(new ApiError("inválido", 422, "VALIDATION_ERROR", [{ campo: "body.area_ha", mensaje: "Debe ser mayor que 0" }]))).toBe("Revisá los datos: body.area_ha: Debe ser mayor que 0"));
  it("error común", () => expect(describeError(new Error("hola"))).toBe("hola"));
  it("desconocido", () => expect(describeError(42)).toMatch(/inesperado/));
});
