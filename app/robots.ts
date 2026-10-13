import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Páginas públicas (site, links das clínicas e funis) podem ser indexadas;
// painel, APIs e rotas de login não. Funil com "noindex" usa a meta tag.
const PRIVATE = ["/dashboard", "/flows", "/leads", "/analytics", "/schedule", "/settings", "/admin", "/bio", "/assinar", "/redefinir-senha"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // "$" e "/" no fim: bloqueia a rota exata sem pegar identificadores
      // de clínicas que começam com a mesma palavra (ex.: /biomedica).
      disallow: ["/api/", "/auth/", "/f/", ...PRIVATE.flatMap((p) => [`${p}$`, `${p}/`])],
    },
    host: siteUrl(),
  };
}
