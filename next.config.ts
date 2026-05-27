import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Aumenta o limite de body pras server actions (default 1MB).
    // 100MB pra caber vídeo curto de celular em anexos de manutenção.
    // Cotações (PDFs/imagens/Excel) ficam bem abaixo desse limite.
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
