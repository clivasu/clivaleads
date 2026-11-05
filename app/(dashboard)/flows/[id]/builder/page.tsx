import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Monitor } from "lucide-react";
import { getFlowById, getFlowPrivateSettings } from "@/lib/data/flows";
import { listLeadsByFlow } from "@/lib/data/leads";
import { BuilderClient } from "@/components/builder/builder-client";
import type { JourneyLead } from "@/lib/flow-journeys";
import { getBookingOptions } from "@/lib/data/booking";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flow = await getFlowById(id);
  if (!flow) notFound();

  const [rows, privateSettings, bookingOptions] = await Promise.all([listLeadsByFlow(id), getFlowPrivateSettings(id), getBookingOptions(flow.organization_id)]);
  const leads: JourneyLead[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    whatsapp_clicked: l.whatsapp_clicked,
    status: l.status,
    answers: l.answers?.map((a) => ({ question_title: a.question_title })),
  }));

  return (
    <>
      {/* O editor tem três painéis: no celular, orienta a abrir no computador. */}
      <div className="flex flex-col items-center py-10 text-center md:hidden">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50"><Monitor className="h-7 w-7 text-emerald-600" /></span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{flow.name}</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">O editor de funis foi feito para telas grandes. Para editar, abra a Cliva no computador.</p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          {flow.status === "published" && (
            <Link href={`/${flow.organization.slug}/${flow.slug}`} target="_blank" className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white">
              <ExternalLink className="h-4 w-4" /> Ver o funil publicado
            </Link>
          )}
          <Link href="/flows" className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Voltar para Funis
          </Link>
        </div>
      </div>
      <div className="hidden md:block">
        <BuilderClient flow={flow} leads={leads} privateSettings={privateSettings} bookingOptions={bookingOptions} />
      </div>
    </>
  );
}
