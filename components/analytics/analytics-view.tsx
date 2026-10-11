import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Database, Info, TrendingUp } from "lucide-react";
import type { FunnelAnalytics } from "@/lib/data/funnel-analytics";
import { conversionSteps, fmtRate, rate, trend, type MetricKey } from "@/lib/analytics/metrics";
import { tierFromScore, TIER_LABEL } from "@/lib/scoring";
import { FiltersBar } from "./filters-bar";
import { MetricInfo } from "./metric-info";
import { SeriesChart } from "./series-chart";

const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const n = (v: number) => v.toLocaleString("pt-BR");

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-slate-100 text-slate-600" },
  qualified: { label: "Qualificado", cls: "bg-sky-50 text-sky-700" },
  whatsapp: { label: "WhatsApp", cls: "bg-teal-50 text-teal-700" },
  scheduled: { label: "Agendado", cls: "bg-indigo-50 text-indigo-700" },
  converted: { label: "Convertido", cls: "bg-emerald-50 text-emerald-700" },
  lost: { label: "Perdido", cls: "bg-rose-50 text-rose-700" },
};

function Trend({ cur, prev }: { cur: number; prev: number }) {
  const t = trend(cur, prev);
  if (t === null) return <span className="text-[11px] text-slate-400">sem base anterior</span>;
  const up = t >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
      <Icon className="h-3 w-3" /> {up ? "+" : ""}{t}%
    </span>
  );
}

function Tile({ metric, value, prev, sub }: { metric: MetricKey; value: number; prev: number; sub: string }) {
  const labels: Partial<Record<MetricKey, string>> = {
    visits: "Visitas", unique_visitors: "Visitantes únicos", starts: "Inícios", completions: "Conclusões",
    qualified: "Qualificados", whatsapp_clicks: "Cliques no WhatsApp", appointments: "Agendamentos", leads: "Leads",
  };
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm font-medium text-slate-600">{labels[metric]}</span>
        <MetricInfo metric={metric} />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{n(value)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Trend cur={value} prev={prev} />
        <span className="text-[11px] text-slate-400">{sub}</span>
      </div>
    </div>
  );
}

export function AnalyticsView({ data }: { data: FunnelAnalytics }) {
  const t = data.totals;
  const p = data.previous;
  const steps = conversionSteps(t);
  const stepMax = Math.max(1, ...steps.map((s) => s.value));
  const hasData = t.visits + t.leads + t.starts > 0;
  const firstStepViews = data.steps[0]?.views ?? 0;

  return (
    <div className="space-y-5">
      {/* header + filtros */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">
            {data.period.label} · comparado com os {data.period.range === "12m" ? "12 meses" : `${data.period.label.replace("Últimos ", "")}`} anteriores.
          </p>
        </div>
        <FiltersBar filters={data.filters} options={data.options} />
      </div>

      {!data.available ? (
        <div className={`${CARD} flex flex-col items-center gap-2 p-10 text-center`}>
          <Database className="h-6 w-6 text-slate-300" />
          <p className="font-medium text-slate-700">Métricas indisponíveis no momento</p>
          <p className="max-w-md text-sm text-slate-500">O banco ainda não tem a atualização de métricas (migration 0013). Nenhum número é mostrado para não exibir dados incorretos.</p>
        </div>
      ) : !hasData ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="font-medium text-slate-700">Sem dados neste período</p>
          <p className="mt-1 text-sm text-slate-500">Publique um funil e compartilhe o link, ou mude os filtros. Os números aparecem aqui assim que houver visitas.</p>
        </div>
      ) : (
        <>
          {/* indicadores */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile metric="visits" value={t.visits} prev={p.visits} sub={`${n(t.unique_visitors)} visitantes únicos`} />
            <Tile metric="starts" value={t.starts} prev={p.starts} sub={`${fmtRate(rate(t.starts, t.visits))} das visitas`} />
            <Tile metric="completions" value={t.completions} prev={p.completions} sub={`${fmtRate(rate(t.completions, t.starts))} dos inícios`} />
            <Tile metric="leads" value={t.leads} prev={p.leads} sub={`${n(t.leads_with_contact)} com contato`} />
            <Tile metric="qualified" value={t.qualified} prev={p.qualified} sub={`${fmtRate(rate(t.qualified, t.leads))} dos leads`} />
            <Tile metric="whatsapp_clicks" value={t.whatsapp_clicks} prev={p.whatsapp_clicks} sub={`${fmtRate(rate(t.whatsapp_clicks, t.completions))} das conclusões`} />
            <Tile metric="appointments" value={t.appointments} prev={p.appointments} sub={`${fmtRate(rate(t.appointments, t.leads))} dos leads`} />
            {/* potencial estimado (destaque, rotulado como estimativa) */}
            <div className="relative overflow-hidden rounded-2xl bg-emerald-500 p-4 text-white shadow-sm shadow-emerald-500/20">
              <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-sm font-medium text-white/90">Potencial estimado</span>
                <span className="text-white/70"><MetricInfo metric="potential" align="right" /></span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{brl.format(data.potential)}</p>
              <p className="mt-1.5 text-[11px] text-white/75">Estimativa por ticket médio. Não é faturamento.</p>
            </div>
          </div>

          {/* série + funil */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className={`${CARD} p-5 xl:col-span-7`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><TrendingUp className="h-4 w-4 text-emerald-600" /></span>
                <div>
                  <p className="font-semibold text-slate-800">Série histórica</p>
                  <p className="text-xs text-slate-400">Por {data.period.bucket === "day" ? "dia" : data.period.bucket === "week" ? "semana" : "mês"}, horário de Brasília</p>
                </div>
              </div>
              <SeriesChart data={data.series} bucket={data.period.bucket} />
            </div>

            <div className={`${CARD} p-5 xl:col-span-5`}>
              <p className="font-semibold text-slate-800">Conversão do funil</p>
              <p className="mb-4 text-xs text-slate-400">Cada taxa usa a etapa indicada como base.</p>
              <div className="space-y-3">
                {steps.map((s, i) => (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-slate-600">{s.label} <MetricInfo metric={s.key as MetricKey} /></span>
                      <span className="text-slate-500"><b className="text-slate-900">{n(s.value)}</b>{s.of && <> · {fmtRate(s.rate)} {s.of}</>}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, (s.value / stepMax) * 100)}%`, background: `hsl(${160 - i * 10} 65% ${42 + i * 4}%)` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">Saídas “sem interesse”: <b className="text-slate-800">{n(t.exits)}</b> <MetricInfo metric="exits" /></span>
                <span className="flex items-center gap-1">Não concluíram: <b className="text-slate-800">{n(Math.max(0, t.starts - t.completions - t.exits))}</b> <MetricInfo metric="not_finished" align="right" /></span>
                <span className="flex items-center gap-1">Botão final: <b className="text-slate-800">{n(t.final_cta)}</b> <MetricInfo metric="final_cta" /></span>
              </div>
            </div>
          </div>

          {/* abandono por etapa */}
          <div className={`${CARD} p-5`}>
            <p className="font-semibold text-slate-800">Abandono por etapa</p>
            {!data.filters.flow ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400"><Info className="h-4 w-4" /> Escolha um funil no filtro para ver em que etapa as pessoas param.</p>
            ) : data.steps.length === 0 ? (
              <p className="mt-1 text-sm text-slate-400">Sem visualizações de etapa registradas neste período. Visitas anteriores a esta atualização não têm esse detalhe.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-medium">Etapa</th>
                      <th className="pb-2 pl-3 text-right font-medium">Viram</th>
                      <th className="pb-2 pl-3 text-right font-medium">Avançaram</th>
                      <th className="pb-2 pl-3 text-right font-medium">Avanço</th>
                      <th className="hidden pb-2 pl-4 font-medium sm:table-cell">Retenção desde a 1ª etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.steps.map((s) => (
                      <tr key={s.step_index} className="border-b border-slate-50 last:border-0">
                        <td className="max-w-[16rem] truncate py-2.5 text-slate-700" title={s.label}><span className="mr-2 text-xs text-slate-400">{s.step_index + 1}.</span>{s.label}</td>
                        <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.views)}</td>
                        <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.completions)}</td>
                        <td className="py-2.5 pl-3 text-right font-medium text-slate-900">{fmtRate(rate(s.completions, s.views))}</td>
                        <td className="hidden py-2.5 pl-4 sm:table-cell">
                          <div className="h-2 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${firstStepViews ? Math.min(100, (s.views / firstStepViews) * 100) : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-400">“Avançaram” conta quem seguiu para a próxima etapa. A última etapa termina em WhatsApp ou formulário e aparece em Conclusões.</p>
              </div>
            )}
          </div>

          {/* origem + procedimentos */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className={`${CARD} p-5 xl:col-span-7`}>
              <p className="font-semibold text-slate-800">Origem e campanha</p>
              <p className="mb-3 text-xs text-slate-400">Pelos parâmetros UTM do link. Sem UTM = “(direto)”.</p>
              {data.sources.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sem dados de origem no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 font-medium">Origem</th>
                        <th className="pb-2 pl-3 font-medium">Campanha</th>
                        <th className="pb-2 pl-3 text-right font-medium">Visitas</th>
                        <th className="pb-2 pl-3 text-right font-medium">Leads</th>
                        <th className="pb-2 pl-3 text-right font-medium">Qualif.</th>
                        <th className="pb-2 pl-3 text-right font-medium">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map((s) => (
                        <tr key={`${s.source}|${s.campaign}`} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 font-medium text-slate-800">{s.source}</td>
                          <td className="max-w-[10rem] truncate py-2.5 pl-3 text-slate-500" title={s.campaign}>{s.campaign || "—"}</td>
                          <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.visits)}</td>
                          <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.leads)}</td>
                          <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.qualified)}</td>
                          <td className="py-2.5 pl-3 text-right text-slate-700">{n(s.whatsapp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-slate-400">Visitas com origem registrada a partir desta atualização; visitas antigas aparecem como “(direto)”. WhatsApp aqui = leads que abriram o WhatsApp.</p>
                </div>
              )}
            </div>

            <div className={`${CARD} p-5 xl:col-span-5`}>
              <p className="font-semibold text-slate-800">Por procedimento</p>
              <p className="mb-3 text-xs text-slate-400">“Avançaram” = abriram o WhatsApp, agendados ou convertidos.</p>
              {data.procedures.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sem leads por procedimento no período.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.procedures.slice(0, 6).map((pr) => (
                    <div key={pr.procedure} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-700">{pr.procedure}</span>
                        <span className="shrink-0 text-sm font-bold text-slate-900">{n(pr.leads)} <span className="text-xs font-normal text-slate-400">leads</span></span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {n(pr.qualified)} qualificados · {n(pr.advanced)} avançaram ({fmtRate(rate(pr.advanced, pr.leads))})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* interesse + perfil */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className={`${CARD} p-5`}>
              <p className="mb-3 flex items-center gap-1.5 font-semibold text-slate-800">Nível de interesse <MetricInfo metric="qualified" /></p>
              {[
                { label: "Quente (61+)", v: t.qualified, bg: "bg-emerald-500" },
                { label: "Em potencial (31–60)", v: t.warm, bg: "bg-amber-500" },
                { label: "Frio (0–30)", v: t.cold, bg: "bg-slate-400" },
              ].map((r) => (
                <div key={r.label} className="mb-3 last:mb-0">
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="text-slate-600">{r.label}</span><span className="shrink-0 text-slate-500"><b className="text-slate-900">{n(r.v)}</b> · {fmtRate(rate(r.v, t.leads))}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.bg}`} style={{ width: `${t.leads ? (r.v / t.leads) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>

            <div className={`${CARD} p-5`}>
              <p className="mb-3 font-semibold text-slate-800">Principais dores / interesses</p>
              {data.profile.pains.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sem respostas suficientes.</p>
              ) : (
                <Bars items={data.profile.pains} />
              )}
            </div>

            <div className={`${CARD} p-5`}>
              <p className="mb-3 font-semibold text-slate-800">Perfil</p>
              {data.profile.gender ? (
                <div className="mb-3 flex gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> Fem. <b className="text-slate-900">{n(data.profile.gender.female)}</b></span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Masc. <b className="text-slate-900">{n(data.profile.gender.male)}</b></span>
                </div>
              ) : <p className="mb-3 text-xs text-slate-400">Gênero não coletado.</p>}
              {data.profile.ages ? <div className="mb-3"><p className="mb-1.5 text-xs font-medium text-slate-500">Idade</p><Bars items={data.profile.ages} compact /></div> : <p className="mb-3 text-xs text-slate-400">Idade não coletada.</p>}
              <p className="text-xs text-slate-500">Dispositivo dos leads: 📱 <b className="text-slate-800">{n(t.devices_mobile)}</b> · 💻 <b className="text-slate-800">{n(t.devices_desktop)}</b></p>
            </div>
          </div>

          {/* últimos leads */}
          <div className={`${CARD} p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800">Últimos leads do período</p>
              <Link href="/leads" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Ver todos</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-medium">Lead</th><th className="pb-2 font-medium">Procedimento</th><th className="pb-2 font-medium">Interesse</th><th className="pb-2 font-medium">Status</th><th className="pb-2 pl-3 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((l) => {
                    const tier = tierFromScore(l.score);
                    const st = STATUS[l.status] ?? STATUS.new;
                    return (
                      <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="py-2.5 font-medium text-slate-800">{l.name}</td>
                        <td className="py-2.5 text-slate-500">{l.procedure}</td>
                        <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tier === "hot" ? "bg-emerald-50 text-emerald-700" : tier === "warm" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{l.score} · {TIER_LABEL[tier]}</span></td>
                        <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                        <td className="py-2.5 text-right text-slate-400">{new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" })}</td>
                      </tr>
                    );
                  })}
                  {data.recent.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhum lead no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Bars({ items, compact }: { items: { label: string; count: number }[]; compact?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className={`shrink-0 truncate text-slate-600 ${compact ? "w-20 text-xs" : "w-32 text-sm"}`} title={it.label}>{it.label}</span>
          <div className="h-3.5 flex-1 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-emerald-400" style={{ width: `${(it.count / max) * 100}%` }} /></div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{n(it.count)}</span>
        </div>
      ))}
    </div>
  );
}
