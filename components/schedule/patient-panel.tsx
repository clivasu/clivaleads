"use client";

import { X, Phone, MessageCircle, Calendar, Clock, Pencil, Check, Ban } from "lucide-react";
import type { Appt, Doctor, Patient, Status } from "@/lib/demo-schedule";
import { STATUS_META, procColor, fmtHour } from "@/lib/demo-schedule";
import { cn } from "@/lib/utils";

const STATUS_ORDER: Status[] = ["registered", "confirmed", "in_progress", "done", "cancelled"];

export function PatientPanel({
  appt, patient, doctor, procColorOf, onClose, onStatus, onEdit,
}: {
  appt: Appt;
  patient: Patient;
  doctor?: Doctor;
  procColorOf?: (name: string) => string;
  onClose: () => void;
  onStatus: (s: Status) => void;
  onEdit: () => void;
}) {
  const colorOf = procColorOf ?? procColor;
  const color = colorOf(appt.procedure);
  const waHref = `https://wa.me/${patient.phone}?text=${encodeURIComponent(`Olá ${patient.name.split(" ")[0]}! Tudo bem?`)}`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ficha do paciente</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Identidade */}
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{patient.name}</h3>
              <p className="text-sm text-slate-500">
                {patient.age} anos · {patient.gender === "F" ? "Feminino" : "Masculino"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {appt.isReturn && <Badge className="bg-amber-100 text-amber-700">Retorno</Badge>}
            {patient.tags.map((t) => (
              <Badge key={t} className="bg-slate-100 text-slate-600">{t}</Badge>
            ))}
            <Badge className="bg-slate-100 text-slate-500">Paciente desde {new Date(patient.since).getFullYear()}</Badge>
          </div>

          {/* Contato */}
          <div className="mt-4 flex gap-2">
            <a href={`tel:${patient.phone}`} className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Phone className="h-4 w-4" /> Ligar
            </a>
            <a href={waHref} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>

          {/* Agendamento atual */}
          <div className="mt-5 rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="font-semibold text-slate-800">{appt.procedure}</span>
            </div>
            <div className="flex flex-col gap-1 text-sm text-slate-500">
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {new Date(appt.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {fmtHour(appt.start)} – {fmtHour(appt.end)} · {doctor?.name}</span>
            </div>
            {/* Status */}
            <p className="mb-1 mt-3 text-xs font-medium text-slate-400">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    appt.status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: appt.status === s ? "#fff" : STATUS_META[s].dot }} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          {patient.notes && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-slate-400">Observações</p>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{patient.notes}</p>
            </div>
          )}

          {/* Histórico */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-400">Histórico de atendimentos</p>
            {patient.history.length === 0 ? (
              <p className="text-sm text-slate-400">Sem atendimentos anteriores.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {patient.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(h.procedure) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{h.procedure}</span>
                        <span className="text-xs text-slate-400">{new Date(h.date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-xs text-slate-500">{h.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-2 border-t p-4">
          <button onClick={onEdit} className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button onClick={() => onStatus("done")} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
            <Check className="h-4 w-4" /> Concluir
          </button>
          <button onClick={() => onStatus("cancelled")} className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
            <Ban className="h-4 w-4" /> Cancelar
          </button>
        </div>
      </aside>
    </>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>{children}</span>;
}
