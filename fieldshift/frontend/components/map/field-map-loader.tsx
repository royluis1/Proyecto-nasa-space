"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet usa `window`: se carga solo en el navegador. */
export const FieldMap = dynamic(() => import("./field-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});
export type { MapPoint, OtherField } from "./field-map";
