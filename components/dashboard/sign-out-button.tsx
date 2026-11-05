"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

// Encerra a sessão de verdade. Navegação completa para limpar da memória as
// telas já abertas (o painel tem dados de pacientes).
export function SignOutButton({ className, children, label = "Sair" }: { className?: string; children: React.ReactNode; label?: string }) {
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    setBusy(true);
    try {
      if (isSupabaseConfigured) await createClient().auth.signOut();
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- de propósito: recarga completa limpa os dados da memória
      window.location.assign("/login");
    }
  };
  return (
    <button type="button" aria-label={label} disabled={busy} onClick={leave} className={className}>
      {children}
    </button>
  );
}
