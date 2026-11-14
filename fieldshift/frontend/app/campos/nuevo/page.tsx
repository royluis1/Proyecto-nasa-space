import type { Metadata } from "next";
import { FieldForm } from "@/components/field/field-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Cargar mi campo" };

export default function NuevoCampoPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="Cargá tu campo" description="Son tres pasos cortos. Lo único obligatorio es el nombre, la ubicación y la superficie." />
      <FieldForm mode="create" />
    </div>
  );
}
