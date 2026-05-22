# Roadmap do Sistema-Empresa

> Documento vivo. Última atualização: 2026-05-21.
> Decide **o quê** e **em que ordem**. Detalhes finos de UI/queries ficam nos PRs/issues.

ERP unificado da construtora. 7 módulos sobre uma fundação comum. Stack: Next.js 16 + Supabase. Constrói-se **um módulo por vez**, da fundação pra fora.

Legenda de status:

| Badge | Significado |
|-------|-------------|
| 🟢 **Em andamento** | sendo construído agora |
| 🔵 **Próximo** | logo após o atual |
| 🟡 **Planejado** | escopo definido, aguardando vez |
| ⚪ **Esboçado** | conceito decidido, sem detalhe |

---

## 1. Mapa dos módulos

```
                  ┌─────────────────────────────┐
                  │   OBRAS  (fundação)         │  entidade central
                  │   empreendimentos / lotes   │
                  └─────────────┬───────────────┘
                                │ referenciada por ↓
   ┌────────────────────────────┼────────────────────────────┐
   │                            │                            │
┌──┴────────┐    ┌──────────────┴────────────┐    ┌──────────┴─────────┐
│  VENDAS   │    │  COMPRAS                  │    │  RH / PONTO        │
│  (CRM)    │    │  fornecedores · gastos    │    │  funcionários      │
│           │    │  · custo por obra         │    │  jornada · horas   │
└─────┬─────┘    └──────────────┬────────────┘    └──────────┬─────────┘
      │ receita                 │ despesa                    │ folha
      ▼                         ▼                            ▼
              ┌─────────────────────────────────┐
              │  FINANCEIRO  (consolidador)     │
              │  contas a pagar/receber, caixa, │
              │  DRE por obra                   │
              └────────────────┬────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  COBRANÇA                       │
              │  régua de inadimplência, acordos│
              └─────────────────────────────────┘

       AGENDA  (transversal · independente · tarefas + agendamentos)
```

---

## 2. Ordem de construção

Quatro fases. Cada fase libera valor antes da próxima começar.

### 🟢 Fase 1 · O que está acontecendo agora

| Módulo | Estado |
|--------|--------|
| **Vendas (CRM imobiliário)** | em andamento — clientes/CRM/financeiro/dashboard prontos; falta tela de vendedores e polimento de UI |

### 🔵 Fase 2 · A seguir (fundação + primeiras telas novas)

| Módulo | Por quê agora |
|--------|--------------|
| **Obras (cadastro enxuto)** | é a entidade central referenciada por Compras, RH e Financeiro. Sem ela, cada módulo recriaria "obra" do seu jeito |
| **Compras** | substitui os Sheets que você usa hoje, alimenta o custo por obra |
| **Agenda** | módulo leve e independente, traz valor imediato pro responsável de manutenção — pode rodar em paralelo com Compras |

### 🟡 Fase 3 · Gestão de equipe

| Módulo | Quando |
|--------|--------|
| **RH / Ponto** | depois que Obras existir (precisa de obra pra alocação) |

### ⚪ Fase 4 · Visão financeira consolidada

| Módulo | Quando |
|--------|--------|
| **Financeiro** | depois que houver receita (Vendas) + despesa (Compras) + folha (RH) — antes disso a tela fica vazia |
| **Cobrança** | sub-fluxo do Financeiro, vem por último |

---

## 3. Decisões transversais

Princípios que valem pra todos os módulos. Não repetir em cada um.

### 3.1 Stack
- **Next.js 16** (App Router, Server Components, Server Actions). Antes de escrever código novo, ler `node_modules/next/dist/docs/`.
- **Supabase** como única fonte de verdade. Migrations versionadas em `supabase/migrations/`.
- **shadcn/ui** customizado pra ficar **fora do look genérico** ("AI-made") — direção visual = Abacate Pay recolorido em preto/branco/azul-escuro. **Nunca verde.**

### 3.2 Identidade & autorização
**3 roles** em `profiles.role`:

| Role | Acesso |
|------|--------|
| `ADMIN` | Tudo. Ignora `acesso_modulos`. |
| `VENDEDOR` | Só módulo Vendas, e só seus clientes (regra do CRM). Ignora `acesso_modulos`. |
| `COLABORADOR` | Apenas os módulos listados em `acesso_modulos` (text[]). Ex.: Omar tem `['AGENDA']`. |

Campo extra em `profiles`:
- `acesso_modulos text[]` — valores válidos: `'AGENDA','OBRAS','COMPRAS','RH','FINANCEIRO','COBRANCA'`. NULL ou vazio quando role é ADMIN ou VENDEDOR.

**Como o bloqueio funciona:**
- Sidebar renderiza só os módulos que o usuário tem permissão pra ver
- Middleware Next.js redireciona em URLs proibidas
- RLS Supabase: cada tabela checa role + acesso_modulos antes de retornar linhas

**Provisionamento:** Admin cria usuário em 1 passo via Supabase admin API (`auth.users` + `profiles` + perfil de role específico no mesmo handler).

**RLS é mandatório.** Nenhuma tabela nova entra em produção com RLS aberto.

### 3.3 IDs e migração
- IDs em `TEXT` (cuid) — herança da migração Neon → Supabase. Tabelas novas seguem o padrão.

### 3.4 Vinculação a `obras`
Quando o módulo Obras existir, módulos que hoje guardam "obra" como texto livre passam a referenciar `obras.id`. Pra não pagar migration depois, **tabelas novas já criam o FK `obra_id` como nullable**, mesmo que a UI não exponha ainda.

### 3.5 Design system
- Componentes shadcn como base, mas estilizados (não usar o tema default).
- Sidebar único centraliza navegação dos módulos.
- Tabelas: filtros no topo, paginação no rodapé, ações em linha.
- Formulários: server actions, validação com Zod, erros inline.

---

## 4. Módulo Vendas (CRM imobiliário)

**Status:** 🟢 em andamento · **Páginas prontas:** clientes, CRM (kanban), financeiro de vendas, dashboard · **Stubbed:** vendedores

Só consolido aqui o que **ainda falta** (resto vive no código + memórias):

- [ ] Finalizar tela de vendedores (lista + criar com login + métricas)
- [ ] Revisão dos status (CRM funil ≠ status de avaliação por tipo de imóvel — não misturar)
- [ ] Integração futura com Obras: quando obras existirem, `cliente.imovel_interesse` pode apontar pra `obras.id` ao invés de texto livre
- [ ] Polimento de UI seguindo direção Abacate Pay

---

## 5. Módulo Obras (fundação)

**Status:** 🔵 próximo · **Bloqueia:** Compras, RH/Ponto, Financeiro

### Por que existe
Hoje "obra" só vive na cabeça do usuário. Sem cadastro central, cada módulo recriaria o conceito de jeito diferente — Compras com texto livre, Ponto com outro campo, Financeiro com um terceiro. Vira inferno de agregação.

### Escopo MVP (enxuto, propositalmente)
- Tabela `obras`: id, nome, endereço, cidade, status (`PLANEJAMENTO` / `EM_ANDAMENTO` / `PAUSADA` / `CONCLUIDA`), data_inicio, data_previsao_entrega, orcamento_previsto, observacoes, timestamps.
- (Opcional v1.1) Tabela `unidades` (apto/lote) — só se Vendas começar a vincular cliente a unidade específica. Senão fica pra depois.
- Telas: lista `/obras`, detalhe `/obras/[id]` com abas (Dados, Compras, Ponto, Financeiro) que ficam vazias até cada módulo plugar.

### Fora de escopo no MVP
- Cronograma físico-financeiro (etapas de obra) → v2
- Galeria de fotos → v2
- Documentos/contratos → v2

---

## 6. Módulo Compras (gastos de obra)

**Status:** 🟡 planejado em detalhe (baseado em 3 Sheets reais analisados em 2026-05-21) · **Depende de:** Obras

### 6.1 Achados da análise dos Sheets atuais

3 arquivos analisados: QD 55 (233 lançamentos, R$ 373.652), QD 70 (6, R$ 6.491), QD 151 (60, R$ 65.704).

**Estrutura uniforme:** Descrição · Categoria · Quantidade · Data · Valor Unit · Valor Total. **Sem fornecedor** em lugar nenhum — lacuna do controle atual.

**Problemas a resolver no sistema novo:**

| Problema | Exemplo | Solução |
|---------|---------|---------|
| Categorias inconsistentes entre obras | "Estrutura" (QD 55) vs "Alvenaria"+"Ferragem" (QD 151) | tabela `categorias_custo` central, seed padronizado, Admin edita |
| Unidade colada na quantidade | `6M³`, `4 pç`, `2D`, `21,00 m` | separar `quantidade` (numeric) + `unidade` (FK pra `unidades_medida`) |
| Descrições caóticas | "cimento" em 5 grafias diferentes | autocomplete a partir do histórico; catálogo opcional pra itens frequentes |
| Total digitado errado | "Aluguel cs Vizinha" qtd 1 × R$ 200 = total R$ 2.000 | sistema **calcula** `total = quantidade × valor_unit`; campo derivado |
| Typo de data | `06/08/0205` | validação na entrada |
| Não tem fornecedor | toda planilha | adicionar campo opcional desde o MVP pra começar a coletar |
| Mistura de naturezas | "Compra do Lote" R$ 60k, "Energia" mensal, "Adiantamento Emp." parcelado | aceitar a mistura — categoria distingue; **não criar tipo separado** no MVP |

### 6.2 Escopo MVP — revisado após análise

**Dentro do MVP:**
1. **Cadastro de obras** (já entra via módulo Obras)
2. **Lançamento de gastos** — espelha o Sheets (descrição, qtd, unidade, valor unit, data, categoria), com total auto-calculado e fornecedor opcional
3. **Cadastro de fornecedores** — começar simples (nome, telefone, observação); pode estar vazio no início
4. **Categorias padronizadas** — seed baseado nas categorias reais; Admin gerencia
5. **Unidades de medida** — seed; texto controlado
6. **Importação CSV** — crítica. Mapeia formato do Sheets atual com preview + validação. Sem isso você não migra os 300+ lançamentos
7. **Dashboard por obra** — gasto total, por categoria, por mês, top fornecedores, top itens

**Saiu do MVP (vai pra v2):**
- ❌ **Cotações** — não existe no fluxo atual. Adicionar agora é resistência sem ganho real
- ❌ **Workflow de aprovação** — você é o único Admin hoje, não há a quem aprovar
- ❌ **Catálogo de itens rígido** — começar com texto-livre + autocomplete; promover a item-catálogo só quando provar uso
- ❌ **Anexos (NF, foto)** — útil mas não bloqueia adoção

### 6.3 Schema final

```sql
fornecedores
  id              text pk (cuid)
  nome            text not null
  telefone        text
  email           text
  cnpj_cpf        text
  observacoes     text
  ativo           boolean default true
  created_at, updated_at

unidades_medida
  id              text pk
  sigla           text unique  -- 'un','kg','m','m²','m³','l','sc','pç','dia','mês','h'
  nome            text         -- 'unidade','quilograma','metro',...
  ordem           integer

categorias_custo
  id              text pk
  nome            text unique  -- 'Estrutura','Alvenaria','Hidráulica',...
  cor             text         -- hex pra UI
  icone           text
  ativo           boolean
  ordem           integer

itens_catalogo      -- OPCIONAL no MVP, popular com autocomplete depois
  id              text pk
  descricao       text
  unidade_padrao_id text fk → unidades_medida
  categoria_padrao_id text fk → categorias_custo
  ativo           boolean

gastos              -- 1 linha = 1 lançamento (espelha o Sheets)
  id              text pk (cuid)
  obra_id         text fk → obras (NOT NULL)
  descricao       text not null
  item_catalogo_id text fk → itens_catalogo (nullable, preenchido se usuário escolheu do catálogo)
  categoria_id    text fk → categorias_custo (NOT NULL)
  fornecedor_id   text fk → fornecedores (nullable)
  quantidade      numeric(12,3) not null
  unidade_id      text fk → unidades_medida (NOT NULL)
  valor_unitario  numeric(12,2) not null
  valor_total     numeric(12,2) generated always as (quantidade * valor_unitario) stored
  data            date not null
  observacoes     text
  criado_por      text fk → profiles
  created_at, updated_at
```

**Decisões refletidas no schema:**
- `valor_total` é **coluna calculada** (`GENERATED ALWAYS AS`) — fim do bug de digitação
- `obra_id`, `categoria_id`, `unidade_id` são NOT NULL — sem "gasto solto"
- `fornecedor_id` nullable — você começa sem fornecedores cadastrados; vai populando
- `item_catalogo_id` nullable — descrição texto-livre é o suficiente; catálogo é cherry-on-top

### 6.4 Seeds padronizados (baseados nos seus dados)

**Categorias** (consolidando o que apareceu nas 3 obras):
- Estrutura · Alvenaria · Ferragem · Impermeabilizante
- Hidráulica · Elétrica
- Acabamento · Mármore
- Mão-de-obra · Locação/Equipamentos
- Documentação · Transporte
- Energia/Água · Aluguel · Ajuda de custo · Outros

**Unidades de medida:** un, kg, m, m², m³, l, sc, pç, dia, mês, h, paletes

### 6.5 Telas

| Rota | Função |
|------|--------|
| `/obras` | Lista de obras |
| `/obras/[id]` | Detalhe da obra com aba "Gastos" |
| `/obras/[id]/gastos` | Listagem dos gastos da obra (tabela com filtros: categoria, fornecedor, período) |
| `/obras/[id]/gastos/novo` | Form de lançamento (modal ou página) |
| `/obras/[id]/dashboard` | Total · por categoria · por mês · top fornecedores · top itens |
| `/obras/[id]/importar` | **Importação CSV** — upload, mapeamento de colunas, preview, correção de erros, confirmação |
| `/fornecedores` | CRUD de fornecedores |
| `/configuracoes/categorias` | Admin gerencia categorias |
| `/configuracoes/unidades` | Admin gerencia unidades de medida |

### 6.6 Importação CSV (detalhamento)

Crítica. Você tem 3 sheets pra trazer + os próximos. Fluxo:

1. Upload do CSV
2. **Auto-detecção** de colunas (mapeamento padrão pra `Descrição/Categoria/Quantidade/Data/Valor Unitário/Valor`)
3. **Parsing inteligente:**
   - Extrai unidade do final da quantidade (`6M³` → qtd 6, unid m³; `4 pç` → qtd 4, unid pç)
   - Normaliza moeda BR (`R$ 1.500,00` → `1500.00`)
   - Detecta data inválida (`06/08/0205`) e marca pra correção
   - Calcula total auto e marca divergências em vermelho
4. **Mapeamento de categorias** — mostra categorias do CSV e deixa você mapear pra categorias do sistema (lembra a escolha pra próximos imports)
5. **Preview com erros destacados** — você corrige inline
6. **Importação em batch** com relatório (200 importados, 3 com aviso, 0 com erro)

### 6.7 RLS
- ADMIN: tudo
- VENDEDOR: sem acesso por padrão (este módulo é admin/gestor, não vendas). Se houver um "responsável de obra" no futuro, ele teria acesso só às obras dele

### 6.8 Decisões abertas
- [ ] Mantém só Admin tendo acesso a Compras, ou cria role `GESTOR_OBRAS`?
- [ ] Importação CSV: faz mapeamento manual de categorias OU tenta auto-match por similaridade? *Recomendo: começar com mapeamento manual + lembrar escolha; ML/similaridade fica pra depois.*
- [ ] Promover descrição livre a `itens_catalogo`: automático quando mesma descrição aparece N vezes, ou só manual? *Recomendo: manual no MVP, automatizar depois.*

---

## 7. Módulo Agenda (tarefas + agendamentos)

**Status:** 🟡 planejado em detalhe · **Inspiração:** github.com/Kasaxi/dia-foco-app (público) · **Independente** dos outros módulos

Módulo híbrido tarefas + agendamentos. Núcleo herda o dia-foco-app; adapta pra multi-usuário, fecha RLS, e adiciona horário/recorrência/local pro responsável de manutenção.

### Schema

```sql
-- Uma tabela só, com horário opcional. Item sem hora = tarefa; com hora = agendamento.
agenda_itens
  id                  text pk (cuid)
  tipo                text check (tipo in ('TAREFA','AGENDAMENTO'))
  titulo              text not null
  descricao           text
  data                date not null
  hora_inicio         time            -- null = "dia inteiro"
  hora_fim            time            -- opcional
  prioridade          text check (prioridade in ('BAIXA','MEDIA','ALTA'))
  status              text check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','CANCELADO'))
  categoria_id        text fk → categorias_agenda
  local               text            -- "Obra X", "Escritório", endereço
  criado_por          text fk → profiles
  atribuido_para      text fk → profiles
  -- vinculação a domínio (campos prontos, UI desligada no MVP)
  cliente_id          text fk → clientes nullable
  obra_id             text fk → obras    nullable
  -- recorrência (iCal RRULE)
  recorrencia_regra   text            -- ex: "FREQ=WEEKLY;BYDAY=MO,WE"
  recorrencia_pai_id  text fk → agenda_itens
  created_at, updated_at

subtarefas
  id, item_id fk→agenda_itens, titulo, concluida, ordem, timestamps

categorias_agenda
  id, nome, cor, icone, ativo, ordem

agenda_historico   (auditoria: campo_alterado, valor_anterior, valor_novo, mudado_por, mudado_em)

agenda_anexos      (fotos/vídeos/documentos)
  id              text pk (cuid)
  item_id         text fk → agenda_itens not null on delete cascade
  tipo            text check (tipo in ('FOTO','VIDEO','DOCUMENTO'))
  nome            text not null              -- nome original do arquivo
  storage_path    text not null              -- caminho no Supabase Storage
  mime_type       text
  tamanho_bytes   bigint
  enviado_por     text fk → profiles
  created_at      timestamptz default now()
```

**Supabase Storage:** bucket privado `agenda-anexos`. RLS espelha a do `agenda_itens` pai (quem vê o item, vê os anexos).

**Limites:**
- 50 MB por vídeo (validação client + server)
- 20 arquivos por item (constraint via trigger)
- Compressão automática de foto no client (4K → ~1080p)
- Câmera direta no mobile via `<input capture>`

### Telas

| Rota | Função |
|------|--------|
| `/agenda` | Landing com 4 views: **Hoje · Semana · Mês · Kanban** |
| `/agenda/tarefas` | Lista pura tipo Todoist, abas **Hoje / Atrasadas / Próximos** |
| Modal global | Criar/editar item (toggle "É agendamento? tem horário") |

### RLS
- VENDEDOR vê só itens onde `criado_por = self` OU `atribuido_para = self`
- ADMIN vê tudo
- Vendedor não pode reatribuir item dele a outro usuário

### Decisões já tomadas
- ✅ Tabela única (não 2 entidades separadas)
- ✅ Sem integração com CRM no MVP (FKs prontos mas UI desligada)
- ✅ Sem notificações no MVP (sem email/WhatsApp/badge)
- ✅ Categorias gerenciáveis pelo Admin (não enum hardcoded)
- ✅ Histórico de alterações vai no MVP (auditoria importa em multi-usuário)
- ✅ Recorrência simples por preset (diária/semanal/quinzenal/mensal/anual) — sem RRULE completo no MVP
- ✅ Categorias **não têm seed genérico** — vêm do import do dia-foco-app (Trabalho, Documentação, Marketing, Avaliações, Treinamento, Planejamento, Fotos)

### Migração one-shot do dia-foco-app

Acontece UMA vez, no início. Usuário não tem acesso ao banco do dia-foco-app, mas exportou CSVs em 2026-05-22:
- `profiles` (7 linhas) — usuários antigos
- `tarefas` (~120 linhas) — período nov/25 → mai/26
- `tarefas_historico` (~200 linhas) — audit log

**Estratégia:** script de import server-side rodado pelo dev (não vira tela de upload, porque é one-shot).

**Mapeamento:**

| Origem | Destino | Notas |
|--------|---------|-------|
| `profiles.id` (auth user) | `profiles` novo (cuid) | Os 3 "Nilson" duplicados ficam como 3 entradas separadas |
| `tarefas.user_id` | `agenda_itens.criado_por` | Via tabela de mapeamento user_id→profile_id |
| `tarefas.titulo` | `agenda_itens.titulo` | Re-encode UTF-8 (Ã©→é etc) |
| `tarefas.descricao` | `agenda_itens.descricao` | Re-encode UTF-8 |
| `tarefas.data` | `agenda_itens.data` | OK |
| `tarefas.prioridade` (Baixa/Média/Alta) | `agenda_itens.prioridade` (BAIXA/MEDIA/ALTA) | Normalizar |
| `tarefas.status` (A Fazer/Em Andamento/Concluída) | `agenda_itens.status` (PENDENTE/EM_ANDAMENTO/CONCLUIDO) | Normalizar |
| `tarefas.categoria` (texto livre, caótico) | `agenda_itens.categoria_id` | Cria categoria automaticamente; **`TABALHO`/`TRABALHO`/`trabalho` viram a mesma categoria "Trabalho"** |
| `tarefas.responsavel` (texto livre) | Vai pra `observacoes` prefixado: `[Resp. original: WESLEY/NILSON]` | Não cria profile-stub |
| `tarefas.created_at`/`updated_at` | Preservar valores originais | |
| `tarefas.ordem` | `agenda_itens.ordem` | Corrige valores -1 |
| `tarefas_historico.*` | `agenda_historico.*` | 1:1 |
| Todas as 120 entradas | `tipo='TAREFA'` | Nenhuma tem horário, então nenhum AGENDAMENTO |

**Profiles a criar manualmente (não via import):**
- **Wesley** → role=ADMIN
- **Omar** → role=COLABORADOR, acesso_modulos=['AGENDA']
- Jéssica e Guilherme **não migram** (sem login)

### Categorias-seed (geradas pela migração)
Trabalho · Documentação · Marketing · Avaliações · Treinamento · Planejamento · Fotos

(Após criar, Admin pode adicionar/desativar livremente.)

### Fora de escopo
- Convites/participantes múltiplos (estilo Google Calendar) → v2
- Integração com Google Calendar / Outlook → v2
- Re-import dos CSVs (migração é one-shot) → não previsto
- Compressão automática de vídeo (custosa no client) → v2

---

## 8. Módulo RH / Ponto

**Status:** ⚪ esboçado · **Depende de:** Obras (alocação por obra)

Detalhar quando chegarmos. Pontos críticos a considerar:
- Funcionários (CLT, terceirizado, diarista) — modelos jurídicos diferentes
- Alocação funcionário ↔ obra (1 funcionário pode passar por várias obras)
- Registro de ponto: entrada/saída/intervalo, idealmente via app/QR/foto
- Banco de horas e regras de hora extra
- Base pra folha (não folha em si — folha integra ou continua em sistema separado)
- Faltas, atestados, férias

**Decisão a tomar antes:** vamos fazer folha aqui ou só ponto + export pra contador?

---

## 9. Módulo Financeiro (consolidador)

**Status:** ⚪ esboçado · **Depende de:** Compras + RH (e idealmente Vendas)

Consolida tudo. Vazio sem as outras fontes — por isso vem depois.

- **Contas a receber** vindo de Vendas + lançamentos manuais
- **Contas a pagar** vindo de Compras + RH (folha) + lançamentos manuais
- **Fluxo de caixa** (realizado + projetado)
- **DRE simplificado por obra** — receita - custo direto - rateios
- **Conciliação bancária** (v2)
- **Centros de custo** — provavelmente = obras + administrativo

---

## 10. Módulo Cobrança

**Status:** ⚪ esboçado · **Depende de:** Financeiro (contas a receber)

Workflow sobre o contas-a-receber do Financeiro.
- Régua automática (D+5 ligar, D+10 boleto, D+30 carta, D+60 jurídico)
- Histórico de contato e tentativas
- Acordos / parcelamento / renegociação
- Integração com WhatsApp (já temos `whatsapp_contacts` no banco — aproveitar)
- Dashboard: aging, % inadimplência por obra, recuperação

---

## 11. Decisões abertas (precisam de input)

Listadas em ordem de bloqueio:

1. **Compras sem cotações/aprovação no MVP** — confirmado após análise dos Sheets reais. OK reservar pra v2? (deixado pra revisitar quando começarmos Compras)
2. **Folha em RH?** — sistema processa folha ou só ponto + export pra contador externo? Decide o escopo de RH.

---

## 12. Histórico do roadmap

- **2026-05-21** — Documento inicial. Vendas em andamento. Acrescentados Agenda (inspirado em dia-foco-app) e Compras, além de Obras identificado como fundação.
- **2026-05-21** — Análise dos 3 Sheets reais (QD 55, QD 70, QD 151). Compras detalhado §6 com schema, seeds, telas, importação CSV. Cotações/aprovação removidas do MVP (não existem no fluxo atual).
- **2026-05-21** — Removida nomenclatura M0/M1/...M6 (estava confundindo). Módulos referenciados por nome; ordem agrupada em fases visuais.
- **2026-05-22** — Analisados CSVs do dia-foco-app (profiles/tarefas/histórico). Introduzido role `COLABORADOR` em §3.2 com `acesso_modulos[]` (Omar terá `['AGENDA']`, Wesley vai como ADMIN). Plano de migração one-shot detalhado em §7. Categorias-seed vêm do import (Trabalho/Documentação/Marketing/Avaliações/Treinamento/Planejamento/Fotos).
- **2026-05-22** — Anexos (foto/vídeo/documento) entraram no MVP da Agenda. Tabela `agenda_anexos` + bucket Supabase Storage. Limites: 50 MB/vídeo, 20 arquivos/item. Compressão automática de foto no client; câmera mobile via input capture.
