import { beforeEach, describe, expect, it, vi } from "vitest";
import { fechaLarga, groupByYear, sownSequence, validateRegistro } from "@/lib/historial";

const TODAY = new Date(2026, 10, 15);
const ok = { fecha: "2026-10-01", tipo: "siembra", cultivo: "Soja", nota: "" };

describe("formulario del historial", () => {
  it("un registro completo no tiene errores", () => {
    expect(validateRegistro(ok, TODAY)).toEqual({});
  });
  it("siembra y cosecha piden el cultivo", () => {
    expect(validateRegistro({ ...ok, cultivo: " " }, TODAY).cultivo).toMatch(/qué cultivo/);
    expect(validateRegistro({ ...ok, tipo: "riego", cultivo: "" }, TODAY)).toEqual({});
  });
  it("no acepta fechas futuras: el historial es de lo que ya pasó", () => {
    expect(validateRegistro({ ...ok, fecha: "2027-01-10" }, TODAY).fecha).toMatch(/futura/);
  });
  it("una nota vacía no es una nota", () => {
    expect(validateRegistro({ ...ok, tipo: "nota", cultivo: "", nota: "" }, TODAY).nota).toMatch(/Escribí/);
  });
  it("rechaza tipos que no existen", () => {
    expect(validateRegistro({ ...ok, tipo: "inventado" }, TODAY).tipo).toBeDefined();
  });
});

describe("línea de tiempo", () => {
  const rows = [
    { id: "a", fecha: "2024-11-10", tipo: "siembra", cultivo: "Soja" },
    { id: "b", fecha: "2025-12-01", tipo: "siembra", cultivo: "Maíz" },
    { id: "c", fecha: "2025-04-20", tipo: "cosecha", cultivo: "Soja" },
    { id: "d", fecha: "2025-06-15", tipo: "siembra", cultivo: "Vicia" },
  ];
  it("agrupa por año, del más reciente al más viejo", () => {
    expect(groupByYear(rows).map((g) => [g.year, g.rows.map((r) => r.id)])).toEqual([[2025, ["b", "d", "c"]], [2024, ["a"]]]);
  });
  it("la rotación real son las siembras en orden", () => {
    expect(sownSequence(rows)).toEqual(["Soja", "Vicia", "Maíz"]);
  });
  it("la fecha no se corre un día por la zona horaria", () => {
    expect(fechaLarga("2025-04-20")).toContain("20");
  });
});

/* --------- consultas a Supabase, con un cliente falso que registra cada llamada --------- */

type Call = [string, ...unknown[]];
const calls: Call[] = [];
let result: { data: unknown; error: unknown } = { data: null, error: null };

function chain(): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === "then") return (res: (v: unknown) => void) => res(result);
      return (...args: unknown[]) => { calls.push([prop, ...args]); return proxy; };
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}

const fake = {
  from: (t: string) => { calls.push(["from", t]); return chain(); },
  auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
};
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => fake, isSupabaseConfigured: true }));

describe("consultas a Supabase", () => {
  beforeEach(() => { calls.length = 0; result = { data: null, error: null }; });

  it("busca el lote del campo por datos->>field_id", async () => {
    const { findLoteByFieldId } = await import("@/lib/supabase/lotes");
    result = { data: [{ id: "lote-1" }], error: null };
    const l = await findLoteByFieldId("campo-este");
    expect(l).toEqual({ id: "lote-1" });
    expect(calls).toContainEqual(["from", "lotes"]);
    expect(calls).toContainEqual(["eq", "datos->>field_id", "campo-este"]);
  });

  it("si el campo no se guardó todavía devuelve null", async () => {
    const { findLoteByFieldId } = await import("@/lib/supabase/lotes");
    result = { data: [], error: null };
    expect(await findLoteByFieldId("campo-x")).toBeNull();
  });

  it("al agregar un registro pone el usuario logueado (lo exige la regla de seguridad)", async () => {
    const { addHistorial } = await import("@/lib/supabase/lotes");
    result = { data: { id: "h1" }, error: null };
    await addHistorial({ lote_id: "lote-1", fecha: "2026-10-01", tipo: "siembra", cultivo: "Soja" });
    const insert = calls.find((c) => c[0] === "insert");
    expect(insert?.[1]).toMatchObject({ lote_id: "lote-1", user_id: "user-1", tipo: "siembra" });
  });

  it("borra solo el registro pedido", async () => {
    const { deleteHistorial } = await import("@/lib/supabase/lotes");
    await deleteHistorial("h1");
    expect(calls).toContainEqual(["from", "lote_historial"]);
    expect(calls).toContainEqual(["eq", "id", "h1"]);
  });

  it("si Supabase devuelve un error, lo informa en vez de seguir callado", async () => {
    const { listHistorial } = await import("@/lib/supabase/lotes");
    result = { data: null, error: { message: "permission denied" } };
    await expect(listHistorial("lote-1")).rejects.toThrow(/permission denied/);
  });
});
