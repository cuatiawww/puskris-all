'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PUBLIC_BASE_PATH } from '@/lib/public-path'
import { applyDerive } from '@/lib/puskris/derive'
import { activeFilterCount, defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { jenisOptions } from '@/lib/puskris/to-spasial'
import { filterQuery, matchPuskrisPath } from '@/lib/puskris/pages'
import PuskrisFilterPanel from '@/components/puskris/PuskrisFilterPanel'
import PuskrisRingkasanView from '@/components/puskris/PuskrisRingkasanView'
import PuskrisAnalisisView from '@/components/puskris/PuskrisAnalisisView'
import PuskrisPageShell from '@/components/puskris/PuskrisPageShell'

const PANEL_KEY = 'puskris-dasbor-filter-panel-open'

function readFilterFromSearch(): PuskrisUiFilter {
  const next = defaultUiFilter()
  if (typeof window === 'undefined') return next
  const sp = new URLSearchParams(window.location.search)
  const periode = sp.get('periode')
  if (periode === 'tahun' || periode === 'bulan' || periode === '7hari' || periode === '30hari') {
    next.periode = periode
    next.bulan = periode === 'bulan' ? 10 : null
  }
  if (sp.get('provinsi')) next.provinsi = sp.get('provinsi')
  if (sp.get('kabupaten')) next.kabupaten = sp.get('kabupaten')
  if (sp.get('jenis')) next.jenis = sp.get('jenis')
  return next
}

export default function PuskrisDasborClient() {
  const pathname = usePathname() || '/dashboard/ringkasan'
  const { item, bagian } = matchPuskrisPath(pathname)
  const [raw, setRaw] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<PuskrisUiFilter>(defaultUiFilter())
  const [ready, setReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)

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
    setF(readFilterFromSearch())
    setReady(true)
  }, [])

  const writeUrl = (applied: PuskrisUiFilter) => {
    if (typeof window === 'undefined') return
    const qs = filterQuery(applied)
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

  const derivedForOpts = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const provinces = useMemo(() => (raw?.regions || []).map((r: any) => ({ code: r.code, nama: r.name || r.nama })), [raw])
  const jenisList = useMemo(() => (raw ? jenisOptions(raw) : []), [raw])
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
        <PuskrisFilterPanel
          f={f}
          onApply={handleApply}
          tab={item.key}
          onClose={() => setPanelOpen(false)}
          provinces={provinces}
          kabOptions={(derivedForOpts?.kabOptions as string[]) || []}
          jenisOptions={jenisList}
          hidePilar
          hideJenis={item.key === 'layanan' || item.key === 'kesiapsiagaan' || item.key === 'asistensi'}
        />
      }
    >
      {item.key === 'analisis'
        ? <PuskrisAnalisisView raw={raw} f={f} onApply={handleApply} />
        : <PuskrisRingkasanView raw={raw} f={f} tab={item.key} bagian={bagian} onApply={handleApply} />}
    </PuskrisPageShell>
  )
}
