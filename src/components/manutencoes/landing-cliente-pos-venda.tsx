'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, IdCard, ArrowRight, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { findClienteByCpf } from '@/app/actions/ordens-servico-actions'

/**
 * Formata CPF/CNPJ enquanto o usuário digita.
 * Aceita qualquer entrada e mostra formatado por largura.
 */
function formatDoc(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function LandingClientePosVenda() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar() {
    setErro(null)
    const digits = cpf.replace(/\D/g, '')
    if (digits.length < 11) {
      setErro('Digite o CPF completo.')
      return
    }
    setBuscando(true)
    try {
      const r = await findClienteByCpf(cpf)
      if (!r) {
        setErro('Não encontramos esse CPF no nosso cadastro. Se é a primeira vez, abra uma solicitação avulsa abaixo.')
        return
      }
      router.push(`/portal/${r.token}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao buscar.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          Manutenção do seu imóvel
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)] sm:text-base">
          Acompanhe atendimentos e abra novas solicitações.
        </p>
      </div>

      {/* Card principal: clientes já cadastrados */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
            <IdCard className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">
              Já é cliente AJMG?
            </h2>
            <p className="text-xs text-[var(--ink-soft)]">
              Entre com seu CPF pra ver seu histórico e abrir solicitação.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Label htmlFor="cpf">CPF ou CNPJ</Label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={e => setCpf(formatDoc(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') void entrar() }}
              placeholder="000.000.000-00"
              className="h-12 flex-1 rounded-xl text-base"
              autoFocus
            />
            <Button
              onClick={entrar}
              disabled={buscando}
              className="h-12 gap-1.5 px-5 text-base"
            >
              {buscando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </>
              ) : (
                <>
                  Entrar <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </div>
      </section>

      {/* Divisor */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          ou
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      {/* Card secundário: primeira solicitação */}
      <section className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--paper)] text-[var(--ink-soft)]">
            <MessageSquarePlus className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">
              Primeira solicitação
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Ainda não é cliente cadastrado? Abra uma solicitação avulsa — a gente entra em contato.
            </p>
            <Link
              href="/manutencao/nova"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-bright)] hover:underline"
            >
              Abrir solicitação <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-[var(--ink-faint)]">
        Em dúvida sobre seu cadastro? Fale com a AJMG.
      </p>
    </div>
  )
}
