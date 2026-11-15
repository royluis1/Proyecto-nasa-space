import { CampoProvider } from "@/components/campo/campo-provider";
import { CampoShell } from "@/components/campo/campo-shell";
import { ProfileRouteGuard } from "@/components/campo/profile-route-guard";

export default async function CampoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fieldId = decodeURIComponent(id);
  return (
    <CampoProvider fieldId={fieldId}>
      <CampoShell>
        <ProfileRouteGuard fieldId={fieldId}>{children}</ProfileRouteGuard>
      </CampoShell>
    </CampoProvider>
  );
}
