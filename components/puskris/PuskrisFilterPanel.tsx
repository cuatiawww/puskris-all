'use client'

import { useEffect, useState } from 'react'
import { CalendarRange, Info, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { BULAN_ID, periodeRange, todayWibStr } from '@/lib/puskris/derive'
import { defaultUiFilter, activeFilterCount, tahunIni, toDeriveFilter, type PuskrisTab, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'

const lbl = 'mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600'
const sel = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400'

export type Opt = { value: string; label: string }
export type FilterOptions = {
  provinces: { code: string; nama: string }[]
  kab: string[]
  jenis: string[]
  years: number[]
  regional?: Opt[]
  kategori?: Opt[]
  profesi?: Opt[]
  status?: Opt[]
  /** catatan sumber per halaman (mis. hanya per tahun / nasional) */
  catatan?: string[]
}
export type BagianOpt = { key: string | null; label: string }

/** Bidang filter yang dipakai tiap halaman / bagian. */
export function fieldsFor(page: PuskrisTab, bagian: string | null) {
  const F = { periode: true, provinsi: true, kab: true, jenis: false, regional: false, kategori: false, kedaluwarsa: false, profesi: false, tim: false, status: false, nccKategori: false }
  if (page === 'ringkasan' || page === 'krisis' || page === 'analisis') F.jenis = true
  if (page === 'layanan') {
    if (!bagian || bagian === 'psc' || bagian === 'ambulans') F.status = true
    if (bagian === 'panggilan-119') { F.nccKategori = true; F.kab = false }
  }
  if (page === 'kesiapsiagaan') {
    if (!bagian || bagian === 'logistik') { F.regional = true; F.kategori = true; F.kedaluwarsa = true }
    if (!bagian || bagian === 'tenaga-cadangan') { F.profesi = true; F.tim = true }
    if (bagian === 'logistik') F.kab = false
  }
  if (page === 'asistensi') F.status = true
  return F
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string | null }) {
  return (
    <div>
      <div className={lbl}>{label}</div>
      {children}
      {hint ? <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-slate-500"><Info className="mt-px h-3 w-3 shrink-0" />{hint}</p> : null}
    </div>
  )
}

export default function PuskrisFilterPanel({
  f, onApply, tab, bagian = null, bagianOptions, onBagian, onClose, options: optionsIn,
}: {
  f: PuskrisUiFilter
  onApply: (applied: PuskrisUiFilter) => void
  tab: PuskrisTab
  bagian?: string | null
  bagianOptions?: BagianOpt[]
  onBagian?: (key: string | null, applied: PuskrisUiFilter) => void
  onClose?: () => void
  /** Pilihan bergantung pada draf (mis. kab/kota & profesi mengikuti provinsi yang sedang dipilih). */
  options: FilterOptions | ((draft: PuskrisUiFilter) => FilterOptions)
}) {
  const [draft, setDraft] = useState<PuskrisUiFilter>(f)
  const options = typeof optionsIn === 'function' ? optionsIn(draft) : optionsIn
  useEffect(() => { setDraft(f) }, [f])
  const setPatch = (patch: Partial<PuskrisUiFilter>) => setDraft((prev) => ({ ...prev, ...patch }))
  const F = fieldsFor(tab, bagian)
  const handleApply = () => onApply(draft)
  const handleReset = () => { const def = defaultUiFilter(); setDraft(def); onApply(def) }
  const count = activeFilterCount(draft)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(f)

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
        {bagianOptions?.length ? (
          <Field label={tab === 'asistensi' ? 'Tingkat wilayah' : 'Bagian halaman'}>
            <select className={sel} data-testid="filter-bagian" value={bagian || ''} onChange={(e) => onBagian?.(e.target.value || null, draft)}>
              {bagianOptions.map((b) => <option key={b.key || 'semua'} value={b.key || ''}>{b.label}</option>)}
            </select>
          </Field>
        ) : null}

        {F.periode && <PeriodePicker draft={draft} setPatch={setPatch} years={options.years} />}

        {F.provinsi && (
          <Field label="Provinsi">
            <select className={sel} data-testid="filter-provinsi" value={draft.provinsi || ''} onChange={(e) => setPatch({ provinsi: e.target.value || null, kabupaten: null, regional: null, profesi: null })}>
              <option value="">Semua Provinsi (Nasional)</option>
              {options.provinces.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map((p) => <option key={p.code} value={p.code}>{p.nama}</option>)}
            </select>
          </Field>
        )}

        {F.kab && (
          <Field label="Kabupaten / Kota">
            <select className={sel} data-testid="filter-kab" value={draft.kabupaten || ''} disabled={!draft.provinsi || !options.kab.length} onChange={(e) => setPatch({ kabupaten: e.target.value || null })}>
              <option value="">{!draft.provinsi ? 'Pilih provinsi terlebih dahulu' : options.kab.length ? 'Semua Kab/Kota' : 'Belum ada data kab/kota dari API'}</option>
              {options.kab.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        )}

        {F.jenis && (
          <Field label="Jenis Kejadian">
            <select className={sel} data-testid="filter-jenis" value={draft.jenis || ''} onChange={(e) => setPatch({ jenis: e.target.value || null })}>
              <option value="">Semua jenis kejadian</option>
              {options.jenis.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </Field>
        )}

        {F.status && (
          <Field label={tab === 'asistensi' ? 'Status kapasitas' : 'Status PSC / Ambulans'} hint={tab === 'asistensi' ? null : 'Aktif = PSC berstatus aktif; Siap = ambulans aktif dan kondisi baik (API PSC 119).'}>
            <select className={sel} data-testid="filter-status" value={draft.status || ''} onChange={(e) => setPatch({ status: e.target.value || null })}>
              <option value="">Semua status</option>
              {(options.status || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}

        {F.nccKategori && (
          <Field label="Kategori panggilan" hint="Laporan interval NCC tidak memuat kategori maupun provinsi panggilan, jadi kategori belum bisa disaring (data nasional).">
            <select className={sel} disabled value=""><option value="">Belum tersedia di API NCC</option></select>
          </Field>
        )}

        {F.regional && (
          <Field label="Gudang regional" hint={draft.provinsi && !draft.regional ? 'Mengikuti gudang regional yang melayani provinsi terpilih.' : null}>
            <select className={sel} data-testid="filter-regional" value={draft.regional || ''} onChange={(e) => setPatch({ regional: e.target.value || null })}>
              <option value="">{draft.provinsi ? 'Gudang penanggung provinsi' : 'Semua regional'}</option>
              {(options.regional || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        {F.kategori && (
          <Field label="Kategori barang">
            <select className={sel} data-testid="filter-kategori" value={draft.kategori || ''} onChange={(e) => setPatch({ kategori: e.target.value || null })}>
              <option value="">Semua kategori</option>
              {(options.kategori || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        {F.kedaluwarsa && (
          <Field label="Status kedaluwarsa">
            <select className={sel} data-testid="filter-kedaluwarsa" value={draft.kedaluwarsa || ''} onChange={(e) => setPatch({ kedaluwarsa: e.target.value || null })}>
              <option value="">Semua</option>
              <option value="lewat">Sudah kedaluwarsa</option>
              <option value="segera">Kedaluwarsa ≤ 90 hari</option>
            </select>
          </Field>
        )}
        {F.profesi && (
          <Field label="Profesi relawan">
            <select className={sel} data-testid="filter-profesi" value={draft.profesi || ''} onChange={(e) => setPatch({ profesi: e.target.value || null })}>
              <option value="">Semua profesi</option>
              {(options.profesi || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        {F.tim && (
          <Field label="Tim / EMT" hint="Tim dan Tim Medis Darurat (Emergency Medical Team, EMT) hanya bisa disaring per tahun pembentukan (API Tenaga Cadangan).">
            <select className={sel} data-testid="filter-tim" value={draft.tim || ''} onChange={(e) => setPatch({ tim: e.target.value || null })}>
              <option value="">Tim dan EMT</option>
              <option value="tim">Tim relawan</option>
              <option value="emt">Tim Medis Darurat (EMT)</option>
            </select>
          </Field>
        )}

        {options.catatan?.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-[10px] leading-snug text-amber-900" data-testid="filter-catatan">
            {options.catatan.map((c) => <li key={c} className="flex items-start gap-1"><Info className="mt-px h-3 w-3 shrink-0" />{c}</li>)}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-slate-100 p-4">
        <button type="button" onClick={handleApply} data-testid="filter-terapkan"
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black text-white shadow-xs ${isDirty ? 'bg-primary hover:bg-primary-dark' : 'bg-slate-400'}`}>
          Terapkan Filter
        </button>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{draft.provinsi ? 'Filter provinsi aktif' : 'Skala Nasional'}</span>
          <button type="button" onClick={handleReset} data-testid="filter-reset" className="font-bold text-slate-600 hover:text-primary">Reset Default</button>
        </div>
      </div>
    </aside>
  )
}

/** Pemilih periode: preset, tahun, bulan, dan rentang tanggal kustom (dipakai Filter Dasbor & panel Analisis). */
export function PeriodePicker({ draft, setPatch, years: yearsIn }: { draft: PuskrisUiFilter; setPatch: (p: Partial<PuskrisUiFilter>) => void; years: number[] }) {
  const range = periodeRange(toDeriveFilter(draft))
  const today = todayWibStr()
  const yNow = tahunIni()
  const years = yearsIn.length ? yearsIn : [yNow]
  const maxBulan = draft.tahun === yNow ? Number(today.slice(5, 7)) : 12
  const preset = (p: PuskrisUiFilter['periode']) => setPatch({ periode: p, tahun: p === 'tahun' ? yNow : draft.tahun, bulan: null })
  return (
          <div data-testid="filter-periode">
            <div className={lbl}><CalendarRange className="h-3.5 w-3.5 text-primary" />Periode</div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {([['7hari', '7 hari'], ['30hari', '30 hari'], ['bulanini', 'Bulan ini'], ['tahun', 'Tahun ini']] as const).map(([v, l]) => {
                const on = v === 'tahun' ? draft.periode === 'tahun' && draft.tahun === yNow : draft.periode === v
                return (
                  <button key={v} type="button" data-testid={`periode-${v}`} onClick={() => preset(v)}
                    className={`rounded-lg py-1.5 text-center text-[11px] font-bold transition ${on ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
                )
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <select className={sel} aria-label="Tahun" data-testid="filter-tahun"
                value={draft.periode === 'tahun' || draft.periode === 'bulan' ? String(draft.tahun) : ''}
                onChange={(e) => { const t = Number(e.target.value); if (t) setPatch({ periode: draft.periode === 'bulan' ? 'bulan' : 'tahun', tahun: t, bulan: draft.periode === 'bulan' ? Math.min(draft.bulan || 1, t === yNow ? Number(today.slice(5, 7)) : 12) : null }) }}>
                <option value="">Tahun…</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={sel} aria-label="Bulan" data-testid="filter-bulan"
                value={draft.periode === 'bulan' ? String(draft.bulan || '') : ''}
                onChange={(e) => { const b = Number(e.target.value); setPatch(b ? { periode: 'bulan', bulan: b, tahun: draft.periode === 'tahun' || draft.periode === 'bulan' ? draft.tahun : yNow } : { periode: 'tahun', bulan: null }) }}>
                <option value="">Semua bulan</option>
                {BULAN_ID.slice(0, (draft.periode === 'tahun' || draft.periode === 'bulan') ? maxBulan : Number(today.slice(5, 7))).map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
              </select>
            </div>
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-bold text-slate-500">Rentang tanggal (kustom)</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input type="date" aria-label="Dari tanggal" data-testid="filter-dari" className={`${sel} px-1.5`} max={draft.sampai || today} min="2015-01-01"
                  value={draft.periode === 'rentang' ? draft.dari || '' : ''}
                  onChange={(e) => setPatch({ periode: 'rentang', dari: e.target.value || null, sampai: draft.sampai || today })} />
                <input type="date" aria-label="Sampai tanggal" data-testid="filter-sampai" className={`${sel} px-1.5`} min={draft.dari || '2015-01-01'} max={today}
                  value={draft.periode === 'rentang' ? draft.sampai || '' : ''}
                  onChange={(e) => setPatch({ periode: 'rentang', sampai: e.target.value || null, dari: draft.dari || `${today.slice(0, 4)}-01-01` })} />
              </div>
            </div>
            <p className="mt-1.5 rounded-lg bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary" data-testid="filter-periode-aktif">{range.label} · {range.teks}</p>
          </div>
  )
}
