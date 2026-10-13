import { notFound } from "next/navigation";
import { getFlowById, getFlowPrivateSettings } from "@/lib/data/flows";
import { listLeadsByFlow } from "@/lib/data/leads";
import { BuilderClient } from "@/components/builder/builder-client";
import type { JourneyLead } from "@/lib/flow-journeys";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flow = await getFlowById(id);
  if (!flow) notFound();

  const [rows, privateSettings] = await Promise.all([listLeadsByFlow(id), getFlowPrivateSettings(id)]);
  const leads: JourneyLead[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    whatsapp_clicked: l.whatsapp_clicked,
    status: l.status,
    answers: l.answers?.map((a) => ({ question_title: a.question_title })),
  }));

  return <BuilderClient flow={flow} leads={leads} privateSettings={privateSettings} />;
}
