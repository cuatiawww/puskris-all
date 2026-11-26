'use client'

import Link from 'next/link'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PUSKRIS_NAV, PUSKRIS_TOP_BAR_TABS, isTopBarTabActive, filterQuery, type PuskrisNavItem } from '@/lib/puskris/pages'
import type { PuskrisUiFilter } from '@/lib/puskris/ui-filter'

export default function PuskrisPageShell({
  item, bagian, filter, count, panelOpen, onTogglePanel, filterPanel, children,
}: {
  item: PuskrisNavItem
  bagian: string | null
  filter: PuskrisUiFilter
  count: number
  panelOpen: boolean
  onTogglePanel: () => void
  filterPanel: React.ReactNode
  children: React.ReactNode
}) {
  const child = bagian ? item.children?.find((c) => c.key === bagian) : null
  const title = child ? `${item.title}: ${child.label}` : item.title
  const qs = filterQuery(filter)
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="puskris-dasbor-root">
      <nav aria-label="Jalur halaman" className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Link href={`/dashboard/ringkasan${qs}`} className="hover:text-primary">Dasbor</Link>
        <span aria-hidden>/</span>
        {item.key === 'ringkasan' ? (
          <span className="text-slate-800">Dasbor Utama</span>
        ) : (
          <>
            <Link href={`${item.href}${qs}`} className={child ? 'hover:text-primary' : 'text-slate-800'}>{item.label}</Link>
            {child ? (<><span aria-hidden>/</span><span className="text-slate-800">{child.label}</span></>) : null}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="skdr-eyebrow">{item.eyebrow}</div>
          <h1 className="mt-0.5 text-2xl font-black uppercase tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 max-w-4xl text-xs text-slate-500">{item.desc}</p>
        </div>
        {filterPanel ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePanel}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-xs transition ${
                panelOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {panelOpen ? (
                <><PanelLeftClose className="h-4 w-4" /><span>Sembunyikan Filter</span></>
              ) : (
                <>
                  <PanelLeftOpen className="h-4 w-4" />
                  <span>Buka Filter</span>
                  {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{count}</span>}
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-200 pb-3">
        <nav className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1" aria-label="Menu dasbor Pusat Krisis">
          {PUSKRIS_TOP_BAR_TABS.map((tab) => {
            const active = isTopBarTabActive(tab, item.key, bagian)
            return (
              <Link
                key={tab.id}
                href={`${tab.href}${qs}`}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active ? 'bg-primary text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {panelOpen && filterPanel ? (
          <div className="w-full max-w-full shrink-0 lg:sticky lg:top-4 lg:w-[280px]">
            {filterPanel}
          </div>
        ) : null}
        <div className="min-w-0 w-full flex-1">{children}</div>
      </div>
    </div>
  )
}
