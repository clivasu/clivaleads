import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicFunnelPage } from "@/lib/data/flows";
import { FlowRunner } from "@/components/flow-runner/flow-runner";
import { MarketingPixels } from "@/components/flow-runner/marketing-pixels";
import { funnelMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}): Promise<Metadata> {
  const { handle, slug } = await params;
  const page = await getPublicFunnelPage(handle, slug);
  if (!page) return { title: "Funil não encontrado", robots: { index: false } };
  return funnelMetadata(page.flow, page.flow.organization, page.config);
}

export default async function HandleFlowPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  const page = await getPublicFunnelPage(handle, slug);
  if (!page || page.flow.steps.length === 0) notFound();

  return (
    <div className="min-h-[100dvh] bg-white">
      <FlowRunner flow={page.flow} config={page.config} />
      <MarketingPixels config={page.config} orgId={page.flow.organization_id} />
    </div>
  );
}
