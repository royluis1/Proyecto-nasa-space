import type { Metadata } from "next";
import { FieldForm } from "@/components/field/field-form";
import { PageHeader } from "@/components/page-header";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Cargar mi campo", "Add my field") };
}

export default async function NuevoCampoPage() {
  const t = await getT();
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t("Cargá tu campo", "Add your field")}
        description={t(
          "Son tres pasos cortos. Lo único obligatorio es el nombre, la ubicación y la superficie.",
          "Three short steps. Only the name, location and area are required.",
        )}
      />
      <FieldForm mode="create" />
    </div>
  );
}
