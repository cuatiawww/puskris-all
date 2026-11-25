'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronRight as ChevronGo, LayoutGrid, LayoutList } from 'lucide-react'
import { karakteristikJenis, type KarakteristikKartu } from '@/lib/puskris/wilayah-detail'
import { dmy } from '@/lib/puskris/jenis-meta'

const ORANGE = '#EA580C'
const TEAL = '#0F766E'

function nf(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('id-ID')
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const series = values.length ? values : [0]
  const max = Math.max(1, ...series)
  const w = 96
  const h = 24
  const pts = series
    .map((v, i) => `${((i / Math.max(1, series.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
    .join(' ')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function MoM({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[10.5px] font-bold text-slate-400">bln —</span>
  const cls = value > 0 ? 'text-red-600' : value < 0 ? 'text-emerald-700' : 'text-slate-500'
  return (
    <span className={`text-[10.5px] font-bold ${cls}`} title="Selisih bulan ini terhadap bulan sebelumnya">
      bln {value > 0 ? '+' : ''}{nf(value)}
    </span>
  )
}

function Metric({
  label, value, spark, color, delta, mark,
}: {
  label: string
  value: number
  spark: number[]
  color: string
  delta: number | null
  mark: 'dot' | 'diamond'
}) {
  return (
    <div className="rounded-lg bg-page px-2 py-1.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {mark === 'diamond' ? (
          <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: color }} aria-hidden />
        ) : (
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
        )}
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-black leading-none tabular-nums text-slate-900">{nf(value)}</span>
        <div className="min-w-0 flex-1"><Spark values={spark} color={color} /></div>
      </div>
      <div className="mt-0.5"><MoM value={delta} /></div>
    </div>
  )
}

function Kartu({
  card, selected, onSelect, fill,
}: {
  card: KarakteristikKartu
  selected: boolean
  onSelect: (id: string | null) => void
  fill?: boolean
}) {
  return (
    <button
      type="button"
      data-slide
      data-testid={card.id == null ? 'karakteristik-card-semua' : 'karakteristik-card'}
      data-jenis={card.id ?? 'semua'}
      aria-pressed={selected}
      onClick={() => onSelect(card.id)}
      className={`skdr-card group flex h-full flex-col p-3 text-left transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047D78] ${fill ? 'w-full' : 'w-[16.5rem] shrink-0 snap-start sm:w-[17.5rem]'} ${selected ? 'border-[#047D78] ring-2 ring-[#047D78]/25' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-900 group-hover:text-[#047D78]">{card.nama}</div>
          {card.category ? (
            <div className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{card.category}</div>
          ) : null}
        </div>
        <ChevronGo className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[#047D78]" aria-hidden />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Metric label="Kejadian" value={card.kejadian} spark={card.sparkKejadian} color={ORANGE} delta={card.deltaKejadian} mark="dot" />
        <Metric label="Penduduk terdampak" value={card.terdampak} spark={card.sparkTerdampak} color={TEAL} delta={card.deltaTerdampak} mark="diamond" />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="flex justify-between gap-1">
          <dt className="text-slate-500">Meninggal</dt>
          <dd className="font-bold tabular-nums text-slate-800">{nf(card.meninggal)}</dd>
        </div>
        <div className="flex justify-between gap-1">
          <dt className="text-slate-500">Krisis</dt>
          <dd className="font-bold tabular-nums text-slate-800">{nf(card.krisis)}</dd>
        </div>
        <div className="col-span-2 flex justify-between gap-1">
          <dt className="text-slate-500">Kab/kota terdampak</dt>
          <dd className="font-bold tabular-nums text-slate-800">{nf(card.kab)}</dd>
        </div>
      </dl>
      <div className="mt-auto pt-2 text-[10.5px] text-slate-500">
        Data terakhir: <span className="font-semibold text-slate-700">{card.lastDate ? dmy(card.lastDate) : 'Data belum tersedia dari API'}</span>
      </div>
    </button>
  )
}

export default function WilayahKarakteristik({
  list, selected, onSelect, tahun,
}: {
  list: any[]
  selected: string | null
  onSelect: (id: string | null) => void
  tahun: number
}) {
  const cards = useMemo(() => karakteristikJenis(list || [], tahun), [list, tahun])
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const [grid, setGrid] = useState(false)

  const page = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-slide]')
    const w = card ? card.offsetWidth + 12 : 280
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  if (!cards.length || (cards.length === 1 && cards[0].kejadian === 0)) {
    return (
      <section data-testid="wilayah-karakteristik" className="skdr-section min-w-0">
        <div className="skdr-section-head">
          <div className="skdr-eyebrow">Karakteristik kejadian</div>
          <h2 className="skdr-section-title">Ringkasan per jenis kejadian</h2>
        </div>
        <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
          Data belum tersedia dari API
        </div>
      </section>
    )
  }

  return (
    <section data-testid="wilayah-karakteristik" className="skdr-section min-w-0" aria-roledescription="carousel" aria-label="Ringkasan per jenis kejadian">
      <div className="skdr-section-head flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="skdr-eyebrow">Karakteristik kejadian</div>
          <h2 className="skdr-section-title">Ringkasan per jenis kejadian</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="karakteristik-grid"
            onClick={() => setGrid((v) => !v)}
            aria-pressed={grid}
            aria-label={grid ? 'Tampilkan sebagai slider' : 'Tampilkan semua kartu dalam kisi'}
            title={grid ? 'Tampilkan sebagai slider' : 'Tampilkan semua kartu'}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            {grid ? <LayoutList className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          </button>
          {!grid ? (
            <>
              <button
                type="button"
                data-testid="karakteristik-prev"
                onClick={() => page(-1)}
                aria-label="Geser ke kiri"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="karakteristik-next"
                onClick={() => page(1)}
                aria-label="Geser ke kanan"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {grid ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="karakteristik-grid-view">
          {cards.map((c) => (
            <Kartu key={c.id ?? 'semua'} card={c} selected={selected === c.id} onSelect={onSelect} fill />
          ))}
        </div>
      ) : (
        <div
          ref={track}
          tabIndex={0}
          data-testid="karakteristik-track"
          className="flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing select-none"
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || !track.current) return
            drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || !track.current) return
            const dx = e.clientX - d.x
            if (Math.abs(dx) > 4) d.moved = true
            track.current.scrollLeft = d.left - dx
          }}
          onPointerUp={() => { setTimeout(() => { drag.current = null }, 0) }}
          onPointerLeave={() => { drag.current = null }}
          onClickCapture={(e) => {
            if (drag.current?.moved) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {cards.map((c) => (
            <Kartu key={c.id ?? 'semua'} card={c} selected={selected === c.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  )
}
