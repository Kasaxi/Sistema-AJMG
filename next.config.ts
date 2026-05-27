import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Aumenta o limite de body pras server actions (default 1MB).
    // 100MB pra caber vídeo curto de celular em anexos de manutenção.
    // Cotações (PDFs/imagens/Excel) ficam bem abaixo desse limite.
    serverActions: {
      bodySizeLimit: '100mb',
    },
    // Next 16 introduziu um buffer de proxy separado (default 10MB) que
    // trunca o body antes da server action ler. Sem isso, vídeos quebram
    // com "Unexpected end of form". Alinhado ao limite das server actions.
    proxyClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
