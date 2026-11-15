import type { Metadata } from "next";
import { Landing } from "@/components/home/landing";

export const metadata: Metadata = {
  title: "AgroOrbit — Sembrar con datos, no con dudas",
  description:
    "AgroOrbit ayuda a productores de San Luis a decidir qué sembrar con datos satelitales de la NASA, clima y rotación de cultivos.",
  openGraph: {
    title: "AgroOrbit — Sembrar con datos, no con dudas",
    description: "Datos satelitales de la NASA, clima y rotación de cultivos para productores de San Luis.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function HomePage() {
  return <Landing />;
}
