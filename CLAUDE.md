@AGENTS.md

# Sistema-empresa — ERP da AJMG Construtora

ERP unificado que substitui planilhas e ferramentas avulsas (Monday, etc) da AJMG
Construtora. Módulos por fase: **Vendas (CRM imobiliário)**, **Agenda**, **Obras**,
**Compras** (fornecedores, cotações/RFQ, gastos), **Manutenções** (O.S. pós-venda com
portal do cliente). Planejados: **Financeiro**, **RH/Ponto**, **Cobrança**, **Imóveis**.

Textos, labels e nomes de domínio são em **português**. Mantenha esse padrão.

## Stack

- **Next.js 16.2.6** (App Router) — ⚠️ tem breaking changes vs. versões anteriores. **Leia `node_modules/next/dist/docs/` antes de escrever código Next novo** e atenda deprecation notices.
- **React 19.2**, **TypeScript 5**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — Postgres + Auth + Storage
- **Tailwind CSS v4** + **Base UI** (`@base-ui/react`) pros primitivos de UI
- **Anthropic SDK** (`@anthropic-ai/sdk`) — extração de dados em cotações (modelo `claude-sonnet-4-6`)
- `recharts` (gráficos), `jspdf` (PDF), `xlsx` (import/export), `zod` (validação)

## Comandos

```bash
npm run dev        # dev server
npm run build      # build de produção
npm run lint       # eslint
npx tsc --noEmit   # typecheck (não há script dedicado — rode assim)
```

Sempre rode `npx tsc --noEmit` antes de dar uma tarefa por concluída. Lint warnings
do tipo `react-hooks/set-state-in-effect` são **ruído conhecido** do codebase (padrão
de `useEffect(() => { void carregar() }, [...])` em quase toda página) — não são
introduzidos por mudanças novas e podem ser ignorados.

## Arquitetura

### Rotas (App Router)

- `src/app/(auth)/` — login
- `src/app/(dashboard)/` — app interno autenticado (Vendas, Agenda, Obras, Compras, Manutenções)
- **Rotas públicas sem auth** (fora dos groups): `src/app/cotacao/[token]` (resposta de fornecedor), `src/app/manutencao` + `/manutencao/nova` (solicitação pública), `src/app/portal/[token]` (portal do cliente pós-venda)
- **Toda rota pública nova precisa ser liberada explicitamente em `src/middleware.ts`** (lista `isPublicPath`). O middleware redireciona pra `/login` qualquer path não-público sem sessão.

### Camada de dados: Server Actions

Toda leitura/escrita passa por server actions em `src/app/actions/*-actions.ts`
(`'use server'`). Não há route handlers de API pra dados. Padrão:
- `requireUser()` no topo de cada action interna (valida sessão, retorna `{ supabase, user }`)
- Erros via `throw new Error(mensagem-amigável)`; o componente client captura e mostra
- `revalidatePath()` após mutações

### Três clients Supabase — use o certo

| Client | Arquivo | Quando |
|---|---|---|
| Server (RLS) | `lib/supabase-server.ts` → `createClient()` | **Padrão** em server actions internas. Respeita RLS com a sessão do usuário. |
| Browser | `lib/supabase.ts` → `createClient()` | Client components. Hoje só usado pra `uploadToSignedUrl` e logout. |
| Admin (service_role) | `lib/supabase-admin.ts` → `createAdminClient()` | **Só** em ações públicas (via token/CPF) que precisam furar RLS. **Bypassa RLS** — sempre valide o acesso manualmente antes de usar. |

## Banco de dados

- **Migrations** em `supabase/migrations/NNNN_nome.sql`, numeradas em sequência. **Aplicadas manualmente no SQL Editor do Supabase** (não há CLI configurada). Sempre escreva **idempotentes** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY`, `ON CONFLICT DO ...`).
- **IDs são `TEXT`** com cuid/uuid (alinhado à migração que veio do Neon), não `serial`/`bigint`.
- Trigger `set_updated_at` em toda tabela com `updated_at`.
- **RLS é obrigatória.** Padrão por tabela: `ENABLE ROW LEVEL SECURITY` + uma policy **por operação que o app usa**. Helpers no banco: `public.current_user_role()` e `public.user_has_module('CHAVE')`.
  - ⚠️ **Lição cara (migrations 0010→0014)**: criar só policy de `SELECT` num bucket/tabela faz o upload/insert falhar silenciosamente com permission denied. Ao habilitar RLS, cubra **INSERT, UPDATE, DELETE** conforme o que o app faz — não só SELECT.

## Storage — regra crítica de custo

Buckets são **privados**. O objetivo é **nunca passar o arquivo pela função Vercel**
(consome Fast Origin Transfer / duração de função). Padrão correto:

- **Download/preview**: `createSignedUrl()` no server → o browser baixa **direto do Supabase**. Use em `<img src>`, `<video>`, `<iframe>` ou nova aba.
- **Upload**: **signed upload URL** — o browser sobe direto. Fluxo em 3 passos:
  1. Server gera permissão: `createSignedUploadUrl(path)` → `{ path, token }`
  2. Browser sobe: helper `uploadToSignedUrl(bucket, path, token, file)` em `lib/storage-upload.ts`
  3. Server registra metadata na tabela (`registrar*Anexo`)
- **Nunca** receba `File`/`FormData` grande numa server action pra reencaminhar ao storage. (Cotações e Agenda ainda usam o padrão antigo de FormData — são PDFs pequenos; migre quando mexer neles.)
- Buckets de manutenção/O.S. aceitam até 100 MB (foto/vídeo/PDF). Mime types e limite são validados pelo próprio bucket.

## Permissões e módulos

- Roles: `ADMIN` (tudo), `VENDEDOR` (só `VENDAS`), `COLABORADOR` (módulos em `profiles.acesso_modulos`).
- No client use `profileHasModule(profile, 'CHAVE')` de `lib/permissions.ts` (espelha `user_has_module()` do banco). Não chame server action só pra checar módulo.
- Sidebar (`components/layout/sidebar.tsx`): módulo com 1 sub-item vira link direto; com 2+ vira grupo expansível. Item ativo usa heurística "irmão de path mais específico vence".

## Design system

Tokens CSS em `src/app/globals.css` (use sempre, nunca cores hardcoded):
`--ink` (texto), `--ink-soft`, `--ink-faint`, `--paper` (fundo), `--line` (bordas),
`--brand` / `--brand-hover` (azul escuro, ações), `--brand-bright` (azul de destaque/foco),
`--brand-tint` (superfície suave), `--sidebar-bg` (navy).

**Barra de qualidade visual (importante pro usuário):**
- O produto **não pode parecer "AI-made" / shadcn default**. Capriche em espaçamento, hierarquia, microinterações.
- Paleta: **preto / branco / azul-escuro**. **NUNCA use verde** como cor de marca.
- Componentes base em `components/ui/` (sobre Base UI). Use `cn()` (`lib/utils`) pra compor classes.
- Hover/focus sempre visíveis; `focus-visible:ring` nos interativos.

## Convenções de código

- Siga as regras globais de comentários (por quê, não o quê; mínimo necessário).
- Componentes client (`'use client'`) pra interatividade; server components pra data-fetching de página quando possível.
- Forms com upload diferido quando o registro-pai ainda não existe (ex.: anexos por item na criação de manutenção sobem após o save, mapeando draft→registro pela ordem).
- Erros amigáveis em PT pro usuário final; `console.error` pra falhas não-bloqueantes.

## Gotchas

- **Next 16**: `proxyClientMaxBodySize` (era `middlewareClientMaxBodySize`) controla um buffer de 10 MB que trunca o body antes da server action — já setado pra 100 MB no `next.config.ts`. Mudanças em `middleware.ts` e `next.config.ts` exigem **reiniciar o dev server**.
- **CORS de upload**: o signed upload URL do browser depende do CORS do Storage (liberado por padrão no Supabase).
