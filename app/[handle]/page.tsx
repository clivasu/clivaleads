import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicOrgFunnels } from "@/lib/data/flows";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicOrgFunnels(handle);
  return { title: data ? data.org.name : "Página não encontrada" };
}

export default async function HandleIndexPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const data = await getPublicOrgFunnels(handle);
  if (!data) notFound();
  const { org, flows } = data;
  const color = org.primary_color ?? "#7C3AED";

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <div className="mx-auto max-w-lg px-5 py-12">
        <div className="mb-8 flex items-center gap-3">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: color }}>
              {org.name.charAt(0)}
            </span>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{org.name}</h1>
            <p className="text-sm text-slate-500">Escolha uma avaliação para começar</p>
          </div>
        </div>

        {flows.length === 0 ? (
          <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
            Nenhum funil publicado ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {flows.map((f) => (
              <Link
                key={f.id}
                href={`/${handle}/${f.slug}`}
                className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-slate-300"
              >
                <span>
                  <span className="block font-semibold text-slate-900">{f.procedure ?? f.name}</span>
                  {f.description && <span className="block text-sm text-slate-500">{f.description}</span>}
                </span>
                <span className="text-slate-300">→</span>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-slate-300">Feito com Prelead</p>
      </div>
    </div>
  );
}
