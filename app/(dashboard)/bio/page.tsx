import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentOrg } from "@/lib/data/org";
import { getMyBio, getBioClicks } from "@/lib/data/bio";
import { ensureBio } from "@/lib/actions/bio";
import { isSupabaseConfigured } from "@/lib/env";
import { BioEditor } from "@/components/bio/bio-editor";

export const dynamic = "force-dynamic";

export default async function BioPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  if (isSupabaseConfigured) await ensureBio();
  const bio = await getMyBio(org.id);
  if (!bio) redirect("/login");
  const clicks = await getBioClicks(bio.id);

  const h = await headers();
  const host = h.get("host") ?? "prelead.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";

  return <BioEditor bio={bio} handle={org.slug} baseUrl={`${proto}://${host}`} clicks={clicks} />;
}
