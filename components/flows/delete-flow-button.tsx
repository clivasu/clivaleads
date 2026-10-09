"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { countFlowLeads, deleteFlow } from "@/lib/actions/flows";
import { cn } from "@/lib/utils";

// Botão "Excluir funil" com confirmação. Mostra quantos leads vão junto.
export function DeleteFlowButton({
  flowId, flowName, variant = "icon", redirectTo,
}: {
  flowId: string;
  flowName: string;
  variant?: "icon" | "button";
  redirectTo?: string; // ex.: "/flows" quando excluído de dentro do construtor
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openDialog = () => {
    setOpen(true);
    setError(null);
    setLeads(null);
    countFlowLeads(flowId).then(setLeads).catch(() => setLeads(0));
  };

  const confirm = () =>
    start(async () => {
      const res = await deleteFlow(flowId);
      if (!res.ok) { setError(res.error ?? "Não foi possível excluir."); return; }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });

  return (
    <>
      {variant === "icon" ? (
        <button onClick={openDialog} aria-label={`Excluir ${flowName}`} title="Excluir funil"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <button onClick={openDialog} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
          Excluir funil
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50"><Trash2 className="h-5 w-5 text-rose-600" /></span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Excluir “{flowName}”?</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              {leads === null ? "Verificando leads…" : leads > 0
                ? <>Os <b className="text-slate-800">{leads} lead{leads === 1 ? "" : "s"}</b> capturados por este funil também serão apagados. Isso não pode ser desfeito.</>
                : "Este funil não tem leads. Isso não pode ser desfeito."}
            </p>
            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={pending} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirm} disabled={pending || leads === null}
                className={cn("flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60")}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
