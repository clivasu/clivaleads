"use client";

import { useEffect } from "react";
import { initPwa } from "@/lib/pwa";

// Só no painel: paciente que abre um funil público não recebe convite da Cliva.
export function PwaInit() {
  useEffect(() => { initPwa(); }, []);
  return null;
}
