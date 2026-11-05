/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nenhuma tela usa next/image: o otimizador não aceita imagens de fora.
  // Reduz a superfície de ataque (GHSA-2464-fhr4-w9xw e semelhantes).
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
