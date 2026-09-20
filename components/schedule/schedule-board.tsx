"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalIcon, ArrowLeft2, ArrowRight2, Filter, ArrowDown2, More, Coffee, Add,
} from "iconsax-reactjs";
import { Bell, X, Repeat } from "lucide-react";
import {
  doctors, patients as seedPatients, PROCEDURES, STATUS_META, DAY_START, DAY_END,
  procColor, fmtHour, iso, addDays, seedAppointments, patientById as findSeedPatient,
  type Appt, type Patient, type Status,
} from "@/lib/demo-schedule";
import { PatientPanel } from "@/components/schedule/patient-panel";
import { AppointmentModal, draftToAppt, type ApptDraft } from "@/components/schedule/appointment-modal";
import { cn } from "@/lib/utils";

const ROW_H = 76;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // segunda=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

type View = "day" | "week" | "month";

export function ScheduleBoard() {
  const [appts, setAppts] = useState<Appt[]>(() => seedAppointments());
  const [extraPatients, setExtraPatients] = useState<Patient[]>([]);
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [docFilter, setDocFilter] = useState<string>("all");
  const [procFilter, setProcFilter] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<(Partial<ApptDraft> & { id?: string }) | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dismissedNotif, setDismissedNotif] = useState<string | null>(null);
  const [tab, setTab] = useState<"cal" | "hist">("cal");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const patientOf = (id: string): Patient | undefined =>
    findSeedPatient(id) ?? extraPatients.find((p) => p.id === id);

  const visibleDoctors = docFilter === "all" ? doctors : doctors.filter((d) => d.id === docFilter);

  const filtered = useMemo(
    () => appts.filter((a) => (procFilter.size === 0 || procFilter.has(a.procedure)) && (docFilter === "all" || a.doctorId === docFilter)),
    [appts, procFilter, docFilter],
  );

  // ------- CRUD -------
  const saveDraft = (d: ApptDraft) => {
    let patient = seedPatients.find((p) => p.name === d.patientName) ?? extraPatients.find((p) => p.name === d.patientName);
    if (!patient) {
      patient = { id: "np" + Date.now(), name: d.patientName, phone: "55", age: 30, gender: "F", since: iso(new Date()), tags: ["Novo"], notes: "", history: [] };
      setExtraPatients((p) => [...p, patient!]);
    }
    if (d.id) {
      setAppts((prev) => prev.map((a) => (a.id === d.id ? draftToAppt(d, patient!.id, d.id) : a)));
    } else {
      setAppts((prev) => [...prev, draftToAppt(d, patient!.id, "ap" + Date.now())]);
    }
    setModal(null);
  };
  const setStatus = (id: string, s: Status) => setAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status: s } : a)));
  const moveAppt = (id: string, patch: Partial<Appt>) => setAppts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const deleteAppt = (id: string) => { setAppts((prev) => prev.filter((a) => a.id !== id)); setSelectedId(null); setModal(null); };

  // ------- notificação de próximo -------
  const todayIso = iso(now);
  const nowDec = now.getHours() + now.getMinutes() / 60;
  const upcoming = useMemo(() => {
    return appts
      .filter((a) => a.date === todayIso && a.start >= nowDec - 0.05 && a.status !== "done" && a.status !== "cancelled")
      .sort((a, b) => a.start - b.start)[0];
  }, [appts, todayIso, nowDec]);
  const notifKey = upcoming ? upcoming.id : "";
  const minsTo = upcoming ? Math.round((upcoming.start - nowDec) * 60) : 0;

  const selected = appts.find((a) => a.id === selectedId);
  const selectedPatient = selected ? patientOf(selected.patientId) : undefined;

  // ------- header -------
  const dateLabel = view === "month"
    ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : view === "week"
    ? `Semana de ${startOfWeek(cursor).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : cursor.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const step = view === "month" ? "month" : view === "week" ? 7 : 1;
  const shift = (dir: number) => {
    setCursor((c) => {
      const d = new Date(c);
      if (step === "month") d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * (step as number));
      return d;
    });
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {/* notificação */}
      {upcoming && dismissedNotif !== notifKey && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white"><Bell className="h-4 w-4" /></span>
          <div className="flex-1 text-sm">
            <span className="font-semibold text-slate-800">Próximo: {patientOf(upcoming.patientId)?.name}</span>
            <span className="text-slate-500"> · {upcoming.procedure} às {fmtHour(upcoming.start)} {minsTo > 0 ? `(em ${minsTo} min)` : "(agora)"}</span>
          </div>
          <button onClick={() => { setSelectedId(upcoming.id); }} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">Ver</button>
          <button onClick={() => setDismissedNotif(notifKey)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* tabs */}
      <div className="flex items-center gap-6 border-b px-6">
        <button onClick={() => setTab("cal")} className={cn("border-b-2 py-4 text-sm font-semibold", tab === "cal" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400")}>Calendário</button>
        <button onClick={() => setTab("hist")} className={cn("border-b-2 py-4 text-sm font-medium", tab === "hist" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400")}>Histórico</button>
        <button onClick={() => setModal({ date: iso(cursor) })} className="my-2 ml-auto flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          <Add size={18} color="#fff" /> Novo agendamento
        </button>
      </div>

      {tab === "hist" ? (
        <History appts={appts} patientOf={patientOf} onOpen={setSelectedId} />
      ) : (
        <>
          {/* controls */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><CalIcon size={18} variant="Bulk" color="#475569" /></span>
            <p className="text-sm text-slate-500"><span className="font-semibold text-slate-800">{filtered.length}</span> agendamentos</p>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d); }} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-emerald-600">Hoje</button>
              <button onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-500 hover:bg-slate-50"><ArrowLeft2 size={16} color="currentColor" /></button>
              <button onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-500 hover:bg-slate-50"><ArrowRight2 size={16} color="currentColor" /></button>
              <span className="min-w-[120px] text-sm font-semibold capitalize text-slate-800">{dateLabel}</span>

              <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
                {(["day", "week", "month"] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1 transition-colors", view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                    {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                  </button>
                ))}
              </div>

              <div className="relative">
                <button onClick={() => setShowDocMenu((s) => !s)} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {docFilter === "all" ? "Todos os profissionais" : doctors.find((d) => d.id === docFilter)?.name}
                  <ArrowDown2 size={14} color="currentColor" />
                </button>
                {showDocMenu && (
                  <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
                    <button onClick={() => { setDocFilter("all"); setShowDocMenu(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50">Todos os profissionais</button>
                    {doctors.map((d) => (
                      <button key={d.id} onClick={() => { setDocFilter(d.id); setShowDocMenu(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50">{d.name}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setShowFilters((s) => !s)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50", procFilter.size > 0 ? "border-emerald-300 text-emerald-600" : "text-slate-600")}>
                  <Filter size={16} variant="Bulk" color={procFilter.size > 0 ? "#059669" : "#64748b"} /> Filtros {procFilter.size > 0 && `(${procFilter.size})`}
                </button>
                {showFilters && (
                  <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold text-slate-500">Procedimentos</p>
                    <div className="flex flex-col gap-1">
                      {PROCEDURES.map((p) => (
                        <label key={p.name} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                          <input type="checkbox" checked={procFilter.has(p.name)} onChange={(e) => setProcFilter((prev) => { const n = new Set(prev); e.target.checked ? n.add(p.name) : n.delete(p.name); return n; })} className="accent-emerald-500" />
                          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                    {procFilter.size > 0 && <button onClick={() => setProcFilter(new Set())} className="mt-2 text-xs font-medium text-emerald-600">Limpar</button>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* legenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-3">
            {PROCEDURES.map((p) => (
              <span key={p.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name}
              </span>
            ))}
          </div>

          {view === "month" ? (
            <MonthGrid cursor={cursor} appts={filtered} onOpenDay={(d) => { setCursor(d); setView("day"); }} onOpenAppt={setSelectedId} />
          ) : (
            <TimeGrid
              view={view}
              cursor={cursor}
              doctors={visibleDoctors}
              appts={filtered}
              patientOf={patientOf}
              now={now}
              onOpen={setSelectedId}
              onMove={moveAppt}
              onCreate={(colKey, time) => setModal(view === "day"
                ? { doctorId: colKey, date: iso(cursor), start: time }
                : { doctorId: docFilter === "all" ? doctors[0].id : docFilter, date: colKey, start: time })}
            />
          )}
        </>
      )}

      {selected && selectedPatient && (
        <PatientPanel
          appt={selected}
          patient={selectedPatient}
          doctor={doctors.find((d) => d.id === selected.doctorId)}
          onClose={() => setSelectedId(null)}
          onStatus={(s) => setStatus(selected.id, s)}
          onEdit={() => { const dur = Math.round((selected.end - selected.start) * 60); setModal({ id: selected.id, patientName: selectedPatient.name, procedure: selected.procedure, doctorId: selected.doctorId, date: selected.date, start: selected.start, duration: dur, status: selected.status, isReturn: selected.isReturn }); setSelectedId(null); }}
        />
      )}

      {modal && (
        <AppointmentModal
          initial={modal}
          onClose={() => setModal(null)}
          onSave={saveDraft}
          onDelete={modal.id ? () => deleteAppt(modal.id!) : undefined}
        />
      )}
    </div>
  );
}

/* ============================ TIME GRID (Dia / Semana) ============================ */

function TimeGrid({
  view, cursor, doctors: docs, appts, patientOf, now, onOpen, onMove, onCreate,
}: {
  view: "day" | "week";
  cursor: Date;
  doctors: typeof doctors;
  appts: Appt[];
  patientOf: (id: string) => Patient | undefined;
  now: Date;
  onOpen: (id: string) => void;
  onMove: (id: string, patch: Partial<Appt>) => void;
  onCreate: (colKey: string, time: number) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; dur: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; appt: Appt; time: number } | null>(null);

  const weekStart = startOfWeek(cursor);
  const columns = view === "day"
    ? docs.map((d) => ({ key: d.id, title: d.name, sub: "", avatar: d.initials, avatarColor: d.avatarColor }))
    : Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { key: iso(d), title: WEEKDAYS[i], sub: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), avatar: "", avatarColor: "" };
      });

  const inCol = (a: Appt, colKey: string) =>
    view === "day" ? a.doctorId === colKey && a.date === iso(cursor) : a.date === colKey;

  const computeDrop = (clientX: number, clientY: number) => {
    const r = bodyRef.current!.getBoundingClientRect();
    const colW = r.width / columns.length;
    const colIdx = clamp(Math.floor((clientX - r.left) / colW), 0, columns.length - 1);
    let time = DAY_START + (clientY - r.top) / ROW_H;
    time = clamp(Math.round(time / 0.25) * 0.25, DAY_START, DAY_END - 0.25);
    return { colKey: columns[colIdx].key, time };
  };

  const bodyH = HOURS.length * ROW_H;
  const showNow = view === "day" && iso(now) === iso(cursor);
  const nowDec = now.getHours() + now.getMinutes() / 60;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* headers */}
        <div className="flex border-b">
          <div className="w-16 shrink-0" />
          {columns.map((c) => (
            <div key={c.key} className="flex flex-1 items-center gap-2 border-l px-3 py-3">
              {c.avatar ? <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", c.avatarColor)}>{c.avatar}</span> : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{c.title}</p>
                {c.sub && <p className="text-[11px] text-slate-400">{c.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* body */}
        <div className="flex">
          <div className="w-16 shrink-0">
            <div className="relative" style={{ height: bodyH }}>
              {HOURS.map((h, i) => (
                <div key={h} className="absolute right-2 text-xs text-slate-400" style={{ top: i * ROW_H - 7 }}>{fmtHour(h)}</div>
              ))}
            </div>
          </div>

          <div ref={bodyRef} className="relative flex flex-1">
            {columns.map((c) => (
              <div key={c.key} className="relative flex-1 border-l" style={{ height: bodyH }}>
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 cursor-copy border-t border-slate-100 hover:bg-emerald-50/40"
                    style={{ top: i * ROW_H, height: ROW_H }}
                    onClick={() => onCreate(c.key, h)}
                  />
                ))}
                {appts.filter((a) => inCol(a, c.key)).map((a) => {
                  const color = procColor(a.procedure);
                  const patient = patientOf(a.patientId);
                  const st = STATUS_META[a.status];
                  return (
                    <div
                      key={a.id}
                      onPointerDown={(e) => {
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        drag.current = { id: a.id, startX: e.clientX, startY: e.clientY, dur: a.end - a.start, moved: false };
                      }}
                      onPointerMove={(e) => {
                        if (!drag.current || drag.current.id !== a.id) return;
                        if (Math.abs(e.clientX - drag.current.startX) + Math.abs(e.clientY - drag.current.startY) > 4) drag.current.moved = true;
                        if (drag.current.moved) { const d = computeDrop(e.clientX, e.clientY); setGhost({ x: e.clientX, y: e.clientY, appt: a, time: d.time }); }
                      }}
                      onPointerUp={(e) => {
                        if (!drag.current || drag.current.id !== a.id) return;
                        if (!drag.current.moved) { onOpen(a.id); }
                        else {
                          const d = computeDrop(e.clientX, e.clientY);
                          const patch: Partial<Appt> = { start: d.time, end: d.time + drag.current.dur };
                          if (view === "day") patch.doctorId = d.colKey; else patch.date = d.colKey;
                          onMove(a.id, patch);
                        }
                        drag.current = null; setGhost(null);
                      }}
                      className="absolute inset-x-1 cursor-grab overflow-hidden rounded-lg border-l-4 bg-white px-2.5 py-1.5 shadow-sm active:cursor-grabbing"
                      style={{ top: (a.start - DAY_START) * ROW_H + 2, height: (a.end - a.start) * ROW_H - 4, borderLeftColor: color, background: `${color}10` }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-slate-800">{patient?.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{fmtHour(a.start)} – {fmtHour(a.end)}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="inline-block truncate rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${color}22`, color }}>{a.procedure}</span>
                        {a.isReturn && <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700"><Repeat className="h-2.5 w-2.5" />Retorno</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {showNow && (
              <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowDec - DAY_START) * ROW_H }}>
                <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{fmtHour(nowDec)}</span>
                <div className="h-px flex-1 bg-rose-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {ghost && (
        <div className="pointer-events-none fixed z-50 rounded-lg border-l-4 bg-white px-3 py-2 text-sm shadow-xl" style={{ left: ghost.x + 12, top: ghost.y - 10, borderLeftColor: procColor(ghost.appt.procedure) }}>
          <span className="font-semibold text-slate-800">{patientOf(ghost.appt.patientId)?.name}</span>
          <span className="ml-2 text-slate-500">{fmtHour(ghost.time)}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ MONTH ============================ */

function MonthGrid({
  cursor, appts, onOpenDay, onOpenAppt,
}: {
  cursor: Date;
  appts: Appt[];
  onOpenDay: (d: Date) => void;
  onOpenAppt: (id: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayI = iso(new Date());

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-slate-200">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500">{w}</div>
        ))}
        {days.map((d) => {
          const di = iso(d);
          const dayAppts = appts.filter((a) => a.date === di).sort((a, b) => a.start - b.start);
          const inMonth = d.getMonth() === cursor.getMonth();
          return (
            <div key={di} className={cn("min-h-[104px] bg-white p-1.5", !inMonth && "bg-slate-50/60")}>
              <button onClick={() => onOpenDay(d)} className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium", di === todayI ? "bg-emerald-500 text-white" : inMonth ? "text-slate-600 hover:bg-slate-100" : "text-slate-300")}>
                {d.getDate()}
              </button>
              <div className="flex flex-col gap-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => onOpenAppt(a.id)} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px]" style={{ background: `${procColor(a.procedure)}18` }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: procColor(a.procedure) }} />
                    <span className="truncate text-slate-600">{fmtHour(a.start)} {a.procedure}</span>
                  </button>
                ))}
                {dayAppts.length > 3 && <span className="px-1 text-[10px] text-slate-400">+{dayAppts.length - 3} mais</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ HISTÓRICO ============================ */

function History({ appts, patientOf, onOpen }: { appts: Appt[]; patientOf: (id: string) => Patient | undefined; onOpen: (id: string) => void }) {
  const rows = [...appts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.start - a.start));
  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-3 font-medium">Data</th><th className="pb-3 font-medium">Paciente</th><th className="pb-3 font-medium">Procedimento</th><th className="pb-3 font-medium">Horário</th><th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-b last:border-0 hover:bg-slate-50">
                <td className="py-3 text-slate-500">{new Date(a.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td className="py-3 font-medium text-slate-800">{patientOf(a.patientId)?.name}</td>
                <td className="py-3"><span className="inline-flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: procColor(a.procedure) }} />{a.procedure}</span></td>
                <td className="py-3 text-slate-500">{fmtHour(a.start)}–{fmtHour(a.end)}</td>
                <td className="py-3"><span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[a.status].dot }} />{STATUS_META[a.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
