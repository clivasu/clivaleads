import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isStripeConfigured } from "@/lib/stripe";
import { getPlan, type Plan } from "@/lib/plans";

export interface OrgBilling {
  organization_id: string;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_used: boolean;
  manual?: boolean;
  admin_note?: string | null;
}

export interface BillingState {
  enabled: boolean;      // cobrança ligada (Stripe + tabela org_billing existem)
  billing: OrgBilling | null;
  plan: Plan | null;     // plano em vigor (null = sem limites)
  hasAccess: boolean;
}

// comp = cortesia liberada pelo admin; legacy = conta anterior à cobrança.
const ACCESS_STATUSES = new Set(["trialing", "active", "past_due", "legacy", "comp"]);

export function statusHasAccess(status?: string | null): boolean {
  return ACCESS_STATUSES.has(status ?? "");
}

// "Tabela não existe" = migration 0007 ainda não rodou: cobrança desligada.
const isMissingTable = (code?: string) => code === "42P01" || code === "PGRST205";

function toState(row: OrgBilling | null, error?: { code?: string } | null): BillingState {
  if (error && isMissingTable(error.code)) return { enabled: false, billing: null, plan: null, hasAccess: true };
  const hasAccess = statusHasAccess(row?.status);
  return {
    enabled: true,
    billing: row,
    plan: hasAccess ? getPlan(row?.plan) ?? null : null,
    hasAccess,
  };
}

const OFF: BillingState = { enabled: false, billing: null, plan: null, hasAccess: true };

// Estado da assinatura da org do usuário logado (respeita RLS).
export async function getBillingState(orgId: string): Promise<BillingState> {
  if (!isSupabaseConfigured || !isStripeConfigured) return OFF;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_billing")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return toState((data as OrgBilling | null) ?? null, error);
}

// Mesma coisa via service role, para rotas públicas (ex.: captura de lead).
export async function getBillingStateAdmin(orgId: string): Promise<BillingState> {
  if (!isSupabaseConfigured || !isStripeConfigured) return OFF;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("org_billing")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return toState((data as OrgBilling | null) ?? null, error);
}

export function monthStartISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export interface Usage {
  publishedFlows: number;
  leadsThisMonth: number;
}

export async function getUsage(orgId: string): Promise<Usage> {
  if (!isSupabaseConfigured) return { publishedFlows: 0, leadsThisMonth: 0 };
  const supabase = await createClient();
  const [flows, leads] = await Promise.all([
    supabase.from("flows").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("status", "published"),
    supabase.from("lead_sessions").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).not("flow_id", "is", null).gte("created_at", monthStartISO()), // só leads dos funis
  ]);
  return { publishedFlows: flows.count ?? 0, leadsThisMonth: leads.count ?? 0 };
}
