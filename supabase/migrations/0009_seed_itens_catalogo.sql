-- ============================================================
-- MIGRAÇÃO 0009 — Seed do catálogo de itens a partir dos gastos
--
-- A tabela `itens_catalogo` foi criada na 0006 mas nunca usada.
-- Esta migration:
--   1. Adiciona índice único sobre descrição normalizada
--      (lower(trim(descricao))) — permite ON CONFLICT em inserts
--      futuros e elimina duplicatas case/whitespace-insensitive.
--   2. Faz seed inicial agregando descrições distintas dos 364
--      gastos importados, escolhendo unidade_id e categoria_id
--      mais frequentes por descrição via MODE() WITHIN GROUP.
--
-- Após isso, o frontend faz busca por full-text (GIN index já
-- existe) e auto-upserta novos itens conforme são lançados.
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. Índice único na descrição normalizada
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS itens_catalogo_descricao_unique
  ON public.itens_catalogo (lower(trim(descricao)));

-- ============================================================
-- 2. Seed: agrega descrições distintas dos gastos
-- ============================================================
WITH agregado AS (
  SELECT
    trim(descricao) AS descricao_norm,
    -- MODE() retorna o valor mais frequente do grupo
    MODE() WITHIN GROUP (ORDER BY unidade_id) AS unidade_padrao,
    MODE() WITHIN GROUP (ORDER BY categoria_id) AS categoria_padrao
  FROM public.gastos
  WHERE descricao IS NOT NULL
    AND trim(descricao) != ''
  GROUP BY trim(descricao)
)
INSERT INTO public.itens_catalogo (descricao, unidade_padrao_id, categoria_padrao_id, ativo)
SELECT descricao_norm, unidade_padrao, categoria_padrao, true
FROM agregado
ON CONFLICT (lower(trim(descricao))) DO NOTHING;
