"use client";

import { PROFILES, readProfile } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";

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
import { L, appLocale, localize, tr } from "@/lib/i18n";

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

const OM_WORD: Record<Level, string> = localize({ bajo: L("baja", "low"), medio: L("media", "medium"), alto: L("alta", "high") });

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
  if (!s.name.trim()) e.name = tr("Poné un nombre para reconocer el campo.", "Give the field a name you'll recognize.");
  if (!s.point) e.point = tr("Marcá la ubicación del campo: buscá tu ciudad o pueblo, tocá el mapa o ingresá las coordenadas.", "Mark the field location: search your city or town, tap the map or enter the coordinates.");
  const area = Number(s.area_ha.replace(",", "."));
  if (!s.area_ha.trim() || !Number.isFinite(area) || area <= 0) e.area_ha = tr("Ingresá la superficie en hectáreas (mayor que 0).", "Enter the area in hectares (greater than 0).");
  else if (area > 100_000) e.area_ha = tr("La superficie máxima es de 100.000 ha.", "The maximum area is 100,000 ha.");
  if (s.slope_pct.trim()) {
    const slope = Number(s.slope_pct.replace(",", "."));
    if (!Number.isFinite(slope) || slope < 0 || slope > 100) e.slope_pct = tr("La pendiente tiene que estar entre 0 y 100 %.", "The slope must be between 0 and 100 %.");
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
            note: s.lab_analysis ? tr("Análisis de laboratorio declarado por el productor.", "Laboratory test reported by the farmer.") : tr("Declarado por el productor.", "Reported by the farmer."),
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
  <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky">{tr("Estimado automáticamente", "Estimated automatically")}</span>
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
    body = <p>{tr("Elegí la ubicación del campo (paso 1) y el suelo se completa solo con la estimación de ese punto.", "Choose the field location (step 1) and the soil fills in automatically with that point's estimate.")}</p>;
  } else if (lookup.status === "loading" || lookup.status === "idle") {
    body = (
      <p className="flex items-center gap-2">
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
        <span>{tr("Buscando el suelo de este punto… El mapa de suelos puede tardar más de un minuto: mientras tanto podés seguir completando y guardar.", "Looking up the soil at this point… The soil map can take more than a minute: meanwhile you can keep filling in and save.")}</span>
      </p>
    );
  } else if (lookup.status === "error") {
    body = <p>{tr(`No pudimos estimar el suelo ahora (${lookup.message}). Podés cargarlo a mano.`, `We couldn't estimate the soil now (${lookup.message}). You can enter it by hand.`)}</p>;
  } else if (!lookup.estimate) {
    body = <p>{tr("No hay una estimación de suelo para este punto (puede ser agua, zona urbana o un lugar sin datos). Si lo sabés, cargalo vos.", "There is no soil estimate for this point (it may be water, an urban area or a place without data). If you know it, enter it yourself.")}</p>;
  } else if (!usableEstimate(lookup.estimate)) {
    body = (
      <p>
        {tr(
          <>No pudimos consultar el mapa de suelos en este momento. <strong>No completamos el suelo con datos de muestra</strong>: cargalo vos si lo sabés, o volvé a intentar más tarde.</>,
          <>We couldn&apos;t query the soil map right now. <strong>We don&apos;t fill in the soil with sample data</strong>: enter it yourself if you know it, or try again later.</>,
        )}
      </p>
    );
  } else {
    const e = lookup.estimate;
    body = (
      <div className="space-y-1.5">
        <p className="text-base">
          {tr("Suelo estimado de este punto:", "Estimated soil at this point:")} <strong>{e.texture ? SOIL_TEXTURES[e.texture] : (e.texture_usda ?? tr("sin textura", "no texture"))}</strong>
          {e.organic_matter && (
            <>, {tr("materia orgánica", "organic matter")} <strong>{OM_WORD[e.organic_matter]}</strong>{e.organic_matter_pct != null && <> (~{num(e.organic_matter_pct, 1)} %)</>}</>
          )}
          .
        </p>
        {e.clay_pct != null && (
          <p className="text-muted-foreground">{tr("Arcilla", "Clay")} {num(e.clay_pct)} %, {tr("arena", "sand")} {num(e.sand_pct)} %, {tr("limo", "silt")} {num(e.silt_pct)} %.</p>
        )}
        {lookup.distanceKm > 0 && (
          <p className="font-medium">
            {tr(
              `Ojo: es el suelo de los alrededores, a unos ${num(lookup.distanceKm)} km, porque en el punto elegido no hay suelo agrícola (por ejemplo, el centro del pueblo). Mové el punto a tu campo para afinarlo.`,
              `Note: this is the soil of the surroundings, about ${num(lookup.distanceKm)} km away, because there is no farm soil at the chosen point (for example, the town center). Move the point to your field to refine it.`,
            )}
          </p>
        )}
        <p className="text-muted-foreground">
          {tr("Fuente", "Source")}: {e.source} · {e.depth} · {tr("píxel de", "pixel of")} {e.resolution} · {e.origin_label}. {tr("Es una estimación de un mapa de suelos, no un análisis.", "It is an estimate from a soil map, not a lab test.")}
        </p>
        {lab && <p className="font-medium">{tr("Tenés análisis de laboratorio: usamos tus valores y no esta estimación.", "You have a lab test: we use your values, not this estimate.")}</p>}
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
      { icon: Save, label: tr("Guardando el campo", "Saving the field"), state: "pending", detail: "…" },
      { icon: Layers, label: tr("Suelo estimado (SoilGrids)", "Estimated soil (SoilGrids)"), state: "pending", detail: "…" },
      { icon: CloudSun, label: tr("Zona climática (NASA POWER)", "Climate zone (NASA POWER)"), state: "pending", detail: "…" },
    ];
  }
  const ap = p.field.auto_profile;
  const soilOrigin = ap?.soil_estimate?.origin;
  return [
    { icon: Save, label: tr("Campo guardado", "Field saved"), state: "ok", detail: p.demo ? tr("En este navegador", "In this browser") : tr("Listo", "Done") },
    {
      icon: Layers,
      label: tr("Suelo estimado (SoilGrids)", "Estimated soil (SoilGrids)"),
      state: soilOrigin === "live" || soilOrigin === "cached" ? "ok" : "info",
      detail: soilOrigin === "live" || soilOrigin === "cached" ? tr("Listo", "Done") : soilOrigin === "sample" ? tr("Dato de muestra", "Sample data") : tr(tr("Sin dato", "No data"), "No data"),
    },
    {
      icon: CloudSun,
      label: tr("Zona climática (NASA POWER)", "Climate zone (NASA POWER)"),
      state: ap?.zone?.zone ? "ok" : "info",
      detail: ap?.zone?.zone ? tr("Listo", "Done") : tr("Sin zonificación", "No zoning"),
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
          {done ? tr(`¡Listo! Guardamos «${name}»`, `Done! We saved “${name}”`) : tr("Guardando tu campo y consultando datos satelitales…", "Saving your field and querying satellite data…")}
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
              <Link ref={goRef} href={progress.href}>{tr("Ir a mi campo", "Go to my field")}</Link>
            </Button>
            <p className="text-sm text-muted-foreground">{tr("Te llevamos en un momento…", "Taking you there in a moment…")}</p>
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
  // Perfil huerta: formulario simple (m², tipo de tierra, tipo de riego, cultivo anterior). No rompe el de agricultor.
  const isHuerta = useProfile() === "huerta";
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops(isHuerta ? "huerta" : "campo", { signal })).data, [isHuerta]);
  const [s, setS] = useState<FormState>(() => toFormState(initial));
  // Solo huerta: tipo de riego (se guarda como "tengo riego") y compost, para la estimación cualitativa de nutrientes.
  const [irrigationType, setIrrigationType] = useState<string>(initial?.irrigated ? "goteo" : "");
  const [compost, setCompost] = useState(false);
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

  const cropOptions = useMemo(() => [...(crops.data ?? [])].filter((c) => !c.is_cover_crop).sort((a, b) => a.name.localeCompare(b.name, appLocale())), [crops.data]);
  // Huerta: estimación cualitativa de nutrientes según el cultivo anterior (leguminosa deja N) y el compost.
  const prevCrop = (crops.data ?? []).find((c) => c.id === s.previous[0]);
  const nitrogenEst = prevCrop?.fixes_nitrogen ? tr("medio a alto (el cultivo anterior era leguminosa)", "medium to high (the previous crop was a legume)")
    : s.previous[0] ? tr("bajo a medio", "low to medium") : tr("sin dato (cargá el cultivo anterior)", "no data (add the previous crop)");
  const omEst = compost ? tr("algo mayor por el compost", "somewhat higher thanks to the compost") : tr("según tu suelo (sin aporte)", "as per your soil (no amendment)");
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
      setLabFileMsg(tr("El archivo es muy grande (máximo 15 MB).", "The file is too large (15 MB max)."));
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
    setPlaceNote(far ? tr("Borramos el lote que habías dibujado porque estaba en otro lugar. Dibujalo de nuevo si querés.", "We removed the plot you had drawn because it was somewhere else. Draw it again if you like.") : null);
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
      setSaveError(describeError(e) + (mode === "edit" ? tr(" Si estás sin conexión, usá “Guardar como campo nuevo”.", " If you are offline, use “Save as a new field”.") : ""));
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
          <CardTitle as={h}>{tr("1. ¿Dónde está el campo?", "1. Where is the field?")}</CardTitle>
          <CardDescription>{tr("Buscá tu ciudad o pueblo: el mapa, las coordenadas, el nombre y el suelo se completan solos.", "Search for your city or town: the map, coordinates, name and soil fill in automatically.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocalitySearch
            id={id("localidad")}
            label={tr("Buscá tu ciudad o pueblo", "Search for your city or town")}
            help={tr("Es la forma más rápida. Después podés mover el punto en el mapa para afinarlo.", "It's the fastest way. Then you can move the point on the map to refine it.")}
            onSelect={onLocality}
            clearSignal={clearPlace}
          />
          <p className="text-sm text-muted-foreground">{tr("O tocá el mapa donde está el campo:", "Or tap the map where the field is:")}</p>
          <div id={id("map")} tabIndex={-1}>
            <FieldMap mode="edit" point={s.point} polygon={s.polygon} onPointChange={onMapPoint} onPolygonChange={onPolygon} showPlaceSearch={false} />
          </div>
          {s.point && <LocalityLine lat={s.point.lat} lon={s.point.lon} live prefix={tr("Ubicación elegida: ", "Chosen location: ")} className="text-base font-medium text-foreground" />}
          {s.polygon && (
            <p aria-live="polite" className="text-base">
              {tr("Lote dibujado:", "Drawn plot:")} <strong>{num(ringAreaHa(s.polygon), 1)} ha</strong>. {tr("La superficie se completó sola en el paso 3.", "The area was filled in automatically in step 3.")}
            </p>
          )}
          {placeNote && <p role="status" className="text-sm text-muted-foreground">{placeNote}</p>}
          {errors.point && <p role="alert" className="text-sm font-medium text-destructive">{errors.point}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("name")} label={tr("Nombre del campo", "Field name")} error={errors.name} hint={s.autoName && s.name === s.autoName ? tr("Lo tomamos de la ciudad: cambialo si querés.", "Taken from the city: change it if you like.") : undefined}>
              <Input
                id={id("name")} value={s.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)}
                aria-describedby={describedBy(id("name"), s.autoName && s.name === s.autoName ? "x" : undefined, errors.name)} autoComplete="off" placeholder={tr("Ej.: Lote Norte", "E.g.: North Plot")}
              />
            </Field>
            {!isHuerta && (
              <Field id={id("farm")} label={tr("Establecimiento (opcional)", "Farm (optional)")}>
                <Input id={id("farm")} value={s.farm_name} onChange={(e) => set("farm_name", e.target.value)} autoComplete="off" placeholder={tr("Ej.: La Esperanza", "E.g.: La Esperanza")} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Análisis de suelo */}
      <Card>
        <CardHeader>
          <CardTitle as={h} className="flex items-center gap-2"><FlaskConical aria-hidden className="size-5 text-primary" /> {isHuerta ? tr("2. Tu tierra", "2. Your soil") : tr("2. Análisis de suelo", "2. Soil test")}</CardTitle>
          <CardDescription>{isHuerta ? tr("Elegí el tipo de tierra de tu cantero. El resto es orientativo y se estima.", "Choose your bed's soil type. The rest is indicative and estimated.") : tr("Se completa solo con el suelo estimado del punto. Si tenés un análisis de laboratorio, marcalo y cargá tus valores: siempre ganan los tuyos.", "It fills in automatically with the point's estimated soil. If you have a lab test, check it and enter your values: yours always win.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isHuerta && (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={id("lab")}>{tr("Tengo análisis de suelo de laboratorio", "I have a laboratory soil test")}</Label>
                <p className="text-sm text-muted-foreground">{tr("Sube la confianza del resultado y reemplaza a la estimación.", "It raises the result's confidence and replaces the estimate.")}</p>
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
                        <ExternalLink aria-hidden /> {tr("Ver", "View")}
                      </a>
                    </Button>
                    <Button type="button" size="sm" variant="ghost" aria-label={tr(`Quitar el archivo ${labFile.name}`, `Remove the file ${labFile.name}`)} onClick={() => setLabFile(null)}>
                      <X aria-hidden /> {tr("Quitar", "Remove")}
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip aria-hidden /> {tr("Agregar archivo", "Add file")}
                  </Button>
                )}
                {labFileMsg && <p role="alert" className="text-sm text-destructive">{labFileMsg}</p>}
                <p className="text-sm text-muted-foreground">
                  {tr(
                    "PDF, foto o planilla del análisis. Queda a mano para consultarlo mientras cargás los valores de abajo: todavía no se guarda en el servidor.",
                    "PDF, photo or spreadsheet of the test. It stays handy while you enter the values below: it is not saved on the server yet.",
                  )}
                </p>
              </div>
            )}
          </div>
          )}
          <SoilEstimateBox lookup={soil} hasPoint={Boolean(s.point)} lab={s.lab_analysis} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={id("texture")} label={tr("Tipo de suelo (textura)", "Soil type (texture)")}
              badge={s.soilAuto.texture ? <EstimatedTag /> : undefined}
              hint={s.soilAuto.texture ? tr("Viene de la estimación: cambiala si sabés el dato real.", "From the estimate: change it if you know the real value.") : tr("Sin este dato suponemos franco arenosa.", "Without this we assume sandy loam.")}
            >
              <Select id={id("texture")} value={s.texture} onChange={(e) => onSoilChange("texture", e.target.value as SoilTexture | "")} aria-describedby={describedBy(id("texture"), "x")}>
                <option value="">{tr("No lo sé", "I don't know")}</option>
                {Object.entries(SOIL_TEXTURES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            {!isHuerta && (<>
            <Field
              id={id("om")} label={tr("Materia orgánica", "Organic matter")}
              badge={s.soilAuto.organic_matter ? <EstimatedTag /> : undefined}
              hint={s.soilAuto.organic_matter ? tr("Viene de la estimación: cambiala si tenés el análisis.", "From the estimate: change it if you have the lab test.") : tr("Los satélites no la miden: es tu estimación o un análisis.", "Satellites don't measure it: it's your estimate or a lab test.")}
            >
              <Select id={id("om")} value={s.organic_matter} onChange={(e) => onSoilChange("organic_matter", e.target.value as Level | "")} aria-describedby={describedBy(id("om"), "x")}>
                <option value="">{tr("No lo sé", "I don't know")}</option>
                <option value="bajo">{tr("Baja", "Low")}</option>
                <option value="medio">{tr("Media", "Medium")}</option>
                <option value="alto">{tr("Alta", "High")}</option>
              </Select>
            </Field>
            <Field id={id("depth")} label={tr("Profundidad del suelo", "Soil depth")} hint={tr("Cuánto pueden bajar las raíces.", "How deep roots can go.")}>
              <Select id={id("depth")} value={s.depth} onChange={(e) => set("depth", e.target.value as Level | "")} aria-describedby={describedBy(id("depth"), "x")}>
                <option value="">{tr("No lo sé", "I don't know")}</option>
                <option value="bajo">{tr("Somera (menos de ~60 cm)", "Shallow (less than ~60 cm)")}</option>
                <option value="medio">{tr("Media (~1 m)", "Medium (~1 m)")}</option>
                <option value="alto">{tr("Profunda (más de ~1,4 m)", "Deep (more than ~1.4 m)")}</option>
              </Select>
            </Field>
            <Field id={id("drain")} label={tr("Drenaje", "Drainage")} hint={tr("Todavía no influye en el puntaje: queda registrado.", "It doesn't affect the score yet: it is recorded.")}>
              <Select id={id("drain")} value={s.drainage} onChange={(e) => set("drainage", e.target.value as Level | "")} aria-describedby={describedBy(id("drain"), "x")}>
                <option value="">{tr("No lo sé", "I don't know")}</option>
                <option value="bajo">{tr("Lento: se anega", "Slow: it waterlogs")}</option>
                <option value="medio">{tr("Bueno", "Good")}</option>
                <option value="alto">{tr("Excesivo: el agua se va rápido", "Excessive: water drains fast")}</option>
              </Select>
            </Field>
            </>)}
          </div>
          {isHuerta && (
            <div className="space-y-3 rounded-xl border p-4">
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">{tr("Le pongo compost o abono orgánico", "I add compost or organic matter")}</span>
                  <span className="block text-sm text-muted-foreground">{tr("Mejora la materia orgánica y los nutrientes del cantero.", "It improves the bed's organic matter and nutrients.")}</span>
                </span>
                <Switch checked={compost} onCheckedChange={setCompost} />
              </label>
              <div className="border-t pt-3 text-sm">
                <p className="font-medium">{tr("Nutrientes estimados del cantero", "Estimated bed nutrients")}</p>
                <p className="text-muted-foreground">
                  {tr("Nitrógeno", "Nitrogen")}: <strong className="text-foreground">{nitrogenEst}</strong>
                  {" · "}{tr("Materia orgánica", "Organic matter")}: <strong className="text-foreground">{omEst}</strong>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{tr("Estimado a partir del cultivo anterior y el compost: validá con un análisis de suelo. No lo mide ningún satélite.", "Estimated from the previous crop and compost: validate with a soil test. No satellite measures it.")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Tamaño y cultivos */}
      <Card>
        <CardHeader>
          <CardTitle as={h}>{tr("3. Tamaño y cultivos", "3. Size and crops")}</CardTitle>
          <CardDescription>{tr("Si dibujaste el lote, la superficie se calcula sola (la podés corregir).", "If you drew the plot, the area is calculated automatically (you can correct it).")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("area")} label={isHuerta ? tr("Superficie (m²)", "Area (m²)") : tr("Superficie (hectáreas)", "Area (hectares)")} error={errors.area_ha} hint={isHuerta ? tr("Por ejemplo: 50. El tamaño de tu huerta en metros cuadrados.", "For example: 50. Your garden size in square meters.") : areaFromDrawing ? tr("Calculada con el lote que dibujaste: corregila si hace falta.", "Calculated from the plot you drew: correct it if needed.") : tr("Por ejemplo: 250. Si dibujás el lote en el mapa, se calcula sola.", "For example: 250. If you draw the plot on the map, it is calculated automatically.")}>
              <Input id={id("area")} inputMode="decimal"
                value={isHuerta ? (s.area_ha.trim() && Number.isFinite(Number(s.area_ha.replace(",", "."))) ? String(Math.round(Number(s.area_ha.replace(",", ".")) * 10000)) : "") : s.area_ha}
                onChange={(e) => {
                  setAreaFromDrawing(false);
                  if (isHuerta) {
                    const m2 = Number(e.target.value.replace(",", "."));
                    set("area_ha", e.target.value.trim() === "" || !Number.isFinite(m2) ? "" : String(m2 / 10000));
                  } else set("area_ha", e.target.value);
                }}
                aria-invalid={Boolean(errors.area_ha)} aria-describedby={describedBy(id("area"), "x", errors.area_ha)} />
            </Field>
            <Field id={id("crop")} label={tr("Cultivo actual", "Current crop")} hint={crops.error ? tr("No se pudo cargar la lista de cultivos.", "The crop list could not be loaded.") : tr("El de esta campaña o el último que sembraste.", "This season's crop or the last one you planted.")}>
              {crops.loading && !crops.data ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <Select id={id("crop")} value={s.current_crop} onChange={(e) => set("current_crop", e.target.value)}>
                  <option value="">{tr("No lo sé / lote en barbecho", "I don't know / plot in fallow")}</option>
                  {cropOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {isHuerta ? (
            <Field id={id("prev")} label={tr("Cultivo anterior", "Previous crop")} hint={tr("Lo que tenías antes en ese cantero: sirve para estimar los nutrientes.", "What you had before in that bed: it helps estimate nutrients.")}>
              {crops.loading && !crops.data ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <Select id={id("prev")} value={s.previous[0] ?? ""} onChange={(e) => set("previous", e.target.value ? [e.target.value] : [])}>
                  <option value="">{tr("No lo sé / cantero nuevo", "I don't know / new bed")}</option>
                  {cropOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
          <fieldset className="space-y-3">
            <legend className="text-base font-medium">{tr("Rotación histórica", "Crop history")}</legend>
            <p className="text-sm text-muted-foreground">
              {tr("Cultivos de las campañas anteriores, de la más vieja a la más reciente. Con esto detectamos monocultivos y armamos tu rotación actual.", "Crops from previous seasons, from oldest to most recent. We use this to detect monoculture and build your current rotation.")}
            </p>
            {s.previous.length === 0 && <p className="text-sm italic text-muted-foreground">{tr("Todavía no cargaste campañas anteriores.", "You haven't added previous seasons yet.")}</p>}
            <ol className="space-y-2">
              {s.previous.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">{tr(`Hace ${s.previous.length - i} campaña${s.previous.length - i > 1 ? "s" : ""}`, `${s.previous.length - i} season${s.previous.length - i > 1 ? "s" : ""} ago`)}</span>
                  <Select aria-label={tr(`Cultivo de hace ${s.previous.length - i} campaña${s.previous.length - i > 1 ? "s" : ""}`, `Crop from ${s.previous.length - i} season${s.previous.length - i > 1 ? "s" : ""} ago`)} value={c} onChange={(e) => set("previous", s.previous.map((p, j) => (j === i ? e.target.value : p)))}>
                    <option value="">{tr("Sin dato", "No data")}</option>
                    {cropOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </Select>
                  <Button type="button" variant="ghost" size="icon" aria-label={tr(`Quitar la campaña de hace ${s.previous.length - i}`, `Remove the season from ${s.previous.length - i} ago`)} onClick={() => set("previous", s.previous.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" size="sm" disabled={s.previous.length >= MAX_PREVIOUS} onClick={() => set("previous", [...s.previous, ""])}>
              <Plus aria-hidden /> {tr("Agregar campaña anterior", "Add previous season")}
            </Button>
          </fieldset>
          )}
        </CardContent>
      </Card>

      {/* 4. Manejo */}
      <Card>
        <CardHeader>
          <CardTitle as={h}>{tr("4. Manejo", "4. Management")}</CardTitle>
          <CardDescription>{tr("Todo es opcional. Si no sabés un dato, dejalo en blanco.", "Everything is optional. If you don't know something, leave it blank.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isHuerta ? (
            <Field id={id("riego")} label={tr("Tipo de riego", "Irrigation type")} hint={tr("Cómo regás la huerta.", "How you water the garden.")}>
              <Select id={id("riego")} value={irrigationType} onChange={(e) => { setIrrigationType(e.target.value); set("irrigated", e.target.value !== "" && e.target.value !== "secano"); }}>
                <option value="">{tr("No lo sé", "I don't know")}</option>
                <option value="secano">{tr("Sin riego (solo lluvia)", "No irrigation (rain only)")}</option>
                <option value="regadera">{tr("Regadera o manguera", "Watering can or hose")}</option>
                <option value="goteo">{tr("Goteo", "Drip")}</option>
                <option value="aspersion">{tr("Aspersión", "Sprinkler")}</option>
              </Select>
            </Field>
          ) : (
          <>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor={id("irr")}>{tr("Tengo riego disponible", "I have irrigation available")}</Label>
              <p className="text-sm text-muted-foreground">{tr("Con riego se cubre buena parte del déficit de agua, pero se descuenta el costo del agua aplicada.", "Irrigation covers much of the water deficit, but the cost of applied water is deducted.")}</p>
            </div>
            <Switch id={id("irr")} checked={s.irrigated} onCheckedChange={(v) => set("irrigated", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("slope")} label={tr("Pendiente (%)", "Slope (%)")} error={errors.slope_pct} hint={tr("Si la dejás vacía, la calculamos con el relieve de la NASA (SRTM).", "If you leave it empty, we calculate it with NASA terrain data (SRTM).")}>
              <Input id={id("slope")} inputMode="decimal" value={s.slope_pct} onChange={(e) => set("slope_pct", e.target.value)} aria-invalid={Boolean(errors.slope_pct)} aria-describedby={describedBy(id("slope"), "x", errors.slope_pct)} placeholder={tr("Ej.: 1,5", "E.g.: 1.5")} />
            </Field>
            <Field id={id("budget")} label={tr("Presupuesto para hacer cambios", "Budget for changes")} hint={tr("Todavía no influye en el puntaje: queda registrado.", "It doesn't affect the score yet: it is recorded.")}>
              <Select id={id("budget")} value={s.budget} onChange={(e) => set("budget", e.target.value as Level | "")} aria-describedby={describedBy(id("budget"), "x")}>
                <option value="">{tr("Prefiero no decirlo", "I'd rather not say")}</option>
                <option value="bajo">{tr("Ajustado", "Tight")}</option>
                <option value="medio">{tr("Medio", "Medium")}</option>
                <option value="alto">{tr("Amplio", "Ample")}</option>
              </Select>
            </Field>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {saveError && <Alert tone="error" title={tr("No se pudo guardar", "Could not save")}>{saveError}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {saving ? tr("Guardando…", "Saving…") : mode === "create" ? tr("Guardar y seguir", "Save and continue") : tr("Guardar cambios", "Save changes")}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
            {tr("Guardar como campo nuevo", "Save as a new field")}
          </Button>
        )}
        <p role="status" className={cn("inline-flex items-center gap-1.5 font-semibold text-success", !savedAt && "sr-only")}>
          {savedAt && (
            <>
              <CheckCircle2 aria-hidden className="size-5" /> {tr("Cambios guardados", "Changes saved")}
            </>
          )}
        </p>
        {s.point && !savedAt && <span className="text-sm text-muted-foreground">{tr("Ubicación", "Location")}: {num(s.point.lat, 4)}, {num(s.point.lon, 4)}</span>}
      </div>

      {progress && <SaveOverlay progress={progress} />}
    </form>
  );
}
