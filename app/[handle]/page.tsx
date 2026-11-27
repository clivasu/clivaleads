import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { getPublicBioByHandle } from "@/lib/data/bio";
import { BioRenderer } from "@/components/bio/bio-renderer";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// cliva.me/<identificador> mostra só o Link na Bio publicado. Sem bio, a página
// não existe: os funis da conta não são listados (cada funil tem o próprio link).
const getBio = cache((handle: string) => getPublicBioByHandle(handle));

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const bio = await getBio(handle);
  if (!bio) return { title: "Página não encontrada", robots: { index: false } };
  return { title: bio.config.name, description: bio.config.tagline, alternates: { canonical: `${siteUrl()}/${handle.toLowerCase()}` } };
}

export default async function HandleIndexPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const bio = await getBio(handle);
  if (!bio) notFound();
  return <BioRenderer config={bio.config} pageId={bio.id} />;
}
