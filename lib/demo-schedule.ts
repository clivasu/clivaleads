// Modelo de dados da Agenda (interativa). Focado em saúde/estética.

export const DAY_START = 8;
export const DAY_END = 19;

export type Status = "registered" | "confirmed" | "in_progress" | "done" | "cancelled";

export interface Doctor {
  id: string;
  name: string;
  initials: string;
  avatarColor: string; // classes tailwind
}

export interface Procedure {
  name: string;
  color: string; // hex — cor do procedimento
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: "F" | "M";
  since: string;
  tags: string[];
  notes: string;
  history: { date: string; procedure: string; note: string }[];
}

export interface Appt {
  id: string;
  doctorId: string;
  patientId: string;
  procedure: string;
  date: string; // YYYY-MM-DD
  start: number; // hora decimal
  end: number;
  status: Status;
  isReturn: boolean;
}

export const doctors: Doctor[] = [
  { id: "d1", name: "Dra. Sofia Martins", initials: "SM", avatarColor: "bg-emerald-100 text-emerald-700" },
  { id: "d2", name: "Dr. Jerald O'Hara", initials: "JO", avatarColor: "bg-sky-100 text-sky-700" },
  { id: "d3", name: "Dra. Putri Larasati", initials: "PL", avatarColor: "bg-violet-100 text-violet-700" },
];

export const PROCEDURES: Procedure[] = [
  { name: "Check-up Geral", color: "#f43f5e" },
  { name: "Limpeza", color: "#10b981" },
  { name: "Clareamento", color: "#0ea5e9" },
  { name: "Extração", color: "#8b5cf6" },
  { name: "Harmonização Facial", color: "#ec4899" },
  { name: "Botox", color: "#f59e0b" },
  { name: "Preenchimento", color: "#14b8a6" },
  { name: "Avaliação", color: "#64748b" },
];

export function procColor(name: string): string {
  return PROCEDURES.find((p) => p.name === name)?.color ?? "#64748b";
}

export const STATUS_META: Record<Status, { label: string; dot: string }> = {
  registered: { label: "Registrado", dot: "#94a3b8" },
  confirmed: { label: "Confirmado", dot: "#6366f1" },
  in_progress: { label: "Em atendimento", dot: "#f59e0b" },
  done: { label: "Concluído", dot: "#10b981" },
  cancelled: { label: "Cancelado", dot: "#f43f5e" },
};

export const patients: Patient[] = [
  { id: "p1", name: "Rafael Jainudin", phone: "5561999990001", age: 34, gender: "M", since: "2024-03-10", tags: ["Convênio"], notes: "Sensibilidade em molar inferior.", history: [
    { date: "2026-06-02", procedure: "Limpeza", note: "Sem intercorrências." },
    { date: "2026-03-18", procedure: "Check-up Geral", note: "Indicada limpeza." },
  ]},
  { id: "p2", name: "Sekar Nandita", phone: "5561999990002", age: 28, gender: "F", since: "2023-11-02", tags: ["VIP"], notes: "Prefere horário da manhã.", history: [
    { date: "2026-05-20", procedure: "Clareamento", note: "Boa resposta." },
  ]},
  { id: "p3", name: "Angkasa Pura", phone: "5561999990003", age: 41, gender: "M", since: "2025-01-15", tags: [], notes: "", history: [
    { date: "2026-04-11", procedure: "Clareamento", note: "1ª sessão." },
  ]},
  { id: "p4", name: "Lembayung Senja", phone: "5561999990004", age: 37, gender: "F", since: "2022-08-30", tags: ["Retorno"], notes: "Ansiosa — explicar cada etapa.", history: [
    { date: "2026-05-02", procedure: "Avaliação", note: "Indicada extração." },
  ]},
  { id: "p5", name: "Daniswara", phone: "5561999990005", age: 25, gender: "F", since: "2026-02-01", tags: ["Novo"], notes: "", history: [] },
  { id: "p6", name: "Christopher Small", phone: "5561999990006", age: 52, gender: "M", since: "2024-07-19", tags: [], notes: "Hipertenso.", history: [
    { date: "2026-06-01", procedure: "Harmonização Facial", note: "Botox testa." },
  ]},
  { id: "p7", name: "Marina Duarte", phone: "5561999990007", age: 31, gender: "F", since: "2025-09-09", tags: ["VIP"], notes: "Interesse em preenchimento labial.", history: [] },
];

export function patientById(id: string) {
  return patients.find((p) => p.id === id);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
export function fmtHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h % 1) * 60);
  return `${pad(hh)}:${pad(mm)}`;
}

// Gera agendamentos ao redor de "hoje" para as views Dia/Semana/Mês terem conteúdo.
export function seedAppointments(): Appt[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const T = (n: number) => iso(addDays(today, n));
  let seq = 0;
  const id = () => "ap" + ++seq;

  return [
    // hoje
    { id: id(), doctorId: "d1", patientId: "p1", procedure: "Check-up Geral", date: T(0), start: 9, end: 10, status: "done", isReturn: false },
    { id: id(), doctorId: "d1", patientId: "p2", procedure: "Limpeza", date: T(0), start: 10, end: 11, status: "done", isReturn: true },
    { id: id(), doctorId: "d2", patientId: "p3", procedure: "Clareamento", date: T(0), start: 11, end: 12, status: "done", isReturn: false },
    { id: id(), doctorId: "d1", patientId: "p4", procedure: "Extração", date: T(0), start: 12, end: 13, status: "in_progress", isReturn: true },
    { id: id(), doctorId: "d1", patientId: "p5", procedure: "Check-up Geral", date: T(0), start: 14.5, end: 15.5, status: "registered", isReturn: false },
    { id: id(), doctorId: "d3", patientId: "p6", procedure: "Harmonização Facial", date: T(0), start: 14, end: 15, status: "confirmed", isReturn: false },
    // amanhã
    { id: id(), doctorId: "d2", patientId: "p7", procedure: "Preenchimento", date: T(1), start: 9.5, end: 10.5, status: "confirmed", isReturn: false },
    { id: id(), doctorId: "d1", patientId: "p2", procedure: "Clareamento", date: T(1), start: 11, end: 12, status: "registered", isReturn: true },
    { id: id(), doctorId: "d3", patientId: "p6", procedure: "Botox", date: T(1), start: 15, end: 16, status: "confirmed", isReturn: true },
    // +2 e +3
    { id: id(), doctorId: "d1", patientId: "p4", procedure: "Avaliação", date: T(2), start: 10, end: 10.5, status: "confirmed", isReturn: false },
    { id: id(), doctorId: "d2", patientId: "p3", procedure: "Clareamento", date: T(3), start: 13, end: 14, status: "registered", isReturn: true },
    // essa semana atrás
    { id: id(), doctorId: "d1", patientId: "p1", procedure: "Limpeza", date: T(-1), start: 9, end: 10, status: "done", isReturn: false },
    { id: id(), doctorId: "d3", patientId: "p7", procedure: "Preenchimento", date: T(-2), start: 16, end: 17, status: "done", isReturn: false },
    // espalhados no mês
    { id: id(), doctorId: "d2", patientId: "p5", procedure: "Avaliação", date: T(6), start: 9, end: 9.5, status: "registered", isReturn: false },
    { id: id(), doctorId: "d1", patientId: "p6", procedure: "Harmonização Facial", date: T(9), start: 14, end: 15, status: "confirmed", isReturn: true },
    { id: id(), doctorId: "d3", patientId: "p2", procedure: "Botox", date: T(-5), start: 11, end: 12, status: "done", isReturn: false },
  ];
}
