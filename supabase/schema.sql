-- ============================================================
-- SISTEMA DE GESTÃO EMPRESARIAL — Schema Supabase
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- ─── PERFIS DE USUÁRIO ──────────────────────────────────────
-- Extende auth.users com dados da empresa

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'VENDEDOR' CHECK (role IN ('ADMIN', 'VENDEDOR')),
  vendedor_id UUID,  -- será preenchido ao vincular ao vendedor
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: cria perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.vendedores
  WHERE lower(email) = lower(new.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, nome, role, vendedor_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'VENDEDOR',
    v_id
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── VENDEDORES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendedores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT,  -- usado para vincular ao usuário (login) por e-mail
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_unique
  ON public.vendedores (lower(email))
  WHERE email IS NOT NULL;

-- ─── CLIENTES / LEADS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                    TEXT NOT NULL,
  telefone_whatsapp       TEXT NOT NULL,
  cpf                     TEXT,
  cidade                  TEXT,
  vendedor_id             UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  tipo_imovel             TEXT NOT NULL DEFAULT 'NOVO' CHECK (tipo_imovel IN ('NOVO', 'USADO', 'AMBOS')),
  tipo_cliente            TEXT NOT NULL DEFAULT 'NOVO' CHECK (tipo_cliente IN ('NOVO', 'ANTIGO')),
  tipo_renda              TEXT CHECK (tipo_renda IN ('FORMAL', 'INFORMAL', 'AMBOS')),
  status                  TEXT NOT NULL DEFAULT 'NOVO_LEAD',
  status_novo             TEXT DEFAULT 'NAO_AVALIADO',
  status_usado            TEXT,
  origem                  TEXT DEFAULT 'MANUAL',
  motivo_reprovacao       TEXT,
  motivo_reprovacao_usado TEXT,
  observacoes             TEXT,
  data_avaliacao          TIMESTAMPTZ DEFAULT now(),
  valor_venda             DECIMAL(12,2),
  tipo_venda              TEXT CHECK (tipo_venda IN ('NOVO', 'USADO', 'AMBOS')),
  data_venda              TIMESTAMPTZ,
  valor_simulacao_novo    DECIMAL(12,2),
  valor_simulacao_usado   DECIMAL(12,2),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_vendedor_idx ON public.clientes(vendedor_id);
CREATE INDEX IF NOT EXISTS clientes_status_novo_idx ON public.clientes(status_novo);
CREATE INDEX IF NOT EXISTS clientes_tipo_imovel_idx ON public.clientes(tipo_imovel);
CREATE INDEX IF NOT EXISTS clientes_data_avaliacao_idx ON public.clientes(data_avaliacao DESC);
CREATE INDEX IF NOT EXISTS clientes_nome_idx ON public.clientes USING gin(to_tsvector('portuguese', nome));

-- ─── ETAPAS DO FUNIL CRM ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.etapas_funil (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  chave     TEXT UNIQUE NOT NULL,
  cor       TEXT DEFAULT '#3b82f6',
  ordem     INTEGER NOT NULL,
  protegida BOOLEAN DEFAULT false,
  ativo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── DISTRIBUIÇÃO DE LEADS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_distribuicao (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  quantidade  INTEGER NOT NULL DEFAULT 0,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendedor_id, data)
);

CREATE INDEX IF NOT EXISTS lead_dist_vendedor_idx ON public.lead_distribuicao(vendedor_id);
CREATE INDEX IF NOT EXISTS lead_dist_data_idx ON public.lead_distribuicao(data DESC);

-- ─── CONTATOS WHATSAPP ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas_funil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distribuicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Helper: retorna role do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: retorna vendedor_id do usuário atual
CREATE OR REPLACE FUNCTION public.current_vendedor_id()
RETURNS UUID AS $$
  SELECT vendedor_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Profiles ──
CREATE POLICY "Usuário vê seu próprio perfil" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Usuário atualiza seu próprio perfil" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admin vê todos os perfis" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── Vendedores ──
CREATE POLICY "Autenticados veem vendedores" ON public.vendedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin gerencia vendedores" ON public.vendedores
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── Clientes ──
CREATE POLICY "Admin vê todos os clientes" ON public.clientes
  FOR ALL USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "Vendedor vê seus clientes" ON public.clientes
  FOR SELECT USING (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
  );

CREATE POLICY "Vendedor edita seus clientes" ON public.clientes
  FOR UPDATE USING (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
  );

CREATE POLICY "Vendedor insere clientes" ON public.clientes
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
    OR public.current_user_role() = 'ADMIN'
  );

-- ── Etapas Funil ──
CREATE POLICY "Autenticados veem etapas" ON public.etapas_funil
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin gerencia etapas" ON public.etapas_funil
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── Lead Distribuição ──
CREATE POLICY "Autenticados veem distribuições" ON public.lead_distribuicao
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin gerencia distribuições" ON public.lead_distribuicao
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── WhatsApp Contacts ──
CREATE POLICY "Autenticados veem contatos" ON public.whatsapp_contacts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin gerencia contatos" ON public.whatsapp_contacts
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ============================================================
-- DADOS INICIAIS — Etapas do Funil CRM
-- ============================================================

INSERT INTO public.etapas_funil (nome, chave, cor, ordem, protegida) VALUES
  ('Novo Lead',             'NOVO_LEAD',                   '#64748b', 1,  true),
  ('Não Avaliado',          'NAO_AVALIADO',                '#94a3b8', 2,  true),
  ('Condicionado',          'CONDICIONADO',                '#f59e0b', 3,  false),
  ('QV / Lib. Reavaliar',   'QV_LIBERACAO_REAVALIAR',      '#8b5cf6', 4,  false),
  ('Carta Cancelamento',    'PRECISA_CARTA_CANCELAMENTO',  '#ef4444', 5,  false),
  ('Aprovado',              'APROVADO',                    '#10b981', 6,  true),
  ('Reprovado',             'REPROVADO',                   '#dc2626', 7,  true),
  ('Venda Fechada',         'VENDA_FECHADA',               '#059669', 8,  true)
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- COMO CRIAR O PRIMEIRO ADMIN
-- Execute após rodar este script:
--
-- 1. Crie o usuário pelo painel do Supabase em Authentication > Users
-- 2. Depois rode:
--    UPDATE public.profiles SET role = 'ADMIN', nome = 'Seu Nome'
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@suaempresa.com');
-- ============================================================
