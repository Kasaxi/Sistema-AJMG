-- ============================================================
-- RESET do import do dia-foco-app (apaga tudo pra re-importar limpo)
--
-- Use quando o import gerou dados com encoding corrompido (��) e
-- você precisa rodar de novo o script com a correção.
--
-- Limpa: agenda_historico, agenda_itens, categorias_agenda.
-- NÃO mexe em: profiles, obras, clientes.
--
-- Como rodar: SQL Editor do Supabase → cola e Run.
-- ============================================================

-- 1. Histórico (cascade do item já cuidaria, mas explicitamos)
DELETE FROM public.agenda_historico;

-- 2. Itens da agenda (cascade leva subtarefas e anexos junto)
DELETE FROM public.agenda_itens;

-- 3. Categorias (todas — o import recria)
DELETE FROM public.categorias_agenda;

-- Conferência
SELECT
  (SELECT COUNT(*) FROM public.agenda_itens)      AS itens,
  (SELECT COUNT(*) FROM public.agenda_historico)  AS historico,
  (SELECT COUNT(*) FROM public.categorias_agenda) AS categorias;
-- esperado: 0, 0, 0
