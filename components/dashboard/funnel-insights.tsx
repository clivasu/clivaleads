import Link from "next/link";
import { MousePointerClick, LogOut, MessageCircle, Users, TrendingUp, Flame, Activity, Snowflake, ArrowRight } from "lucide-react";
import type { FunnelAnalytics } from "@/lib/data/funnel-analytics";
import type { Bucket } from "@/lib/analytics/answers";
import { TIER_LABEL, tierFromScore } from "@/lib/scoring";
import { MetricInfo } from "@/components/analytics/metric-info";
import type { MetricKey } from "@/lib/analytics/metrics";

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm";

export function FunnelInsights({ data }: { data: FunnelAnalytics }) {
  const t = data.totals;
  // Inícios sem conclusão nem saída explícita (não é abandono confirmado).
  const notFinished = Math.max(0, t.starts - t.completions - t.exits);
  const anyData = data.available && t.visits + t.starts + t.leads > 0;
  const insights = {
    total: t.leads,
    interest: { hot: t.qualified, warm: t.warm, cold: t.cold },
    pains: data.profile.pains,
    gender: data.profile.gender,
    ages: data.profile.ages,
    devices: { mobile: t.devices_mobile, desktop: t.devices_desktop },
    recent: data.recent.map((l) => {
      const tier = tierFromScore(l.score);
      return { ...l, tier, tierLabel: TIER_LABEL[tier], date: new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }) };
    }),
  };

  const kpis: { key: string; metric: MetricKey; label: string; value: number; sub: string; icon: typeof Users; tone: string }[] = [
    { key: "visitors", metric: "visits", label: "Visitas", value: t.visits, sub: `${t.unique_visitors.toLocaleString("pt-BR")} visitantes únicos`, icon: Users, tone: "slate" },
    { key: "clicks", metric: "starts", label: "Interagiram", value: t.starts, sub: `${pct(t.starts, t.visits)}% das visitas`, icon: MousePointerClick, tone: "emerald" },
    { key: "exits", metric: "not_finished", label: "Não concluíram", value: notFinished, sub: `${pct(notFinished, t.starts)}% dos inícios`, icon: LogOut, tone: "rose" },
    { key: "whatsapp", metric: "whatsapp_clicks", label: "Foram pro WhatsApp", value: t.whatsapp_clicks, sub: `${pct(t.whatsapp_clicks, t.completions)}% das conclusões`, icon: MessageCircle, tone: "green" },
  ];

  const funnelSteps = [
    { label: "Visitas", value: t.visits },
    { label: "Interagiram", value: t.starts },
    { label: "Concluíram", value: t.completions },
    { label: "WhatsApp", value: t.whatsapp_clicks },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100"><TrendingUp className="h-4 w-4 text-emerald-600" /></span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Desempenho dos funis</h2>
          <p className="text-sm text-slate-400">Últimos 30 dias. Passe o mouse no ⓘ para ver como cada número é contado.</p>
        </div>
        <Link href="/analytics" className="ml-auto flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">Análise completa <ArrowRight className="h-4 w-4" /></Link>
      </div>

      {!anyData ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-sm text-slate-500">{data.available ? "Sem dados nos últimos 30 dias. Publique um funil e compartilhe o link: os números aparecem aqui." : "Métricas indisponíveis até a atualização do banco (migration 0013)."}</p>
        </div>
      ) : (
        <>
          {/* KPIs do funil */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              const tone = k.tone === "green" ? "bg-green-50 text-green-600" : k.tone === "emerald" ? "bg-emerald-50 text-emerald-600" : k.tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500";
              return (
                <div key={k.key} className={`${CARD} p-5`}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
                    <span className="text-sm font-medium text-slate-600">{k.label}</span>
                    <MetricInfo metric={k.metric} />
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-slate-900">{k.value.toLocaleString("pt-BR")}</p>
                  <p className="mt-1 text-xs text-slate-400">{k.sub}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Funil visual */}
            <div className={`${CARD} p-5 lg:col-span-2`}>
              <h3 className="mb-4 font-semibold text-slate-800">Jornada dos leads</h3>
              <div className="space-y-3">
                {funnelSteps.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-slate-500">{s.label}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-semibold text-white"
                        style={{ width: `${Math.max(6, (s.value / funnelMax) * 100)}%`, background: `hsl(${160 - i * 12} ${70 - i * 4}% ${45 + i * 3}%)` }}
                      >
                        {s.value.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs font-medium text-slate-400" title={i === 0 ? undefined : "sobre as visitas"}>{i === 0 ? "100%" : `${pct(s.value, funnelSteps[0].value)}%`}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nível de interesse */}
            <div className={`${CARD} p-5`}>
              <h3 className="mb-4 font-semibold text-slate-800">Nível de interesse</h3>
              <div className="space-y-3">
                <InterestRow icon={Flame} color="text-emerald-600" bg="bg-emerald-500" label="Quente" value={insights.interest.hot} total={insights.total} />
                <InterestRow icon={Activity} color="text-amber-600" bg="bg-amber-500" label="Em potencial" value={insights.interest.warm} total={insights.total} />
                <InterestRow icon={Snowflake} color="text-slate-500" bg="bg-slate-400" label="Frio" value={insights.interest.cold} total={insights.total} />
              </div>
              <p className="mt-4 text-[11px] text-slate-400">Score 0–100 calculado no servidor pelas respostas. Quente = 61 ou mais.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Principais dores */}
            <div className={`${CARD} p-5 lg:col-span-2`}>
              <h3 className="mb-4 font-semibold text-slate-800">Principais dores / interesses</h3>
              {insights.pains.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sem respostas suficientes ainda.</p>
              ) : (
                <BucketBars items={insights.pains} />
              )}
            </div>

            {/* Gênero / Idade / Dispositivo */}
            <div className={`${CARD} p-5`}>
              <h3 className="mb-4 font-semibold text-slate-800">Perfil</h3>
              {insights.gender ? (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Gênero</p>
                  <div className="flex gap-3 text-sm">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> Fem. <b className="text-slate-800">{insights.gender.female}</b></span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Masc. <b className="text-slate-800">{insights.gender.male}</b></span>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-xs text-slate-400">Gênero não coletado neste funil.</p>
              )}
              {insights.ages ? (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Idade</p>
                  <BucketBars items={insights.ages} compact />
                </div>
              ) : (
                <p className="mb-4 text-xs text-slate-400">Idade não coletada neste funil.</p>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Dispositivo</p>
                <div className="flex gap-3 text-sm text-slate-600">
                  <span>📱 {insights.devices.mobile}</span>
                  <span>💻 {insights.devices.desktop}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Últimos leads */}
          <div className={`${CARD} p-5`}>
            <h3 className="mb-4 font-semibold text-slate-800">Últimos leads</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">Procedimento</th>
                    <th className="pb-3 font-medium">Interesse</th>
                    <th className="pb-3 font-medium">WhatsApp</th>
                    <th className="pb-3 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.recent.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-slate-800">{l.name}</td>
                      <td className="py-3 text-slate-500">{l.procedure}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${l.tier === "hot" ? "bg-emerald-50 text-emerald-700" : l.tier === "warm" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                          {l.score} · {l.tierLabel}
                        </span>
                      </td>
                      <td className="py-3">
                        {l.whatsapp ? <span className="text-emerald-600">✓ Sim</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 text-right text-slate-400">{l.date}</td>
                    </tr>
                  ))}
                  {insights.recent.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhum lead com dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function InterestRow({ icon: Icon, color, bg, label, value, total }: { icon: React.ElementType; color: string; bg: string; label: string; value: number; total: number }) {
  const p = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={`flex items-center gap-1.5 font-medium ${color}`}><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span className="text-slate-500"><b className="text-slate-800">{value}</b> · {p}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function BucketBars({ items, compact }: { items: Bucket[]; compact?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className={`shrink-0 truncate text-slate-600 ${compact ? "w-16 text-xs" : "w-40 text-sm"}`} title={it.label}>{it.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded bg-emerald-400" style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">{it.count}</span>
        </div>
      ))}
    </div>
  );
}
