'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { activeFilterCount, defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { jenisOptions } from '@/lib/puskris/to-spasial'
import { buildFilterOptions, tahunTersedia } from '@/lib/puskris/filter-options'
import { filterQuery, matchPuskrisPath, parseFilterQuery } from '@/lib/puskris/pages'
import PuskrisFilterPanel from '@/components/puskris/PuskrisFilterPanel'
import PuskrisRingkasanView from '@/components/puskris/PuskrisRingkasanView'
import SumberDataStrip from '@/components/puskris/SumberDataStrip'
import PeriodeAktifBar from '@/components/puskris/PeriodeAktifBar'
import PuskrisAnalisisView from '@/components/puskris/PuskrisAnalisisView'
import PuskrisPageShell from '@/components/puskris/PuskrisPageShell'

const PANEL_KEY = 'puskris-dasbor-filter-panel-open'

export function readFilterFromSearch(): PuskrisUiFilter {
  const next = defaultUiFilter()
  if (typeof window === 'undefined') return next
  return parseFilterQuery(window.location.search, next) as PuskrisUiFilter
}

export default function PuskrisDasborClient() {
  const pathname = usePathname() || '/dashboard/ringkasan'
  const { item, bagian } = matchPuskrisPath(pathname)
  const [f, setF] = useState<PuskrisUiFilter>(defaultUiFilter())
  const [ready, setReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const { raw, error, pending, loadingRange } = usePuskrisRaw(f, ready)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedPanel = window.localStorage.getItem(PANEL_KEY)
    if (savedPanel !== null) setPanelOpen(savedPanel === '1')
    setF(readFilterFromSearch())
    setReady(true)
  }, [])

  const writeUrl = (applied: PuskrisUiFilter) => {
    if (typeof window === 'undefined') return
    const qs = filterQuery(applied, true)
    const next = `${window.location.pathname}${qs}`
    window.history.replaceState(null, '', next)
  }

  const handleApply = useCallback((applied: PuskrisUiFilter) => {
    setF(applied)
    writeUrl(applied)
  }, [])

  const togglePanel = () => {
    setPanelOpen((cur) => {
      const next = !cur
      if (typeof window !== 'undefined') window.localStorage.setItem(PANEL_KEY, next ? '1' : '0')
      return next
    })
  }

  const router = useRouter()
  const jenisList = useMemo(() => (raw ? jenisOptions(raw) : []), [raw])
  const options = useCallback((d: PuskrisUiFilter) => buildFilterOptions(raw, d, item.key, bagian, jenisList), [raw, item.key, bagian, jenisList])
  const years = useMemo(() => tahunTersedia(raw), [raw])
  const bagianOptions = item.children?.length ? [{ key: null, label: item.key === 'asistensi' ? 'Provinsi & Kab/Kota' : `Semua bagian ${item.label}` }, ...item.children.map((c) => ({ key: c.key, label: c.label }))] : undefined
  const goBagian = (key: string | null, applied: PuskrisUiFilter) => {
    const href = key ? item.children?.find((c) => c.key === key)?.href || item.href : item.href
    setF(applied)
    router.push(`${href}${filterQuery(applied, true)}`)
  }
  const count = activeFilterCount({ ...f, pilar: 'semua' })

  if (error) return <div className="p-6 text-sm text-red-700">Data dasbor tidak dapat dimuat: {error}</div>
  if (!raw || !ready) return <div className="p-6 text-sm text-slate-500">Memuat dasbor Pusat Krisis Kesehatan…</div>

  return (
    <PuskrisPageShell
      item={item}
      bagian={bagian}
      filter={f}
      count={count}
      panelOpen={panelOpen}
      onTogglePanel={togglePanel}
      filterPanel={
        item.key === 'analisis' ? null : (
          <PuskrisFilterPanel
            f={f}
            onApply={handleApply}
            tab={item.key}
            bagian={bagian}
            bagianOptions={bagianOptions}
            onBagian={goBagian}
            onClose={() => setPanelOpen(false)}
            options={options}
          />
        )
      }
    >
      <SumberDataStrip status={raw.live_status} pending={pending} />
      <PeriodeAktifBar f={f} raw={raw} page={item.key} bagian={bagian} loading={loadingRange} />
      {item.key === 'analisis'
        ? <PuskrisAnalisisView raw={raw} f={f} onApply={handleApply} years={years} />
        : <PuskrisRingkasanView raw={raw} f={f} tab={item.key} bagian={bagian} onApply={handleApply} />}
    </PuskrisPageShell>
  )
}
