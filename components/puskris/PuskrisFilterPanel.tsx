'use client'

import { useEffect, useState } from 'react'
import { Layers, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import type { Periode } from '@/lib/puskris/types'
import { activeFilterCount, defaultUiFilter, type Pilar, type PuskrisTab, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'

const lbl = 'mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600'

export default function PuskrisFilterPanel({
  f,
  onApply,
  tab,
  onClose,
  provinces,
  kabOptions,
  jenisOptions,
}: {
  f: PuskrisUiFilter
  onApply: (applied: PuskrisUiFilter) => void
  tab: PuskrisTab
  onClose?: () => void
  provinces: { code: string; nama: string }[]
  kabOptions: string[]
  jenisOptions: string[]
}) {
  const [draft, setDraft] = useState<PuskrisUiFilter>(f)
  useEffect(() => { setDraft(f) }, [f])
  const setPatch = (patch: Partial<PuskrisUiFilter>) => setDraft((prev) => ({ ...prev, ...patch }))
  const handleApply = () => onApply(draft)
  const handleReset = () => {
    const def = defaultUiFilter()
    setDraft(def)
    onApply(def)
  }
  const count = activeFilterCount(draft)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(f)
  void tab

  return (
    <aside className="flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs box-border" data-testid="puskris-filter-panel">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>Filter Dasbor</span>
          {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{count}</span>}
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button type="button" onClick={handleReset} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Atur Ulang Filter">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden" aria-label="Sembunyikan filter">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="w-full space-y-4 overflow-x-hidden p-4 text-xs box-border">
        <div>
          <div className={lbl}><Layers className="h-3.5 w-3.5 text-primary" /><span>Sumber / Pilar</span></div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {([
              ['semua', 'Semua'],
              ['krisis', 'Krisis'],
              ['layanan', 'Layanan'],
              ['kesiapsiagaan', 'Kesiapsiagaan'],
            ] as [Pilar, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPatch({ pilar: val })}
                className={`rounded-lg py-1.5 text-center text-[11px] font-bold transition ${draft.pilar === val ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={lbl}>Periode</div>
          <select
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
            value={draft.periode}
            onChange={(e) => {
              const periode = e.target.value as Periode
              setPatch({ periode, bulan: periode === 'bulan' ? 10 : null })
            }}
          >
            <option value="tahun">Tahun 2026</option>
            <option value="bulan">Oktober 2026</option>
            <option value="30hari">30 hari terakhir</option>
            <option value="7hari">7 hari terakhir</option>
          </select>
        </div>

        <div>
          <div className={lbl}>Provinsi</div>
          <select
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
            value={draft.provinsi || ''}
            onChange={(e) => setPatch({ provinsi: e.target.value || null, kabupaten: null })}
          >
            <option value="">Semua Provinsi (Nasional)</option>
            {provinces.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map((p) => (
              <option key={p.code} value={p.code}>{p.nama}</option>
            ))}
          </select>
        </div>

        <div>
          <div className={lbl}>Kabupaten / Kota</div>
          <select
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-50"
            value={draft.kabupaten || ''}
            disabled={!draft.provinsi}
            onChange={(e) => setPatch({ kabupaten: e.target.value || null })}
          >
            <option value="">{draft.provinsi ? 'Semua Kab/Kota' : 'Pilih provinsi terlebih dahulu'}</option>
            {kabOptions.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <div className={lbl}>Jenis Kejadian</div>
          <select
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
            value={draft.jenis || ''}
            onChange={(e) => setPatch({ jenis: e.target.value || null })}
          >
            <option value="">Semua jenis kejadian</option>
            {jenisOptions.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 p-4">
        <button
          type="button"
          onClick={handleApply}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black text-white shadow-xs ${isDirty ? 'bg-primary hover:bg-primary-dark' : 'bg-slate-400'}`}
        >
          Terapkan Filter
        </button>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{draft.provinsi ? 'Filter provinsi aktif' : 'Skala Nasional'}</span>
          <button type="button" onClick={handleReset} className="font-bold text-slate-600 hover:text-primary">Reset Default</button>
        </div>
      </div>
    </aside>
  )
}
