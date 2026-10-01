import "server-only";
import { listLeads } from "./leads";
import { tierFromScore, TIER_LABEL, type LeadTier } from "@/lib/scoring";

export interface Bucket { label: string; count: number }

export interface LeadInsights {
  total: number;
  withContact: number;
  whatsapp: number;
  interest: { hot: number; warm: number; cold: number };
  gender: { female: number; male: number } | null;
  ages: Bucket[] | null;
  pains: Bucket[];
  devices: { mobile: number; desktop: number; other: number };
  recent: {
    id: string; name: string; procedure: string; score: number;
    tier: LeadTier; tierLabel: string; whatsapp: boolean; date: string;
  }[];
}

const GENDER_F = /^(feminino|mulher|fem(inina)?\.?|f)$/i;
const GENDER_M = /^(masculino|homem|masc(ulino)?\.?|m)$/i;
const GENDER_Q = /(sexo|g[êe]nero)/i;
const AGE_Q = /(idade|quantos anos|faixa et[áa]ria|sua idade)/i;
const AGE_LABEL = /(\d{1,2}\s*[-–a]\s*\d{1,2}|\d{2}\s*anos|\+\s*\d{2}|menos de|mais de|acima de)/i;
// Perguntas que não são "dor" (não entram no ranking de dores).
const SKIP_PAIN_Q = /(sexo|g[êe]nero|idade|quando|prazo|realizar|seu nome|whats|telefone|e-?mail|como podemos)/i;

export async function getLeadInsights(orgId: string): Promise<LeadInsights> {
  const leads = await listLeads(orgId);
  const total = leads.length;

  const interest = { hot: 0, warm: 0, cold: 0 };
  const gender = { female: 0, male: 0 };
  let genderSeen = false;
  const ageMap = new Map<string, number>();
  const painMap = new Map<string, number>();
  const devices = { mobile: 0, desktop: 0, other: 0 };
  let whatsapp = 0;
  let withContact = 0;

  for (const l of leads) {
    const tier = tierFromScore(l.score);
    interest[tier === "hot" ? "hot" : tier === "warm" ? "warm" : "cold"] += 1;
    if (l.whatsapp_clicked) whatsapp += 1;
    if (l.name || l.phone || l.email) withContact += 1;

    const dev = (l.device ?? "").toLowerCase();
    if (dev.includes("mobile")) devices.mobile += 1;
    else if (dev.includes("desktop")) devices.desktop += 1;
    else devices.other += 1;

    for (const a of l.answers ?? []) {
      const q = a.question_title ?? "";
      const lbl = (a.answer_label ?? "").trim();
      if (!lbl) continue;

      if (GENDER_Q.test(q) || GENDER_F.test(lbl) || GENDER_M.test(lbl)) {
        if (GENDER_F.test(lbl)) { gender.female += 1; genderSeen = true; }
        else if (GENDER_M.test(lbl)) { gender.male += 1; genderSeen = true; }
        continue;
      }
      if (AGE_Q.test(q) || AGE_LABEL.test(lbl)) {
        ageMap.set(lbl, (ageMap.get(lbl) ?? 0) + 1);
        continue;
      }
      if (SKIP_PAIN_Q.test(q)) continue;
      painMap.set(lbl, (painMap.get(lbl) ?? 0) + 1);
    }
  }

  const toBuckets = (m: Map<string, number>, n: number): Bucket[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));

  const recent = [...leads]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 8)
    .map((l) => {
      const tier = tierFromScore(l.score);
      return {
        id: l.id,
        name: l.name ?? "Anônimo",
        procedure: l.procedure ?? "—",
        score: l.score,
        tier,
        tierLabel: TIER_LABEL[tier],
        whatsapp: Boolean(l.whatsapp_clicked),
        date: new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      };
    });

  return {
    total,
    withContact,
    whatsapp,
    interest,
    gender: genderSeen ? gender : null,
    ages: ageMap.size > 0 ? toBuckets(ageMap, 5) : null,
    pains: toBuckets(painMap, 6),
    devices,
    recent,
  };
}
