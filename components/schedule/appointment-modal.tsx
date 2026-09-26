"use client";

import { useState } from "react";
import { X, Plus, Trash2, Settings2 } from "lucide-react";
import type { Appt, Doctor, Procedure, Status } from "@/lib/demo-schedule";
import { patients, STATUS_META, DAY_START, DAY_END, fmtHour, PROC_COLORS } from "@/lib/demo-schedule";

export interface ApptDraft {
  id?: string;
  patientName: string;
  procedure: string;
  doctorId: string;
  date: string;
  start: number;
  duration: number; // minutos
  status: Status;
  isReturn: boolean;
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

const slots: number[] = [];
for (let h = DAY_START; h < DAY_END; h += 0.5) slots.push(h);

export function AppointmentModal({
  initial, doctors, procedures, onClose, onSave, onDelete,
  onAddDoctor, onDeleteDoctor, onAddProcedure, onDeleteProcedure,
}: {
  initial: Partial<ApptDraft> & { id?: string };
  doctors: Doctor[];
  procedures: Procedure[];
  onClose: () => void;
  onSave: (d: ApptDraft) => void;
  onDelete?: () => void;
  onAddDoctor: (name: string) => void;
  onDeleteDoctor: (id: string) => void;
  onAddProcedure: (name: string, color: string) => void;
  onDeleteProcedure: (name: string) => void;
}) {
  const [d, setD] = useState<ApptDraft>({
    patientName: initial.patientName ?? "",
    procedure: initial.procedure ?? procedures[0]?.name ?? "",
    doctorId: initial.doctorId ?? doctors[0]?.id ?? "",
    date: initial.date ?? new Date().toISOString().slice(0, 10),
    start: initial.start ?? 9,
    duration: initial.duration ?? 60,
    status: initial.status ?? "registered",
    isReturn: initial.isReturn ?? false,
  });
  const set = (p: Partial<ApptDraft>) => setD((prev) => ({ ...prev, ...p }));
  const isEdit = Boolean(initial.id);

  const [manageDocs, setManageDocs] = useState(false);
  const [manageProcs, setManageProcs] = useState(false);
  const [newDoc, setNewDoc] = useState("");
  const [newProc, setNewProc] = useState("");
  const [newProcColor, setNewProcColor] = useState(PROC_COLORS[0]);

  const addDoc = () => {
    if (!newDoc.trim()) return;
    onAddDoctor(newDoc.trim());
    setNewDoc("");
  };
  const addProc = () => {
    if (!newProc.trim()) return;
    onAddProcedure(newProc.trim(), newProcColor);
    setD((prev) => ({ ...prev, procedure: newProc.trim() }));
    setNewProc("");
    setNewProcColor(PROC_COLORS[(PROC_COLORS.indexOf(newProcColor) + 1) % PROC_COLORS.length]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? "Editar agendamento" : "Novo agendamento"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Paciente</span>
            <input list="pt-list" className={inputCls} value={d.patientName} onChange={(e) => set({ patientName: e.target.value })} placeholder="Nome do paciente" />
            <datalist id="pt-list">{patients.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </label>

          {/* Procedimento + gerenciar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Procedimento</span>
              <button type="button" onClick={() => setManageProcs((s) => !s)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                <Settings2 className="h-3.5 w-3.5" /> Gerenciar
              </button>
            </div>
            <select className={inputCls} value={d.procedure} onChange={(e) => set({ procedure: e.target.value })}>
              {procedures.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            {manageProcs && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {procedures.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="flex-1 truncate text-slate-700">{p.name}</span>
                      <button type="button" onClick={() => onDeleteProcedure(p.name)} disabled={procedures.length <= 1} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label="Remover procedimento">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input type="color" value={newProcColor} onChange={(e) => setNewProcColor(e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5" aria-label="Cor do procedimento" />
                  <input className={inputCls} value={newProc} onChange={(e) => setNewProc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProc())} placeholder="Novo procedimento" />
                  <button type="button" onClick={addProc} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profissional + gerenciar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Profissional</span>
              <button type="button" onClick={() => setManageDocs((s) => !s)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                <Settings2 className="h-3.5 w-3.5" /> Gerenciar
              </button>
            </div>
            <select className={inputCls} value={d.doctorId} onChange={(e) => set({ doctorId: e.target.value })}>
              {doctors.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
            </select>
            {manageDocs && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {doctors.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${doc.avatarColor}`}>{doc.initials}</span>
                      <span className="flex-1 truncate text-slate-700">{doc.name}</span>
                      <button type="button" onClick={() => onDeleteDoctor(doc.id)} disabled={doctors.length <= 1} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label="Remover profissional">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className={inputCls} value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDoc())} placeholder="Nome do profissional" />
                  <button type="button" onClick={addDoc} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Data</span>
              <input type="date" className={inputCls} value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Início</span>
              <select className={inputCls} value={d.start} onChange={(e) => set({ start: Number(e.target.value) })}>
                {slots.map((s) => <option key={s} value={s}>{fmtHour(s)}</option>)}
              </select>
            </label>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Duração</span>
              <select className={inputCls} value={d.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
              <select className={inputCls} value={d.status} onChange={(e) => set({ status: e.target.value as Status })}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={d.isReturn} onChange={(e) => set({ isReturn: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            É um retorno
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          {isEdit && onDelete ? (
            <button onClick={onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Excluir</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button
              onClick={() => d.patientName.trim() && onSave(d)}
              disabled={!d.patientName.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
            >
              {isEdit ? "Salvar" : "Agendar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function draftToAppt(d: ApptDraft, patientId: string, id: string): Appt {
  return {
    id, doctorId: d.doctorId, patientId, procedure: d.procedure, date: d.date,
    start: d.start, end: d.start + d.duration / 60, status: d.status, isReturn: d.isReturn,
  };
}
