import type { Metadata } from "next";
import { MetodologiaView } from "@/components/pages/metodologia";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Metodología y fuentes", "Methodology and sources") };
}

export default function MetodologiaPage() {
  return <MetodologiaView />;
}
