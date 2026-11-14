import { redirect } from "next/navigation";

export default async function CampoIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/campo/${id}/perfil`);
}
