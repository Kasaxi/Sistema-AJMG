-- ============================================================
-- MIGRAÇÃO 0016 — Módulo Imóveis (inventário comercial)
--
-- Substitui os boards do Monday. Estrutura:
--   imovel_carteiras  — grupos gerenciáveis (Usados AJMG, Novos AJMG,
--                       Sociedade Fusão Print, Imóveis Tiago, ...)
--   imoveis           — uma linha por imóvel/unidade, com as colunas
--                       que existiam no Monday
--   imovel_anexos     — fotos e documentos (bucket próprio)
--
-- "Processo Finalizado" NÃO é carteira — é o status FINALIZADO, que a
-- UI agrupa numa aba própria cruzando todas as carteiras.
--
-- Permissão: módulo 'IMOVEIS' em profiles.acesso_modulos. Sem grant
-- automático (ADMIN sempre vê).
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. imovel_carteiras — grupos gerenciáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imovel_carteiras (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT UNIQUE NOT NULL,
  -- tipo define a APRESENTAÇÃO (Novos destacam Clientes; Usados destacam Chave,
  -- fotos, local e edição inline de avaliação/vencimento). O dado é o mesmo.
  tipo        TEXT NOT NULL DEFAULT 'USADO' CHECK (tipo IN ('NOVO','USADO')),
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotente: cobre o caso da tabela já existir de uma execução anterior
ALTER TABLE public.imovel_carteiras
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'USADO';

DROP TRIGGER IF EXISTS imovel_carteiras_set_updated_at ON public.imovel_carteiras;
CREATE TRIGGER imovel_carteiras_set_updated_at
  BEFORE UPDATE ON public.imovel_carteiras
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Seed das carteiras observadas no Monday (Processo Finalizado é status, não entra aqui)
INSERT INTO public.imovel_carteiras (nome, tipo, ordem) VALUES
  ('Imóveis Usados AJMG',     'USADO', 1),
  ('Imóveis Novos AJMG',      'NOVO',  2),
  ('Sociedade Fusão Print',   'USADO', 3),
  ('Imóveis Tiago',           'USADO', 4),
  ('Processo Finalizado',     'NOVO',  5)
ON CONFLICT (nome) DO NOTHING;

-- Garante o tipo NOVO mesmo se a carteira já existia de execução anterior (antes da coluna tipo)
UPDATE public.imovel_carteiras SET tipo = 'NOVO' WHERE nome = 'Imóveis Novos AJMG' AND tipo <> 'NOVO';

-- ============================================================
-- 2. imoveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imoveis (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  carteira_id       TEXT REFERENCES public.imovel_carteiras(id) ON DELETE SET NULL,

  -- Identificação (Name no Monday) + agrupador leve por empreendimento
  identificacao     TEXT NOT NULL,
  empreendimento    TEXT,            -- "QD 77 LT 38 PQ ALVORADA I" (agrupa unidades APT 1, APT 2...)
  idr_matricula     TEXT,            -- IDR159944 / 23011

  -- Situação. Status cobre Novos e Usados (união); a UI mostra os relevantes por tipo.
  -- Constraint definida via ALTER nomeado abaixo (idempotente).
  status            TEXT NOT NULL DEFAULT 'DISPONIVEL',
  andamento         TEXT,            -- texto livre: "GARANTIA OK", "MONTAGEM", "CLI X / RESERVA"

  -- Localização
  endereco          TEXT,
  cidade            TEXT,
  regiao            TEXT,            -- Ocidental, Valparaíso, SAD, Águas Lindas, Planaltina, Luziânia

  -- Financiamento / avaliação
  correspondente    TEXT,           -- NOVA, OUTRA — correspondente bancário
  avaliacao         NUMERIC(14,2),  -- R$ 142.000,00 → 142000.00
  vencimento_laudo  TEXT,           -- texto livre: data (dd/mm/aaaa), "VENCIDO", etc

  -- Operacional
  chave_com         TEXT,           -- "NO QUADRO", "C/ VIZINHO", "HERNANDO"...
  clientes          TEXT,           -- texto livre dos Novos ("CLI JHONATAN / FELIPE")
  local             TEXT,           -- link/endereço do mapa (coluna LOCAL dos Usados)
  observacoes       TEXT,

  -- Vínculos opcionais (preenchidos quando aplicável)
  cliente_id        TEXT,           -- comprador (CRM clientes) — FK leve, sem constraint por ora
  vendedor_id       TEXT REFERENCES public.vendedores(id) ON DELETE SET NULL,
  obra_id           TEXT REFERENCES public.obras(id) ON DELETE SET NULL,

  criado_por        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotente: cobre tabela imoveis já existente de execução anterior
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS clientes TEXT;
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS local    TEXT;

-- Status: conjunto real do Monday (Novos + Usados unificados).
-- Migra valores do enum preliminar antes de aplicar a constraint nova.
UPDATE public.imoveis SET status = 'VENDIDO'    WHERE status = 'VENDIDA';
UPDATE public.imoveis SET status = 'NEGOCIACAO' WHERE status = 'RESERVADA';
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_status_check;  -- nome auto do CHECK inline antigo
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_status_chk;
ALTER TABLE public.imoveis ADD CONSTRAINT imoveis_status_chk CHECK (
  status IN ('DISPONIVEL','NEGOCIACAO','AGIO','PARADO','EM_CONSTRUCAO','VENDIDO','ALUGADA','FINALIZADO')
);

CREATE INDEX IF NOT EXISTS imoveis_carteira_idx   ON public.imoveis(carteira_id);
CREATE INDEX IF NOT EXISTS imoveis_status_idx     ON public.imoveis(status);
CREATE INDEX IF NOT EXISTS imoveis_empreend_idx   ON public.imoveis(empreendimento);
CREATE INDEX IF NOT EXISTS imoveis_regiao_idx     ON public.imoveis(regiao);

DROP TRIGGER IF EXISTS imoveis_set_updated_at ON public.imoveis;
CREATE TRIGGER imoveis_set_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. imovel_anexos — fotos e documentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imovel_anexos (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  imovel_id     TEXT NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL DEFAULT 'OUTRO'
                  CHECK (file_type IN ('FOTO','DOCUMENTO','OUTRO')),
  ordem         INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER,
  uploaded_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imovel_anexos_imovel_idx ON public.imovel_anexos(imovel_id, ordem);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.imovel_carteiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imovel_anexos    ENABLE ROW LEVEL SECURITY;

-- carteiras: ADMIN gerencia; quem tem IMOVEIS lê
DROP POLICY IF EXISTS "Admin gerencia imovel_carteiras" ON public.imovel_carteiras;
CREATE POLICY "Admin gerencia imovel_carteiras" ON public.imovel_carteiras
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS lê imovel_carteiras" ON public.imovel_carteiras;
CREATE POLICY "IMOVEIS lê imovel_carteiras" ON public.imovel_carteiras
  FOR SELECT USING (public.user_has_module('IMOVEIS'));

-- imoveis: ADMIN tudo; IMOVEIS faz tudo
DROP POLICY IF EXISTS "Admin gerencia imoveis" ON public.imoveis;
CREATE POLICY "Admin gerencia imoveis" ON public.imoveis
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS gerencia imoveis" ON public.imoveis;
CREATE POLICY "IMOVEIS gerencia imoveis" ON public.imoveis
  FOR ALL USING (public.user_has_module('IMOVEIS'));

-- anexos: ADMIN tudo; IMOVEIS faz tudo
DROP POLICY IF EXISTS "Admin gerencia imovel_anexos" ON public.imovel_anexos;
CREATE POLICY "Admin gerencia imovel_anexos" ON public.imovel_anexos
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS gerencia imovel_anexos" ON public.imovel_anexos;
CREATE POLICY "IMOVEIS gerencia imovel_anexos" ON public.imovel_anexos
  FOR ALL USING (public.user_has_module('IMOVEIS'));

-- ============================================================
-- 5. Storage bucket pros anexos de imóvel
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imovel-anexos',
  'imovel-anexos',
  false,
  104857600,  -- 100 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies completas (SELECT/INSERT/UPDATE/DELETE) — não repetir o erro da 0010
DROP POLICY IF EXISTS "Admin lê imovel-anexos" ON storage.objects;
CREATE POLICY "Admin lê imovel-anexos" ON storage.objects
  FOR SELECT USING (bucket_id = 'imovel-anexos' AND public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS lê imovel-anexos" ON storage.objects;
CREATE POLICY "IMOVEIS lê imovel-anexos" ON storage.objects
  FOR SELECT USING (bucket_id = 'imovel-anexos' AND public.user_has_module('IMOVEIS'));

DROP POLICY IF EXISTS "Admin envia imovel-anexos" ON storage.objects;
CREATE POLICY "Admin envia imovel-anexos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'imovel-anexos' AND public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS envia imovel-anexos" ON storage.objects;
CREATE POLICY "IMOVEIS envia imovel-anexos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'imovel-anexos' AND public.user_has_module('IMOVEIS'));

DROP POLICY IF EXISTS "Admin atualiza imovel-anexos" ON storage.objects;
CREATE POLICY "Admin atualiza imovel-anexos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'imovel-anexos' AND public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS atualiza imovel-anexos" ON storage.objects;
CREATE POLICY "IMOVEIS atualiza imovel-anexos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'imovel-anexos' AND public.user_has_module('IMOVEIS'));

DROP POLICY IF EXISTS "Admin remove imovel-anexos" ON storage.objects;
CREATE POLICY "Admin remove imovel-anexos" ON storage.objects
  FOR DELETE USING (bucket_id = 'imovel-anexos' AND public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "IMOVEIS remove imovel-anexos" ON storage.objects;
CREATE POLICY "IMOVEIS remove imovel-anexos" ON storage.objects
  FOR DELETE USING (bucket_id = 'imovel-anexos' AND public.user_has_module('IMOVEIS'));
