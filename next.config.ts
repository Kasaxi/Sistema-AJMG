import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Aumenta o limite de body pras server actions (default 1MB) pra suportar
    // upload de PDFs/imagens/Excel de até 20MB nas cotações públicas.
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
