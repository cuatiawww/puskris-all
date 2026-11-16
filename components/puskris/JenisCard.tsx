'use client'
// Layout disalin dari DiseaseCard compact (SKDR), isi diganti ke jenis kejadian.
import { Activity, ChevronRight, Users } from 'lucide-react'
import { fmt } from '@/lib/analytics-api'
import { Spark, type Delta } from '@/components/dashboard/DiseaseTable'
import { dmy } from '@/lib/puskris/jenis-meta'
import type { JenisCardModel } from '@/lib/puskris/to-spasial'

function Trend0({ d }: { d: Delta }) {
  if (!d) return <span className="text-[11px] text-slate-500">0</span>
  const up = d.last4 > d.prev4, same = d.last4 === d.prev4
  return (
    <span
      title={`4 bulan terakhir ${fmt(d.last4)} vs 4 bulan sebelumnya ${fmt(d.prev4)}`}
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${same ? 'text-slate-500' : up ? 'text-red-600' : 'text-emerald-700'}`}
    >
      {same ? '=' : up ? '↑' : '↓'}{fmt(d.last4)}
    </span>
  )
}

function Dot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </dt>
      <dd className="font-bold tabular-nums text-slate-800">{fmt(value)}</dd>
    </div>
  )
}

export default function JenisCard({
  card, selected, onSelect,
}: {
  card: JenisCardModel
  selected?: boolean
  onSelect: (nama: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.nama)}
      aria-pressed={selected}
      className={`skdr-card flex w-[280px] shrink-0 snap-start flex-col p-4 text-left transition-colors hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${selected ? 'border-brand-400 ring-2 ring-brand-200' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-slate-900">{card.nama}</h3>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.category}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-lg bg-page px-2.5 py-2">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Activity className="h-3 w-3 text-brand-600" aria-hidden />
            Kejadian
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="text-lg font-black tabular-nums leading-none text-slate-900">{fmt(card.kejadian)}</span>
            <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
              <Spark values={card.sparkKejadian} color="#0F766E" fluid />
              <Trend0 d={card.deltaKejadian} />
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-page px-2.5 py-2">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Users className="h-3 w-3 text-amber-600" aria-hidden />
            Pengungsi
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="text-lg font-black tabular-nums leading-none text-slate-900">{fmt(card.pengungsi)}</span>
            <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
              <Spark values={card.sparkPengungsi} color="#D97706" fluid />
              <Trend0 d={card.deltaPengungsi} />
            </div>
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
        <Dot color="#BE123C" label="Meninggal" value={card.meninggal} />
        <Dot color="#CA8A04" label="Pengungsi" value={card.pengungsi} />
        <Dot color="#0F766E" label="Provinsi terdampak" value={card.provinces} />
      </dl>
      <p className="mt-2 text-[10px] text-slate-400">
        Data terakhir: {card.lastDate ? dmy(card.lastDate) : 'tahun 2026'}
      </p>
    </button>
  )
}
