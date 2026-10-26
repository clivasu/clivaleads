"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CalendarCheck2, CalendarClock, ClipboardList, Filter, Loader2, MessageCircle, Repeat2,
  Save, ShieldCheck, Stethoscope, Wallet,
} from "lucide-react";
import { ANAMNESIS, ageFrom, formatCpf, formatPhone, healthAlerts, onlyDigits, type Anamnesis } from "@/lib/patients";
import { savePatient } from "@/lib/actions/patients";
import type { PatientChartData, PatientRecord } from "@/lib/data/patients";
import { cn } from "@/lib/utils";

const input = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none";
const area = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none";
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const STATUS: Record<string, { label: string; cls: string }> = {
  done: { label: "Concluído", cls: "bg-emerald-50 text-emerald-700" },
  confirmed: { label: "Confirmado", cls: "bg-sky-50 text-sky-700" },
  registered: { label: "Aguardando", cls: "bg-amber-50 text-amber-700" },
  in_progress: { label: "Em atendimento", cls: "bg-indigo-50 text-indigo-700" },
  cancelled: { label: "Cancelado", cls: "bg-rose-50 text-rose-600" },
};
const SOURCES = ["", "Instagram", "Facebook", "Google", "Indicação", "WhatsApp", "Funil da Cliva", "Passou na frente", "Outro"];

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function Card({ title, icon: Icon, children, action }: { title: string; icon: typeof ClipboardList; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><Icon className="h-4 w-4 text-emerald-600" /></span>
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

type Form = Omit<PatientRecord, "created_at" | "updated_at" | "lead_session_id" | "consent_at"> & { consent: boolean };

export function PatientChart({ data, isNew = false }: { data: PatientChartData; isNew?: boolean }) {
  const router = useRouter();
  const r = data.record;
  const [tab, setTab] = useState<"ficha" | "atendimentos" | "origem">(isNew ? "ficha" : "ficha");
  const [f, setF] = useState<Form>({
    id: r.id, name: r.name, phone: r.phone ? formatPhone(r.phone) : "", cpf: r.cpf ? formatCpf(r.cpf) : "", rg: r.rg ?? "",
    birth_date: r.birth_date ?? "", gender: r.gender ?? "", email: r.email ?? "", occupation: r.occupation ?? "", source: r.source ?? "",
    notes: r.notes ?? "", address: r.address ?? {}, emergency_contact: r.emergency_contact ?? {}, anamnesis: r.anamnesis ?? {},
    consent: Boolean(r.consent_at),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const setA = (k: string, v: string | boolean) => setF((x) => {
    const a: Anamnesis = { ...x.anamnesis };
    if (v === false || v === "") delete a[k]; else a[k] = v;
    return { ...x, anamnesis: a };
  });

  const alerts = healthAlerts(f.anamnesis);
  const age = ageFrom(f.birth_date);
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => {
    const past = data.visits.filter((v) => Date.parse(v.starts_at) < now && v.status !== "cancelled");
    const done = data.visits.filter((v) => v.status === "done");
    const next = [...data.visits].reverse().find((v) => Date.parse(v.starts_at) >= now && v.status !== "cancelled") ?? null;
    return {
      done: done.length,
      last: past[0] ?? null,
      next,
      spent: done.reduce((s, v) => s + (v.price_cents ?? 0), 0),
      returns: data.visits.filter((v) => v.is_return).length,
    };
  }, [data.visits, now]);

  const save = () => start(async () => {
    setMsg(null);
    const res = await savePatient({
      ...(f.id ? { id: f.id } : {}),
      name: f.name, phone: f.phone ?? "", cpf: f.cpf ?? "", rg: f.rg ?? "", birth_date: f.birth_date ?? "",
      gender: (f.gender ?? "") as "F" | "M" | "O" | "N" | "", email: f.email ?? "", occupation: f.occupation ?? "", source: f.source ?? "",
      notes: f.notes ?? "", address: f.address, emergency_contact: f.emergency_contact, anamnesis: f.anamnesis, consent: f.consent,
    });
    if (!res.ok) { setMsg({ ok: false, text: res.error ?? "Não foi possível salvar.", field: res.field }); return; }
    setMsg({ ok: true, text: "Ficha salva." });
    if (isNew && res.id) router.replace(`/patients/${res.id}`);
    else router.refresh();
  });

  const wa = onlyDigits(f.phone ?? "");
  const waHref = wa.length >= 10 ? `https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}` : null;
  const err = (k: string) => (msg && !msg.ok && msg.field === k ? "border-rose-300" : "");

  return (
    <div className="space-y-5 pb-24">
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>

      {/* Cabeçalho */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
            {(f.name || "?").split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{f.name || "Novo paciente"}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {[age !== null ? `${age} anos` : null, f.gender === "F" ? "Feminino" : f.gender === "M" ? "Masculino" : f.gender === "O" ? "Outro" : null,
                f.cpf ? `CPF ${f.cpf}` : null, f.phone || null].filter(Boolean).join(" · ") || "Preencha os dados abaixo"}
            </p>
            {!isNew && <p className="text-xs text-slate-400">Paciente desde {dt(r.created_at)}{f.source ? ` · origem: ${f.source}` : ""}</p>}
          </div>
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
        {alerts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-xl bg-rose-50 p-3">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span className="text-xs font-semibold text-rose-700">Atenção:</span>
            {alerts.map((a) => <span key={a} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">{a}</span>)}
          </div>
        )}
        {!isNew && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { icon: CalendarCheck2, label: "Atendimentos", value: String(stats.done), sub: stats.returns ? `${stats.returns} retornos` : "concluídos" },
              { icon: Stethoscope, label: "Último atendimento", value: stats.last ? dt(stats.last.starts_at) : "—", sub: stats.last?.procedure ?? "" },
              { icon: CalendarClock, label: "Próximo", value: stats.next ? `${dt(stats.next.starts_at)} ${hm(stats.next.starts_at)}` : "—", sub: stats.next?.procedure ?? "nada agendado" },
              { icon: Wallet, label: "Total investido", value: brl(stats.spent), sub: "atendimentos concluídos" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><s.icon className="h-3.5 w-3.5" /> {s.label}</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900">{s.value}</p>
                <p className="truncate text-[11px] text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abas */}
      {!isNew && (
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm font-medium sm:w-fit" role="tablist">
          {([["ficha", "Ficha"], ["atendimentos", `Atendimentos (${data.visits.length})`], ["origem", "Origem"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("flex-1 rounded-full px-4 py-1.5 transition-colors sm:flex-none", tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{l}</button>
          ))}
        </div>
      )}

      {tab === "ficha" && (
        <>
          {!data.extended && !isNew && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">CPF, endereço e anamnese ficam disponíveis depois da atualização do banco (migration 0019).</p>
          )}
          <Card title="Dados pessoais" icon={ClipboardList}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome completo *" className="sm:col-span-2"><input className={cn(input, err("name"))} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="CPF"><input className={cn(input, err("cpf"))} inputMode="numeric" value={f.cpf ?? ""} onChange={(e) => set({ cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
              <Field label="RG"><input className={input} value={f.rg ?? ""} onChange={(e) => set({ rg: e.target.value })} /></Field>
              <Field label="Data de nascimento"><input type="date" className={cn(input, err("birth_date"))} value={f.birth_date ?? ""} onChange={(e) => set({ birth_date: e.target.value })} /></Field>
              <Field label="Sexo">
                <select className={input} value={f.gender ?? ""} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option><option value="N">Prefere não informar</option>
                </select>
              </Field>
              <Field label="Telefone / WhatsApp"><input className={cn(input, err("phone"))} inputMode="tel" value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="(61) 90000-0000" /></Field>
              <Field label="E-mail"><input type="email" className={cn(input, err("email"))} value={f.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Profissão"><input className={input} value={f.occupation ?? ""} onChange={(e) => set({ occupation: e.target.value })} /></Field>
              <Field label="Como conheceu a clínica">
                <select className={input} value={f.source ?? ""} onChange={(e) => set({ source: e.target.value })}>
                  {SOURCES.concat(f.source && !SOURCES.includes(f.source) ? [f.source] : []).map((s) => <option key={s} value={s}>{s || "—"}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Endereço e contato de emergência" icon={ClipboardList}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="CEP" className="sm:col-span-2"><input className={input} inputMode="numeric" value={f.address.cep ?? ""} onChange={(e) => set({ address: { ...f.address, cep: e.target.value } })} /></Field>
              <Field label="Rua" className="sm:col-span-4"><input className={input} value={f.address.street ?? ""} onChange={(e) => set({ address: { ...f.address, street: e.target.value } })} /></Field>
              <Field label="Número" className="sm:col-span-1"><input className={input} value={f.address.number ?? ""} onChange={(e) => set({ address: { ...f.address, number: e.target.value } })} /></Field>
              <Field label="Complemento" className="sm:col-span-2"><input className={input} value={f.address.complement ?? ""} onChange={(e) => set({ address: { ...f.address, complement: e.target.value } })} /></Field>
              <Field label="Bairro" className="sm:col-span-3"><input className={input} value={f.address.district ?? ""} onChange={(e) => set({ address: { ...f.address, district: e.target.value } })} /></Field>
              <Field label="Cidade" className="sm:col-span-4"><input className={input} value={f.address.city ?? ""} onChange={(e) => set({ address: { ...f.address, city: e.target.value } })} /></Field>
              <Field label="UF" className="sm:col-span-2"><input className={input} maxLength={2} value={f.address.state ?? ""} onChange={(e) => set({ address: { ...f.address, state: e.target.value.toUpperCase() } })} /></Field>
            </div>
            <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
              <Field label="Contato de emergência"><input className={input} value={f.emergency_contact.name ?? ""} onChange={(e) => set({ emergency_contact: { ...f.emergency_contact, name: e.target.value } })} /></Field>
              <Field label="Telefone"><input className={input} inputMode="tel" value={f.emergency_contact.phone ?? ""} onChange={(e) => set({ emergency_contact: { ...f.emergency_contact, phone: e.target.value } })} /></Field>
              <Field label="Parentesco"><input className={input} value={f.emergency_contact.relation ?? ""} onChange={(e) => set({ emergency_contact: { ...f.emergency_contact, relation: e.target.value } })} /></Field>
            </div>
          </Card>

          {ANAMNESIS.map((sec) => (
            <Card key={sec.title} title={`Anamnese: ${sec.title.toLowerCase()}`} icon={Stethoscope}>
              <div className="grid gap-3 sm:grid-cols-2">
                {sec.fields.filter((x) => x.kind !== "flag").map((x) => (
                  <Field key={x.key} label={x.label} className={x.kind === "text" && x.long ? "sm:col-span-2" : ""}>
                    {x.kind === "select" ? (
                      <select className={input} value={String(f.anamnesis[x.key] ?? "")} onChange={(e) => setA(x.key, e.target.value)}>
                        {x.options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                      </select>
                    ) : x.kind === "text" && x.long ? (
                      <textarea rows={2} className={area} value={String(f.anamnesis[x.key] ?? "")} placeholder={x.placeholder} onChange={(e) => setA(x.key, e.target.value)} />
                    ) : (
                      <input className={input} value={String(f.anamnesis[x.key] ?? "")} placeholder={x.kind === "text" ? x.placeholder : undefined} onChange={(e) => setA(x.key, e.target.value)} />
                    )}
                  </Field>
                ))}
              </div>
              {sec.fields.some((x) => x.kind === "flag") && (
                <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2">
                  {sec.fields.filter((x) => x.kind === "flag").map((x) => (
                    <label key={x.key} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", f.anamnesis[x.key] === true && x.kind === "flag" && x.alert ? "bg-rose-50 text-rose-700" : "text-slate-700")}>
                      <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={f.anamnesis[x.key] === true} onChange={(e) => setA(x.key, e.target.checked)} />
                      {x.label}
                    </label>
                  ))}
                </div>
              )}
            </Card>
          ))}

          <Card title="Observações e consentimento" icon={ShieldCheck}>
            <Field label="Observações gerais"><textarea rows={3} className={area} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
            <label className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} />
              <span>
                O paciente autorizou o registro dos dados pessoais e de saúde desta ficha para o atendimento (LGPD).
                {r.consent_at && f.consent && <span className="block text-xs text-slate-400">Registrado em {dt(r.consent_at)}.</span>}
              </span>
            </label>
          </Card>
        </>
      )}

      {tab === "atendimentos" && (
        <Card title="Histórico de atendimentos" icon={CalendarCheck2}>
          {data.visits.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum atendimento na Agenda ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-medium">Data</th><th className="pb-2 font-medium">Horário</th><th className="pb-2 font-medium">Procedimento</th>
                    <th className="pb-2 font-medium">Profissional</th><th className="pb-2 font-medium">Status</th><th className="pb-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.visits.map((v) => {
                    const st = STATUS[v.status] ?? STATUS.registered;
                    const future = Date.parse(v.starts_at) >= now;
                    return (
                      <tr key={v.id} className={cn("border-b last:border-0", future && "bg-emerald-50/40")}>
                        <td className="py-2.5 font-medium text-slate-800">{dt(v.starts_at)}{future && <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-600">próximo</span>}</td>
                        <td className="py-2.5 text-slate-600">{hm(v.starts_at)}–{hm(v.ends_at)}</td>
                        <td className="py-2.5 text-slate-700">{v.procedure}{v.is_return && <Repeat2 className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-label="Retorno" />}{v.source === "funnel" && <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">online</span>}</td>
                        <td className="py-2.5 text-slate-600">{v.professional}</td>
                        <td className="py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span></td>
                        <td className="py-2.5 text-right text-slate-600">{v.status === "done" && v.price_cents ? brl(v.price_cents) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/schedule" className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">Agendar na Agenda →</Link>
        </Card>
      )}

      {tab === "origem" && (
        <Card title="Origem do paciente" icon={Filter}>
          {!data.lead ? (
            <p className="py-6 text-center text-sm text-slate-400">Não veio de um funil (ou o telefone não bate com nenhum lead).</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">
                Lead {data.lead.flow_name ? <>do funil <b>{data.lead.flow_name}</b></> : "cadastrado manualmente"} em {dt(data.lead.created_at)}
                {data.lead.utm_source ? <> · origem <b>{data.lead.utm_source}</b></> : null} · interesse <b>{data.lead.score}</b>
              </p>
              {data.lead.answers.length > 0 && (
                <ul className="divide-y rounded-xl border">
                  {data.lead.answers.map((a, i) => (
                    <li key={i} className="px-3 py-2"><span className="block text-xs text-slate-400">{a.question_title}</span><span className="text-slate-800">{a.answer_label}</span></li>
                  ))}
                </ul>
              )}
              <Link href={`/leads/${data.lead.id}`} className="inline-block font-medium text-emerald-600 hover:text-emerald-700">Abrir lead →</Link>
            </div>
          )}
        </Card>
      )}

      {/* Salvar (fixo no rodapé) */}
      {tab === "ficha" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 backdrop-blur md:left-auto md:right-6 md:bottom-6 md:rounded-2xl md:border md:shadow-xl">
          <div className="flex items-center justify-end gap-3">
            {msg && <p role="status" className={cn("text-sm", msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</p>}
            <button onClick={save} disabled={pending || !f.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isNew ? "Cadastrar paciente" : "Salvar ficha"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
