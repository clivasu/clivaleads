import Link from "next/link";
import { Greeting, TodayLabel } from "@/components/dashboard/greeting";
import { formatToday, greetingFor } from "@/lib/greeting";
import {
  Profile2User,
  CalendarTick,
  DollarCircle,
  Health,
  More,
  StatusUp,
  Eye,
} from "iconsax-reactjs";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AppointmentDonut } from "@/components/dashboard/appointment-donut";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg, getNavInfo } from "@/lib/data/org";
import { getHomeData } from "@/lib/data/home";
import { resolveDashPeriod } from "@/lib/dashboard-period";
import { PeriodPicker } from "@/components/dashboard/period-picker";

export const dynamic = "force-dynamic";

function firstName(full: string): string {
  const t = (full || "").trim();
  if (!t || t.includes("@")) return "";
  return t.split(/\s+/)[0];
}

const KPI_STYLES: Record<string, { grad: string; icon: React.ReactNode }> = {
  patients: {
    grad: "from-emerald-300 to-teal-200",
    icon: <Profile2User size={22} variant="Bulk" color="#065f46" />,
  },
  appointments: {
    grad: "from-lime-200 to-green-200",
    icon: <CalendarTick size={22} variant="Bulk" color="#3f6212" />,
  },
  revenue: {
    grad: "from-green-200 to-emerald-200",
    icon: <DollarCircle size={22} variant="Bulk" color="#065f46" />,
  },
  doctors: {
    grad: "from-emerald-100 to-teal-100",
    icon: <Health size={22} variant="Bulk" color="#047857" />,
  },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  done: { label: "Concluído", cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Em atendimento", cls: "bg-sky-100 text-sky-700" },
  confirmed: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-700" },
  waiting: { label: "Aguardando", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelado", cls: "bg-rose-100 text-rose-700" },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Fuso de Brasília no servidor; o navegador ajusta para a hora local.
  const TZ = "America/Sao_Paulo";
  const now = new Date();
  const today = formatToday(now, TZ);
  const hourBR = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));

  // Conta real (Supabase) começa zerada; modo demo mantém a vitrine.
  const demo = !isSupabaseConfigured;
  const nav = await getNavInfo();
  const greetName = demo ? "Dra. Sarah" : (firstName(nav.userName) || nav.orgName || "por aqui");
  // Conta real: números da agenda (0016/0017) no período escolhido. Demo: vitrine.
  const period = resolveDashPeriod(await searchParams, now);
  const org = demo ? null : await getCurrentOrg();
  const home = await getHomeData(org?.id ?? "", period);
  const kpis = home.kpis;
  const todayAppointments = home.today;
  const recentPatients = home.recent;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Greeting name={greetName} initialGreeting={greetingFor(hourBR)} />
          <p className="text-sm text-slate-500">
            Veja o que está acontecendo na sua clínica hoje.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-right text-sm lowercase text-slate-500 first-letter:uppercase">
            <TodayLabel initial={today} />
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Clínica aberta
          </span>
        </div>
      </div>

      {/* Período (indicadores, gráfico e consultas seguem a escolha) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{period.label}</h2>
          <p className="text-xs text-slate-400">Faturamento conta só atendimentos concluídos.</p>
        </div>
        <PeriodPicker current={period.key} de={period.de} ate={period.ate} agrupar={period.bucketAuto ? null : period.bucket} compareLabel={period.compareLabel} />
      </div>

      {/* KPI cards (clínica) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const s = KPI_STYLES[k.key];
          return (
            <div
              key={k.key}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.grad} p-5`}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20" />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70">
                    {s.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{k.title}</span>
                </div>
                <More size={18} color="#334155" className="rotate-90" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-slate-900">{k.value}</p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-600">{k.subtitle}</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    k.trendUp ? "text-emerald-700" : "text-slate-500"
                  }`}
                >
                  <StatusUp size={13} color="currentColor" className={k.trendUp ? "" : "rotate-180"} />
                  {k.trend}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue + donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart series={home.series} bucket={home.bucket} totals={home.totals} />
        </div>
        <AppointmentDonut data={home.donut} subtitle={period.label} />
      </div>

      {/* Today's appointments + recent patients */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Agendamentos de hoje</h2>
            <p className="text-sm text-slate-400">Próximas consultas do dia</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 font-medium">Profissional</th>
                  <th className="pb-3 font-medium">Paciente</th>
                  <th className="pb-3 font-medium">Horário</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((a) => {
                  const b = STATUS_BADGE[a.status];
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{a.doctor}</p>
                        <p className="text-xs text-slate-400">{a.specialty}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{a.patient}</p>
                        <p className="text-xs text-slate-400">{a.tag}</p>
                      </td>
                      <td className="py-3 text-slate-600">{a.time}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link href="/schedule" aria-label={`Abrir ${a.patient} na agenda`} className="flex items-center justify-end text-slate-400 hover:text-emerald-600">
                          <Eye size={18} color="currentColor" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {todayAppointments.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Nenhum agendamento por enquanto. Cadastre na Agenda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Pacientes recentes</h2>
            <Link href="/schedule" className="text-sm font-medium text-emerald-600">Ver agenda</Link>
          </div>
          <div className="flex flex-col gap-4">
            {recentPatients.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                  {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">{p.condition}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">{p.date}</p>
              </div>
            ))}
            {recentPatients.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">Seus pacientes recentes aparecem aqui.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
