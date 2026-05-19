'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Edit2, UserMinus, UserCheck, Loader2, Users, Search } from 'lucide-react'
import { getVendedores, createVendedor, createVendedorComAcesso, updateVendedor, deleteVendedor, getClientes, getCurrentProfile } from '@/app/actions/vendas-actions'
import type { Vendedor } from '@/types/vendas'
import { formatDate, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

function avatarTone(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return h % 2 === 0 ? 'bg-[var(--brand)]' : 'bg-[var(--ink)]'
}

export default function VendedoresPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [clienteCounts, setClienteCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVendedores()
      setVendedores(data)

      const counts: Record<string, number> = {}
      for (const v of data) {
        const result = await getClientes({ vendedor_id: v.id, per_page: 1 })
        counts[v.id] = result.total
      }
      setClienteCounts(counts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getCurrentProfile()
      .then(p => {
        if (p.role !== 'ADMIN') {
          router.replace('/vendas/clientes')
        } else {
          setAllowed(true)
        }
      })
      .catch(() => router.replace('/vendas/clientes'))
  }, [router])

  useEffect(() => { if (allowed) loadData() }, [allowed, loadData])

  function openCreate() {
    setEditingId(null)
    setNome('')
    setEmail('')
    setSenha('')
    setError(null)
    setModalOpen(true)
  }

  function openEdit(v: Vendedor) {
    setEditingId(v.id)
    setNome(v.nome)
    setEmail(v.email ?? '')
    setSenha('')
    setError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim()) { setError('Nome é obrigatório.'); return }
    const temAcesso = !editingId && !!email.trim()
    if (temAcesso && senha.trim().length < 6) {
      setError('Para criar o acesso, a senha precisa ter ao menos 6 caracteres.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      if (editingId) {
        await updateVendedor(editingId, { nome, email: email.trim() || null })
      } else if (email.trim()) {
        await createVendedorComAcesso(nome, email, senha)
      } else {
        await createVendedor(nome)
      }
      setModalOpen(false)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAtivo(v: Vendedor) {
    await updateVendedor(v.id, { ativo: !v.ativo })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este vendedor?')) return
    await deleteVendedor(id)
    loadData()
  }

  const filtered = vendedores.filter(v => v.nome.toLowerCase().includes(search.toLowerCase()))

  if (allowed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)] motion-reduce:animate-none" />
      </div>
    )
  }

  const novoBtn = (
    <Button
      onClick={openCreate}
      className="h-11 cursor-pointer gap-2 rounded-2xl bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)] shadow-[0_8px_20px_-8px_var(--brand)] transition-all hover:bg-[var(--brand-hover)]"
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo Vendedor
    </Button>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="Vendedores"
        subtitle="Gerencie a equipe de vendas"
        actions={novoBtn}
      />

      <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <div className="group relative mb-6 sm:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 text-[var(--ink-faint)] transition-colors group-focus-within:text-[var(--brand-bright)]" />
          <Input
            placeholder="Buscar vendedor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-2xl border-[var(--line)] bg-[var(--surface)] pl-11 text-sm text-[var(--ink)] shadow-sm placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/12"
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(11,16,32,0.04),0_20px_48px_-24px_rgba(11,16,32,0.18)]">
          {loading ? (
            <div className="divide-y divide-[var(--line)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-5">
                  <Skeleton className="h-11 w-11 rounded-2xl" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40 rounded" /></div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--brand-tint)] ring-1 ring-inset ring-[var(--brand-bright)]/15">
                <Users className="h-8 w-8 text-[var(--brand)]" strokeWidth={1.8} />
              </div>
              <p className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">
                Nenhum vendedor
              </p>
              <p className="mt-2 max-w-sm text-sm text-[var(--ink-soft)]">
                {search ? 'Nenhum resultado para essa busca.' : 'Cadastre o primeiro vendedor da equipe.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left">
                    {['Nome', 'Clientes', 'Status', 'Cadastro', ''].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          'px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]',
                          i === 1 && 'hidden sm:table-cell',
                          i === 3 && 'hidden md:table-cell',
                          i === 4 && 'w-12',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filtered.map((v) => (
                    <tr key={v.id} className="group transition-colors hover:bg-[var(--paper)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className={cn(
                            'grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-[13px] font-bold text-white',
                            avatarTone(v.nome)
                          )}>
                            {v.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--ink)]">{v.nome}</p>
                            <p className="truncate text-xs text-[var(--ink-faint)]">{v.email || 'sem e-mail de login'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 sm:table-cell">
                        <span className="font-semibold tabular-nums text-[var(--ink)]">{clienteCounts[v.id] ?? '—'}</span>
                        <span className="ml-1 text-xs text-[var(--ink-faint)]">clientes</span>
                      </td>
                      <td className="px-6 py-4">
                        {v.ativo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-500/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Inativo
                          </span>
                        )}
                      </td>
                      <td className="hidden px-6 py-4 md:table-cell">
                        <span className="text-xs tabular-nums text-[var(--ink-faint)]">{formatDate(v.created_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button aria-label="Ações do vendedor" variant="ghost" size="icon" className="h-9 w-9 cursor-pointer rounded-xl text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--paper)] hover:text-[var(--ink)] group-hover:opacity-100 data-[popup-open]:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(v)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleAtivo(v)}>
                              {v.ativo
                                ? <><UserMinus className="mr-2 h-4 w-4" /> Desativar</>
                                : <><UserCheck className="mr-2 h-4 w-4" /> Reativar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(v.id)} variant="destructive">
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={o => !o && setModalOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
              {editingId ? 'Editar Vendedor' : 'Novo Vendedor'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Nome</label>
              <Input
                placeholder="Nome do vendedor"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
                className="h-11 rounded-xl border-[var(--line)] focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/12"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                E-mail de login
              </label>
              <Input
                type="email"
                placeholder="vendedor@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="h-11 rounded-xl border-[var(--line)] focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/12"
              />
              <p className="text-xs text-[var(--ink-faint)]">
                {editingId
                  ? 'Editar o e-mail aqui não altera um acesso de login já criado.'
                  : 'Com e-mail + senha, o acesso de login é criado automaticamente. Deixe o e-mail vazio para só registrar o vendedor (sem login).'}
              </p>
            </div>
            {!editingId && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                  Senha inicial {email.trim() && <span className="text-rose-500">*</span>}
                </label>
                <Input
                  type="password"
                  placeholder={email.trim() ? 'Mínimo 6 caracteres' : 'Preencha o e-mail para criar o acesso'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  disabled={!email.trim()}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-[var(--line)] focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/12 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-[var(--ink-faint)]">
                  Repasse essa senha ao vendedor — ele entra com o e-mail e a senha definidos aqui.
                </p>
              </div>
            )}
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="cursor-pointer rounded-xl border-[var(--line)]">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer rounded-xl bg-[var(--brand)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-hover)]"
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
