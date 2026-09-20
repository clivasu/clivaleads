// Dados de demonstração do Dashboard (estilo Clinexa). Estáticos para bater o
// visual da referência; quando o Supabase estiver conectado dá para trocar por
// consultas reais.

export interface KpiCard {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendUp: boolean;
}

export const kpis: KpiCard[] = [
  { key: "patients", title: "Total de Pacientes", value: "4.892", subtitle: "Este mês", trend: "+12%", trendUp: true },
  { key: "appointments", title: "Agendamentos", value: "48", subtitle: "Novas marcações", trend: "+8%", trendUp: true },
  { key: "revenue", title: "Receita Mensal", value: "R$ 24.500", subtitle: "Mês passado", trend: "+15%", trendUp: true },
  { key: "doctors", title: "Profissionais Ativos", value: "35", subtitle: "De licença 2%", trend: "2%", trendUp: false },
];

// Série de receita (em milhares) — Jan..Set, pico em Maio.
export const revenueSeries = [
  { label: "Jan", value: 7 },
  { label: "Fev", value: 6.5 },
  { label: "Mar", value: 9.5 },
  { label: "Abr", value: 9 },
  { label: "Mai", value: 20 },
  { label: "Jun", value: 11 },
  { label: "Jul", value: 10.5 },
  { label: "Ago", value: 9.5 },
  { label: "Set", value: 14 },
];

export const appointmentStats = {
  total: 54,
  segments: [
    { label: "Concluídos", value: 28, color: "#34d399" }, // emerald-400
    { label: "Próximos", value: 18, color: "#a3e635" }, // lime-400
    { label: "Cancelados", value: 8, color: "#fb7185" }, // rose-400
  ],
};

export interface TodayAppointment {
  doctor: string;
  specialty: string;
  patient: string;
  patientId: string;
  time: string;
  status: "confirmed" | "waiting" | "cancelled";
}

export const todayAppointments: TodayAppointment[] = [
  { doctor: "Dra. Sarah Khan", specialty: "Cardiologia", patient: "Esther Howard", patientId: "#PT-84920", time: "10:00", status: "confirmed" },
  { doctor: "Emma Lee", specialty: "Dermatologia", patient: "Guy Hawkins", patientId: "#PT-84921", time: "11:30", status: "waiting" },
  { doctor: "Robert Fox", specialty: "Ortodontia", patient: "Jane Cooper", patientId: "#PT-84922", time: "13:00", status: "confirmed" },
  { doctor: "Cody Fisher", specialty: "Clínico Geral", patient: "Leslie Alexander", patientId: "#PT-84923", time: "14:30", status: "cancelled" },
];

export interface RecentPatient {
  name: string;
  condition: string;
  age: string;
  date: string;
}

export const recentPatients: RecentPatient[] = [
  { name: "Michael Ross", condition: "Hipertensão", age: "42a", date: "20 Jun" },
  { name: "Emma Wilson", condition: "Enxaqueca", age: "35a", date: "19 Jun" },
  { name: "David Brown", condition: "Diabetes Tipo 2", age: "58a", date: "18 Jun" },
  { name: "Olivia Martin", condition: "Asma", age: "29a", date: "17 Jun" },
];
