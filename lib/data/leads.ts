import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { LeadAnswer, LeadSession } from "@/lib/types";

export interface LeadWithAnswers extends LeadSession {
  answers: LeadAnswer[];
}

const DEMO_LEADS: LeadWithAnswers[] = [
  {
    id: "lead-1", session_id: "sid-1",
    flow_id: "22222222-0000-0000-0000-000000000001",
    organization_id: "11111111-1111-1111-1111-111111111111",
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

export async function listLeads(orgId: string): Promise<LeadWithAnswers[]> {
  if (!isSupabaseConfigured) return DEMO_LEADS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sessions")
    .select("*, answers:lead_answers(question_title, answer_value, answer_label, score)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as unknown as LeadWithAnswers[]) ?? [];
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
