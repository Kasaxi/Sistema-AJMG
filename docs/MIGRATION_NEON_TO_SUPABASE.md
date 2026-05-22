# Migração Neon → Supabase (operação única)

Este documento é o **runbook** da migração de dados do banco Neon (legado, gerado por Prisma) para o Supabase, que agora é a fonte de verdade do sistema.

> **Pré-requisito:** ter acesso ao Neon Console (banco antigo) e ao painel do Supabase (banco novo, projeto `zxcgrbuemohtjgwbwhhw`). Service-role key do Supabase já está em `.env.local`.

## Visão geral

```
Neon (PostgreSQL)            Supabase (PostgreSQL gerenciado)
─────────────────            ─────────────────────────────
users          ────────►     auth.users + public.profiles
vendedores     ────────►     vendedores  (+ email populado via JOIN)
clientes       ────────►     clientes
etapas_funil   ────────►     etapas_funil
lead_distrib.  ────────►     lead_distribuicao
whatsapp_cont. ────────►     whatsapp_contacts
```

Ordem importa por causa de FKs e do trigger `handle_new_user()`. Siga as fases na ordem.

---

## Fase 0 — Backup e preparação

1. **Backup completo do Neon** (rede de segurança):
   ```sh
   pg_dump --no-owner --no-privileges \
     "postgres://USER:PASS@HOST.neon.tech/DB?sslmode=require" \
     > supabase/legacy/neon-full-backup.sql
   ```
2. Confira que o arquivo tem tamanho razoável (não vazio) e está em `supabase/legacy/` (gitignored).
3. **Marque o Neon como somente-leitura** no Neon Console (Project Settings → enable read-only) para evitar gravações novas durante a migração. Reabra para escrita só se a migração falhar.

---

## Fase 1 — Aplicar migration 0002 no Supabase

A migration alinha o schema do Supabase ao formato Neon (IDs em TEXT, `updated_at` onde faltava, `data` em TIMESTAMPTZ, etc.).

1. Abra o **SQL Editor** do Supabase.
2. Cole e execute todo o conteúdo de [`supabase/migrations/0002_align_to_neon.sql`](../supabase/migrations/0002_align_to_neon.sql).
3. Confira que não houve erro. Validação:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'id';
   -- esperado: data_type = 'text'
   ```

---

## Fase 2 — Limpar o Supabase (estado fresco)

Como o Supabase já tem o seed de `etapas_funil` (e talvez um admin que você criou para testar), precisamos zerar antes de importar.

No SQL Editor:

```sql
-- Cuidado: apaga TUDO do schema public + auth.users
TRUNCATE
  public.clientes,
  public.lead_distribuicao,
  public.whatsapp_contacts,
  public.etapas_funil,
  public.vendedores
RESTART IDENTITY CASCADE;

-- auth.users cascateia para profiles via FK
DELETE FROM auth.users;
```

Se quiser preservar um admin já existente, **pule este passo** e use UPSERTs no dump (mais frágil). Recomendo zerar.

---

## Fase 3 — Exportar e importar os dados de domínio

### 3.1 Exportar do Neon

No terminal, com a connection string do Neon:

```sh
pg_dump \
  --data-only \
  --inserts \
  --column-inserts \
  --no-owner \
  --no-privileges \
  --table=vendedores \
  --table=etapas_funil \
  --table=clientes \
  --table=lead_distribuicao \
  --table=whatsapp_contacts \
  "postgres://USER:PASS@HOST.neon.tech/DB?sslmode=require" \
  > supabase/legacy/neon-dump.sql
```

> Por que esses 5 tables e não `users`? Porque `users` do Neon não existe no Supabase — vai ser tratada na próxima fase via script.

### 3.2 Ajustar o dump (1 substituição)

O `pg_dump` gera INSERTs com o schema explícito. Em Neon (Prisma) o schema é `public`, mesmo do Supabase, então **provavelmente nada precisa mudar**. Verifique:

```sh
grep -c "INSERT INTO public" supabase/legacy/neon-dump.sql
```

Se for 0, mas houver INSERTs sem prefixo, rode:
```sh
sed -i 's/INSERT INTO "/INSERT INTO public."/g' supabase/legacy/neon-dump.sql
```

(No Windows/PowerShell: `(Get-Content file) -replace 'INSERT INTO "', 'INSERT INTO public."' | Set-Content file`.)

### 3.3 Importar no Supabase

1. Abra o SQL Editor.
2. Cole o conteúdo de `supabase/legacy/neon-dump.sql`.
3. Execute. Se o dump for grande (>5MB), use a aba **Database → Backups** ou rode via `psql` na connection string do Supabase (Settings → Database).

---

## Fase 4 — Importar usuários (com bcrypt preservado)

### 4.1 Exportar `users` do Neon como JSON

No SQL Editor do Neon, rode:

```sql
SELECT json_agg(row_to_json(u)) AS users
FROM users u;
```

Copie o JSON da coluna `users` e salve em `supabase/legacy/neon-users.json`.

> Formato esperado: array de objetos com `id, email, password, nome, role, vendedor_id, created_at`.

### 4.2 Gerar o SQL de import

```sh
node scripts/build-import-sql.mjs \
  supabase/legacy/neon-users.json \
  supabase/legacy/auth-users-inserts.sql
```

O script:
- Valida que cada `password` é um hash bcrypt (`$2a$`, `$2b$`, `$2y$`)
- Cria uma TEMP TABLE com os usuários
- Atualiza `vendedores.email` via JOIN (essencial para o trigger linkar)
- Insere em `auth.users` com o hash bcrypt direto em `encrypted_password`
- Corrige `profiles.role` e `profiles.nome` (o trigger cria como `VENDEDOR` por padrão)
- Verifica contagem ao final

Se houver hashes não-bcrypt (ex: Argon2), o script avisa: esses usuários precisarão **redefinir senha** após a migração (o login normal falhará).

### 4.3 Aplicar no Supabase

1. SQL Editor → cole o conteúdo de `supabase/legacy/auth-users-inserts.sql`.
2. Execute. No final, o `RAISE NOTICE` mostra esperados × importados.

---

## Fase 5 — Validação

### 5.1 Contagens
No Supabase SQL Editor:
```sql
SELECT 'vendedores' AS t, COUNT(*) FROM public.vendedores
UNION ALL SELECT 'clientes', COUNT(*) FROM public.clientes
UNION ALL SELECT 'etapas_funil', COUNT(*) FROM public.etapas_funil
UNION ALL SELECT 'lead_distribuicao', COUNT(*) FROM public.lead_distribuicao
UNION ALL SELECT 'whatsapp_contacts', COUNT(*) FROM public.whatsapp_contacts
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
UNION ALL SELECT 'profiles', COUNT(*) FROM public.profiles;
```
Compare com o Neon. Deve bater 1:1 (exceto `etapas_funil` se houver seed diferente — verificar manualmente).

### 5.2 Spot-check de cliente
```sql
SELECT id, nome, telefone_whatsapp, status, vendedor_id, valor_venda
FROM public.clientes
ORDER BY created_at DESC
LIMIT 5;
```
Confira no Neon que os mesmos `id`s aparecem com os mesmos valores.

### 5.3 Linkage vendedor↔profile
```sql
SELECT p.id, p.nome, p.role, p.vendedor_id, v.nome AS vendedor_nome
FROM public.profiles p
LEFT JOIN public.vendedores v ON v.id = p.vendedor_id
ORDER BY p.role, v.nome;
```
Verificar: ADMINs têm `vendedor_id = NULL`; VENDEDORes têm `vendedor_id` preenchido e o nome bate.

### 5.4 Login funcional
1. `npm run dev`
2. Acessar `http://localhost:3000/login`
3. Logar com um e-mail/senha que existia no Neon
4. Deve cair em `/vendas/clientes` e listar apenas os clientes desse vendedor (se VENDEDOR) ou todos (se ADMIN).

### 5.5 Provisionamento de vendedor novo
No painel `/vendas/vendedores` (logado como ADMIN), criar um vendedor novo com e-mail e senha. Confirme que:
- Aparece em `auth.users`
- Aparece em `profiles` com role=`VENDEDOR` e `vendedor_id` corretamente linkado
- Consegue logar com a senha criada

---

## Fase 6 — Limpeza e congelamento do Neon

1. Apague os artefatos sensíveis localmente:
   ```sh
   rm supabase/legacy/neon-dump.sql
   rm supabase/legacy/neon-users.json
   rm supabase/legacy/auth-users-inserts.sql
   ```
   Mantenha `neon-full-backup.sql` por **30 dias** como rede de segurança.
2. No Neon Console, mantenha o projeto em modo **read-only** por 30 dias. Após esse período, arquive ou delete o projeto.
3. Atualize qualquer documento interno apontando para o Neon — agora é Supabase.

---

## Troubleshooting

### "duplicate key value violates unique constraint vendedores_email_unique"
Você importou os mesmos dados duas vezes ou o Supabase ainda tinha vendedores antigos. Volte à Fase 2 (TRUNCATE).

### "permission denied for table users (auth.users)"
Você está rodando com a anon key. Use o SQL Editor do Supabase (que roda com privilégio elevado) ou conecte via `psql` com a senha do banco (Settings → Database → Connection string).

### Login falha mesmo com senha correta
O hash não é bcrypt. Possíveis algoritmos no Neon: `argon2`, `scrypt`, `pbkdf2`. Solução: usuário pede "esqueci minha senha" (Supabase envia email de recuperação) ou ADMIN reseta via `supabase.auth.admin.updateUserById(id, { password: 'nova' })`.

### Trigger não linkou vendedor_id
A ordem na Fase 4.2 é crítica: `vendedores.email` deve estar populada **antes** do INSERT em `auth.users`. O script faz isso na mesma transação — se você rodou em pedaços separados, refaça com tudo de uma vez.
