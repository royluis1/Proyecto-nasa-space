"use client";

import { PROFILES, readProfile } from "@/lib/profile";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudSun, ExternalLink, FlaskConical, Layers, Loader2, Paperclip, Plus, Satellite, Save, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FieldMap } from "@/components/map/field-map-loader";
import { LocalityLine } from "@/components/field/locality-line";
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
import { applySoilEstimate, initialSoilAuto, nameAfterLocality, soilForSave, usableEstimate, type SoilAutoFlags } from "@/lib/field-sync";
import { num, SOIL_TEXTURES } from "@/lib/format";
import { fromBoundary, ringAreaHa, ringCentroid, toBoundary, type LngLat } from "@/lib/geometry";
import { cn } from "@/lib/utils";
import type { Crop, FieldCreate, FieldOut, Level, SoilEstimate, SoilTexture } from "@/types/api";

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
  /** Qué casillas de suelo completó la estimación (no las cargó el productor). */
  soilAuto: SoilAutoFlags;
  /** Último nombre puesto automáticamente desde la ciudad (para que la siga mientras no se escriba otro). */
  autoName: string | null;
}

const MAX_PREVIOUS = 4;
/** Si la ciudad elegida queda a más de esto del lote dibujado, el dibujo era de otro lugar y se borra. */
const POLYGON_RESET_KM = 5;
/** Tiempo que se ve la confirmación antes de ir al campo. */
const REDIRECT_MS = 2400;

const OM_WORD: Record<Level, string> = { bajo: "baja", medio: "media", alto: "alta" };

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
    soilAuto: initialSoilAuto(f?.auto_profile?.soil_applied),
    autoName: null,
  };
}

export type FormErrors = Partial<Record<"name" | "point" | "area_ha" | "slope_pct", string>>;

export function validate(s: FormState): FormErrors {
  const e: FormErrors = {};
  if (!s.name.trim()) e.name = "Poné un nombre para reconocer el campo.";
  if (!s.point) e.point = "Marcá la ubicación del campo: buscá tu ciudad o pueblo, tocá el mapa o ingresá las coordenadas.";
  const area = Number(s.area_ha.replace(",", "."));
  if (!s.area_ha.trim() || !Number.isFinite(area) || area <= 0) e.area_ha = "Ingresá la superficie en hectáreas (mayor que 0).";
  else if (area > 100_000) e.area_ha = "La superficie máxima es de 100.000 ha.";
  if (s.slope_pct.trim()) {
    const slope = Number(s.slope_pct.replace(",", "."));
    if (!Number.isFinite(slope) || slope < 0 || slope > 100) e.slope_pct = "La pendiente tiene que estar entre 0 y 100 %.";
  }
  return e;
}

/**
 * Del formulario al pedido de la API. Lo que completó la estimación de suelo y nadie tocó se manda vacío:
 * el backend lo vuelve a completar con la misma estimación, rotulada como "estimado (SoilGrids)".
 */
export function toFieldCreate(form: FormState): FieldCreate {
  const s = soilForSave(form, form.soilAuto);
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
          provenance: {
            label: s.lab_analysis ? "observado" : "estimado",
            confidence: s.lab_analysis ? "alta" : "baja",
            note: s.lab_analysis ? "Análisis de laboratorio declarado por el productor." : "Declarado por el productor.",
          },
        }
      : null,
    current_crop: s.current_crop || null,
    crop_history: history,
    drainage: s.drainage || null,
    budget: s.budget || null,
    boundary: s.polygon ? toBoundary(s.polygon) : null,
  };
}

/** Distancia aproximada en km (alcanza para decidir si un dibujo quedó lejos). */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dlat = (b.lat - a.lat) * 111.32;
  const dlon = (b.lon - a.lon) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dlat, dlon);
}

function Field({ id, label, hint, error, badge, children }: { id: string; label: string; hint?: string; error?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {badge}
      </div>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

/** Marca de las casillas completadas con la estimación. */
const EstimatedTag = () => (
  <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky">Estimado automáticamente</span>
);

/* ------------------------------ suelo estimado del punto ------------------------------ */

type SoilLookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; estimate: SoilEstimate | null; distanceKm: number; note: string | null }
  | { status: "error"; message: string };

function SoilEstimateBox({ lookup, hasPoint, lab }: { lookup: SoilLookup; hasPoint: boolean; lab: boolean }) {
  const box = "rounded-xl border p-4 text-sm";
  let body: React.ReactNode;
  if (!hasPoint) {
    body = <p>Elegí la ubicación del campo (paso 1) y el suelo se completa solo con la estimación de ese punto.</p>;
  } else if (lookup.status === "loading" || lookup.status === "idle") {
    body = (
      <p className="flex items-center gap-2">
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
        <span>Buscando el suelo de este punto… El mapa de suelos puede tardar más de un minuto: mientras tanto podés seguir completando y guardar.</span>
      </p>
    );
  } else if (lookup.status === "error") {
    body = <p>No pudimos estimar el suelo ahora ({lookup.message}). Podés cargarlo a mano.</p>;
  } else if (!lookup.estimate) {
    body = <p>No hay una estimación de suelo para este punto (puede ser agua, zona urbana o un lugar sin datos). Si lo sabés, cargalo vos.</p>;
  } else if (!usableEstimate(lookup.estimate)) {
    body = (
      <p>
        No pudimos consultar el mapa de suelos en este momento. <strong>No completamos el suelo con datos de muestra</strong>: cargalo vos si lo
        sabés, o volvé a intentar más tarde.
      </p>
    );
  } else {
    const e = lookup.estimate;
    body = (
      <div className="space-y-1.5">
        <p className="text-base">
          Suelo estimado de este punto: <strong>{e.texture ? SOIL_TEXTURES[e.texture] : (e.texture_usda ?? "sin textura")}</strong>
          {e.organic_matter && (
            <>, materia orgánica <strong>{OM_WORD[e.organic_matter]}</strong>{e.organic_matter_pct != null && <> (~{num(e.organic_matter_pct, 1)} %)</>}</>
          )}
          .
        </p>
        {e.clay_pct != null && (
          <p className="text-muted-foreground">Arcilla {num(e.clay_pct)} %, arena {num(e.sand_pct)} %, limo {num(e.silt_pct)} %.</p>
        )}
        {lookup.distanceKm > 0 && (
          <p className="font-medium">
            Ojo: es el suelo de los alrededores, a unos {num(lookup.distanceKm)} km, porque en el punto elegido no hay suelo agrícola (por ejemplo, el
            centro del pueblo). Mové el punto a tu campo para afinarlo.
          </p>
        )}
        <p className="text-muted-foreground">
          Fuente: {e.source} · {e.depth} · píxel de {e.resolution} · {e.origin_label}. Es una estimación de un mapa de suelos, no un análisis.
        </p>
        {lab && <p className="font-medium">Tenés análisis de laboratorio: usamos tus valores y no esta estimación.</p>}
      </div>
    );
  }
  return (
    <div aria-live="polite" className={cn(box, lookup.status === "done" && usableEstimate(lookup.estimate) ? "border-sky/40 bg-sky-soft/50" : "bg-muted/40")}>
      {body}
    </div>
  );
}

/* ------------------------------ confirmación al guardar ------------------------------ */

type SaveProgress = { phase: "saving"; name: string } | { phase: "done"; field: FieldOut; demo: boolean; href: string };

type StepState = "pending" | "ok" | "info";

function stepsOf(p: SaveProgress): { icon: LucideIcon; label: string; state: StepState; detail: string }[] {
  if (p.phase === "saving") {
    return [
      { icon: Save, label: "Guardando el campo", state: "pending", detail: "…" },
      { icon: Layers, label: "Suelo estimado (SoilGrids)", state: "pending", detail: "…" },
      { icon: CloudSun, label: "Zona climática (NASA POWER)", state: "pending", detail: "…" },
    ];
  }
  const ap = p.field.auto_profile;
  const soilOrigin = ap?.soil_estimate?.origin;
  return [
    { icon: Save, label: "Campo guardado", state: "ok", detail: p.demo ? "En este navegador" : "Listo" },
    {
      icon: Layers,
      label: "Suelo estimado (SoilGrids)",
      state: soilOrigin === "live" || soilOrigin === "cached" ? "ok" : "info",
      detail: soilOrigin === "live" || soilOrigin === "cached" ? "Listo" : soilOrigin === "sample" ? "Dato de muestra" : "Sin dato",
    },
    {
      icon: CloudSun,
      label: "Zona climática (NASA POWER)",
      state: ap?.zone?.zone ? "ok" : "info",
      detail: ap?.zone?.zone ? "Listo" : "Sin zonificación",
    },
  ];
}

function SaveOverlay({ progress }: { progress: SaveProgress }) {
  const done = progress.phase === "done";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const goRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    (done ? goRef.current : headingRef.current)?.focus();
  }, [done]);
  const name = done ? progress.field.name : progress.name;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="guardado-titulo">
      <div className="w-full max-w-sm animate-rise text-center">
        <div className="relative mx-auto size-24">
          {done ? (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 aria-hidden className="size-14" />
            </span>
          ) : (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30" />
              <span className="absolute inset-0 animate-orbit">
                <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-sky shadow-soft" />
              </span>
              <span className="absolute inset-5 grid place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                <Satellite aria-hidden className="size-6" />
              </span>
            </>
          )}
        </div>
        <h2 id="guardado-titulo" ref={headingRef} tabIndex={-1} className="mt-6 font-display text-lg font-semibold outline-none">
          {done ? <>¡Listo! Guardamos «{name}»</> : "Guardando tu campo y consultando datos satelitales…"}
        </h2>
        <ul className="mt-5 space-y-2 text-left" aria-live="polite">
          {stepsOf(progress).map(({ icon: Icon, label, state, detail }) => (
            <li key={label} className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm", state === "pending" && "opacity-60")}>
              <Icon aria-hidden className="size-4 text-primary" />
              <span className="flex-1">{label}</span>
              <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", state === "ok" ? "text-success" : "text-muted-foreground")}>
                {state === "ok" && <CheckCircle2 aria-hidden className="size-3.5" />}
                {detail}
              </span>
            </li>
          ))}
        </ul>
        {done && (
          <div className="mt-6 space-y-2">
            <Button asChild size="lg" className="w-full">
              <Link ref={goRef} href={progress.href}>Ir a mi campo</Link>
            </Button>
            <p className="text-sm text-muted-foreground">Te llevamos en un momento…</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ formulario ------------------------------ */

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
  // true mientras la superficie sea la calculada con el lote dibujado (si se escribe otra, deja de serlo)
  const [areaFromDrawing, setAreaFromDrawing] = useState(false);
  // Archivo del análisis de laboratorio: queda a mano en esta página (todavía no se sube al servidor).
  const [labFile, setLabFile] = useState<{ name: string; size: number; url: string } | null>(null);
  const [labFileMsg, setLabFileMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);
  // Después del primer intento de guardar, los errores se recalculan en cada cambio: desaparecen apenas se corrigen.
  const errors: FormErrors = useMemo(() => (attempted ? validate(s) : {}), [attempted, s]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [clearPlace, setClearPlace] = useState(0);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const [soil, setSoil] = useState<SoilLookup>({ status: "idle" });

  const cropOptions = useMemo(() => [...(crops.data ?? [])].filter((c) => !c.is_cover_crop).sort((a, b) => a.name.localeCompare(b.name, "es")), [crops.data]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setSavedAt(null);
    setS((p) => ({ ...p, [k]: v }));
  };
  const id = (n: string) => `${uid}-${n}`;

  // Suelo estimado del punto: se busca cada vez que cambia la ubicación (con una pausa, por si se mueve varias veces).
  const lat = s.point?.lat;
  const lon = s.point?.lon;
  useEffect(() => {
    if (lat == null || lon == null) return;
    const ctrl = new AbortController();
    setSoil({ status: "loading" });
    const t = setTimeout(async () => {
      try {
        const r = await api.soilEstimate(lat, lon, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setSoil({ status: "done", estimate: r.data.estimate, distanceKm: r.data.distance_km, note: r.data.note ?? null });
        // Completa solo lo vacío o lo que ya era automático; lo del productor no se toca.
        setS((p) => {
          const res = applySoilEstimate(p, p.soilAuto, r.data.estimate);
          return { ...res.state, soilAuto: res.auto };
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setSoil({ status: "error", message: describeError(e) });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [lat, lon]);

  // Después de guardar un campo nuevo, se ve la confirmación y se va solo al campo.
  useEffect(() => {
    if (progress?.phase !== "done") return;
    const t = setTimeout(() => router.push(progress.href), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [progress, router]);

  /** Lote dibujado: la superficie se completa sola con lo dibujado (se puede corregir a mano). */
  function onPolygon(ring: LngLat[] | null) {
    setSavedAt(null);
    setAreaFromDrawing(Boolean(ring));
    setS((p) => ({ ...p, polygon: ring, area_ha: ring ? String(Math.round(ringAreaHa(ring) * 10) / 10) : p.area_ha }));
  }

  // El enlace temporal del archivo se libera al cambiarlo o al salir.
  useEffect(() => () => {
    if (labFile) URL.revokeObjectURL(labFile.url);
  }, [labFile]);

  function onLabFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setLabFileMsg("El archivo es muy grande (máximo 15 MB).");
      return;
    }
    setLabFileMsg(null);
    setLabFile({ name: file.name, size: file.size, url: URL.createObjectURL(file) });
  }

  /** Ciudad elegida en el buscador: se mueven el punto, el mapa y las coordenadas, y el nombre la acompaña. */
  function onLocality(loc: { nombre: string; lat: number; lon: number; label: string }) {
    setSavedAt(null);
    const nm = nameAfterLocality(s.name, s.autoName, loc.nombre);
    // Si había un lote dibujado lejos de la ciudad nueva, era de otro lugar: se borra (y se avisa).
    const far = Boolean(s.polygon && distanceKm(ringCentroid(s.polygon), loc) > POLYGON_RESET_KM);
    setS((p) => ({ ...p, point: { lat: loc.lat, lon: loc.lon }, polygon: far ? null : p.polygon, name: nm.name, autoName: nm.auto }));
    setPlaceNote(far ? "Borramos el lote que habías dibujado porque estaba en otro lugar. Dibujalo de nuevo si querés." : null);
  }

  /** Punto movido desde el mapa (clic, arrastre o coordenadas): el nombre de ciudad escrito ya no corresponde. */
  function onMapPoint(p: { lat: number; lon: number }) {
    setSavedAt(null);
    setPlaceNote(null);
    setClearPlace((n) => n + 1);
    setS((prev) => ({ ...prev, point: p }));
  }

  function onSoilChange<K extends "texture" | "organic_matter">(k: K, v: FormState[K]) {
    setSavedAt(null);
    setS((p) => ({ ...p, [k]: v, soilAuto: { ...p.soilAuto, [k]: false } }));
  }

  function onLab(v: boolean) {
    setSavedAt(null);
    setS((p) => {
      if (v) {
        // Con análisis de laboratorio la estimación no se usa: se vacía lo automático para cargar los valores propios.
        return {
          ...p,
          lab_analysis: true,
          texture: p.soilAuto.texture ? "" : p.texture,
          organic_matter: p.soilAuto.organic_matter ? "" : p.organic_matter,
          soilAuto: { texture: false, organic_matter: false },
        };
      }
      const next = { ...p, lab_analysis: false };
      const res = applySoilEstimate(next, next.soilAuto, soil.status === "done" ? soil.estimate : null);
      return { ...res.state, soilAuto: res.auto };
    });
  }

  async function save(asNew: boolean) {
    const errs = validate(s);
    setAttempted(true);
    setSaveError(null);
    if (Object.keys(errs).length > 0) {
      document.getElementById(id(errs.name ? "name" : errs.point ? "map" : errs.area_ha ? "area" : "slope"))?.focus();
      return;
    }
    const creating = mode === "create" || asNew;
    setSaving(true);
    if (creating) setProgress({ phase: "saving", name: s.name.trim() });
    try {
      const body = toFieldCreate(s);
      const result = !creating && initial ? await api.updateField(initial.id, body) : await api.createField(body);
      onSaved?.(result.data);
      if (creating) {
        setProgress({ phase: "done", field: result.data, demo: result.demo, href: PROFILES[readProfile() ?? "agricultor"].home(result.data.id) });
      } else {
        setSavedAt(new Date());
      }
    } catch (e) {
      setProgress(null);
      setSaveError(describeError(e) + (mode === "edit" ? " Si estás sin conexión, usá “Guardar como campo nuevo”." : ""));
    } finally {
      setSaving(false);
    }
  }

  const h = mode === "create" ? "h2" : "h3";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      className="space-y-6"
    >
      {/* 1. Ubicación */}
      <Card>
        <CardHeader>
          <CardTitle as={h}>1. ¿Dónde está el campo?</CardTitle>
          <CardDescription>Buscá tu ciudad o pueblo: el mapa, las coordenadas, el nombre y el suelo se completan solos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocalitySearch
            id={id("localidad")}
            label="Buscá tu ciudad o pueblo"
            help="Es la forma más rápida. Después podés mover el punto en el mapa para afinarlo."
            onSelect={onLocality}
            clearSignal={clearPlace}
          />
          <p className="text-sm text-muted-foreground">O tocá el mapa donde está el campo:</p>
          <div id={id("map")} tabIndex={-1}>
            <FieldMap mode="edit" point={s.point} polygon={s.polygon} onPointChange={onMapPoint} onPolygonChange={onPolygon} showPlaceSearch={false} />
          </div>
          {s.point && <LocalityLine lat={s.point.lat} lon={s.point.lon} live prefix="Ubicación elegida: " className="text-base font-medium text-foreground" />}
          {s.polygon && (
            <p aria-live="polite" className="text-base">
              Lote dibujado: <strong>{num(ringAreaHa(s.polygon), 1)} ha</strong>. La superficie se completó sola en el paso 3.
            </p>
          )}
          {placeNote && <p role="status" className="text-sm text-muted-foreground">{placeNote}</p>}
          {errors.point && <p role="alert" className="text-sm font-medium text-destructive">{errors.point}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("name")} label="Nombre del campo" error={errors.name} hint={s.autoName && s.name === s.autoName ? "Lo tomamos de la ciudad: cambialo si querés." : undefined}>
              <Input
                id={id("name")} value={s.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)}
                aria-describedby={describedBy(id("name"), s.autoName && s.name === s.autoName ? "x" : undefined, errors.name)} autoComplete="off" placeholder="Ej.: Lote Norte"
              />
            </Field>
            <Field id={id("farm")} label="Establecimiento (opcional)">
              <Input id={id("farm")} value={s.farm_name} onChange={(e) => set("farm_name", e.target.value)} autoComplete="off" placeholder="Ej.: La Esperanza" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 2. Análisis de suelo */}
      <Card>
        <CardHeader>
          <CardTitle as={h} className="flex items-center gap-2"><FlaskConical aria-hidden className="size-5 text-primary" /> 2. Análisis de suelo</CardTitle>
          <CardDescription>Se completa solo con el suelo estimado del punto. Si tenés un análisis de laboratorio, marcalo y cargá tus valores: siempre ganan los tuyos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={id("lab")}>Tengo análisis de suelo de laboratorio</Label>
                <p className="text-sm text-muted-foreground">Sube la confianza del resultado y reemplaza a la estimación.</p>
              </div>
              <Switch id={id("lab")} checked={s.lab_analysis} onCheckedChange={onLab} />
            </div>
            {s.lab_analysis && (
              <div className="space-y-2 border-t pt-3">
                <input
                  ref={fileRef} id={id("labfile")} type="file" className="sr-only" tabIndex={-1} aria-hidden
                  accept=".pdf,.jpg,.jpeg,.png,.csv,.xls,.xlsx" onChange={onLabFile}
                />
                {labFile ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    <Paperclip aria-hidden className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate font-medium">{labFile.name}</span>
                    <span className="text-muted-foreground">{labFile.size >= 1024 * 1024 ? `${num(labFile.size / 1024 / 1024, 1)} MB` : `${num(Math.max(1, labFile.size / 1024))} KB`}</span>
                    <Button asChild size="sm" variant="outline">
                      <a href={labFile.url} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden /> Ver
                      </a>
                    </Button>
                    <Button type="button" size="sm" variant="ghost" aria-label={`Quitar el archivo ${labFile.name}`} onClick={() => setLabFile(null)}>
                      <X aria-hidden /> Quitar
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip aria-hidden /> Agregar archivo
                  </Button>
                )}
                {labFileMsg && <p role="alert" className="text-sm text-destructive">{labFileMsg}</p>}
                <p className="text-sm text-muted-foreground">
                  PDF, foto o planilla del análisis. Queda a mano para consultarlo mientras cargás los valores de abajo: todavía no se guarda en el
                  servidor.
                </p>
              </div>
            )}
          </div>
          <SoilEstimateBox lookup={soil} hasPoint={Boolean(s.point)} lab={s.lab_analysis} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={id("texture")} label="Tipo de suelo (textura)"
              badge={s.soilAuto.texture ? <EstimatedTag /> : undefined}
              hint={s.soilAuto.texture ? "Viene de la estimación: cambiala si sabés el dato real." : "Sin este dato suponemos franco arenosa."}
            >
              <Select id={id("texture")} value={s.texture} onChange={(e) => onSoilChange("texture", e.target.value as SoilTexture | "")} aria-describedby={describedBy(id("texture"), "x")}>
                <option value="">No lo sé</option>
                {Object.entries(SOIL_TEXTURES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field
              id={id("om")} label="Materia orgánica"
              badge={s.soilAuto.organic_matter ? <EstimatedTag /> : undefined}
              hint={s.soilAuto.organic_matter ? "Viene de la estimación: cambiala si tenés el análisis." : "Los satélites no la miden: es tu estimación o un análisis."}
            >
              <Select id={id("om")} value={s.organic_matter} onChange={(e) => onSoilChange("organic_matter", e.target.value as Level | "")} aria-describedby={describedBy(id("om"), "x")}>
                <option value="">No lo sé</option>
                <option value="bajo">Baja</option>
                <option value="medio">Media</option>
                <option value="alto">Alta</option>
              </Select>
            </Field>
            <Field id={id("depth")} label="Profundidad del suelo" hint="Cuánto pueden bajar las raíces.">
              <Select id={id("depth")} value={s.depth} onChange={(e) => set("depth", e.target.value as Level | "")} aria-describedby={describedBy(id("depth"), "x")}>
                <option value="">No lo sé</option>
                <option value="bajo">Somera (menos de ~60 cm)</option>
                <option value="medio">Media (~1 m)</option>
                <option value="alto">Profunda (más de ~1,4 m)</option>
              </Select>
            </Field>
            <Field id={id("drain")} label="Drenaje" hint="Todavía no influye en el puntaje: queda registrado.">
              <Select id={id("drain")} value={s.drainage} onChange={(e) => set("drainage", e.target.value as Level | "")} aria-describedby={describedBy(id("drain"), "x")}>
                <option value="">No lo sé</option>
                <option value="bajo">Lento: se anega</option>
                <option value="medio">Bueno</option>
                <option value="alto">Excesivo: el agua se va rápido</option>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tamaño y cultivos */}
      <Card>
        <CardHeader>
          <CardTitle as={h}>3. Tamaño y cultivos</CardTitle>
          <CardDescription>Si dibujaste el lote, la superficie se calcula sola (la podés corregir).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("area")} label="Superficie (hectáreas)" error={errors.area_ha} hint={areaFromDrawing ? "Calculada con el lote que dibujaste: corregila si hace falta." : "Por ejemplo: 250. Si dibujás el lote en el mapa, se calcula sola."}>
              <Input id={id("area")} inputMode="decimal" value={s.area_ha} onChange={(e) => { setAreaFromDrawing(false); set("area_ha", e.target.value); }} aria-invalid={Boolean(errors.area_ha)} aria-describedby={describedBy(id("area"), "x", errors.area_ha)} />
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

      {/* 4. Manejo */}
      <Card>
        <CardHeader>
          <CardTitle as={h}>4. Manejo</CardTitle>
          <CardDescription>Todo es opcional. Si no sabés un dato, dejalo en blanco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor={id("irr")}>Tengo riego disponible</Label>
              <p className="text-sm text-muted-foreground">Con riego se cubre buena parte del déficit de agua, pero se descuenta el costo del agua aplicada.</p>
            </div>
            <Switch id={id("irr")} checked={s.irrigated} onCheckedChange={(v) => set("irrigated", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("slope")} label="Pendiente (%)" error={errors.slope_pct} hint="Si la dejás vacía, la calculamos con el relieve de la NASA (SRTM).">
              <Input id={id("slope")} inputMode="decimal" value={s.slope_pct} onChange={(e) => set("slope_pct", e.target.value)} aria-invalid={Boolean(errors.slope_pct)} aria-describedby={describedBy(id("slope"), "x", errors.slope_pct)} placeholder="Ej.: 1,5" />
            </Field>
            <Field id={id("budget")} label="Presupuesto para hacer cambios" hint="Todavía no influye en el puntaje: queda registrado.">
              <Select id={id("budget")} value={s.budget} onChange={(e) => set("budget", e.target.value as Level | "")} aria-describedby={describedBy(id("budget"), "x")}>
                <option value="">Prefiero no decirlo</option>
                <option value="bajo">Ajustado</option>
                <option value="medio">Medio</option>
                <option value="alto">Amplio</option>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {saveError && <Alert tone="error" title="No se pudo guardar">{saveError}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {saving ? "Guardando…" : mode === "create" ? "Guardar y seguir" : "Guardar cambios"}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
            Guardar como campo nuevo
          </Button>
        )}
        <p role="status" className={cn("inline-flex items-center gap-1.5 font-semibold text-success", !savedAt && "sr-only")}>
          {savedAt && (
            <>
              <CheckCircle2 aria-hidden className="size-5" /> Cambios guardados
            </>
          )}
        </p>
        {s.point && !savedAt && <span className="text-sm text-muted-foreground">Ubicación: {num(s.point.lat, 4)}, {num(s.point.lon, 4)}</span>}
      </div>

      {progress && <SaveOverlay progress={progress} />}
    </form>
  );
}
