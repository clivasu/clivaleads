import { notFound } from "next/navigation";
import { getFlowById } from "@/lib/data/flows";
import { BuilderClient } from "@/components/builder/builder-client";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flow = await getFlowById(id);
  if (!flow) notFound();

  return <BuilderClient flow={flow} />;
}
