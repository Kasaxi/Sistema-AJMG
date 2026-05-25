-- ============================================================
-- MIGRAÇÃO 0006 — Módulo Compras e Gastos de Obra
--
-- 5 tabelas pro controle de gastos:
--   fornecedores     — cadastro
--   unidades_medida  — un/kg/m²/m³/sc/...
--   categorias_custo — Estrutura/Hidráulica/Elétrica/...
--   itens_catalogo   — opcional; itens recorrentes
--   gastos           — lançamento: 1 linha = 1 gasto, espelha o Sheets
--
-- valor_total é GENERATED ALWAYS AS (quantidade * valor_unit) STORED
-- pra eliminar bug de digitação manual.
--
-- RLS:
--   ADMIN faz tudo. COLABORADOR com 'COMPRAS' lê (escrita futura).
--
-- Seeds: unidades_medida + categorias_custo padrão.
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. fornecedores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome            TEXT NOT NULL,
  telefone        TEXT,
  email           TEXT,
  cnpj_cpf        TEXT,
  observacoes     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fornecedores_nome_idx ON public.fornecedores USING GIN (to_tsvector('portuguese', nome));

DROP TRIGGER IF EXISTS fornecedores_set_updated_at ON public.fornecedores;
CREATE TRIGGER fornecedores_set_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 2. unidades_medida
-- ============================================================
CREATE TABLE IF NOT EXISTS public.unidades_medida (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sigla           TEXT UNIQUE NOT NULL,
  nome            TEXT NOT NULL,
  ordem           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. categorias_custo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias_custo (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome            TEXT UNIQUE NOT NULL,
  cor             TEXT,
  icone           TEXT,
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS categorias_custo_set_updated_at ON public.categorias_custo;
CREATE TRIGGER categorias_custo_set_updated_at
  BEFORE UPDATE ON public.categorias_custo
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 4. itens_catalogo (opcional; preenchido conforme uso)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.itens_catalogo (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  descricao             TEXT NOT NULL,
  unidade_padrao_id     TEXT REFERENCES public.unidades_medida(id) ON DELETE SET NULL,
  categoria_padrao_id   TEXT REFERENCES public.categorias_custo(id) ON DELETE SET NULL,
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itens_catalogo_descricao_idx ON public.itens_catalogo USING GIN (to_tsvector('portuguese', descricao));

DROP TRIGGER IF EXISTS itens_catalogo_set_updated_at ON public.itens_catalogo;
CREATE TRIGGER itens_catalogo_set_updated_at
  BEFORE UPDATE ON public.itens_catalogo
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 5. gastos (núcleo do módulo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gastos (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  obra_id           TEXT NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  descricao         TEXT NOT NULL,
  item_catalogo_id  TEXT REFERENCES public.itens_catalogo(id) ON DELETE SET NULL,
  categoria_id      TEXT NOT NULL REFERENCES public.categorias_custo(id) ON DELETE RESTRICT,
  fornecedor_id     TEXT REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  quantidade        NUMERIC(12,3) NOT NULL,
  unidade_id        TEXT NOT NULL REFERENCES public.unidades_medida(id) ON DELETE RESTRICT,
  valor_unitario    NUMERIC(12,2) NOT NULL,
  valor_total       NUMERIC(14,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  data              DATE NOT NULL,
  observacoes       TEXT,
  criado_por        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_obra_idx       ON public.gastos(obra_id);
CREATE INDEX IF NOT EXISTS gastos_data_idx       ON public.gastos(data DESC);
CREATE INDEX IF NOT EXISTS gastos_categoria_idx  ON public.gastos(categoria_id);
CREATE INDEX IF NOT EXISTS gastos_fornecedor_idx ON public.gastos(fornecedor_id);

DROP TRIGGER IF EXISTS gastos_set_updated_at ON public.gastos;
CREATE TRIGGER gastos_set_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.fornecedores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_catalogo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos           ENABLE ROW LEVEL SECURITY;

-- Fornecedores
DROP POLICY IF EXISTS "Admin gerencia fornecedores" ON public.fornecedores;
CREATE POLICY "Admin gerencia fornecedores" ON public.fornecedores
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê fornecedores" ON public.fornecedores;
CREATE POLICY "COMPRAS lê fornecedores" ON public.fornecedores
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- Unidades de medida
DROP POLICY IF EXISTS "Admin gerencia unidades" ON public.unidades_medida;
CREATE POLICY "Admin gerencia unidades" ON public.unidades_medida
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê unidades" ON public.unidades_medida;
CREATE POLICY "COMPRAS lê unidades" ON public.unidades_medida
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- Categorias de custo
DROP POLICY IF EXISTS "Admin gerencia categorias_custo" ON public.categorias_custo;
CREATE POLICY "Admin gerencia categorias_custo" ON public.categorias_custo
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê categorias_custo" ON public.categorias_custo;
CREATE POLICY "COMPRAS lê categorias_custo" ON public.categorias_custo
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- Itens catálogo
DROP POLICY IF EXISTS "Admin gerencia itens_catalogo" ON public.itens_catalogo;
CREATE POLICY "Admin gerencia itens_catalogo" ON public.itens_catalogo
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê itens_catalogo" ON public.itens_catalogo;
CREATE POLICY "COMPRAS lê itens_catalogo" ON public.itens_catalogo
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- Gastos
DROP POLICY IF EXISTS "Admin gerencia gastos" ON public.gastos;
CREATE POLICY "Admin gerencia gastos" ON public.gastos
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê gastos" ON public.gastos;
CREATE POLICY "COMPRAS lê gastos" ON public.gastos
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- ============================================================
-- 7. Seeds: unidades_medida e categorias_custo padrão
-- ============================================================

INSERT INTO public.unidades_medida (sigla, nome, ordem) VALUES
  ('un',     'Unidade',     1),
  ('pç',     'Peça',        2),
  ('kg',     'Quilograma',  3),
  ('sc',     'Saco',        4),
  ('m',      'Metro',       5),
  ('m²',     'Metro quadrado', 6),
  ('m³',     'Metro cúbico',   7),
  ('l',      'Litro',       8),
  ('h',      'Hora',        9),
  ('dia',    'Dia',        10),
  ('mês',    'Mês',        11),
  ('palete', 'Palete',     12)
ON CONFLICT (sigla) DO NOTHING;

-- Categorias baseadas nos Sheets reais analisados (QD 55, QD 70, QD 151)
INSERT INTO public.categorias_custo (nome, cor, ordem) VALUES
  ('Estrutura',            '#475569',  1),
  ('Alvenaria',            '#78716C',  2),
  ('Ferragem',             '#0F172A',  3),
  ('Impermeabilizante',    '#1E40AF',  4),
  ('Hidráulica',           '#0891B2',  5),
  ('Elétrica',             '#B45309',  6),
  ('Acabamento',           '#7C3AED',  7),
  ('Mármore',              '#374151',  8),
  ('Mão-de-obra',          '#1B2E68',  9),
  ('Locação/Equipamentos', '#6B7280', 10),
  ('Documentação',         '#1E3A8A', 11),
  ('Transporte',           '#0E7490', 12),
  ('Energia/Água',         '#0F766E', 13),
  ('Aluguel',              '#475569', 14),
  ('Ajuda de custo',       '#9CA3AF', 15),
  ('Outros',               '#6B7280', 99)
ON CONFLICT (nome) DO NOTHING;
