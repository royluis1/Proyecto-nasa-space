"use client";

import { Orbit } from "lucide-react";
import { FieldMap } from "@/components/map/field-map-loader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FieldOut } from "@/types/api";

/** Imagen satelital del día (NASA GIBS, MODIS Terra) alrededor del campo, con selector de fecha. */
export function TodaySatellite({ field, title = "Tu zona hoy, vista por la NASA" }: { field: FieldOut; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2"><Orbit aria-hidden className="size-6 text-agua-600" /> {title}</CardTitle>
        <CardDescription>
          Imagen del satélite Terra (MODIS, color real) del día que elijas, de NASA GIBS. Sirve para ver nubes, humo, verdor o zonas anegadas
          alrededor del campo. Necesita conexión a internet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldMap
          mode="overview"
          others={[{ id: field.id, name: field.name, lat: field.location.lat, lon: field.location.lon }]}
          selectedId={field.id}
          initialBase="nasa"
          initialZoom={9}
          heightClass="h-[340px] sm:h-[400px]"
        />
      </CardContent>
    </Card>
  );
}
