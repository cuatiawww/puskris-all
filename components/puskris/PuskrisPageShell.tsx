'use client'

import Link from 'next/link'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PUSKRIS_NAV, filterQuery, type PuskrisNavItem } from '@/lib/puskris/pages'
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
  const compact = item.key === 'ringkasan'

  const tabs = (
    <nav className="flex flex-wrap items-center gap-1 overflow-x-auto" aria-label="Menu dasbor Pusat Krisis">
      {PUSKRIS_NAV.map((nav) => {
        const active = nav.key === item.key
        return (
          <Link
            key={nav.key}
            href={`${nav.href}${qs}`}
            className={`inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              active ? 'bg-primary text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {nav.label}
          </Link>
        )
      })}
    </nav>
  )

  const filterBtn = (
    <button
      type="button"
      onClick={onTogglePanel}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition ${
        panelOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {panelOpen ? (
        <><PanelLeftClose className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sembunyikan Filter</span></>
      ) : (
        <>
          <PanelLeftOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Buka Filter</span>
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{count}</span>}
        </>
      )}
    </button>
  )

  if (compact) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden px-3 py-2" data-testid="puskris-dasbor-root">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight text-slate-900">{title}</h1>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {tabs}
            {filterBtn}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
          {panelOpen ? (
            <div className="hidden h-full w-[220px] shrink-0 overflow-y-auto lg:block">
              {filterPanel}
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="puskris-dasbor-root">
      <nav aria-label="Jalur halaman" className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Link href={`/dashboard/ringkasan${qs}`} className="hover:text-primary">Dasbor</Link>
        <span aria-hidden>/</span>
        {item.key === 'ringkasan' ? (
          <span className="text-slate-800">Ringkasan Utama</span>
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
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 max-w-4xl text-xs text-slate-500">{item.desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{filterBtn}</div>
      </div>

      <div className="border-b border-slate-200 pb-3">
        {tabs}
        {item.children?.length ? (
          <nav className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`Bagian ${item.label}`}>
            <Link
              href={`${item.href}${qs}`}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${!bagian ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              Semua
            </Link>
            {item.children.map((ch) => (
              <Link
                key={ch.key}
                href={`${ch.href}${qs}`}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${bagian === ch.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {ch.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {panelOpen ? (
          <div className="w-full max-w-full shrink-0 lg:sticky lg:top-4 lg:w-[280px]">
            {filterPanel}
          </div>
        ) : null}
        <div className="min-w-0 w-full flex-1">{children}</div>
      </div>
    </div>
  )
}
