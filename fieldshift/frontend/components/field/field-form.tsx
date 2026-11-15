"use client";

import { PROFILES, readProfile } from "@/lib/profile";

import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FieldMap } from "@/components/map/field-map-loader";
import { LocalitySearch } from "@/components/field/locality-search";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAsync } from "@/hooks/use-async";
import { api, describeError } from "@/lib/api";
import { num, SOIL_TEXTURES } from "@/lib/format";
import { fromBoundary, ringAreaHa, toBoundary, type LngLat } from "@/lib/geometry";
import type { Crop, FieldCreate, FieldOut, Level, SoilTexture } from "@/types/api";

interface FormState {
  name: string;
  farm_name: string;
  point: { lat: number; lon: number } | null;
  polygon: LngLat[] | null;
  area_ha: string;
  current_crop: string;
  previous: string[];
  texture: SoilTexture | "";
  depth: Level | "";
  organic_matter: Level | "";
  lab_analysis: boolean;
  drainage: Level | "";
  slope_pct: string;
  irrigated: boolean;
  budget: Level | "";
}

const MAX_PREVIOUS = 4;

/** Del campo guardado al formulario. `crop_history` incluye el cultivo actual como último elemento. */
export function toFormState(f: FieldOut | null): FormState {
  const history = f?.crop_history ?? [];
  const current = f?.current_crop ?? history.at(-1) ?? "";
  const previous = history.length && history.at(-1) === current ? history.slice(0, -1) : history;
  return {
    name: f?.name ?? "",
    farm_name: f?.farm_name ?? "",
    point: f ? { lat: f.location.lat, lon: f.location.lon } : null,
    polygon: fromBoundary(f?.boundary),
    area_ha: f ? String(f.area_ha) : "",
    current_crop: current,
    previous: previous.slice(-MAX_PREVIOUS),
    texture: (f?.soil_profile?.texture as SoilTexture | null | undefined) ?? "",
    depth: f?.soil_profile?.effective_depth ?? "",
    organic_matter: f?.soil_profile?.organic_matter ?? "",
    lab_analysis: f?.soil_profile?.lab_analysis ?? false,
    drainage: f?.drainage ?? "",
    slope_pct: f?.location.slope_pct != null ? String(f.location.slope_pct) : "",
    irrigated: f?.irrigated ?? false,
    budget: f?.budget ?? "",
  };
}

export type FormErrors = Partial<Record<"name" | "point" | "area_ha" | "slope_pct", string>>;

export function validate(s: FormState): FormErrors {
  const e: FormErrors = {};
  if (!s.name.trim()) e.name = "Poné un nombre para reconocer el campo.";
  if (!s.point) e.point = "Marcá la ubicación del campo en el mapa, buscá un lugar o ingresá las coordenadas.";
  const area = Number(s.area_ha.replace(",", "."));
  if (!s.area_ha.trim() || !Number.isFinite(area) || area <= 0) e.area_ha = "Ingresá la superficie en hectáreas (mayor que 0).";
  else if (area > 100_000) e.area_ha = "La superficie máxima es de 100.000 ha.";
  if (s.slope_pct.trim()) {
    const slope = Number(s.slope_pct.replace(",", "."));
    if (!Number.isFinite(slope) || slope < 0 || slope > 100) e.slope_pct = "La pendiente tiene que estar entre 0 y 100 %.";
  }
  return e;
}

/** Del formulario al pedido de la API. */
export function toFieldCreate(s: FormState): FieldCreate {
  const history = [...s.previous.filter(Boolean), ...(s.current_crop ? [s.current_crop] : [])];
  const hasSoil = s.texture || s.depth || s.organic_matter || s.lab_analysis;
  return {
    name: s.name.trim(),
    farm_name: s.farm_name.trim() || null,
    location: { lat: s.point!.lat, lon: s.point!.lon, slope_pct: s.slope_pct.trim() ? Number(s.slope_pct.replace(",", ".")) : null },
    area_ha: Number(s.area_ha.replace(",", ".")),
    irrigated: s.irrigated,
    soil_profile: hasSoil
      ? {
          texture: s.texture || null,
          effective_depth: s.depth || null,
          organic_matter: s.organic_matter || null,
          lab_analysis: s.lab_analysis,
          provenance: { label: s.lab_analysis ? "observado" : "estimado", confidence: s.lab_analysis ? "alta" : "baja", note: "Declarado por el productor." },
        }
      : null,
    current_crop: s.current_crop || null,
    crop_history: history,
    drainage: s.drainage || null,
    budget: s.budget || null,
    boundary: s.polygon ? toBoundary(s.polygon) : null,
  };
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

interface Props {
  mode: "create" | "edit";
  initial?: FieldOut | null;
  onSaved?: (field: FieldOut) => void;
}

export function FieldForm({ mode, initial = null, onSaved }: Props) {
  const router = useRouter();
  const uid = useId();
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const [s, setS] = useState<FormState>(() => toFormState(initial));
  const [areaTouched, setAreaTouched] = useState(Boolean(initial));
  const [attempted, setAttempted] = useState(false);
  // Después del primer intento de guardar, los errores se recalculan en cada cambio: desaparecen apenas se corrigen.
  const errors: FormErrors = useMemo(() => (attempted ? validate(s) : {}), [attempted, s]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const cropOptions = useMemo(() => [...(crops.data ?? [])].filter((c) => !c.is_cover_crop).sort((a, b) => a.name.localeCompare(b.name, "es")), [crops.data]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setS((p) => ({ ...p, [k]: v }));
  const id = (n: string) => `${uid}-${n}`;

  function onPolygon(ring: LngLat[] | null) {
    setS((p) => ({ ...p, polygon: ring, area_ha: ring && !areaTouched ? String(Math.round(ringAreaHa(ring) * 10) / 10) : p.area_ha }));
  }

  async function save(asNew: boolean) {
    const errs = validate(s);
    setAttempted(true);
    setSaveError(null);
    if (Object.keys(errs).length > 0) {
      document.getElementById(id(errs.name ? "name" : errs.point ? "map" : errs.area_ha ? "area" : "slope"))?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = toFieldCreate(s);
      const result = mode === "edit" && !asNew && initial ? await api.updateField(initial.id, body) : await api.createField(body);
      if (result.demo) setNotice("No hay conexión con el servidor: el campo se guardó solo en este navegador.");
      onSaved?.(result.data);
      router.push(PROFILES[readProfile() ?? "agricultor"].home(result.data.id));
      router.refresh();
    } catch (e) {
      setSaveError(describeError(e) + (mode === "edit" ? " Si estás sin conexión, usá “Guardar como campo nuevo”." : ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle as={mode === "create" ? "h2" : "h3"}>1. ¿Dónde está el campo?</CardTitle>
          <CardDescription>Buscá tu ciudad o pueblo, o marcá el punto en el mapa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocalitySearch
            id={id("localidad")}
            label="Buscá tu ciudad o pueblo"
            help="Es la forma más rápida. Después podés mover el punto en el mapa para afinarlo."
            onSelect={(loc) => {
              set("point", { lat: loc.lat, lon: loc.lon });
              if (!s.name.trim()) set("name", loc.nombre);
            }}
          />
          <p className="text-sm text-muted-foreground">O marcalo directamente en el mapa:</p>
          <div id={id("map")} tabIndex={-1}>
            <FieldMap
              mode="edit"
              point={s.point}
              polygon={s.polygon}
              onPointChange={(p) => set("point", p)}
              onPolygonChange={onPolygon}
            />
          </div>
          {errors.point && <p role="alert" className="text-sm font-medium text-destructive">{errors.point}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("name")} label="Nombre del campo" error={errors.name}>
              <Input id={id("name")} value={s.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy(id("name"), undefined, errors.name)} autoComplete="off" placeholder="Ej.: Lote Norte" />
            </Field>
            <Field id={id("farm")} label="Establecimiento (opcional)">
              <Input id={id("farm")} value={s.farm_name} onChange={(e) => set("farm_name", e.target.value)} autoComplete="off" placeholder="Ej.: La Esperanza" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as={mode === "create" ? "h2" : "h3"}>2. Tamaño y cultivos</CardTitle>
          <CardDescription>Si dibujaste el lote, la superficie se calcula sola (la podés corregir).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("area")} label="Superficie (hectáreas)" error={errors.area_ha} hint="Por ejemplo: 250">
              <Input id={id("area")} inputMode="decimal" value={s.area_ha} onChange={(e) => { setAreaTouched(true); set("area_ha", e.target.value); }} aria-invalid={Boolean(errors.area_ha)} aria-describedby={describedBy(id("area"), "x", errors.area_ha)} />
            </Field>
            <Field id={id("crop")} label="Cultivo actual" hint={crops.error ? "No se pudo cargar la lista de cultivos." : "El de esta campaña o el último que sembraste."}>
              {crops.loading && !crops.data ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <Select id={id("crop")} value={s.current_crop} onChange={(e) => set("current_crop", e.target.value)}>
                  <option value="">No lo sé / lote en barbecho</option>
                  {cropOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium">Rotación histórica</legend>
            <p className="text-sm text-muted-foreground">
              Cultivos de las campañas anteriores, de la más vieja a la más reciente. Con esto detectamos monocultivos y armamos tu rotación actual.
            </p>
            {s.previous.length === 0 && <p className="text-sm italic text-muted-foreground">Todavía no cargaste campañas anteriores.</p>}
            <ol className="space-y-2">
              {s.previous.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">Hace {s.previous.length - i + 0} campaña{s.previous.length - i > 1 ? "s" : ""}</span>
                  <Select aria-label={`Cultivo de hace ${s.previous.length - i} campaña${s.previous.length - i > 1 ? "s" : ""}`} value={c} onChange={(e) => set("previous", s.previous.map((p, j) => (j === i ? e.target.value : p)))}>
                    <option value="">Sin dato</option>
                    {cropOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </Select>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la campaña de hace ${s.previous.length - i}`} onClick={() => set("previous", s.previous.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" size="sm" disabled={s.previous.length >= MAX_PREVIOUS} onClick={() => set("previous", [...s.previous, ""])}>
              <Plus aria-hidden /> Agregar campaña anterior
            </Button>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as={mode === "create" ? "h2" : "h3"}>3. Suelo y manejo</CardTitle>
          <CardDescription>Todo es opcional, pero cuanto más completes, más confiable es el resultado. Si no sabés un dato, dejalo en blanco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("texture")} label="Tipo de suelo (textura)" hint="Sin este dato suponemos franco arenosa.">
              <Select id={id("texture")} value={s.texture} onChange={(e) => set("texture", e.target.value as SoilTexture | "")}>
                <option value="">No lo sé</option>
                {Object.entries(SOIL_TEXTURES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field id={id("depth")} label="Profundidad del suelo" hint="Cuánto pueden bajar las raíces.">
              <Select id={id("depth")} value={s.depth} onChange={(e) => set("depth", e.target.value as Level | "")}>
                <option value="">No lo sé</option>
                <option value="bajo">Somera (menos de ~60 cm)</option>
                <option value="medio">Media (~1 m)</option>
                <option value="alto">Profunda (más de ~1,4 m)</option>
              </Select>
            </Field>
            <Field id={id("om")} label="Materia orgánica (estimada)" hint="Los satélites no la miden: es tu estimación o un análisis.">
              <Select id={id("om")} value={s.organic_matter} onChange={(e) => set("organic_matter", e.target.value as Level | "")}>
                <option value="">No lo sé</option>
                <option value="bajo">Baja</option>
                <option value="medio">Media</option>
                <option value="alto">Alta</option>
              </Select>
            </Field>
            <Field id={id("drain")} label="Drenaje" hint="Todavía no influye en el puntaje: queda registrado.">
              <Select id={id("drain")} value={s.drainage} onChange={(e) => set("drainage", e.target.value as Level | "")}>
                <option value="">No lo sé</option>
                <option value="bajo">Lento: se anega</option>
                <option value="medio">Bueno</option>
                <option value="alto">Excesivo: el agua se va rápido</option>
              </Select>
            </Field>
            <Field id={id("slope")} label="Pendiente (%)" error={errors.slope_pct} hint="Una pendiente mayor aumenta el riesgo de erosión.">
              <Input id={id("slope")} inputMode="decimal" value={s.slope_pct} onChange={(e) => set("slope_pct", e.target.value)} aria-invalid={Boolean(errors.slope_pct)} aria-describedby={describedBy(id("slope"), "x", errors.slope_pct)} placeholder="Ej.: 1,5" />
            </Field>
            <Field id={id("budget")} label="Presupuesto para hacer cambios" hint="Todavía no influye en el puntaje: queda registrado.">
              <Select id={id("budget")} value={s.budget} onChange={(e) => set("budget", e.target.value as Level | "")}>
                <option value="">Prefiero no decirlo</option>
                <option value="bajo">Ajustado</option>
                <option value="medio">Medio</option>
                <option value="alto">Amplio</option>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor={id("irr")}>Tengo riego disponible</Label>
              <p className="text-sm text-muted-foreground">Con riego se cubre buena parte del déficit de agua, pero se descuenta el costo del agua aplicada.</p>
            </div>
            <Switch id={id("irr")} checked={s.irrigated} onCheckedChange={(v) => set("irrigated", v)} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor={id("lab")}>Tengo análisis de suelo de laboratorio</Label>
              <p className="text-sm text-muted-foreground">Sube la confianza del resultado.</p>
            </div>
            <Switch id={id("lab")} checked={s.lab_analysis} onCheckedChange={(v) => set("lab_analysis", v)} />
          </div>
        </CardContent>
      </Card>

      {saveError && <Alert tone="error" title="No se pudo guardar">{saveError}</Alert>}
      {notice && <Alert tone="warning">{notice}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          <Save aria-hidden /> {saving ? "Guardando…" : mode === "create" ? "Guardar y seguir" : "Guardar cambios"}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
            Guardar como campo nuevo
          </Button>
        )}
        {s.point && <span className="text-sm text-muted-foreground">Ubicación: {num(s.point.lat, 4)}, {num(s.point.lon, 4)}</span>}
      </div>
    </form>
  );
}
