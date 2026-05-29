-- ============================================================
-- MIGRAÇÃO 0019 — Módulo Financeiro (Fase 1: lançamentos)
--
-- Substitui o ERP-Financeiro avulso. Foco: ENTRADAS e SAÍDAS.
--   financeiro_centros_custo — centros de custo flexíveis (Grupo > Nome).
--                              Podem ser obra, imóvel ou avulso (ADM,
--                              Abastecimento...). Permitem relatório individual.
--   financeiro_categorias    — classificação dos lançamentos (+ grupo_dre
--                              já preparado pro DRE futuro)
--   financeiro_lancamentos   — uma linha por entrada/saída. Aponta pra um
--                              centro de custo (opcional). created_by = quem lançou.
--
-- Decisões (alinhadas com o usuário):
--   - Centro de custo é uma LISTA PRÓPRIA flexível (obra/imóvel/avulso). No app
--     antigo tudo era "imóvel" e ele criava unidades-fantasma pra ADM/gasolina;
--     aqui ADM/Abastecimento são centros de verdade, separáveis em relatório.
--   - Não há responsável/person: o vínculo de "pessoa" é só created_by (quem lançou).
--   - Gastos (Compras) e Financeiro coexistem SEPARADOS — sem sincronização.
--
-- Permissão: módulo 'FINANCEIRO' em profiles.acesso_modulos (ADMIN sempre vê).
-- IDs TEXT (cuid/uuid). RLS cobre INSERT/UPDATE/DELETE/SELECT. Idempotente.
-- ============================================================

-- ============================================================
-- 0. financeiro_centros_custo — centros de custo (Grupo > Nome)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_centros_custo (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT NOT NULL,                 -- "SALDO ADM", "GASOLINA", "QD 03 CH 19 CS 03"
  grupo       TEXT,                          -- agrupador (1º nível): "ADM", "Luziânia"...
  tipo        TEXT NOT NULL DEFAULT 'AVULSO'
                CHECK (tipo IN ('OBRA','IMOVEL','AVULSO')),
  -- Vínculo opcional com entidade real (quando tipo = OBRA/IMOVEL)
  obra_id     TEXT REFERENCES public.obras(id)   ON DELETE SET NULL,
  imovel_id   TEXT REFERENCES public.imoveis(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade por (grupo, nome) tratando grupo NULL como '' (evita duplicado avulso)
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_centros_custo_uq
  ON public.financeiro_centros_custo (COALESCE(grupo, ''), nome);

DROP TRIGGER IF EXISTS financeiro_centros_custo_set_updated_at ON public.financeiro_centros_custo;
CREATE TRIGGER financeiro_centros_custo_set_updated_at
  BEFORE UPDATE ON public.financeiro_centros_custo
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 1. financeiro_categorias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  -- grupo pro DRE (deixado pra Fase 3). Texto livre por ora — sem CHECK, pra não
  -- travar import; quando formos fazer o DRE, normalizamos/validamos.
  grupo_dre   TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

-- Idempotente: remove qualquer CHECK antigo de grupo_dre (agora é texto livre).
-- Cobre tanto tabela nova quanto criada por execução anterior.
ALTER TABLE public.financeiro_categorias DROP CONSTRAINT IF EXISTS financeiro_categorias_grupo_dre_check;

DROP TRIGGER IF EXISTS financeiro_categorias_set_updated_at ON public.financeiro_categorias;
CREATE TRIGGER financeiro_categorias_set_updated_at
  BEFORE UPDATE ON public.financeiro_categorias
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Sem seed: as categorias reais (22) vêm do import do ERP-Financeiro antigo
-- (script de migração). Caso queira começar sem importar, cadastre na tela.

-- ============================================================
-- 2. financeiro_lancamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tipo              TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  descricao         TEXT NOT NULL,
  valor             NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  status            TEXT NOT NULL DEFAULT 'PENDENTE'
                      CHECK (status IN ('PENDENTE','PAGO','CANCELADO')),

  categoria_id      TEXT REFERENCES public.financeiro_categorias(id) ON DELETE SET NULL,
  -- Centro de custo (opcional). Lista flexível: obra, imóvel ou avulso.
  centro_custo_id   TEXT REFERENCES public.financeiro_centros_custo(id) ON DELETE SET NULL,

  -- data_competencia = quando o fato aconteceu / data do lançamento
  -- data_vencimento  = quando o dinheiro entra/sai no caixa (alimenta os totais)
  -- data_pagamento   = preenchida ao "dar baixa" (status -> PAGO)
  data_competencia  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento   DATE NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento    DATE,

  origem            TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','import')),
  observacoes       TEXT,

  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotente: cobre tabela já criada por uma execução anterior (versão antiga
-- usava obra_id). Garante centro_custo_id e remove a coluna/índice antigos.
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS centro_custo_id TEXT REFERENCES public.financeiro_centros_custo(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS public.financeiro_lanc_obra_idx;
ALTER TABLE public.financeiro_lancamentos DROP COLUMN IF EXISTS obra_id;

CREATE INDEX IF NOT EXISTS financeiro_lanc_venc_idx      ON public.financeiro_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS financeiro_lanc_status_idx    ON public.financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS financeiro_lanc_tipo_idx      ON public.financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS financeiro_lanc_centro_idx    ON public.financeiro_lancamentos(centro_custo_id);
CREATE INDEX IF NOT EXISTS financeiro_lanc_categoria_idx ON public.financeiro_lancamentos(categoria_id);

DROP TRIGGER IF EXISTS financeiro_lancamentos_set_updated_at ON public.financeiro_lancamentos;
CREATE TRIGGER financeiro_lancamentos_set_updated_at
  BEFORE UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. RLS — ADMIN tudo; quem tem módulo FINANCEIRO faz tudo
-- ============================================================
ALTER TABLE public.financeiro_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia financeiro_centros_custo" ON public.financeiro_centros_custo;
CREATE POLICY "Admin gerencia financeiro_centros_custo" ON public.financeiro_centros_custo
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "FINANCEIRO gerencia financeiro_centros_custo" ON public.financeiro_centros_custo;
CREATE POLICY "FINANCEIRO gerencia financeiro_centros_custo" ON public.financeiro_centros_custo
  FOR ALL USING (public.user_has_module('FINANCEIRO'));

DROP POLICY IF EXISTS "Admin gerencia financeiro_categorias" ON public.financeiro_categorias;
CREATE POLICY "Admin gerencia financeiro_categorias" ON public.financeiro_categorias
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "FINANCEIRO gerencia financeiro_categorias" ON public.financeiro_categorias;
CREATE POLICY "FINANCEIRO gerencia financeiro_categorias" ON public.financeiro_categorias
  FOR ALL USING (public.user_has_module('FINANCEIRO'));

DROP POLICY IF EXISTS "Admin gerencia financeiro_lancamentos" ON public.financeiro_lancamentos;
CREATE POLICY "Admin gerencia financeiro_lancamentos" ON public.financeiro_lancamentos
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "FINANCEIRO gerencia financeiro_lancamentos" ON public.financeiro_lancamentos;
CREATE POLICY "FINANCEIRO gerencia financeiro_lancamentos" ON public.financeiro_lancamentos
  FOR ALL USING (public.user_has_module('FINANCEIRO'));
