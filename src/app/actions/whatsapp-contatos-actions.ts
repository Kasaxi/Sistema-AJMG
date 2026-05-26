'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { WhatsappContato, WhatsappContatoInput } from '@/types/whatsapp'
import { normalizeWhatsappNumber } from '@/types/whatsapp'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

export async function listWhatsappContatos(): Promise<WhatsappContato[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('whatsapp_contatos')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsappContato[]
}

export async function createWhatsappContato(input: WhatsappContatoInput): Promise<WhatsappContato> {
  const { supabase, user } = await requireUser()

  const nome = input.nome.trim()
  if (!nome) throw new Error('Nome é obrigatório.')

  const numero = normalizeWhatsappNumber(input.numero)
  if (!numero) throw new Error('Número inválido. Use DDD + número (ex: 61 99173-1449).')

  const { data, error } = await supabase
    .from('whatsapp_contatos')
    .insert({ nome, numero, criado_por: user.id })
    .select('*')
    .single()

  if (error) {
    // Conflict (UNIQUE numero)
    if (error.code === '23505') {
      throw new Error('Esse número já está cadastrado.')
    }
    throw new Error(error.message)
  }

  revalidatePath('/compras/cotacoes')
  return data as WhatsappContato
}

export async function deleteWhatsappContato(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('whatsapp_contatos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/compras/cotacoes')
}
