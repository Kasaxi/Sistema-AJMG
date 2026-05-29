-- ============================================================
-- MIGRAÇÃO 0017 — Ordenação manual de imóveis e grupos
--
-- imoveis.ordem            — posição do imóvel dentro do seu grupo
-- imovel_carteiras.ordem_grupos — ordem dos grupos (empreendimentos/regiões)
--                            por carteira; array de nomes normalizados (UPPER).
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS imoveis_ordem_idx ON public.imoveis(carteira_id, ordem);

ALTER TABLE public.imovel_carteiras
  ADD COLUMN IF NOT EXISTS ordem_grupos TEXT[] NOT NULL DEFAULT '{}';
