'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { applyDerive } from '@/lib/puskris/derive'
import {
  PUSKRIS_PAGES, activeFilterCount, defaultUiFilter, toDeriveFilter,
  type PuskrisTab, type PuskrisUiFilter,
} from '@/lib/puskris/ui-filter'
import { jenisOptions } from '@/lib/puskris/to-spasial'
import PuskrisFilterPanel from '@/components/puskris/PuskrisFilterPanel'
import PuskrisRingkasanView from '@/components/puskris/PuskrisRingkasanView'

const PANEL_KEY = 'puskris-dasbor-filter-panel-open'
const TAB_KEY = 'puskris-dasbor-tab'

export default function PuskrisRingkasanClient() {
  const [raw, setRaw] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<PuskrisUiFilter>(defaultUiFilter())
  const [ready, setReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [tab, setTab] = useState<PuskrisTab>('ringkasan')

  useEffect(() => {
    let on = true
    fetch(`${PUBLIC_BASE_PATH}/api/puskris/ringkasan`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((j) => { if (on) setRaw(j.data || j) })
      .catch((e) => { if (on) setError(e.message || 'Gagal memuat data') })
    return () => { on = false }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedPanel = window.localStorage.getItem(PANEL_KEY)
    if (savedPanel !== null) setPanelOpen(savedPanel === '1')
    const savedTab = window.localStorage.getItem(TAB_KEY) as PuskrisTab | null
    if (savedTab && PUSKRIS_PAGES.some((p) => p.key === savedTab)) setTab(savedTab)
    const sp = new URLSearchParams(window.location.search)
    const next = defaultUiFilter()
    const pilar = sp.get('pilar')
    if (pilar === 'krisis' || pilar === 'layanan' || pilar === 'kesiapsiagaan' || pilar === 'semua') next.pilar = pilar
    const periode = sp.get('periode')
    if (periode === 'tahun' || periode === 'bulan' || periode === '7hari' || periode === '30hari') {
      next.periode = periode
      next.bulan = periode === 'bulan' ? 10 : null
    }
    if (sp.get('provinsi')) next.provinsi = sp.get('provinsi')
    if (sp.get('kabupaten')) next.kabupaten = sp.get('kabupaten')
    if (sp.get('jenis')) next.jenis = sp.get('jenis')
    const qTab = sp.get('tab') as PuskrisTab | null
    if (qTab && PUSKRIS_PAGES.some((p) => p.key === qTab)) setTab(qTab)
    setF(next)
    setReady(true)
  }, [])

  const writeUrl = (applied: PuskrisUiFilter, nextTab = tab) => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams()
    if (nextTab !== 'ringkasan') sp.set('tab', nextTab)
    if (applied.pilar && applied.pilar !== 'semua') sp.set('pilar', applied.pilar)
    if (applied.periode && applied.periode !== 'tahun') sp.set('periode', applied.periode)
    if (applied.provinsi) sp.set('provinsi', applied.provinsi)
    if (applied.kabupaten) sp.set('kabupaten', applied.kabupaten)
    if (applied.jenis) sp.set('jenis', applied.jenis)
    const qs = sp.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }

  const handleApply = useCallback((applied: PuskrisUiFilter) => {
    setF(applied)
    writeUrl(applied)
  }, [tab])

  const selectTab = (next: PuskrisTab) => {
    setTab(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(TAB_KEY, next)
    writeUrl(f, next)
  }

  const togglePanel = () => {
    setPanelOpen((cur) => {
      const next = !cur
      if (typeof window !== 'undefined') window.localStorage.setItem(PANEL_KEY, next ? '1' : '0')
      return next
    })
  }

  const derivedForOpts = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const provinces = useMemo(() => (raw?.regions || []).map((r: any) => ({ code: r.code, nama: r.name || r.nama })), [raw])
  const jenisList = useMemo(() => (raw ? jenisOptions(raw) : []), [raw])
  const meta = PUSKRIS_PAGES.find((p) => p.key === tab) || PUSKRIS_PAGES[0]
  const count = activeFilterCount(f)

  if (error) return <div className="p-6 text-sm text-red-700">Data Ringkasan tidak dapat dimuat: {error}</div>
  if (!raw || !ready) return <div className="p-6 text-sm text-slate-500">Memuat ringkasan Pusat Krisis Kesehatan…</div>

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="puskris-dasbor-root">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-primary">{meta.eyebrow}</div>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-1 max-w-4xl text-xs text-slate-500">{meta.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePanel}
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
                {count > 0 && <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] text-white">{count}</span>}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 pb-3">
        <nav className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1" aria-label="Sub-dasbor Pusat Krisis">
          {PUSKRIS_PAGES.map((item) => {
            const isActive = item.key === tab
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectTab(item.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {panelOpen && (
          <div className="w-full max-w-full shrink-0 lg:sticky lg:top-4 lg:w-[280px]">
            <PuskrisFilterPanel
              f={f}
              onApply={handleApply}
              tab={tab}
              onClose={() => setPanelOpen(false)}
              provinces={provinces}
              kabOptions={(derivedForOpts?.kabOptions as string[]) || []}
              jenisOptions={jenisList}
            />
          </div>
        )}
        <div className="min-w-0 w-full flex-1">
          <PuskrisRingkasanView raw={raw} f={f} tab={tab} onApply={handleApply} />
        </div>
      </div>
    </div>
  )
}
