import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { LeadAnswer, LeadSession, LeadStatus } from "@/lib/types";

export interface LeadWithAnswers extends LeadSession {
  answers: LeadAnswer[];
}

const DEMO_LEADS: LeadWithAnswers[] = [
  {
    id: "lead-1", session_id: "sid-1",
    flow_id: "22222222-0000-0000-0000-000000000001",
    organization_id: "11111111-1111-1111-1111-111111111111",
    name: "Marina Souza", phone: "5561999887766", email: "marina@email.com",
    procedure: "Rinomodelação", score: 85, status: "whatsapp",
    device: "mobile", browser: "Instagram", entry_page: "/f/rinomodelacao-clinica-demo",
    referrer: "instagram.com",
    utm_source: "instagram", utm_medium: "cpc", utm_campaign: "Rino Setembro",
    utm_content: "AD03", utm_term: null, whatsapp_clicked: true,
    created_at: "2026-09-17T14:22:00Z",
    answers: [
      { question_title: "O que você gostaria de melhorar no seu nariz?", answer_value: "ponta_caida", answer_label: "Ponta caída", score: 15 },
      { question_title: "Quando você gostaria de realizar?", answer_value: "este_mes", answer_label: "Ainda este mês", score: 20 },
      { question_title: "Como podemos te ajudar agora?", answer_value: "indicado", answer_label: "Quero saber se é indicado para mim", score: 20 },
    ],
  },
  {
    id: "lead-2", session_id: "sid-2",
    flow_id: "22222222-0000-0000-0000-000000000002",
    organization_id: "11111111-1111-1111-1111-111111111111",
    name: "Carla Mendes", phone: "5561988776655", email: "carla.mendes@email.com",
    procedure: "Botox Full Face", score: 45, status: "new",
    device: "mobile", browser: "Facebook", entry_page: "/f/botox-full-face-clinica-demo",
    referrer: "facebook.com",
    utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Botox Setembro",
    utm_content: "AD01", utm_term: null, whatsapp_clicked: false,
    created_at: "2026-09-16T09:10:00Z",
    answers: [
      { question_title: "Qual região mais te incomoda?", answer_value: "olhos", answer_label: "Olhos (pés de galinha)", score: 15 },
      { question_title: "Quando pretende realizar?", answer_value: "pesquisando", answer_label: "Só pesquisando", score: 5 },
    ],
  },
  {
    id: "lead-3", session_id: "sid-3",
    flow_id: "22222222-0000-0000-0000-000000000003",
    organization_id: "11111111-1111-1111-1111-111111111111",
    procedure: "Preenchimento Labial", score: 25, status: "lost",
    device: "desktop", browser: "Chrome", entry_page: "/f/preenchimento-labial-clinica-demo",
    referrer: null,
    utm_source: "google", utm_medium: "cpc", utm_campaign: "Labial",
    utm_content: null, utm_term: "preenchimento labial", whatsapp_clicked: false,
    created_at: "2026-09-15T20:40:00Z",
    answers: [
      { question_title: "Qual é o seu objetivo?", answer_value: "natural", answer_label: "Hidratação / naturalidade", score: 10 },
    ],
  },
];

export const LEADS_PAGE_SIZE = 50;

export interface LeadListRow {
  id: string; name?: string | null; phone?: string | null; email?: string | null;
  procedure: string | null; score: number; status: LeadStatus; created_at: string;
}

// Lista paginada no banco: só leads com contato (nome, telefone ou e-mail),
// do mais recente para o mais antigo, com o total exato para a paginação.
export async function listLeadsPage(orgId: string, page = 1, pageSize = LEADS_PAGE_SIZE): Promise<{ rows: LeadListRow[]; total: number }> {
  const p = Math.max(1, Math.floor(page));
  if (!isSupabaseConfigured) {
    const all = DEMO_LEADS.filter((l) => l.name || l.phone || l.email);
    return { rows: all.slice((p - 1) * pageSize, p * pageSize), total: all.length };
  }
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("lead_sessions")
    .select("id, name, phone, email, procedure, score, status, created_at", { count: "exact" })
    .eq("organization_id", orgId)
    .or("name.not.is.null,phone.not.is.null,email.not.is.null")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  return { rows: (data as LeadListRow[]) ?? [], total: count ?? 0 };
}

// Leads de um funil específico (para a visualização de jornada no editor de fluxo).
export async function listLeadsByFlow(flowId: string): Promise<LeadWithAnswers[]> {
  if (!isSupabaseConfigured) return DEMO_LEADS.filter((l) => l.flow_id === flowId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sessions")
    .select("*, answers:lead_answers(question_title, answer_value, answer_label, score)")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data as unknown as LeadWithAnswers[]) ?? [];
}

export interface LeadPatch {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  procedure?: string | null;
  status?: LeadStatus;
}

// Edita os campos editáveis de um lead. Em modo demo (sem Supabase) a UI mantém
// o estado localmente; aqui só persistimos quando há banco conectado.
export async function updateLead(id: string, patch: LeadPatch): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = await createClient();
  // .select() mostra se a RLS deixou alterar (sem permissão = 0 linhas, sem erro).
  const { data, error } = await supabase.from("lead_sessions").update(patch).eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}

// Remove um lead (e suas respostas via cascade no banco).
export async function deleteLead(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_sessions").delete().eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}

export async function getLead(id: string): Promise<LeadWithAnswers | null> {
  if (!isSupabaseConfigured) {
    return DEMO_LEADS.find((l) => l.id === id) ?? null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sessions")
    .select("*, answers:lead_answers(question_title, answer_value, answer_label, score)")
    .eq("id", id)
    .single();
  return (data as unknown as LeadWithAnswers) ?? null;
}
