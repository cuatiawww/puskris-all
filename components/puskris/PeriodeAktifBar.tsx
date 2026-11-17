'use client'

import { CalendarRange, RefreshCw } from 'lucide-react'
import { periodeRange } from '@/lib/puskris/derive'
import { toDeriveFilter, type PuskrisTab, type PuskrisUiFilter } from '@/lib/puskris/ui-filter'

/** Label periode aktif + sumber mana yang mengikuti periode (atau hanya per tahun / terkini / nasional). */
export default function PeriodeAktifBar({ f, raw, page, bagian, loading }: { f: PuskrisUiFilter; raw: any; page: PuskrisTab; bagian: string | null; loading?: boolean }) {
  const r = periodeRange(toDeriveFilter(f))
  const ikut: string[] = []
  const tidak: string[] = []
  const add = (on: boolean, s: string) => (on ? ikut : tidak).push(s)
  const show = (k: string) => page === 'ringkasan' || page === 'analisis' ||
    (page === 'krisis' && k === 'eoc') ||
    (page === 'layanan' && ((k === 'ncc' && (!bagian || bagian === 'panggilan-119')) || (k === 'psc' && bagian !== 'panggilan-119'))) ||
    (page === 'kesiapsiagaan' && ((k === 'tck' && bagian !== 'logistik') || (k === 'log' && bagian !== 'tenaga-cadangan'))) ||
    (page === 'asistensi' && k === 'asis')
  if (show('eoc')) add(true, `Kejadian EOC${raw?.eoc?.rentang ? ' (diambil dari API untuk rentang ini)' : ''}`)
  if (show('ncc')) add(true, 'Panggilan 119 NCC (nasional)')
  if (show('psc')) tidak.push('PSC 119: panggilan per tahun berjalan, PSC & ambulans kondisi terkini')
  if (show('tck')) tidak.push('Tenaga cadangan: jumlah terdaftar terkini; tim/EMT per tahun pembentukan')
  if (show('log')) tidak.push('Logistik: stok terkini')
  if (show('asis')) tidak.push(`Asistensi: rekap tahun ${raw?.asistensi?.tahun || ''}`)
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600" data-testid="periode-aktif-bar">
      <span className="inline-flex items-center gap-1.5 font-black text-slate-800">
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> : <CalendarRange className="h-3.5 w-3.5 text-primary" />}
        Periode aktif: {r.label}
      </span>
      <span className="tabular-nums text-slate-500">{r.teks}</span>
      {loading ? <span className="font-semibold text-primary">Memuat data API untuk rentang ini…</span> : null}
      {ikut.length ? <span><b className="text-emerald-700">Mengikuti periode:</b> {ikut.join(' · ')}</span> : null}
      {tidak.length ? <span><b className="text-amber-700">Tidak mengikuti periode:</b> {tidak.join(' · ')}</span> : null}
    </div>
  )
}
