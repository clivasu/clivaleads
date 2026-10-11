"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Phone, MessageCircle, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tierFromScore, TIER_LABEL } from "@/lib/scoring";
import type { LeadStatus } from "@/lib/types";
import { deleteLeadAction, updateLeadAction } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

export interface LeadRow {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  procedure: string | null;
  score: number;
  status: LeadStatus;
  created_at: string;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  whatsapp: "WhatsApp",
  scheduled: "Agendado",
  converted: "Convertido",
  lost: "Perdido",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function digits(p?: string | null) {
  return (p ?? "").replace(/\D/g, "");
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [rows, setRows] = useState<LeadRow[]>(leads);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [confirming, setConfirming] = useState<LeadRow | null>(null);
  const [, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  // Otimista: aplica na hora e desfaz se o banco recusar (ex.: sem permissão).
  const remove = (lead: LeadRow) => {
    const before = rows;
    setRows((prev) => prev.filter((l) => l.id !== lead.id));
    setConfirming(null);
    setError(null);
    startTransition(async () => {
      const res = await deleteLeadAction(lead.id);
      if (!res.ok) { setRows(before); setError("Não foi possível excluir o lead. Tente de novo."); }
    });
  };

  const save = (id: string, patch: Partial<LeadRow>) => {
    const before = rows;
    setRows((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setEditing(null);
    setError(null);
    startTransition(async () => {
      const res = await updateLeadAction(id, {
        name: patch.name, phone: patch.phone, email: patch.email,
        procedure: patch.procedure, status: patch.status,
      });
      if (!res.ok) { setRows(before); setError("Não foi possível salvar as alterações. Tente de novo."); }
    });
  };

  return (
    <div className="overflow-x-auto" onClick={() => setMenuId(null)}>
      {error && (
        <p role="alert" className="flex items-center justify-between gap-3 border-b bg-rose-50 px-5 py-2.5 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="rounded p-0.5 hover:bg-rose-100" aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3 font-medium">Lead</th>
            <th className="px-5 py-3 font-medium">Telefone</th>
            <th className="px-5 py-3 font-medium">Procedimento</th>
            <th className="px-5 py-3 font-medium">Diagnóstico</th>
            <th className="px-5 py-3 font-medium">Data</th>
            <th className="px-5 py-3 text-center font-medium">WhatsApp</th>
            <th className="px-5 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const tier = tierFromScore(l.score);
            return (
              <tr key={l.id} className="border-b transition-colors last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/leads/${l.id}`} className="block">
                    <span className="block font-semibold text-slate-900">{l.name ?? "Sem nome"}</span>
                    {l.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Mail className="h-3 w-3" /> {l.email}
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {l.phone ? (
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {l.phone}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3 font-medium text-slate-800">
                  <Link href={`/leads/${l.id}`} className="block">{l.procedure ?? "—"}</Link>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={tier}>{l.score} · {TIER_LABEL[tier]}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-500">{fmt(l.created_at)}</td>
                <td className="px-5 py-3 text-center">
                  {l.phone ? (
                    <a
                      href={`https://wa.me/${digits(l.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Chamar
                    </a>
                  ) : "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuId(menuId === l.id ? null : l.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Ações"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === l.id && (
                      <div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border bg-white p-1 shadow-lg">
                        <button
                          onClick={() => { setEditing(l); setMenuId(null); }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => { setConfirming(l); setMenuId(null); }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                Nenhum lead com contato ainda. Quando alguém preencher nome, e-mail ou telefone no funil, aparece aqui.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && <EditModal lead={editing} onClose={() => setEditing(null)} onSave={save} />}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Excluir lead</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tem certeza que deseja excluir <span className="font-medium text-slate-700">{confirming.name ?? "este lead"}</span>? Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirming(null)} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => remove(confirming)} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

function EditModal({ lead, onClose, onSave }: { lead: LeadRow; onClose: () => void; onSave: (id: string, patch: Partial<LeadRow>) => void }) {
  const [name, setName] = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [procedure, setProcedure] = useState(lead.procedure ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Editar lead</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Nome</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do lead" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Telefone</span>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55619..." />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">E-mail</span>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Procedimento</span>
            <input className={inputCls} value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Ex.: Harmonização Facial" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => onSave(lead.id, {
              name: name.trim() || null,
              phone: phone.trim() || null,
              email: email.trim() || null,
              procedure: procedure.trim() || null,
              status,
            })}
            className={cn("rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600")}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
