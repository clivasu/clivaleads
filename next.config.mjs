/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nenhuma tela usa next/image: o otimizador não aceita imagens de fora.
  // Reduz a superfície de ataque (GHSA-2464-fhr4-w9xw e semelhantes).
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
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
