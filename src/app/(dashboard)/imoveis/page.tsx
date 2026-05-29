'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import { Plus, Search, Home } from 'lucide-react'
import {
  listCarteiras, listImoveis, getImoveisCounts,
  reordenarImoveis, reordenarGruposCarteira,
} from '@/app/actions/imoveis-actions'
import { getVendedores } from '@/app/actions/vendas-actions'
import { ImovelForm } from '@/components/imoveis/imovel-form'
import { ImoveisOrdenavel } from '@/components/imoveis/imoveis-ordenavel'
import type { Imovel, ImovelCarteira, CarteiraTipo } from '@/types/imoveis'
import type { Vendedor } from '@/types/vendas'
import { cn } from '@/lib/utils'

export default function ImoveisPage() {
  const [carteiras, setCarteiras] = useState<ImovelCarteira[]>([])
  const [counts, setCounts] = useState<{ porCarteira: Record<string, number> }>({ porCarteira: {} })
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [abaAtiva, setAbaAtiva] = useState<string>('')   // carteira_id ou FINALIZADOS
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [busca, setBusca] = useState('')
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingLista, setLoadingLista] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Imovel | null>(null)
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  // Carrega catálogos (carteiras, counts, vendedores) e define aba inicial
  const carregarBase = useCallback(async () => {
    setLoadingBase(true)
    try {
      const [cs, ct, vs] = await Promise.all([
        listCarteiras({ ativasApenas: true }),
        getImoveisCounts(),
        getVendedores(true),
      ])
      setCarteiras(cs)
      setCounts(ct)
      setVendedores(vs)
      setAbaAtiva(prev => prev || cs[0]?.id || '')
    } finally {
      setLoadingBase(false)
    }
  }, [])

  useEffect(() => { void carregarBase() }, [carregarBase])

  // Carrega a lista da aba ativa
  const carregarLista = useCallback(async () => {
    if (!abaAtiva) return
    setLoadingLista(true)
    try {
      const data = await listImoveis({ carteira_id: abaAtiva, search: busca })
      setImoveis(data)
    } finally {
      setLoadingLista(false)
    }
  }, [abaAtiva, busca])

  useEffect(() => {
    const t = setTimeout(() => { void carregarLista() }, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [carregarLista, busca])

  async function refreshTudo() {
    await Promise.all([carregarBase(), carregarLista()])
  }

  function abrirNovo() { setEditando(null); setModalOpen(true) }
  function abrirEdicao(im: Imovel) { setEditando(im); setModalOpen(true) }

  // Edição inline otimista
  function patchImovel(id: string, patch: Partial<Imovel>) {
    setImoveis(prev => prev.map(im => im.id === id ? { ...im, ...patch } : im))
  }

  const carteiraAtiva = carteiras.find(c => c.id === abaAtiva)
  const tipoDaAba: CarteiraTipo = carteiraAtiva?.tipo ?? 'USADO'

  function toggleGrupo(chave: string) {
    setColapsados(prev => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave); else next.add(chave)
      return next
    })
  }

  // Agrupa: Novos/Finalizado por empreendimento, Usados/Tiago/Fusão por região.
  // Normaliza a chave (trim + maiúsculas) pra não duplicar grupo por grafia diferente.
  // Ordem: manual (carteira.ordem_grupos) e, dentro do grupo, por imovel.ordem.
  const grupos = useMemo(() => {
    const rotuloDe = (im: Imovel): string => {
      const v = tipoDaAba === 'NOVO' ? im.empreendimento : im.regiao
      return (v || '').trim() || (tipoDaAba === 'NOVO' ? 'Sem empreendimento' : 'Sem região')
    }
    const mapa = new Map<string, { label: string; itens: Imovel[] }>()
    for (const im of imoveis) {
      const label = rotuloDe(im)
      const k = label.toUpperCase()
      const grupo = mapa.get(k) ?? { label, itens: [] }
      grupo.itens.push(im)
      mapa.set(k, grupo)
    }
    const ordemGrupos = carteiraAtiva?.ordem_grupos ?? []
    return Array.from(mapa.values())
      .map(g => ({ chave: g.label, itens: g.itens.slice().sort((a, b) => a.ordem - b.ordem) }))
      .sort((a, b) => {
        const ia = ordemGrupos.indexOf(a.chave.toUpperCase())
        const ib = ordemGrupos.indexOf(b.chave.toUpperCase())
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return a.chave.localeCompare(b.chave, 'pt-BR')
      })
  }, [imoveis, tipoDaAba, carteiraAtiva])

  // Reordenação manual (otimista + persiste)
  function reordImoveis(idsEmOrdem: string[]) {
    const pos = new Map(idsEmOrdem.map((id, i) => [id, i]))
    setImoveis(prev => prev.map(im => pos.has(im.id) ? { ...im, ordem: pos.get(im.id)! } : im))
    void reordenarImoveis(idsEmOrdem)
  }
  function reordGrupos(chavesEmOrdem: string[]) {
    if (!carteiraAtiva) return
    const upper = chavesEmOrdem.map(c => c.toUpperCase())
    setCarteiras(prev => prev.map(c => c.id === carteiraAtiva.id ? { ...c, ordem_grupos: upper } : c))
    void reordenarGruposCarteira(carteiraAtiva.id, chavesEmOrdem)
  }

  const abas = carteiras.map(c => ({ id: c.id, label: c.nome, count: counts.porCarteira[c.id] ?? 0 }))

  return (
    <>
      <Header
        eyebrow="Imóveis"
        title="Inventário"
        subtitle="Imóveis novos, usados e parcerias"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={refreshTudo} />
            <Button onClick={abrirNovo} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo imóvel
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {/* Abas (carteiras + finalizados) */}
        {loadingBase ? (
          <Skeleton className="mb-5 h-12 w-full rounded-2xl" />
        ) : (
          <div className="mb-5 flex w-full gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1">
            {abas.map(a => {
              const ativa = abaAtiva === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAbaAtiva(a.id)}
                  className={cn(
                    'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
                    ativa ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                  )}
                >
                  {a.label}
                  <span className={cn(
                    'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                    ativa ? 'bg-[var(--brand-tint)] text-[var(--brand-bright)]' : 'bg-white/60 text-[var(--ink-faint)]',
                  )}>
                    {a.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por identificação, empreendimento, IDR, endereço…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* Lista */}
        {loadingLista || loadingBase ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : imoveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--ink-soft)]">
              <Home className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-base font-semibold text-[var(--ink)]">
              {busca ? 'Nada bateu com a busca' : 'Nenhum imóvel nesta aba'}
            </p>
            {!busca && (
              <Button onClick={abrirNovo} className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar imóvel
              </Button>
            )}
          </div>
        ) : (
          <ImoveisOrdenavel
            grupos={grupos}
            variant={tipoDaAba}
            colapsados={colapsados}
            onToggleGrupo={toggleGrupo}
            onReordenarGrupos={reordGrupos}
            onReordenarImoveis={reordImoveis}
            onEditarTudo={abrirEdicao}
            onPatched={patchImovel}
          />
        )}
      </div>

      <ImovelForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        carteiras={carteiras}
        vendedores={vendedores}
        carteiraPadrao={abaAtiva || (carteiras[0]?.id ?? null)}
        onSaved={refreshTudo}
      />
    </>
  )
}
