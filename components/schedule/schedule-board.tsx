"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalIcon, ArrowLeft2, ArrowRight2, Filter, ArrowDown2, Add,
} from "iconsax-reactjs";
import { Bell, X, Repeat, MoreVertical, Pencil, Trash2, CalendarClock, Plus, UserPlus, Stethoscope } from "lucide-react";
import {
  doctors as seedDoctors, patients as seedPatients, PROCEDURES as seedProcedures,
  STATUS_META, DAY_START, DAY_END, fmtHour, iso, addDays, seedAppointments,
  patientById as findSeedPatient, AVATAR_COLORS, PROC_COLORS, initialsFrom,
  type Appt, type Patient, type Status, type Doctor, type Procedure,
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
type ColorOf = (name: string) => string;

export function ScheduleBoard({ demo = true, storageKey }: { demo?: boolean; storageKey?: string }) {
  // Conta real começa em branco: só aparece o que a clínica cadastrar.
  const [appts, setAppts] = useState<Appt[]>(() => (demo ? seedAppointments() : []));
  const [docs, setDocs] = useState<Doctor[]>(demo ? seedDoctors : []);
  const [procs, setProcs] = useState<Procedure[]>(demo ? seedProcedures : []);
  const [extraPatients, setExtraPatients] = useState<Patient[]>([]);

  // Guarda a agenda da clínica neste navegador (por organização).
  const loadedRef = useRef(false);
  const key = !demo && storageKey ? `cliva_agenda_${storageKey}` : null;
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.docs)) setDocs(d.docs);
        if (Array.isArray(d.procs)) setProcs(d.procs);
        if (Array.isArray(d.appts)) setAppts(d.appts);
        if (Array.isArray(d.patients)) setExtraPatients(d.patients);
      }
    } catch { /* noop */ }
    loadedRef.current = true;
  }, [key]);
  useEffect(() => {
    if (!key || !loadedRef.current) return;
    try { localStorage.setItem(key, JSON.stringify({ docs, procs, appts, patients: extraPatients })); } catch { /* noop */ }
  }, [key, docs, procs, appts, extraPatients]);
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

  const procColorOf: ColorOf = (name) => procs.find((p) => p.name === name)?.color ?? "#64748b";

  const patientOf = (id: string): Patient | undefined =>
    (demo ? findSeedPatient(id) : undefined) ?? extraPatients.find((p) => p.id === id);

  const visibleDoctors = docFilter === "all" ? docs : docs.filter((d) => d.id === docFilter);

  const filtered = useMemo(
    () => appts.filter((a) => (procFilter.size === 0 || procFilter.has(a.procedure)) && (docFilter === "all" || a.doctorId === docFilter)),
    [appts, procFilter, docFilter],
  );

  // ------- CRUD agendamentos -------
  const saveDraft = (d: ApptDraft) => {
    let patient = (demo ? seedPatients.find((p) => p.name === d.patientName) : undefined) ?? extraPatients.find((p) => p.name === d.patientName);
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

  const openApptEdit = (a: Appt) => {
    const p = patientOf(a.patientId);
    const dur = Math.round((a.end - a.start) * 60);
    setModal({ id: a.id, patientName: p?.name ?? "", procedure: a.procedure, doctorId: a.doctorId, date: a.date, start: a.start, duration: dur, status: a.status, isReturn: a.isReturn });
    setSelectedId(null);
  };

  // ------- CRUD profissionais / procedimentos -------
  const addDoctor = (name: string) => {
    setDocs((prev) => {
      if (prev.some((d) => d.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { id: "doc" + Date.now(), name, initials: initialsFrom(name), avatarColor: AVATAR_COLORS[prev.length % AVATAR_COLORS.length] }];
    });
  };
  const deleteDoctor = (id: string) => {
    setDocs((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
    setDocFilter((f) => (f === id ? "all" : f));
  };
  const addProcedure = (name: string, color: string) => {
    setProcs((prev) => (prev.some((p) => p.name.toLowerCase() === name.toLowerCase()) ? prev : [...prev, { name, color }]));
  };
  const deleteProcedure = (name: string) => {
    setProcs((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.name !== name)));
    setProcFilter((prev) => { const n = new Set(prev); n.delete(name); return n; });
  };

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
        <History appts={appts} patientOf={patientOf} procColorOf={procColorOf} onOpen={setSelectedId} onEdit={openApptEdit} onDelete={deleteAppt} />
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
                  {docFilter === "all" ? "Todos os profissionais" : docs.find((d) => d.id === docFilter)?.name}
                  <ArrowDown2 size={14} color="currentColor" />
                </button>
                {showDocMenu && (
                  <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
                    <button onClick={() => { setDocFilter("all"); setShowDocMenu(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50">Todos os profissionais</button>
                    {docs.map((d) => (
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
                      {procs.map((p) => (
                        <label key={p.name} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                          <input type="checkbox" checked={procFilter.has(p.name)} onChange={(e) => setProcFilter((prev) => { const n = new Set(prev); if (e.target.checked) n.add(p.name); else n.delete(p.name); return n; })} className="accent-emerald-500" />
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
            {procs.map((p) => (
              <span key={p.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name}
              </span>
            ))}
          </div>

          {docs.length === 0 ? (
            <AgendaSetup procedures={procs} onAddDoctor={addDoctor} onAddProcedure={addProcedure} onDeleteProcedure={deleteProcedure} />
          ) : view === "month" ? (
            <MonthGrid cursor={cursor} appts={filtered} procColorOf={procColorOf} onOpenDay={(d) => { setCursor(d); setView("day"); }} onOpenAppt={setSelectedId} />
          ) : (
            <TimeGrid
              view={view}
              cursor={cursor}
              doctors={visibleDoctors}
              appts={filtered}
              patientOf={patientOf}
              procColorOf={procColorOf}
              now={now}
              onOpen={setSelectedId}
              onMove={moveAppt}
              onCreate={(colKey, time) => setModal(view === "day"
                ? { doctorId: colKey, date: iso(cursor), start: time }
                : { doctorId: docFilter === "all" ? docs[0]?.id : docFilter, date: colKey, start: time })}
            />
          )}
        </>
      )}

      {selected && selectedPatient && (
        <PatientPanel
          appt={selected}
          patient={selectedPatient}
          doctor={docs.find((d) => d.id === selected.doctorId)}
          procColorOf={procColorOf}
          onClose={() => setSelectedId(null)}
          onStatus={(s) => setStatus(selected.id, s)}
          onEdit={() => openApptEdit(selected)}
        />
      )}

      {modal && (
        <AppointmentModal
          initial={modal}
          doctors={docs}
          procedures={procs}
          patients={demo ? seedPatients : extraPatients}
          onClose={() => setModal(null)}
          onSave={saveDraft}
          onDelete={modal.id ? () => deleteAppt(modal.id!) : undefined}
          onAddDoctor={addDoctor}
          onDeleteDoctor={deleteDoctor}
          onAddProcedure={addProcedure}
          onDeleteProcedure={deleteProcedure}
        />
      )}
    </div>
  );
}

/* ============================ TIME GRID (Dia / Semana) ============================ */

function TimeGrid({
  view, cursor, doctors: docs, appts, patientOf, procColorOf, now, onOpen, onMove, onCreate,
}: {
  view: "day" | "week";
  cursor: Date;
  doctors: Doctor[];
  appts: Appt[];
  patientOf: (id: string) => Patient | undefined;
  procColorOf: ColorOf;
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
                  const color = procColorOf(a.procedure);
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
        <div className="pointer-events-none fixed z-50 rounded-lg border-l-4 bg-white px-3 py-2 text-sm shadow-xl" style={{ left: ghost.x + 12, top: ghost.y - 10, borderLeftColor: procColorOf(ghost.appt.procedure) }}>
          <span className="font-semibold text-slate-800">{patientOf(ghost.appt.patientId)?.name}</span>
          <span className="ml-2 text-slate-500">{fmtHour(ghost.time)}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ MONTH ============================ */

function MonthGrid({
  cursor, appts, procColorOf, onOpenDay, onOpenAppt,
}: {
  cursor: Date;
  appts: Appt[];
  procColorOf: ColorOf;
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
                  <button key={a.id} onClick={() => onOpenAppt(a.id)} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px]" style={{ background: `${procColorOf(a.procedure)}18` }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: procColorOf(a.procedure) }} />
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

function History({
  appts, patientOf, procColorOf, onOpen, onEdit, onDelete,
}: {
  appts: Appt[];
  patientOf: (id: string) => Patient | undefined;
  procColorOf: ColorOf;
  onOpen: (id: string) => void;
  onEdit: (a: Appt) => void;
  onDelete: (id: string) => void;
}) {
  const rows = [...appts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.start - a.start));
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="p-6" onClick={() => setMenuId(null)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-3 font-medium">Data</th><th className="pb-3 font-medium">Paciente</th><th className="pb-3 font-medium">Procedimento</th><th className="pb-3 font-medium">Horário</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="cursor-pointer py-3 text-slate-500" onClick={() => onOpen(a.id)}>{new Date(a.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td className="cursor-pointer py-3 font-medium text-slate-800" onClick={() => onOpen(a.id)}>{patientOf(a.patientId)?.name}</td>
                <td className="cursor-pointer py-3" onClick={() => onOpen(a.id)}><span className="inline-flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: procColorOf(a.procedure) }} />{a.procedure}</span></td>
                <td className="cursor-pointer py-3 text-slate-500" onClick={() => onOpen(a.id)}>{fmtHour(a.start)}–{fmtHour(a.end)}</td>
                <td className="cursor-pointer py-3" onClick={() => onOpen(a.id)}><span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[a.status].dot }} />{STATUS_META[a.status].label}</span></td>
                <td className="py-3 text-right">
                  <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setMenuId(menuId === a.id ? null : a.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Ações">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === a.id && (
                      <div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border bg-white p-1 shadow-lg">
                        <button onClick={() => { onEdit(a); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button onClick={() => { onEdit(a); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          <CalendarClock className="h-3.5 w-3.5" /> Reagendar
                        </button>
                        <button onClick={() => { setConfirmId(a.id); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Nenhum agendamento no histórico.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setConfirmId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Excluir agendamento</h2>
            <p className="mt-1 text-sm text-slate-500">Tem certeza? Essa ação não pode ser desfeita.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => { onDelete(confirmId); setConfirmId(null); }} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ PRIMEIROS PASSOS (agenda vazia) ============================ */

function AgendaSetup({
  procedures, onAddDoctor, onAddProcedure, onDeleteProcedure,
}: {
  procedures: Procedure[];
  onAddDoctor: (name: string) => void;
  onAddProcedure: (name: string, color: string) => void;
  onDeleteProcedure: (name: string) => void;
}) {
  const [doc, setDoc] = useState("");
  const [proc, setProc] = useState("");
  const [color, setColor] = useState(PROC_COLORS[0]);
  const addDoc = () => { if (doc.trim()) { onAddDoctor(doc.trim()); setDoc(""); } };
  const addProc = () => {
    if (!proc.trim()) return;
    onAddProcedure(proc.trim(), color);
    setProc("");
    setColor(PROC_COLORS[(PROC_COLORS.indexOf(color) + 1) % PROC_COLORS.length]);
  };
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
  return (
    <div className="px-6 pb-10 pt-2">
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"><Stethoscope className="h-6 w-6 text-emerald-600" /></span>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Monte a agenda da sua clínica</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Cadastre quem atende e os procedimentos que vocês fazem. Depois é só clicar em um horário para agendar.</p>
        <div className="mt-6 grid gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><UserPlus className="h-4 w-4 text-emerald-600" /> 1. Profissional</p>
            <p className="mt-0.5 text-xs text-slate-400">Cada profissional vira uma coluna da agenda.</p>
            <div className="mt-3 flex gap-2">
              <input className={input} value={doc} onChange={(e) => setDoc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDoc()} placeholder="Ex.: Dra. Ana Souza" />
              <button onClick={addDoc} className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Adicionar</button>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> 2. Procedimentos</p>
            <p className="mt-0.5 text-xs text-slate-400">Cada um ganha uma cor no calendário.</p>
            <div className="mt-3 flex gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5" aria-label="Cor do procedimento" />
              <input className={input} value={proc} onChange={(e) => setProc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProc()} placeholder="Ex.: Avaliação" />
              <button onClick={addProc} className="shrink-0 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">+</button>
            </div>
            {procedures.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {procedures.map((p) => (
                  <span key={p.name} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}
                    <button onClick={() => onDeleteProcedure(p.name)} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${p.name}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
