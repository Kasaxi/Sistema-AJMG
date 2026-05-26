-- ============================================================
-- MIGRAÇÃO 0007 — Módulo Cotações (RFQ / Orçamentos)
--
-- Fluxo:
--   1. AJMG cria uma `cotacao` (opcionalmente vinculada a uma obra)
--   2. Adiciona itens sugeridos em `cotacao_itens`
--   3. Adiciona fornecedores em `cotacao_fornecedores` (cada um ganha
--      um `token` único pra URL pública /cotacao/[token])
--   4. Fornecedor abre a URL sem login, preenche preços em
--      `cotacao_respostas`, opcionalmente envia anexos pra
--      `cotacao_anexos` (PDF / imagem / Excel)
--   5. AJMG vê o mapa de cotação, marca `vencedora` por item
--   6. Lança gastos manualmente conforme material chega
--
-- Tabelas:
--   cotacoes              — cabeçalho do pedido
--   cotacao_itens         — itens sugeridos pela AJMG
--   cotacao_fornecedores  — "envelope" por fornecedor (com token público)
--   cotacao_respostas     — preço preenchido pelo fornecedor por item
--   cotacao_anexos        — arquivos enviados pelo fornecedor
--
-- Bucket de storage: cotacao-anexos (privado; acesso via service_role
-- nas server actions que validam token).
--
-- RLS:
--   ADMIN faz tudo. COLABORADOR com 'COMPRAS' lê.
--   Acesso público via token NÃO usa RLS — server actions usam
--   service_role e validam o token manualmente. Mais simples e seguro
--   que policy condicional baseada em header.
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. cotacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cotacoes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  obra_id         TEXT REFERENCES public.obras(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  status          TEXT NOT NULL DEFAULT 'RASCUNHO'
                    CHECK (status IN ('RASCUNHO','ENVIADA','RECEBENDO','FECHADA','CANCELADA')),
  prazo_resposta  DATE,
  criado_por      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacoes_obra_idx     ON public.cotacoes(obra_id);
CREATE INDEX IF NOT EXISTS cotacoes_status_idx   ON public.cotacoes(status);
CREATE INDEX IF NOT EXISTS cotacoes_created_idx  ON public.cotacoes(created_at DESC);

DROP TRIGGER IF EXISTS cotacoes_set_updated_at ON public.cotacoes;
CREATE TRIGGER cotacoes_set_updated_at
  BEFORE UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 2. cotacao_itens (itens sugeridos pela AJMG)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cotacao_itens (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cotacao_id    TEXT NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  descricao     TEXT NOT NULL,
  quantidade    NUMERIC(12,3) NOT NULL DEFAULT 1,
  unidade_id    TEXT REFERENCES public.unidades_medida(id) ON DELETE SET NULL,
  categoria_id  TEXT REFERENCES public.categorias_custo(id) ON DELETE SET NULL,
  observacoes   TEXT,
  ordem         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_itens_cotacao_idx ON public.cotacao_itens(cotacao_id, ordem);

-- ============================================================
-- 3. cotacao_fornecedores (um "envelope" por fornecedor convidado)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cotacao_fornecedores (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cotacao_id      TEXT NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  fornecedor_id   TEXT NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'PENDENTE'
                    CHECK (status IN ('PENDENTE','ABERTA','RESPONDIDA','RECUSADA')),
  prazo_entrega_dias  INTEGER,
  observacoes_fornecedor TEXT,
  aberta_em       TIMESTAMPTZ,
  respondida_em   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cotacao_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS cotacao_fornecedores_cotacao_idx    ON public.cotacao_fornecedores(cotacao_id);
CREATE INDEX IF NOT EXISTS cotacao_fornecedores_fornecedor_idx ON public.cotacao_fornecedores(fornecedor_id);
CREATE INDEX IF NOT EXISTS cotacao_fornecedores_token_idx      ON public.cotacao_fornecedores(token);

DROP TRIGGER IF EXISTS cotacao_fornecedores_set_updated_at ON public.cotacao_fornecedores;
CREATE TRIGGER cotacao_fornecedores_set_updated_at
  BEFORE UPDATE ON public.cotacao_fornecedores
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 4. cotacao_respostas (preço de cada item pelo fornecedor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cotacao_respostas (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cotacao_fornecedor_id    TEXT NOT NULL REFERENCES public.cotacao_fornecedores(id) ON DELETE CASCADE,
  -- item_id = NULL quando é um item extra que o fornecedor adicionou
  -- (não estava na lista sugerida da AJMG)
  item_id                  TEXT REFERENCES public.cotacao_itens(id) ON DELETE SET NULL,
  descricao                TEXT NOT NULL,
  quantidade               NUMERIC(12,3) NOT NULL,
  unidade_id               TEXT REFERENCES public.unidades_medida(id) ON DELETE SET NULL,
  preco_unitario           NUMERIC(12,2) NOT NULL,
  preco_total              NUMERIC(14,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  observacoes              TEXT,
  vencedora                BOOLEAN NOT NULL DEFAULT false,  -- AJMG marca depois de ver
  ordem                    INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_respostas_envelope_idx ON public.cotacao_respostas(cotacao_fornecedor_id);
CREATE INDEX IF NOT EXISTS cotacao_respostas_item_idx     ON public.cotacao_respostas(item_id);

DROP TRIGGER IF EXISTS cotacao_respostas_set_updated_at ON public.cotacao_respostas;
CREATE TRIGGER cotacao_respostas_set_updated_at
  BEFORE UPDATE ON public.cotacao_respostas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 5. cotacao_anexos (PDFs, imagens, Excel enviados pelo fornecedor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cotacao_anexos (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cotacao_fornecedor_id    TEXT NOT NULL REFERENCES public.cotacao_fornecedores(id) ON DELETE CASCADE,
  file_path                TEXT NOT NULL,         -- caminho no bucket
  file_name                TEXT NOT NULL,         -- nome original
  file_type                TEXT NOT NULL          -- PDF | IMAGEM | EXCEL | OUTRO
                             CHECK (file_type IN ('PDF','IMAGEM','EXCEL','OUTRO')),
  size_bytes               INTEGER,
  parsed_status            TEXT NOT NULL DEFAULT 'PENDENTE'
                             CHECK (parsed_status IN ('PENDENTE','PROCESSANDO','OK','FALHA','PULADO')),
  parsed_data              JSONB,                  -- {itens: [{descricao, qtd, unidade, preco_unitario}, ...]}
  parsed_error             TEXT,
  uploaded_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_anexos_envelope_idx ON public.cotacao_anexos(cotacao_fornecedor_id);

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.cotacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_fornecedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_respostas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_anexos        ENABLE ROW LEVEL SECURITY;

-- cotacoes
DROP POLICY IF EXISTS "Admin gerencia cotacoes" ON public.cotacoes;
CREATE POLICY "Admin gerencia cotacoes" ON public.cotacoes
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "COMPRAS lê cotacoes" ON public.cotacoes;
CREATE POLICY "COMPRAS lê cotacoes" ON public.cotacoes
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- cotacao_itens
DROP POLICY IF EXISTS "Admin gerencia cotacao_itens" ON public.cotacao_itens;
CREATE POLICY "Admin gerencia cotacao_itens" ON public.cotacao_itens
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "COMPRAS lê cotacao_itens" ON public.cotacao_itens;
CREATE POLICY "COMPRAS lê cotacao_itens" ON public.cotacao_itens
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- cotacao_fornecedores
DROP POLICY IF EXISTS "Admin gerencia cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "Admin gerencia cotacao_fornecedores" ON public.cotacao_fornecedores
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "COMPRAS lê cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "COMPRAS lê cotacao_fornecedores" ON public.cotacao_fornecedores
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- cotacao_respostas
DROP POLICY IF EXISTS "Admin gerencia cotacao_respostas" ON public.cotacao_respostas;
CREATE POLICY "Admin gerencia cotacao_respostas" ON public.cotacao_respostas
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "COMPRAS lê cotacao_respostas" ON public.cotacao_respostas;
CREATE POLICY "COMPRAS lê cotacao_respostas" ON public.cotacao_respostas
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- cotacao_anexos
DROP POLICY IF EXISTS "Admin gerencia cotacao_anexos" ON public.cotacao_anexos;
CREATE POLICY "Admin gerencia cotacao_anexos" ON public.cotacao_anexos
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "COMPRAS lê cotacao_anexos" ON public.cotacao_anexos;
CREATE POLICY "COMPRAS lê cotacao_anexos" ON public.cotacao_anexos
  FOR SELECT USING (public.user_has_module('COMPRAS'));

-- ============================================================
-- 7. Storage bucket pros anexos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cotacao-anexos',
  'cotacao-anexos',
  false,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- xlsx
    'application/vnd.ms-excel',                                            -- xls
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: admin lê tudo; upload é feito via service_role nas server actions
DROP POLICY IF EXISTS "Admin lê cotacao-anexos" ON storage.objects;
CREATE POLICY "Admin lê cotacao-anexos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cotacao-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
