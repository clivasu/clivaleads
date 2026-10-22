"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Calendar } from "iconsax-reactjs";
import { CalendarCheck2, CheckCheck } from "lucide-react";
import { listNotifications, markNotificationsRead, type NotificationRow } from "@/lib/actions/booking";

// Calendário do topo: agendamentos novos feitos pelos funis. Número = não lidos.
// Atualiza a cada 60 s e quando a aba volta a ficar visível.
function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function BookingNotifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: NotificationRow[] }>({ unread: 0, items: [] });
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => { listNotifications().then(setData).catch(() => {}); }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const markAll = () => start(async () => { await markNotificationsRead(); refresh(); });
  const n = data.unread;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label={n ? `Agendamentos: ${n} novo${n === 1 ? "" : "s"}` : "Agendamentos"}
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); if (!open) refresh(); }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
      >
        <Calendar size={20} variant="Bulk" color="#475569" />
        {n > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Agendamentos recentes" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Agendamentos pelos funis</p>
            {n > 0 && (
              <button type="button" onClick={markAll} disabled={pending} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                <CheckCheck className="h-3.5 w-3.5" /> Marcar como vistos
              </button>
            )}
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhum agendamento online ainda. Adicione o bloco &quot;Agendamento&quot; num funil.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {data.items.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.link || "/schedule"}
                    onClick={() => { setOpen(false); if (!it.read_at) void markNotificationsRead([it.id]).then(refresh); }}
                    className={`flex gap-3 px-4 py-3 text-left hover:bg-slate-50 ${it.read_at ? "" : "bg-emerald-50/50"}`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.read_at ? "bg-slate-100 text-slate-400" : "bg-emerald-100 text-emerald-600"}`}>
                      <CalendarCheck2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{it.title}</span>
                      {it.body && <span className="line-clamp-2 block text-xs text-slate-500">{it.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{ago(it.created_at)}</span>
                    </span>
                    {!it.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Novo" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/schedule" onClick={() => setOpen(false)} className="block border-t px-4 py-2.5 text-center text-sm font-medium text-emerald-600 hover:bg-slate-50">
            Abrir Agenda
          </Link>
        </div>
      )}
    </div>
  );
}
