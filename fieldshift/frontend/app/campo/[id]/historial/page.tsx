"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { History, LogIn, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useCampo } from "@/components/campo/campo-provider";
import { PageNotes } from "@/components/layout/page-notes";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { NEEDS_CROP, TIPOS, TIPO_LABEL, fechaLarga, groupByYear, isTipo, sownSequence, validateRegistro, type NuevoRegistroForm } from "@/lib/historial";
import { addHistorial, createLote, deleteHistorial, findLoteByFieldId, listHistorial, type HistorialRow, type LoteRow } from "@/lib/supabase/lotes";
import type { Crop } from "@/types/api";
import { tr } from "@/lib/i18n";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY: NuevoRegistroForm = { fecha: "", tipo: "siembra", cultivo: "", nota: "" };

function NewRecordForm({ lote, onAdded }: { lote: LoteRow; onAdded: (r: HistorialRow) => void }) {
  const crops = useAsync<Crop[]>(async (signal) => (await api.crops("campo", { signal })).data, []);
  const [form, setForm] = useState<NuevoRegistroForm>(() => ({ ...EMPTY, fecha: today() }));
  const [errors, setErrors] = useState<ReturnType<typeof validateRegistro>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const tipo = isTipo(form.tipo) ? form.tipo : "nota";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFail(null);
    setSaved(null);
    const errs = validateRegistro(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const row = await addHistorial({
        lote_id: lote.id,
        fecha: form.fecha,
        tipo: form.tipo,
        cultivo: form.cultivo.trim() || null,
        nota: form.nota.trim() || null,
      });
      onAdded(row);
      setSaved(tr(`Guardado: ${TIPO_LABEL[tipo].toLowerCase()} del ${fechaLarga(form.fecha)}.`, `Saved: ${TIPO_LABEL[tipo].toLowerCase()} on ${fechaLarga(form.fecha)}.`));
      setForm({ ...EMPTY, fecha: form.fecha, tipo: form.tipo });
    } catch (err) {
      setFail(tr(`No se pudo guardar: ${(err as Error).message}`, `Could not save: ${(err as Error).message}`));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: keyof NuevoRegistroForm) =>
    errors[k] ? <p id={`h-${k}-error`} className="text-sm font-medium text-destructive">{errors[k]}</p> : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="h-tipo">{tr("¿Qué pasó?", "What happened?")}</Label>
          <Select id="h-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} aria-invalid={Boolean(errors.tipo)}>
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </Select>
          {err("tipo")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="h-fecha">{tr("Fecha", "Date")}</Label>
          <Input
            id="h-fecha" type="date" max={today()} value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            aria-invalid={Boolean(errors.fecha)} aria-describedby={errors.fecha ? "h-fecha-error" : undefined}
          />
          {err("fecha")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="h-cultivo">{tr("Cultivo", "Crop")}{NEEDS_CROP.has(tipo) ? "" : tr(" (opcional)", " (optional)")}</Label>
        <Input
          id="h-cultivo" list="h-cultivos" value={form.cultivo} autoComplete="off" placeholder={tr("Por ejemplo: Soja", "For example: Soybean")}
          onChange={(e) => setForm({ ...form, cultivo: e.target.value })}
          aria-invalid={Boolean(errors.cultivo)} aria-describedby={errors.cultivo ? "h-cultivo-error" : undefined}
        />
        <datalist id="h-cultivos">{(crops.data ?? []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
        {err("cultivo")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="h-nota">{tr("Comentario", "Comment")}{tipo === "nota" ? "" : tr(" (opcional)", " (optional)")}</Label>
        <textarea
          id="h-nota" rows={3} value={form.nota} maxLength={1000}
          onChange={(e) => setForm({ ...form, nota: e.target.value })}
          placeholder={tr("Rinde, lluvia que cayó, plagas, lo que te parezca importante para la próxima campaña.", "Yield, rain that fell, pests, anything you think matters for next season.")}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground"
          aria-invalid={Boolean(errors.nota)} aria-describedby={errors.nota ? "h-nota-error" : undefined}
        />
        {err("nota")}
      </div>
      {fail && <Alert tone="error">{fail}</Alert>}
      <p aria-live="polite" className="text-sm font-medium text-success">{saved}</p>
      <Button type="submit" disabled={busy}><Save aria-hidden /> {busy ? tr("Guardando…", "Saving…") : tr("Guardar en el historial", "Save to history")}</Button>
    </form>
  );
}

function Timeline({ rows, onDelete }: { rows: HistorialRow[]; onDelete: (id: string) => void }) {
  if (rows.length === 0) return <p className="text-muted-foreground">{tr("Todavía no cargaste nada. Empezá por la última siembra o cosecha.", "You haven't added anything yet. Start with the last planting or harvest.")}</p>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (
    <div className="space-y-6">
      {groupByYear(rows).map(({ year, rows: group }) => (
        <section key={year} aria-labelledby={`anio-${year}`} className="space-y-2">
          <h3 id={`anio-${year}`} className="text-lg font-semibold">{year}</h3>
          <ol className="space-y-2 border-l-2 border-primary/30 pl-4">
            {group.map(({ id }) => {
              const r = byId.get(id)!;
              const t = isTipo(r.tipo) ? TIPO_LABEL[r.tipo] : r.tipo ?? tr("Registro", "Record");
              return (
                <li key={id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                  <div>
                    <p className="font-medium">{t}{r.cultivo ? `: ${r.cultivo}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{fechaLarga(r.fecha)}</p>
                    {r.nota && <p className="mt-1 text-sm">{r.nota}</p>}
                  </div>
                  <Button
                    type="button" size="icon" variant="outline"
                    aria-label={tr(`Borrar ${t.toLowerCase()} del ${fechaLarga(r.fecha)}`, `Delete ${t.toLowerCase()} on ${fechaLarga(r.fecha)}`)}
                    onClick={() => { if (window.confirm(tr("¿Borrar este registro?", "Delete this record?"))) onDelete(id); }}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function HistorialPage() {
  const { fieldId, field } = useCampo();
  const { configured, user, loading } = useAuth();
  const [lote, setLote] = useState<LoteRow | null | undefined>(undefined);
  const [rows, setRows] = useState<HistorialRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const l = await findLoteByFieldId(fieldId);
      setLote(l);
      setRows(l ? await listHistorial(l.id) : []);
    } catch (e) {
      setLote(null);
      setError(tr(`No se pudo leer tu historial: ${(e as Error).message}`, `Could not read your history: ${(e as Error).message}`));
    }
  }, [fieldId]);

  useEffect(() => {
    if (configured && user) void load();
  }, [configured, user, load]);

  const sequence = useMemo(() => sownSequence(rows), [rows]);

  async function saveLote() {
    if (!field) return;
    setSaving(true);
    setError(null);
    try {
      const l = await createLote({
        nombre: field.name,
        establecimiento: field.farm_name ?? null,
        lat: field.location.lat,
        lon: field.location.lon,
        area_ha: field.area_ha ?? null,
        con_riego: Boolean(field.irrigated),
        datos: { field_id: field.id, fuente: "AgroOrbit" },
      });
      setLote(l);
      setRows([]);
    } catch (e) {
      setError(tr(`No se pudo guardar el campo: ${(e as Error).message}`, `Could not save the field: ${(e as Error).message}`));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteHistorial(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(tr(`No se pudo borrar: ${(e as Error).message}`, `Could not delete: ${(e as Error).message}`));
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={tr("Historial del lote", "Field history")} description={tr("Lo que sembraste, cosechaste y observaste, guardado para decidir mejor la próxima campaña.", "What you planted, harvested and observed, saved to decide better next season.")} />

      {!configured ? (
        <Alert tone="info" title={tr("El historial necesita una cuenta", "History needs an account")}>
          <p>{tr("Para guardar el historial entre dispositivos hace falta iniciar sesión, y el inicio de sesión todavía no está activado en esta instalación.", "Saving the history across devices requires signing in, and sign-in is not enabled on this installation yet.")}</p>
        </Alert>
      ) : loading ? (
        <p className="text-muted-foreground">{tr("Cargando…", "Loading…")}</p>
      ) : !user ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <p>{tr("Iniciá sesión para guardar el historial de este campo en tu cuenta.", "Sign in to save this field's history to your account.")}</p>
            <Button asChild><Link href="/cuenta"><LogIn aria-hidden /> {tr("Entrar o crear cuenta", "Sign in or create an account")}</Link></Button>
          </CardContent>
        </Card>
      ) : lote === undefined ? (
        <p role="status" className="text-muted-foreground">{tr("Buscando tu historial…", "Looking for your history…")}</p>
      ) : !lote ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2"><History aria-hidden className="size-5" /> {tr(`Empezá el historial de ${field?.name ?? "este campo"}`, `Start the history of ${field?.name ?? "this field"}`)}</CardTitle>
            <CardDescription>{tr("Guardamos el campo en tu cuenta y después cargás lo que va pasando.", "We save the field to your account and then you log what happens.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={saveLote} disabled={saving || !field}><Save aria-hidden /> {saving ? tr("Guardando…", "Saving…") : tr("Guardar este campo en mi cuenta", "Save this field to my account")}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle as="h2">{tr("Cargar un registro", "Add a record")}</CardTitle></CardHeader>
            <CardContent><NewRecordForm lote={lote} onAdded={(r) => setRows((rs) => [r, ...rs])} /></CardContent>
          </Card>
          {sequence.length >= 2 && (
            <Card>
              <CardContent className="pt-5">
                <p><strong>{tr("Lo que se sembró, en orden:", "What was planted, in order:")}</strong> {sequence.join(" → ")}.</p>
                <p className="text-sm text-muted-foreground">{tr("Es tu rotación real según lo que cargaste. Compará con la del perfil del campo.", "It's your real rotation based on what you entered. Compare it with the field profile's.")}</p>
              </CardContent>
            </Card>
          )}
          <section aria-labelledby="registros" className="space-y-3">
            <h2 id="registros" className="text-2xl font-semibold">{tr("Registros", "Records")}</h2>
            <Timeline rows={rows} onDelete={remove} />
          </section>
        </>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <PageNotes>
        <p>{tr("El historial es tuyo: solo lo ves vos con tu cuenta (cada usuario accede únicamente a sus lotes).", "The history is yours: only you see it with your account (each user only accesses their own fields).")}</p>
        <p>{tr("AgroOrbit todavía no usa este historial para calcular el puntaje: sirve para que vos y tu agrónomo vean qué pasó en cada campaña.", "AgroOrbit doesn't use this history to calculate the score yet: it helps you and your agronomist see what happened each season.")}</p>
      </PageNotes>
    </div>
  );
}
