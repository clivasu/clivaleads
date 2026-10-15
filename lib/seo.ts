import type { Metadata } from "next";
import type { PublicFunnelConfig } from "@/lib/public-funnel-config";
import { siteUrl } from "@/lib/site-url";

// Metadados da página pública do funil a partir da configuração validada.
export function funnelMetadata(
  flow: { name: string; procedure: string | null; description: string | null; cover_image_url: string | null; slug: string },
  org: { name: string; slug: string },
  config: PublicFunnelConfig,
): Metadata {
  const title = config.seo.title ?? `${flow.procedure ?? flow.name} — ${org.name}`;
  const description = config.seo.description ?? flow.description ?? undefined;
  const image = config.seo.ogImage ?? (flow.cover_image_url?.startsWith("https://") ? flow.cover_image_url : null);
  const canonical = `${siteUrl()}/${org.slug}/${flow.slug}`;
  const fav = config.seo.favicon;
  const icon = fav && "url" in fav
    ? fav.url
    : fav && "emoji" in fav
      ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${fav.emoji}</text></svg>`)}`
      : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    robots: config.seo.noindex ? { index: false, follow: false } : undefined,
    ...(icon ? { icons: { icon } } : {}),
  };
}
