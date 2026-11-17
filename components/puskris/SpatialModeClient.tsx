'use client'

// Spatial Mode: peta Pusat Krisis Kesehatan layar penuh (tanpa sidebar/header aplikasi) dengan panel mengambang.
// Memakai komponen peta yang sama dengan Ringkasan (PuskrisPetaTerpadu variant "fullscreen"), jadi semua variabel,
// lapisan (API Intelijen Eksternal, BNPB InaRISK, angin) dan filter berlaku sama.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Filter, Globe2, X } from 'lucide-react'
import { usePuskrisRaw } from '@/components/puskris/usePuskrisRaw'
import { buildFilterOptions } from '@/lib/puskris/filter-options'
import { applyDerive, nf, situasiTerfilter } from '@/lib/puskris/derive'
import { activeFilterCount, defaultUiFilter, toDeriveFilter, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'
import { jenisOptions } from '@/lib/puskris/to-spasial'
import { filterQuery, NASIONAL_NOTE } from '@/lib/puskris/pages'
import { KORBAN_LABEL, NCC_LABEL } from '@/lib/puskris/labels'
import PuskrisFilterPanel from '@/components/puskris/PuskrisFilterPanel'
import PuskrisPetaTerpadu, { periodeLabel } from '@/components/puskris/PuskrisPetaTerpadu'
import InfoHint from '@/components/puskris/InfoHint'
import { readFilterFromSearch } from '@/components/puskris/PuskrisDasborClient'

function Kpi({ label, value, sub, hint, tone = 'slate' }: { label: string; value: string; sub?: string; hint?: string; tone?: 'slate' | 'teal' | 'red' | 'amber' | 'blue' }) {
  const color = { slate: 'text-slate-900', teal: 'text-teal-800', red: 'text-red-700', amber: 'text-amber-700', blue: 'text-blue-700' }[tone]
  return (
    <div className="min-w-0 px-2.5 py-1" data-testid="spatial-kpi">
      <div className="flex items-center gap-0.5 truncate text-[9.5px] font-black uppercase tracking-wider text-slate-500">
        <span className="truncate">{label}</span>{hint ? <InfoHint text={hint} label={`Penjelasan ${label}`} /> : null}
      </div>
      <div className={`text-base font-black leading-tight tabular-nums ${color}`}>{value}</div>
      {sub ? <div className="truncate text-[9.5px] font-semibold text-slate-500">{sub}</div> : null}
    </div>
  )
}

export default function SpatialModeClient() {
  const [f, setF] = useState<PuskrisUiFilter>(defaultUiFilter())
  const [ready, setReady] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const { raw, error, loadingRange } = usePuskrisRaw(f, ready)
  useEffect(() => { setF(readFilterFromSearch()); setReady(true) }, [])

  const onApply = useCallback((next: PuskrisUiFilter) => {
    setF(next)
    setSelectedEvent(null)
    window.history.replaceState(null, '', `${window.location.pathname}${filterQuery(next, true)}`)
  }, [])

  const derived = useMemo(() => (raw ? applyDerive(raw, toDeriveFilter(f)) : null), [raw, f])
  const kejadian = useMemo(() => {
    const list = derived?.kejadian || []
    return f.jenis ? list.filter((k: any) => k.jenis === f.jenis) : list
  }, [derived, f.jenis])
  const situasi = useMemo(() => (derived ? situasiTerfilter(derived.situasi, derived.kejadianSemua ? derived.kejadianSemua.filter((k: any) => k.jenis === f.jenis) : kejadian, Boolean(f.jenis)) : null), [derived, kejadian, f.jenis])
  const provinces = useMemo(() => (raw?.regions || []).map((r: any) => ({ code: r.code, nama: r.name || r.nama })), [raw])
  const jenisList = useMemo(() => (raw ? jenisOptions(raw) : []), [raw])
  const options = useCallback((d: PuskrisUiFilter) => buildFilterOptions(raw, d, 'ringkasan', null, jenisList), [raw, jenisList])
  const count = activeFilterCount({ ...f, pilar: 'semua' })
  const wilayahNama = f.provinsi ? (provinces.find((p: any) => p.code === f.provinsi)?.nama || f.provinsi) : 'Seluruh Indonesia'

  if (error) return <div className="flex h-screen items-center justify-center p-6 text-sm text-red-700">Data Pusat Krisis Kesehatan tidak dapat dimuat: {error}</div>
  if (!raw || !ready || !derived || !situasi) return <div className="flex h-screen items-center justify-center text-sm font-bold text-slate-500" data-testid="spatial-mode-loading">Memuat Spatial Mode…</div>

  const l = derived.layanan
  const wilayahDipilih = Boolean(f.provinsi || f.kabupaten)

  const hudTitle = (
    <div className="flex min-w-0 items-center gap-2">
      <Link href={`/dashboard/ringkasan${filterQuery(f)}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Kembali ke Ringkasan" aria-label="Kembali ke Ringkasan" data-testid="spatial-back">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Globe2 className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="truncate text-[9.5px] font-black uppercase tracking-widest text-primary">Pusat Krisis Kesehatan · Spatial Mode</p>
        <h1 className="truncate text-sm font-black leading-tight text-slate-900">{wilayahNama} · {periodeLabel(f)}{f.jenis ? ` · ${f.jenis}` : ''}{loadingRange ? ' · memuat rentang…' : ''}</h1>
      </div>
      <button type="button" onClick={() => setFilterOpen(true)}
        className={`ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold ${count ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`} data-testid="spatial-filter-btn">
        <Filter className="h-3.5 w-3.5" /> Filter{count ? ` (${count})` : ''}
      </button>
    </div>
  )

  const hudExtra = (
    <div className="flex flex-wrap items-stretch divide-x divide-slate-100 self-start rounded-2xl border border-slate-200 bg-white/95 py-1 shadow-lg backdrop-blur" data-testid="spatial-kpi-strip">
      <Kpi label="Kejadian" value={nf(situasi.terpantau)} sub={`${nf(situasi.berdampak_krisis)} berdampak krisis`} tone="teal" />
      <Kpi label="Meninggal" value={nf(situasi.meninggal)} tone="red" />
      <Kpi label="Luka berat / rawat inap" value={situasi.luka_berat == null ? '—' : nf(situasi.luka_berat)} hint={KORBAN_LABEL.lbHint} />
      <Kpi label="Pengungsi" value={nf(situasi.pengungsi)} hint={KORBAN_LABEL.pengungsiHint} tone="amber" />
      <Kpi label="Penduduk terdampak" value={nf(situasi.terdampak)} hint={KORBAN_LABEL.terdampakHint} />
      <Kpi label="Panggilan 119" value={nf(l.panggilan)} sub={l.scr != null ? `berhasil ${String(l.scr.toFixed(1)).replace('.', ',')}%` : undefined} hint={NCC_LABEL.scrHint} tone="blue" />
      <Kpi label="PSC aktif · ambulans" value={`${nf(l.pscAktif)} · ${nf(l.ambulans)}`} sub={wilayahDipilih ? NASIONAL_NOTE : undefined} />
    </div>
  )

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100" data-testid="spatial-mode-root">
      <PuskrisPetaTerpadu
        variant="fullscreen"
        raw={raw}
        f={f}
        onApply={onApply}
        derived={derived}
        kejadian={kejadian}
        selectedEvent={selectedEvent}
        setSelectedEvent={setSelectedEvent}
        hudTitle={hudTitle}
        hudExtra={hudExtra}
      />
      {filterOpen ? (
        <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="Filter Spatial Mode" data-testid="spatial-filter-drawer">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setFilterOpen(false)} />
          <div className="relative m-3 flex max-h-[calc(100vh-24px)] w-[320px] max-w-[90vw] flex-col overflow-y-auto">
            <button type="button" onClick={() => setFilterOpen(false)} className="absolute right-2 top-2 z-10 rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Tutup filter"><X className="h-4 w-4" /></button>
            <PuskrisFilterPanel
              f={f}
              onApply={(next) => { onApply(next); setFilterOpen(false) }}
              tab="ringkasan"
              onClose={() => setFilterOpen(false)}
              options={options}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
