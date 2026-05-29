'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { ToastProvider } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'sidebar-colapsada'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [colapsada, setColapsada] = useState(false)

  useEffect(() => {
    setColapsada(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  function toggle() {
    setColapsada(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <ConfirmProvider>
      <ToastProvider>
        <div className="min-h-screen">
          <div className="print:hidden">
            <Sidebar colapsada={colapsada} onToggle={toggle} />
          </div>
          <div
            className={cn(
              'transition-[padding] duration-200 print:!pl-0',
              colapsada ? 'lg:pl-16' : 'lg:pl-64',
            )}
          >
            <main className="min-h-screen">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </ConfirmProvider>
  )
}
