"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROFILES, type Profile } from "@/lib/profile";
import { SOURCE_MAP } from "@/lib/sources";
import { useT } from "@/components/i18n/lang-provider";

/** Qué dato sale de qué fuente para un perfil, y si ya está funcionando. */
export function SourceMap({ profile }: { profile: Profile }) {
  const t = useT();
  return (
    <Table scrollLabel={t(`Fuentes del perfil ${PROFILES[profile].label}`, `Sources for the ${PROFILES[profile].label} profile`)}>
      <TableCaption>{t(`Fuentes de datos del perfil ${PROFILES[profile].label}. Todo lo que no es de la NASA se aclara.`, `Data sources for the ${PROFILES[profile].label} profile. Anything not from NASA is labeled.`)}</TableCaption>
      <TableHeader><TableRow><TableHead>{t("Para qué", "Used for")}</TableHead><TableHead>{t("Fuente", "Source")}</TableHead><TableHead>{t("Estado", "Status")}</TableHead></TableRow></TableHeader>
      <TableBody>
        {SOURCE_MAP[profile].map((r) => (
          <TableRow key={r.need}>
            <TableCell className="font-medium">{r.need}</TableCell>
            <TableCell>{r.source}{!r.nasa && <span className="block text-sm text-muted-foreground">{t("No es NASA", "Not NASA")}</span>}{r.note && <span className="block text-sm text-muted-foreground">{r.note}</span>}</TableCell>
            <TableCell>
              {r.status === "integrado" ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden className="size-4 text-primary" /> {t("Funcionando", "Working")}</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Clock aria-hidden className="size-4" /> {t("Próximamente", "Coming soon")}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
