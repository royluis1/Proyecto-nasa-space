"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet solo funciona en el navegador: el mapa animado se carga aparte y recién cuando se muestra. */
export const WeatherAnimation = dynamic(() => import("./weather-animation").then((m) => m.WeatherAnimation), {
  ssr: false,
  loading: () => <Skeleton className="h-[380px] w-full" />,
});
