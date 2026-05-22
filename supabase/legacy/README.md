# supabase/legacy

Pasta de quarentena para artefatos exportados do **Neon** durante a migração única para Supabase.

Tudo aqui é **ignorado pelo git** (ver `.gitignore`). Não comite nenhum dump — eles contêm hashes de senha e dados pessoais de clientes.

Arquivos esperados (criados manualmente durante a migração):

- `neon-dump.sql` — saída de `pg_dump --data-only --inserts` do Neon
- `neon-users.json` — export do `SELECT … FROM users` em formato JSON (entrada do `scripts/build-import-sql.mjs`)
- `auth-users-inserts.sql` — saída do script: INSERTs para `auth.users` + UPDATEs em `profiles` e `vendedores.email`

Depois que a migração for validada e o Neon ficar em modo somente-leitura (30 dias), apague esta pasta inteira.

Consulte [`docs/MIGRATION_NEON_TO_SUPABASE.md`](../../docs/MIGRATION_NEON_TO_SUPABASE.md) para o passo-a-passo.
