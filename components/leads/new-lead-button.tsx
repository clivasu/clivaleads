"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { createManualLead } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

const input = "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-400 focus:outline-none";
const SOURCES = ["Indicação", "Instagram", "WhatsApp", "Ligação", "Passou na frente", "Facebook", "Google", "Evento", "Outro"];
const STATUSES: [string, string][] = [["new", "Novo"], ["qualified", "Qualificado"], ["whatsapp", "Em conversa (WhatsApp)"], ["scheduled", "Agendado"], ["converted", "Convertido"], ["lost", "Perdido"]];

// Botão "Novo lead" da página Leads: cadastro manual (fora dos funis).
export function NewLeadButton({ procedures }: { procedures: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", procedure: "", source: "Indicação", interest: "warm" as "hot" | "warm" | "cold", status: "new", notes: "", createPatient: true });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const submit = () => start(async () => {
    setError(null);
    const r = await createManualLead({ ...f, status: f.status as "new" });
    if (!r.ok) { setError(r.error ?? "Não foi possível cadastrar."); return; }
    setOpen(false);
    setF({ name: "", phone: "", email: "", procedure: "", source: "Indicação", interest: "warm", status: "new", notes: "", createPatient: true });
    router.refresh();
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
        <Plus className="h-4 w-4" /> Novo lead
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Novo lead" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Novo lead</h2>
                <p className="text-xs text-slate-400">Para contatos que não vieram pelos funis (indicação, ligação, balcão…).</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <form className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Nome completo *</span>
                <input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus required /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">WhatsApp *</span>
                  <input className={input} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(61) 90000-0000" required /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">E-mail</span>
                  <input type="email" className={input} value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Procedimento de interesse</span>
                  <input className={input} list="lead-procs" value={f.procedure} onChange={(e) => set({ procedure: e.target.value })} />
                  <datalist id="lead-procs">{procedures.map((p) => <option key={p} value={p} />)}</datalist></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Origem</span>
                  <select className={input} value={f.source} onChange={(e) => set({ source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-500">Interesse</span>
                <div className="grid grid-cols-3 gap-2">
                  {([["hot", "Quente", "border-emerald-400 bg-emerald-50 text-emerald-700"], ["warm", "Em potencial", "border-amber-400 bg-amber-50 text-amber-700"], ["cold", "Frio", "border-slate-400 bg-slate-50 text-slate-700"]] as const).map(([k, l, on]) => (
                    <button key={k} type="button" aria-pressed={f.interest === k} onClick={() => set({ interest: k })}
                      className={cn("rounded-lg border py-2 text-sm font-medium", f.interest === k ? on : "border-slate-200 text-slate-500")}>{l}</button>
                  ))}
                </div>
              </div>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
                <select className={input} value={f.status} onChange={(e) => set({ status: e.target.value })}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Observações</span>
                <textarea rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ex.: indicada pela paciente Ana; quer orçamento de pacote" /></label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={f.createPatient} onChange={(e) => set({ createPatient: e.target.checked })} />
                Criar também a ficha de paciente
              </label>
              {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
