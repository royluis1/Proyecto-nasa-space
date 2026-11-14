import { CampoProvider } from "@/components/campo/campo-provider";
import { CampoShell } from "@/components/campo/campo-shell";

export default async function CampoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CampoProvider fieldId={decodeURIComponent(id)}>
      <CampoShell>{children}</CampoShell>
    </CampoProvider>
  );
}
