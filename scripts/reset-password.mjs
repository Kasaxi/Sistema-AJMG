#!/usr/bin/env node
/**
 * Reseta a senha de um usuário via Supabase Admin API (service-role).
 *
 * Uso:
 *   node scripts/reset-password.mjs <email> <nova-senha>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const [, , email, newPassword] = process.argv

if (!email || !newPassword) {
  console.error('Uso: node scripts/reset-password.mjs <email> <nova-senha>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Get user ID via admin API getUserById would need it; use listUsers with filter, or fall back to direct lookup
// Try the v2 API call with a filter
const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) {
  console.error('Erro ao listar users:', JSON.stringify(listErr, null, 2))
  process.exit(1)
}

console.log(`Total users retornados: ${list?.users?.length ?? 0}`)
const user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  console.error(`Usuário não encontrado: ${email}`)
  console.error('Emails disponíveis:', list.users.map(u => u.email).join(', '))
  process.exit(1)
}

console.log(`User ID: ${user.id}`)

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
  email_confirm: true
})

if (error) {
  console.error('Erro ao resetar senha:', error.message)
  process.exit(1)
}

console.log(`✓ Senha do ${email} resetada com sucesso.`)
