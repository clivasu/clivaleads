import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicFlow, resolveLegacySlug } from "@/lib/data/flows";
import { isSupabaseConfigured } from "@/lib/env";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { MarketingPixels } from "@/components/flow-runner/marketing-pixels";
import { toPublicConfig } from "@/lib/public-funnel-config";

export const dynamic = "force-dynamic";

// Rota antiga /f/<slug>. Com banco conectado, redireciona (308) para a URL
// canônica /<identificador>/<slug>. No modo demonstração continua servindo
// os funis de exemplo.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isSupabaseConfigured) return { title: "Redirecionando…", robots: { index: false } };
  const flow = await getPublicFlow(slug);
  if (!flow) return { title: "Funil não encontrado" };
  return {
    title: `${flow.procedure ?? flow.name} — ${flow.organization.name}`,
    description: flow.description ?? undefined,
    openGraph: flow.cover_image_url ? { images: [flow.cover_image_url] } : undefined,
  };
}

export default async function LegacyFlowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isSupabaseConfigured) {
    const canonical = await resolveLegacySlug(slug);
    if (!canonical) notFound();
    permanentRedirect(canonical);
  }
  const flow = await getPublicFlow(slug);
  if (!flow || flow.steps.length === 0) notFound();
  // Demonstração: mesma configuração pública validada das páginas reais.
  const config = toPublicConfig((flow as { settings?: unknown }).settings);
  return (
    <div className="min-h-[100dvh] bg-white">
      <FlowRunner flow={flow} config={config} />
      <MarketingPixels config={config} orgId={flow.organization_id} />
    </div>
  );
}
