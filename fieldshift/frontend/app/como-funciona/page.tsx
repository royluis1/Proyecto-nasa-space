import type { Metadata } from "next";
import { ComoFuncionaView } from "@/components/pages/como-funciona";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Cómo funciona", "How it works"),
    description: t(
      "En cuatro pasos, AgroOrbit cruza datos de la NASA, tu suelo y tus prioridades para comparar qué sembrar.",
      "In four steps, AgroOrbit combines NASA data, your soil and your priorities to compare what to plant.",
    ),
  };
}

export default function ComoFuncionaPage() {
  return <ComoFuncionaView />;
}
