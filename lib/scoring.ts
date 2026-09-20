import type { LeadAnswer } from "@/lib/types";

export type LeadTier = "cold" | "warm" | "hot";

export function totalScore(answers: LeadAnswer[]): number {
  const sum = answers.reduce((acc, a) => acc + (a.score || 0), 0);
  return Math.max(0, Math.min(100, sum));
}

// 0-30 frio | 31-60 potencial | 61-100 quente. Never shown to the lead.
export function tierFromScore(score: number): LeadTier {
  if (score >= 61) return "hot";
  if (score >= 31) return "warm";
  return "cold";
}

export const TIER_LABEL: Record<LeadTier, string> = {
  cold: "Frio",
  warm: "Em potencial",
  hot: "Quente",
};
