import { createClient } from '@supabase/supabase-js'

// Admin client backed by the service_role key. Bypasses RLS.
// SERVER-ONLY: import this exclusively from 'use server' modules that have
// already verified the caller is an ADMIN. Never import from a client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey || serviceKey === 'cole_aqui_a_chave_service_role') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione a chave service_role no .env.local.'
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
