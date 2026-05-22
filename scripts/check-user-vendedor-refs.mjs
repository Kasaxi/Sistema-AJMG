import { readFileSync } from 'node:fs'
const users = JSON.parse(readFileSync('supabase/legacy/neon-users.json', 'utf-8'))
console.log(`Total users: ${users.length}`)
console.log(`\nUsers e seus vendedor_id:`)
for (const u of users) {
  const v = u.vendedor_id ?? '(NULL)'
  console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(42)} → ${v}`)
}
const refs = [...new Set(users.filter(u => u.vendedor_id).map(u => u.vendedor_id))]
console.log(`\nVendedor_ids únicos referenciados: ${refs.length}`)
console.log(refs.map(r => `  '${r}'`).join(',\n'))
