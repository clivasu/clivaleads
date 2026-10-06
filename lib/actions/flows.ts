"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import type { FlowStep } from "@/lib/types";
import { getBillingState } from "@/lib/data/billing";

export interface SaveFlowInput {
  id: string;
  name: string;
  slug: string;
  procedure: string;
  description: string;
  status: "draft" | "published";
  whatsapp: string;
  finalMessage: string;
  coverImageUrl?: string | null;
  settings: Record<string, unknown>;
  steps: FlowStep[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

// Achata a árvore para linhas de flow_steps, guardando os filhos (blocos
// aninhados do container/hero) dentro do próprio config JSONB.
function serializeSteps(steps: FlowStep[]) {
  return steps.map((s, i) => ({
    flow_id: s.flow_id,
    position: i,
    type: s.type,
    config: s.children && s.children.length > 0
      ? { ...s.config, __children: s.children }
      : s.config,
  }));
}

export async function saveFlow(input: SaveFlowInput): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    // Modo demo: nada é persistido, mas o builder segue funcionando localmente.
    return { ok: true, id: input.id };
  }

  const supabase = await createClient();

  // Limite de funis publicados do plano.
  if (input.status === "published") {
    const org = await getCurrentOrg();
    const billing = org ? await getBillingState(org.id) : null;
    if (org && billing?.plan) {
      const { count } = await supabase
        .from("flows")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("status", "published")
        .neq("id", input.id);
      if ((count ?? 0) >= billing.plan.funnels) {
        const n = billing.plan.funnels;
        return {
          ok: false,
          error: `Seu plano ${billing.plan.name} permite ${n} funi${n === 1 ? "l publicado" : "s publicados"}. Salve como rascunho, despublique outro funil ou troque de plano em Configurações.`,
        };
      }
    }
  }

  const { error: flowErr } = await supabase
    .from("flows")
    .update({
      name: input.name,
      slug: input.slug,
      procedure: input.procedure || null,
      description: input.description || null,
      status: input.status,
      whatsapp_number: input.whatsapp || null,
      final_message: input.finalMessage || null,
      cover_image_url: input.coverImageUrl ?? null,
      settings: input.settings,
    })
    .eq("id", input.id);

  if (flowErr) return { ok: false, error: flowErr.message };

  // Substitui as etapas (delete + insert). RLS garante que só o dono altera.
  const { error: delErr } = await supabase
    .from("flow_steps")
    .delete()
    .eq("flow_id", input.id);
  if (delErr) return { ok: false, error: delErr.message };

  if (input.steps.length > 0) {
    const rows = serializeSteps(
      input.steps.map((s) => ({ ...s, flow_id: input.id })),
    );
    const { error: insErr } = await supabase.from("flow_steps").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath(`/flows/${input.id}/builder`);
  revalidatePath(`/f/${input.slug}`);
  revalidatePath("/flows");
  return { ok: true, id: input.id };
}

export async function createFlow(input: {
  name: string;
  procedure: string;
  slug: string;
  whatsapp: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Conecte o Supabase para criar funis persistentes." };
  }

  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Nenhuma organização encontrada. Faça login." };

  const supabase = await createClient();
  const slug =
    input.slug.trim() ||
    input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const { data: flow, error } = await supabase
    .from("flows")
    .insert({
      organization_id: org.id,
      name: input.name,
      slug,
      procedure: input.procedure || null,
      status: "draft",
      whatsapp_number: input.whatsapp || null,
      settings: {},
    })
    .select("id")
    .single();

  if (error || !flow) return { ok: false, error: error?.message ?? "Falha ao criar." };

  // Etapa inicial padrão para o builder não abrir vazio.
  await supabase.from("flow_steps").insert({
    flow_id: flow.id,
    position: 0,
    type: "start",
    config: {
      title: input.name,
      subtitle: "Responda algumas perguntas rápidas.",
      duration_label: "Leva 1 minuto",
      button_label: "Começar",
    },
  });

  revalidatePath("/flows");
  return { ok: true, id: flow.id };
}

// Modelos de funil prontos entregues a toda conta nova.
const TEMPLATE_SLUGS = [
  "harmonizacao-facial-clinica-demo",
  "rinomodelacao-clinica-demo",
  "botox-full-face-clinica-demo",
  "roleta-clinica-demo",
];

const TEMPLATE_NAMES: Record<string, string> = {
  "harmonizacao-facial-clinica-demo": "Harmonização Facial — Avaliação",
  "rinomodelacao-clinica-demo": "Rinomodelação — Avaliação",
  "botox-full-face-clinica-demo": "Botox Full Face — Avaliação",
  "roleta-clinica-demo": "Brinde — Roleta",
};

function slugifyBase(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Semeia os modelos de funil da Cliva na organização (uma vez, quando vazia).
export async function seedTemplateFlows(orgId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { demoFlows } = await import("@/lib/demo-data");
  const supabase = await createClient();
  let created = 0;

  for (const slug of TEMPLATE_SLUGS) {
    const tpl = demoFlows.find((f) => f.slug === slug);
    if (!tpl) continue;
    const name = TEMPLATE_NAMES[slug] ?? tpl.name;
    const newSlug = `${slugifyBase(name)}-${Math.random().toString(36).slice(2, 7)}`;

    const { data: flow, error } = await supabase
      .from("flows")
      .insert({
        organization_id: orgId,
        name,
        slug: newSlug,
        procedure: tpl.procedure ?? null,
        description: tpl.description ?? null,
        status: "draft",
        whatsapp_number: null,
        final_message: tpl.final_message ?? null,
        settings: {},
      })
      .select("id")
      .single();
    if (error || !flow) continue;

    const rows = serializeSteps((tpl.steps ?? []).map((s) => ({ ...s, flow_id: flow.id })));
    if (rows.length > 0) await supabase.from("flow_steps").insert(rows);
    created += 1;
  }

  return created;
}

// Insere um modelo por especialidade (rascunho) na organização.
async function insertSpecialtyFlow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  whatsapp: string | null,
  key: string,
): Promise<string | null> {
  const { getSpecialty, buildSpecialtySteps } = await import("@/lib/specialty-templates");
  const spec = getSpecialty(key);
  if (!spec) return null;
  const { data: flow, error } = await supabase
    .from("flows")
    .insert({
      organization_id: orgId,
      name: spec.name,
      slug: `${slugifyBase(spec.specialty)}-${Math.random().toString(36).slice(2, 7)}`,
      procedure: spec.procedure,
      description: spec.description,
      cover_image_url: `/templates/${spec.key}/cover.webp`,
      status: "draft",
      whatsapp_number: whatsapp,
      final_message: spec.final_message,
      settings: { template: spec.key },
    })
    .select("id")
    .single();
  if (error || !flow) return null;
  const { error: insErr } = await supabase.from("flow_steps").insert(serializeSteps(buildSpecialtySteps(spec, flow.id)));
  if (insErr) return null;
  return flow.id;
}

// Semeia os 7 modelos por especialidade. Roda para conta nova e, uma vez,
// para contas que ainda não têm nenhum deles.
export async function seedSpecialtyFlows(orgId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { SPECIALTIES } = await import("@/lib/specialty-templates");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("whatsapp_number").eq("id", orgId).single();
  let created = 0;
  // Ordem inversa: o primeiro da lista fica no topo (lista ordena por mais recente).
  for (const spec of [...SPECIALTIES].reverse()) {
    if (await insertSpecialtyFlow(supabase, orgId, org?.whatsapp_number ?? null, spec.key)) created += 1;
  }
  return created;
}

// Cria um funil a partir de um modelo por especialidade (galeria do "Novo funil").
export async function createFlowFromTemplate(key: string): Promise<ActionResult> {
  const { getSpecialty, specialtyFlows } = await import("@/lib/specialty-templates");
  const spec = getSpecialty(key);
  if (!spec) return { ok: false, error: "Modelo não encontrado." };

  // Modo demo: abre o próprio modelo no builder (nada é persistido).
  if (!isSupabaseConfigured) {
    return { ok: true, id: specialtyFlows.find((f) => f.slug === `modelo-${key}`)?.id };
  }

  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Nenhuma organização encontrada. Faça login." };

  const supabase = await createClient();
  const id = await insertSpecialtyFlow(supabase, org.id, org.whatsapp_number ?? null, spec.key);
  if (!id) return { ok: false, error: "Falha ao criar o funil." };

  revalidatePath("/flows");
  return { ok: true, id };
}
