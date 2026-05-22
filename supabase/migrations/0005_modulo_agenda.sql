-- ============================================================
-- MIGRAÇÃO 0005 — Módulo Agenda (Tarefas + Agendamentos)
--
-- 5 tabelas:
--   categorias_agenda   — categorias gerenciáveis
--   agenda_itens        — núcleo: tarefa (sem hora) ou agendamento (com hora)
--   subtarefas          — checklist dentro de um item
--   agenda_historico    — audit log de alterações
--   agenda_anexos       — fotos/vídeos/documentos (Storage)
--
-- Tudo com RLS:
--   ADMIN              → vê e mexe em tudo
--   COLABORADOR+AGENDA → vê/edita só os itens que criou ou que
--                        foi atribuído a ele
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. categorias_agenda
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias_agenda (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT NOT NULL UNIQUE,
  cor         TEXT,                          -- '#1E3A8A'
  icone       TEXT,                          -- nome do ícone (Lucide)
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS categorias_agenda_set_updated_at ON public.categorias_agenda;
CREATE TRIGGER categorias_agenda_set_updated_at
  BEFORE UPDATE ON public.categorias_agenda
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 2. agenda_itens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_itens (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tipo                TEXT NOT NULL DEFAULT 'TAREFA'
                        CHECK (tipo IN ('TAREFA','AGENDAMENTO')),
  titulo              TEXT NOT NULL,
  descricao           TEXT,
  data                DATE NOT NULL,
  hora_inicio         TIME,                 -- null = "dia inteiro"
  hora_fim            TIME,
  prioridade          TEXT NOT NULL DEFAULT 'MEDIA'
                        CHECK (prioridade IN ('BAIXA','MEDIA','ALTA')),
  status              TEXT NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  categoria_id        TEXT REFERENCES public.categorias_agenda(id) ON DELETE SET NULL,
  local               TEXT,
  observacoes         TEXT,
  criado_por          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  atribuido_para      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- FKs prontos pra futuro (UI desligada no MVP)
  cliente_id          TEXT REFERENCES public.clientes(id) ON DELETE SET NULL,
  obra_id             TEXT REFERENCES public.obras(id) ON DELETE SET NULL,
  -- recorrência simples por preset
  recorrencia         TEXT NOT NULL DEFAULT 'NENHUMA'
                        CHECK (recorrencia IN ('NENHUMA','DIARIA','SEMANAL','QUINZENAL','MENSAL','ANUAL')),
  recorrencia_ate     DATE,
  recorrencia_pai_id  TEXT REFERENCES public.agenda_itens(id) ON DELETE SET NULL,
  ordem               INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validações coerentes:
  CONSTRAINT agenda_itens_hora_check CHECK (
    hora_fim IS NULL OR hora_inicio IS NULL OR hora_fim >= hora_inicio
  )
);

CREATE INDEX IF NOT EXISTS agenda_itens_criado_por_idx     ON public.agenda_itens(criado_por);
CREATE INDEX IF NOT EXISTS agenda_itens_atribuido_para_idx ON public.agenda_itens(atribuido_para);
CREATE INDEX IF NOT EXISTS agenda_itens_data_idx           ON public.agenda_itens(data);
CREATE INDEX IF NOT EXISTS agenda_itens_status_idx         ON public.agenda_itens(status);
CREATE INDEX IF NOT EXISTS agenda_itens_categoria_idx      ON public.agenda_itens(categoria_id);
CREATE INDEX IF NOT EXISTS agenda_itens_recorrencia_pai_idx ON public.agenda_itens(recorrencia_pai_id);

DROP TRIGGER IF EXISTS agenda_itens_set_updated_at ON public.agenda_itens;
CREATE TRIGGER agenda_itens_set_updated_at
  BEFORE UPDATE ON public.agenda_itens
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. subtarefas (checklist)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subtarefas (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id     TEXT NOT NULL REFERENCES public.agenda_itens(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  concluida   BOOLEAN NOT NULL DEFAULT false,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subtarefas_item_ordem_idx ON public.subtarefas(item_id, ordem);

DROP TRIGGER IF EXISTS subtarefas_set_updated_at ON public.subtarefas;
CREATE TRIGGER subtarefas_set_updated_at
  BEFORE UPDATE ON public.subtarefas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 4. agenda_historico (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_historico (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id         TEXT NOT NULL REFERENCES public.agenda_itens(id) ON DELETE CASCADE,
  campo_alterado  TEXT NOT NULL,
  valor_anterior  TEXT,
  valor_novo      TEXT,
  mudado_por      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mudado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_historico_item_idx   ON public.agenda_historico(item_id, mudado_em DESC);

-- Trigger: registra mudanças em campos relevantes
CREATE OR REPLACE FUNCTION public.agenda_itens_log_change()
RETURNS trigger AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF NEW.titulo IS DISTINCT FROM OLD.titulo THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'titulo', OLD.titulo, NEW.titulo, v_user);
  END IF;
  IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'descricao', OLD.descricao, NEW.descricao, v_user);
  END IF;
  IF NEW.data IS DISTINCT FROM OLD.data THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'data', OLD.data::text, NEW.data::text, v_user);
  END IF;
  IF NEW.hora_inicio IS DISTINCT FROM OLD.hora_inicio THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'hora_inicio', OLD.hora_inicio::text, NEW.hora_inicio::text, v_user);
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'prioridade', OLD.prioridade, NEW.prioridade, v_user);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, v_user);
  END IF;
  IF NEW.categoria_id IS DISTINCT FROM OLD.categoria_id THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'categoria_id', OLD.categoria_id, NEW.categoria_id, v_user);
  END IF;
  IF NEW.atribuido_para IS DISTINCT FROM OLD.atribuido_para THEN
    INSERT INTO public.agenda_historico (item_id, campo_alterado, valor_anterior, valor_novo, mudado_por)
    VALUES (NEW.id, 'atribuido_para', OLD.atribuido_para::text, NEW.atribuido_para::text, v_user);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agenda_itens_log ON public.agenda_itens;
CREATE TRIGGER agenda_itens_log
  AFTER UPDATE ON public.agenda_itens
  FOR EACH ROW EXECUTE PROCEDURE public.agenda_itens_log_change();

-- ============================================================
-- 5. agenda_anexos (Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_anexos (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id         TEXT NOT NULL REFERENCES public.agenda_itens(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('FOTO','VIDEO','DOCUMENTO')),
  nome            TEXT NOT NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  mime_type       TEXT,
  tamanho_bytes   BIGINT,
  enviado_por     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_anexos_item_idx ON public.agenda_anexos(item_id);

-- Constraint: máximo 20 anexos por item
CREATE OR REPLACE FUNCTION public.agenda_anexos_limit_check()
RETURNS trigger AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.agenda_anexos WHERE item_id = NEW.item_id;
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 anexos por item atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agenda_anexos_limit ON public.agenda_anexos;
CREATE TRIGGER agenda_anexos_limit
  BEFORE INSERT ON public.agenda_anexos
  FOR EACH ROW EXECUTE PROCEDURE public.agenda_anexos_limit_check();

-- ============================================================
-- 6. RLS — Row Level Security
-- ============================================================
ALTER TABLE public.categorias_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtarefas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_historico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_anexos     ENABLE ROW LEVEL SECURITY;

-- ── categorias_agenda ──────────────────────────────────────
-- Qualquer um com acesso ao módulo Agenda LÊ; só Admin gerencia.
DROP POLICY IF EXISTS "Quem tem AGENDA lê categorias" ON public.categorias_agenda;
CREATE POLICY "Quem tem AGENDA lê categorias" ON public.categorias_agenda
  FOR SELECT USING (public.user_has_module('AGENDA'));

DROP POLICY IF EXISTS "Admin gerencia categorias" ON public.categorias_agenda;
CREATE POLICY "Admin gerencia categorias" ON public.categorias_agenda
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── agenda_itens ───────────────────────────────────────────
-- ADMIN faz tudo.
DROP POLICY IF EXISTS "Admin gerencia itens" ON public.agenda_itens;
CREATE POLICY "Admin gerencia itens" ON public.agenda_itens
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- COLABORADOR com AGENDA vê itens que criou OU que foi atribuído.
DROP POLICY IF EXISTS "Colaborador AGENDA lê seus itens" ON public.agenda_itens;
CREATE POLICY "Colaborador AGENDA lê seus itens" ON public.agenda_itens
  FOR SELECT USING (
    public.user_has_module('AGENDA') AND
    (criado_por = auth.uid() OR atribuido_para = auth.uid())
  );

-- Insere: precisa ter AGENDA e o criado_por tem que ser ele.
DROP POLICY IF EXISTS "Colaborador AGENDA cria itens" ON public.agenda_itens;
CREATE POLICY "Colaborador AGENDA cria itens" ON public.agenda_itens
  FOR INSERT WITH CHECK (
    public.user_has_module('AGENDA') AND criado_por = auth.uid()
  );

-- Atualiza: só os seus.
DROP POLICY IF EXISTS "Colaborador AGENDA edita seus itens" ON public.agenda_itens;
CREATE POLICY "Colaborador AGENDA edita seus itens" ON public.agenda_itens
  FOR UPDATE USING (
    public.user_has_module('AGENDA') AND
    (criado_por = auth.uid() OR atribuido_para = auth.uid())
  );

-- Deleta: só o criador.
DROP POLICY IF EXISTS "Colaborador AGENDA deleta itens que criou" ON public.agenda_itens;
CREATE POLICY "Colaborador AGENDA deleta itens que criou" ON public.agenda_itens
  FOR DELETE USING (
    public.user_has_module('AGENDA') AND criado_por = auth.uid()
  );

-- ── subtarefas ─────────────────────────────────────────────
-- Espelha o item pai.
DROP POLICY IF EXISTS "Subtarefas herdam acesso do item" ON public.subtarefas;
CREATE POLICY "Subtarefas herdam acesso do item" ON public.subtarefas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = subtarefas.item_id
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

-- ── agenda_historico ───────────────────────────────────────
-- Quem vê o item, vê o histórico. Sistema escreve via trigger (SECURITY DEFINER não necessário aqui).
DROP POLICY IF EXISTS "Histórico herda acesso do item" ON public.agenda_historico;
CREATE POLICY "Histórico herda acesso do item" ON public.agenda_historico
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = agenda_historico.item_id
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

-- Inserção é feita pelo trigger; permitimos via policy permissiva pra trigger funcionar
-- (trigger roda no contexto do usuário que fez UPDATE no item).
DROP POLICY IF EXISTS "Histórico aceita inserções do trigger" ON public.agenda_historico;
CREATE POLICY "Histórico aceita inserções do trigger" ON public.agenda_historico
  FOR INSERT WITH CHECK (true);

-- ── agenda_anexos ──────────────────────────────────────────
-- Espelha o item pai.
DROP POLICY IF EXISTS "Anexos herdam acesso do item" ON public.agenda_anexos;
CREATE POLICY "Anexos herdam acesso do item" ON public.agenda_anexos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = agenda_anexos.item_id
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

DROP POLICY IF EXISTS "Quem edita o item adiciona anexos" ON public.agenda_anexos;
CREATE POLICY "Quem edita o item adiciona anexos" ON public.agenda_anexos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = agenda_anexos.item_id
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

DROP POLICY IF EXISTS "Autor ou admin deleta anexo" ON public.agenda_anexos;
CREATE POLICY "Autor ou admin deleta anexo" ON public.agenda_anexos
  FOR DELETE USING (
    public.current_user_role() = 'ADMIN' OR enviado_por = auth.uid()
  );

-- ============================================================
-- 7. Storage bucket `agenda-anexos`
-- ============================================================
-- Cria o bucket privado se não existir.
INSERT INTO storage.buckets (id, name, public)
VALUES ('agenda-anexos', 'agenda-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage espelham as do agenda_anexos.
-- O caminho do objeto segue o padrão: {item_id}/{filename}
-- Assim podemos cruzar com agenda_itens via prefixo.

DROP POLICY IF EXISTS "Storage: ler anexos do item permitido" ON storage.objects;
CREATE POLICY "Storage: ler anexos do item permitido" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'agenda-anexos' AND
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = split_part(name, '/', 1)
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

DROP POLICY IF EXISTS "Storage: upload em item permitido" ON storage.objects;
CREATE POLICY "Storage: upload em item permitido" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'agenda-anexos' AND
    EXISTS (
      SELECT 1 FROM public.agenda_itens i
       WHERE i.id = split_part(name, '/', 1)
         AND (
           public.current_user_role() = 'ADMIN'
           OR (public.user_has_module('AGENDA') AND (i.criado_por = auth.uid() OR i.atribuido_para = auth.uid()))
         )
    )
  );

DROP POLICY IF EXISTS "Storage: delete pelo autor ou admin" ON storage.objects;
CREATE POLICY "Storage: delete pelo autor ou admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'agenda-anexos' AND (
      public.current_user_role() = 'ADMIN' OR owner = auth.uid()
    )
  );
