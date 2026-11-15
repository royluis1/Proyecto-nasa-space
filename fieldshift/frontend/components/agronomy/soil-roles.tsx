"use client";

import { Droplets, Layers, Sprout, TreeDeciduous, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_INFO, ROLE_ORDER, missingRoles, rolesInRotation, type SoilRole } from "@/lib/agronomy";
import type { Crop } from "@/types/api";

const ROLE_ICON: Record<SoilRole, LucideIcon> = {
  fija_nitrogeno: Sprout,
  cobertura: Layers,
  raiz_profunda: TreeDeciduous,
  tolera_sequia: Droplets,
};

function RoleWhy({ role }: { role: SoilRole }) {
  const info = ROLE_INFO[role];
  return (
    <div className="space-y-2 text-sm">
      <ul className="list-disc space-y-1 pl-5">{info.why.map((w) => <li key={w}>{w}</li>)}</ul>
      <p><strong>Ojo:</strong> {info.caveat}</p>
      <p className="text-muted-foreground">Fuente: {info.source}.</p>
    </div>
  );
}

/** Qué aporta cada cultivo de la rotación a la salud del suelo a largo plazo. */
export function SoilRoles({ cropIds }: { cropIds: string[] }) {
  const catalog = useAsync<Crop[]>(async (signal) => (await api.crops({ signal })).data, []);
  const crops = (catalog.data ?? []).filter((c) => cropIds.includes(c.id));
  if (!catalog.data) return null;
  const present = rolesInRotation(crops);
  const missing = missingRoles(crops);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Qué le hace al suelo a largo plazo</CardTitle>
        <CardDescription>El papel de cada cultivo de esta rotación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid items-start gap-3 sm:grid-cols-2">
          {present.map(({ role, crops: names }) => {
            const Icon = ROLE_ICON[role];
            return (
              <li key={role} className="rounded-lg border p-4">
                <p className="flex items-center gap-2 font-semibold"><Icon aria-hidden className="size-5 text-primary" /> {ROLE_INFO[role].label}: {names.join(", ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{ROLE_INFO[role].short}</p>
                <Disclosure label="Por qué ayuda al suelo" className="mt-1"><RoleWhy role={role} /></Disclosure>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <p className="text-sm">
            <strong>No tiene:</strong> {missing.map((r) => ROLE_INFO[r].label.toLowerCase()).join(", ")}.{" "}
            <span className="text-muted-foreground">Sumar un cultivo con ese papel puede mejorar el suelo; evalualo con tu ingeniero agrónomo.</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Los cuatro papeles explicados (para la página de metodología). */
export function SoilRolesGuide() {
  return (
    <div className="grid items-start gap-3 sm:grid-cols-2">
      {ROLE_ORDER.map((role) => {
        const Icon = ROLE_ICON[role];
        return (
          <div key={role} className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-2 font-semibold"><Icon aria-hidden className="size-5 text-primary" /> {ROLE_INFO[role].label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ROLE_INFO[role].short}</p>
            <Disclosure label="Por qué ayuda al suelo" className="mt-1"><RoleWhy role={role} /></Disclosure>
          </div>
        );
      })}
    </div>
  );
}
