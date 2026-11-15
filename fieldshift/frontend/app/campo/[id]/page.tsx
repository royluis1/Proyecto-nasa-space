"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PROFILES } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";

export default function CampoIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const profile = useProfile();
  const router = useRouter();
  useEffect(() => {
    // Cada perfil entra a su pantalla principal (agricultor: diagnóstico; huerta: Mi huerta).
    router.replace(PROFILES[profile ?? "agricultor"].home(id));
  }, [profile, id, router]);
  return null;
}
