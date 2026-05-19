'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/vendas/clientes')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--ink)] p-4">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, color-mix(in srgb, var(--brand-bright) 26%, transparent), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--brand)] shadow-2xl shadow-[var(--brand-bright)]/20 ring-1 ring-white/10">
            <Building2 className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <div className="text-center">
            <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-white">
              Sistema de Gestão
            </h1>
            <p className="mt-1 text-sm text-white/45">Plataforma empresarial unificada</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold text-white">Entrar na conta</h2>
            <p className="mt-1 text-sm text-white/45">Use suas credenciais para acessar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-white/70">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-white/10 bg-white/5 pr-10 text-white placeholder:text-white/30 focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 transition-colors hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full cursor-pointer rounded-xl bg-[var(--brand)] font-semibold text-[var(--on-brand)] shadow-lg shadow-[var(--brand-bright)]/20 transition-all hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando…</>
              ) : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-white/25">
          © {new Date().getFullYear()} Sistema de Gestão Empresarial
        </p>
      </div>
    </div>
  )
}
