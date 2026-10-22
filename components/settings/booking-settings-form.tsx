"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WEEKDAYS, type BookingSettings, type DayHours } from "@/lib/booking/slots";
import { holidayName } from "@/lib/booking/holidays";
import { saveBookingSettings, saveProcedureDetails } from "@/lib/actions/booking";

const cls = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300";
const NOTICE = [[0, "Sem antecedência"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [720, "12 horas"], [1440, "1 dia"], [2880, "2 dias"]] as const;
const AHEAD = [7, 14, 30, 60, 90] as const;
const SLOTS = [15, 20, 30, 45, 60, 90, 120] as const;

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export interface ProcedureRow { name: string; duration_min: number; price_cents: number | null }

export function BookingSettingsForm({ initial, procedures, available }: { initial: BookingSettings; procedures: ProcedureRow[]; available: boolean }) {
  const [s, setS] = useState<BookingSettings>(initial);
  const [procs, setProcs] = useState(procedures.map((p) => ({ ...p, price: p.price_cents === null ? "" : String(p.price_cents / 100) })));
  const [blocked, setBlocked] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setDay = (i: number, patch: Partial<DayHours>) => setS((p) => ({ ...p, hours: p.hours.map((h, k) => (k === i ? { ...h, ...patch } : h)) }));

  const save = () => start(async () => {
    setMsg(null);
    const r1 = await saveBookingSettings(s);
    if (!r1.ok) { setMsg({ ok: false, text: r1.error ?? "Não foi possível salvar." }); return; }
    if (procs.length) {
      const r2 = await saveProcedureDetails(procs.map((p) => ({ name: p.name, duration_min: Number(p.duration_min) || 60, price: p.price.trim() === "" ? null : Number(p.price.replace(",", ".")) || 0 })));
      if (!r2.ok) { setMsg({ ok: false, text: r2.error ?? "Não foi possível salvar os procedimentos." }); return; }
    }
    setMsg({ ok: true, text: "Agendamento online salvo." });
  });

  if (!available) {
    return (
      <Card className="mb-6">
        <CardHeader><CardTitle>Agendamento online</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-slate-500">Disponível depois da atualização do banco (migration 0018).</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-600" /> Agendamento online</CardTitle>
        <p className="text-sm text-slate-500">Regras para o bloco &quot;Agendamento&quot; dos funis. O paciente vê só horários livres da Agenda.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Receber agendamentos pelos funis</p>
            <p className="text-xs text-slate-500">Desligado: o bloco mostra que a clínica não está agendando online.</p>
          </div>
          <Switch on={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} label="Receber agendamentos pelos funis" />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Horário de atendimento</p>
          <div className="space-y-2">
            {s.hours.map((h, i) => (
              <div key={WEEKDAYS[i]} className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-sm text-slate-600">{WEEKDAYS[i]}</span>
                <Switch on={h.open} onChange={(v) => setDay(i, { open: v })} label={`Atende ${WEEKDAYS[i]}`} />
                <input type="time" className={cls} disabled={!h.open} value={h.start} onChange={(e) => setDay(i, { start: e.target.value })} aria-label={`${WEEKDAYS[i]} abre`} />
                <span className="text-xs text-slate-400">às</span>
                <input type="time" className={cls} disabled={!h.open} value={h.end} onChange={(e) => setDay(i, { end: e.target.value })} aria-label={`${WEEKDAYS[i]} fecha`} />
                <span className="text-xs text-slate-400">pausa</span>
                <input type="time" className={cls} disabled={!h.open} value={h.break_start ?? ""} onChange={(e) => setDay(i, { break_start: e.target.value || null })} aria-label={`${WEEKDAYS[i]} pausa início`} />
                <span className="text-xs text-slate-400">–</span>
                <input type="time" className={cls} disabled={!h.open} value={h.break_end ?? ""} onChange={(e) => setDay(i, { break_end: e.target.value || null })} aria-label={`${WEEKDAYS[i]} pausa fim`} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600">Horários a cada
            <select className={`${cls} mt-1 w-full`} value={s.slot_minutes} onChange={(e) => setS({ ...s, slot_minutes: Number(e.target.value) })}>
              {SLOTS.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Antecedência mínima
            <select className={`${cls} mt-1 w-full`} value={s.min_notice_minutes} onChange={(e) => setS({ ...s, min_notice_minutes: Number(e.target.value) })}>
              {NOTICE.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Agenda aberta por
            <select className={`${cls} mt-1 w-full`} value={s.max_days_ahead} onChange={(e) => setS({ ...s, max_days_ahead: Number(e.target.value) })}>
              {AHEAD.map((d) => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Não abrir feriados nacionais</p>
              <p className="text-xs text-slate-500">Inclui Carnaval, Sexta-feira Santa e Corpus Christi.</p>
            </div>
            <Switch on={s.skip_holidays} onChange={(v) => setS({ ...s, skip_holidays: v })} label="Não abrir feriados" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Confirmar automaticamente</p>
              <p className="text-xs text-slate-500">Desligado: entra na Agenda como &quot;aguardando&quot; para você confirmar.</p>
            </div>
            <Switch on={s.auto_confirm} onChange={(v) => setS({ ...s, auto_confirm: v })} label="Confirmar automaticamente" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Datas sem atendimento</p>
          <div className="flex gap-2">
            <input type="date" className={cls} value={blocked} onChange={(e) => setBlocked(e.target.value)} aria-label="Data sem atendimento" />
            <Button type="button" variant="outline" size="sm" className="gap-1" disabled={!blocked}
              onClick={() => { if (blocked && !s.blocked_dates.includes(blocked)) setS({ ...s, blocked_dates: [...s.blocked_dates, blocked].sort() }); setBlocked(""); }}>
              <Plus className="h-3.5 w-3.5" /> Bloquear
            </Button>
          </div>
          {s.blocked_dates.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.blocked_dates.map((d) => (
                <span key={d} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {d.slice(8, 10)}/{d.slice(5, 7)}/{d.slice(0, 4)}{holidayName(d) ? ` · ${holidayName(d)}` : ""}
                  <button type="button" aria-label={`Desbloquear ${d}`} onClick={() => setS({ ...s, blocked_dates: s.blocked_dates.filter((x) => x !== d) })}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-800">Procedimentos: duração e preço</p>
          <p className="mb-2 text-xs text-slate-500">A duração define o tamanho do horário reservado. O preço entra no faturamento do Dashboard.</p>
          {procs.length === 0 ? (
            <p className="text-xs text-slate-400">Cadastre procedimentos na Agenda.</p>
          ) : (
            <div className="space-y-2">
              {procs.map((p, i) => (
                <div key={p.name} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.name}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="number" min={5} max={720} step={5} className={`${cls} w-20`} value={p.duration_min}
                      onChange={(e) => setProcs((l) => l.map((x, k) => (k === i ? { ...x, duration_min: Number(e.target.value) } : x)))} aria-label={`Duração de ${p.name}`} /> min
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-500">R$
                    <input inputMode="decimal" className={`${cls} w-24`} value={p.price} placeholder="0,00"
                      onChange={(e) => setProcs((l) => l.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} aria-label={`Preço de ${p.name}`} />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar agendamento online
          </Button>
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
