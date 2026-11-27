/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nenhuma tela usa next/image: o otimizador não aceita imagens de fora.
  // Reduz a superfície de ataque (GHSA-2464-fhr4-w9xw e semelhantes).
  images: {
    remotePatterns: [],
  },
  async headers() {
    // Painel e login: não podem ser abertos dentro de outro site (clickjacking).
    // Os funis continuam podendo ser incorporados no site da clínica.
    const PRIVATE = ["dashboard", "flows", "leads", "analytics", "schedule", "patients", "settings", "admin", "bio", "assinar", "login", "redefinir-senha", "auth"];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      ...PRIVATE.map((p) => ({
        source: `/${p}/:path*`,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      })),
      {
        // Sem cache: o navegador precisa ver novas versões do service worker.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/app.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json; charset=utf-8" }],
      },
    ];
  },
};

export default nextConfig;
