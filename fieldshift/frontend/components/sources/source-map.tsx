import { CheckCircle2, Clock } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROFILES, type Profile } from "@/lib/profile";
import { SOURCE_MAP } from "@/lib/sources";

/** Qué dato sale de qué fuente para un perfil, y si ya está funcionando. */
export function SourceMap({ profile }: { profile: Profile }) {
  return (
    <Table scrollLabel={`Fuentes del perfil ${PROFILES[profile].label}`}>
      <TableCaption>Fuentes de datos del perfil {PROFILES[profile].label}. Todo lo que no es de la NASA se aclara.</TableCaption>
      <TableHeader><TableRow><TableHead>Para qué</TableHead><TableHead>Fuente</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
      <TableBody>
        {SOURCE_MAP[profile].map((r) => (
          <TableRow key={r.need}>
            <TableCell className="font-medium">{r.need}</TableCell>
            <TableCell>{r.source}{!r.nasa && <span className="block text-sm text-muted-foreground">No es NASA</span>}{r.note && <span className="block text-sm text-muted-foreground">{r.note}</span>}</TableCell>
            <TableCell>
              {r.status === "integrado" ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden className="size-4 text-primary" /> Funcionando</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Clock aria-hidden className="size-4" /> Próximamente</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
