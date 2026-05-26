import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="lg:pl-64 print:!pl-0">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
