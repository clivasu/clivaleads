import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicFlowByHandle } from "@/lib/data/flows";
import { FlowRunner } from "@/components/flow-runner/flow-runner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}): Promise<Metadata> {
  const { handle, slug } = await params;
  const flow = await getPublicFlowByHandle(handle, slug);
  if (!flow) return { title: "Funil não encontrado" };
  return {
    title: `${flow.procedure ?? flow.name} — ${flow.organization.name}`,
    description: flow.description ?? undefined,
    openGraph: flow.cover_image_url ? { images: [flow.cover_image_url] } : undefined,
  };
}

export default async function HandleFlowPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  const flow = await getPublicFlowByHandle(handle, slug);
  if (!flow || flow.steps.length === 0) notFound();

  return (
    <div className="min-h-[100dvh] bg-white">
      <FlowRunner flow={flow} />
    </div>
  );
}
