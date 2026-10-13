"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentOrg } from "@/lib/data/org";
import type { FlowStep } from "@/lib/types";
import { prepareStepsForSave, type IdMap, type StepRow } from "@/lib/flow-persistence";
import { splitSettings } from "@/lib/flow-settings";
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
  idMap?: IdMap; // ids definitivos das etapas novas (editor aplica)
}

// Linhas de flow_steps para funis criados a partir de modelos: ids definitivos
// e referências de lógica (goto) reescritas (ver lib/flow-persistence.ts).
function serializeSteps(steps: FlowStep[]) {
  const flowId = steps[0]?.flow_id;
  return prepareStepsForSave(steps).rows.map((r) => ({ ...r, flow_id: flowId }));
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

  // Integrações e contatos internos não vão para flows.settings (lido pelo
  // público): ficam em flow_private_settings.
  const { publicSettings, privateSettings } = splitSettings(input.settings);
  if (privateSettings.webhook_url && !/^https:\/\//i.test(privateSettings.webhook_url)) {
    return { ok: false, error: "A URL do webhook precisa começar com https://" };
  }

  const { rows, idMap } = prepareStepsForSave(input.steps);
  const flowPatch = {
    name: input.name,
    slug: input.slug,
    procedure: input.procedure || null,
    description: input.description || null,
    status: input.status,
    whatsapp_number: input.whatsapp || null,
    final_message: input.finalMessage || null,
    cover_image_url: input.coverImageUrl ?? null,
    settings: publicSettings,
  };

  // Funil + etapas numa única transação no banco (RLS: só owner/admin).
  let orgId: string | null = null;
  const { data: rpcOrg, error: rpcErr } = await supabase.rpc("save_flow", {
    p_flow_id: input.id,
    p_flow: flowPatch,
    p_steps: rows,
  });
  if (!rpcErr) {
    orgId = rpcOrg as string;
  } else if (rpcErr.code === "PGRST202" || rpcErr.code === "42883") {
    // Banco ainda sem a migration 0011: caminho antigo (não atômico).
    const legacy = await saveFlowLegacy(supabase, input.id, flowPatch, rows);
    if (!legacy.ok) return legacy;
    orgId = legacy.orgId;
  } else if (rpcErr.code === "42501") {
    return { ok: false, error: "Você não tem permissão para editar este funil." };
  } else {
    return { ok: false, error: friendlyDbError(rpcErr) };
  }

  // Passou pela RLS (owner/admin): grava as privadas pelo servidor.
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { error: privErr } = await createAdminClient()
    .from("flow_private_settings")
    .upsert(
      { flow_id: input.id, organization_id: orgId, ...privateSettings, updated_at: new Date().toISOString() },
      { onConflict: "flow_id" },
    );
  // Tabela ainda não criada (migration 0010 não aplicada): segue sem as privadas.
  if (privErr && privErr.code !== "42P01" && privErr.code !== "PGRST205") return { ok: false, error: privErr.message };

  revalidatePath(`/flows/${input.id}/builder`);
  revalidatePath(`/f/${input.slug}`);
  revalidatePath("/flows");
  return { ok: true, id: input.id, idMap };
}

function friendlyDbError(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Já existe um funil com este endereço (slug). Escolha outro.";
  return "Não foi possível salvar o funil. Nada foi alterado; tente de novo.";
}

// Caminho anterior à 0011 (sem transação). Mantido só para a janela de deploy.
async function saveFlowLegacy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  flowId: string,
  flowPatch: Record<string, unknown>,
  rows: StepRow[],
): Promise<ActionResult & { orgId: string | null }> {
  const { data: updated, error } = await supabase.from("flows").update(flowPatch).eq("id", flowId).select("organization_id");
  if (error) return { ok: false, error: friendlyDbError(error), orgId: null };
  if (!updated || updated.length === 0) return { ok: false, error: "Você não tem permissão para editar este funil.", orgId: null };
  const { error: delErr } = await supabase.from("flow_steps").delete().eq("flow_id", flowId);
  if (delErr) return { ok: false, error: friendlyDbError(delErr), orgId: null };
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("flow_steps").insert(rows.map((r) => ({ ...r, flow_id: flowId })));
    if (insErr) return { ok: false, error: friendlyDbError(insErr), orgId: null };
  }
  return { ok: true, orgId: updated[0].organization_id as string };
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

// Cria um funil a partir de um modelo por especialidade (galeria do "Novo funil").
export async function createFlowFromTemplate(key: string): Promise<ActionResult> {
  const { getSpecialty, buildSpecialtySteps, specialtyFlows } = await import("@/lib/specialty-templates");
  const spec = getSpecialty(key);
  if (!spec) return { ok: false, error: "Modelo não encontrado." };

  // Modo demo: abre o próprio modelo no builder (nada é persistido).
  if (!isSupabaseConfigured) {
    return { ok: true, id: specialtyFlows.find((f) => f.slug === `modelo-${key}`)?.id };
  }

  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Nenhuma organização encontrada. Faça login." };

  const supabase = await createClient();
  const { data: flow, error } = await supabase
    .from("flows")
    .insert({
      organization_id: org.id,
      name: spec.name,
      slug: `${slugifyBase(spec.specialty)}-${Math.random().toString(36).slice(2, 7)}`,
      procedure: spec.procedure,
      description: spec.description,
      cover_image_url: `/templates/${spec.key}/cover.webp`,
      status: "draft",
      whatsapp_number: org.whatsapp_number ?? null,
      final_message: spec.final_message,
      settings: {},
    })
    .select("id")
    .single();
  if (error || !flow) return { ok: false, error: error?.message ?? "Falha ao criar." };

  const rows = serializeSteps(buildSpecialtySteps(spec, flow.id));
  const { error: insErr } = await supabase.from("flow_steps").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/flows");
  return { ok: true, id: flow.id };
}

// Quantos leads um funil tem (para avisar antes de excluir).
export async function countFlowLeads(id: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("lead_sessions")
    .select("id", { count: "exact", head: true })
    .eq("flow_id", id);
  return count ?? 0;
}

// Exclui o funil (etapas, eventos e leads dele vão junto, por cascata no banco).
export async function deleteFlow(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "No modo demonstração os funis de exemplo não podem ser excluídos." };
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Faça login." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flows")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Funil não encontrado ou sem permissão para excluir." };

  revalidatePath("/flows");
  revalidatePath("/dashboard");
  return { ok: true, id };
}
