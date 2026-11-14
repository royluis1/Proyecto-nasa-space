import { DISCLAIMER } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-card print:border-0">
      <div className="container space-y-2 py-6 text-sm text-muted-foreground">
        <p>{DISCLAIMER}</p>
        <p>
          FieldShift usa datos de NASA (POWER, SMAP, MODIS y SRTM). Los datos de muestra son simulados y los marca siempre como tales.
          Proyecto del NASA Space Apps Challenge 2026.
        </p>
      </div>
    </footer>
  );
}
