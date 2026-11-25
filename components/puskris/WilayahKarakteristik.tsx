'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Layers } from 'lucide-react'
import { karakteristikJenis, type KarakteristikKartu } from '@/lib/puskris/wilayah-detail'
import { eocIconOf } from '@/lib/puskris/eoc-markers'

const BRAND = '#047D78'
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function nf(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('id-ID')
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString('id-ID')} rb`
  if (n >= 1_000) return `${(n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
  return nf(n)
}

function accentOf(jenis: string | null) {
  if (!jenis) return BRAND
  return eocIconOf(jenis).color
}

function JenisMark({ jenis }: { jenis: string | null }) {
  if (!jenis) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: BRAND }} aria-hidden>
        <Layers className="h-4 w-4" />
      </span>
    )
  }
  const icon = eocIconOf(jenis)
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: icon.color }} aria-hidden>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <g dangerouslySetInnerHTML={{ __html: icon.glyph }} />
      </svg>
    </span>
  )
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const series = values.length ? values : Array.from({ length: 12 }, () => 0)
  const max = Math.max(1, ...series)
  return (
    <div className="flex h-7 items-end gap-px" aria-hidden>
      {series.map((v, i) => (
        <span
          key={i}
          title={`${BULAN[i] || i + 1}: ${nf(v)}`}
          className="min-w-0 flex-1 rounded-sm"
          style={{
            height: `${Math.max(8, Math.round((v / max) * 100))}%`,
            background: color,
            opacity: v > 0 ? 0.95 : 0.18,
          }}
        />
      ))}
    </div>
  )
}

function Kartu({
  card, selected, onSelect, fill, total,
}: {
  card: KarakteristikKartu
  selected: boolean
  onSelect: (id: string | null) => void
  fill?: boolean
  total: number
}) {
  const color = accentOf(card.id)
  const share = total > 0 ? (card.kejadian / total) * 100 : 0
  const chips: { key: string; text: string }[] = []
  if (card.terdampak > 0) chips.push({ key: 'td', text: `${compact(card.terdampak)} terdampak` })
  chips.push({ key: 'kab', text: `${nf(card.kab)} kab/kota` })

  return (
    <button
      type="button"
      data-slide
      data-testid={card.id == null ? 'karakteristik-card-semua' : 'karakteristik-card'}
      data-jenis={card.id ?? 'semua'}
      aria-pressed={selected}
      onClick={() => onSelect(card.id)}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047D78] ${fill ? 'w-full' : 'w-[12.75rem] shrink-0 snap-start sm:w-[13rem]'} ${selected ? 'ring-2' : 'border-slate-200 hover:border-slate-300'}`}
      style={selected ? { borderColor: color, boxShadow: `0 0 0 2px ${color}33` } : undefined}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} aria-hidden />
      <div className="flex items-center gap-2 pl-1">
        <JenisMark jenis={card.id} />
        <div className="min-w-0 truncate text-[13px] font-bold leading-tight text-slate-900 group-hover:text-[#047D78]">
          {card.nama}
        </div>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2 pl-1">
        <div className="min-w-0">
          <div className="text-[22px] font-black leading-none tabular-nums text-slate-900">{nf(card.kejadian)}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">kejadian</div>
        </div>
        <div className="mb-0.5 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-500">
          {share >= 10 ? `${Math.round(share)}%` : `${share.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}
        </div>
      </div>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 pl-0" title={`${share.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari kejadian di wilayah ini`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(share > 0 ? 4 : 0, share))}%`, background: color }} />
      </div>

      <div className="mt-2 pl-1">
        <MiniBars values={card.sparkKejadian} color={color} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1 pl-1">
        {chips.map((c) => (
          <span key={c.key} className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
            {c.text}
          </span>
        ))}
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
  const total = cards.find((c) => c.id == null)?.kejadian || cards.reduce((s, c) => s + (c.id ? c.kejadian : 0), 0)
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const [grid, setGrid] = useState(false)

  const page = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-slide]')
    const w = card ? card.offsetWidth + 10 : 220
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  if (!cards.length || (cards.length === 1 && cards[0].kejadian === 0)) {
    return (
      <section data-testid="wilayah-karakteristik" className="min-w-0">
        <div className="mb-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#047D78]">Karakteristik kejadian</div>
          <h2 className="mt-0.5 text-lg font-black text-slate-900 sm:text-xl">Ringkasan per jenis kejadian</h2>
        </div>
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
          Data belum tersedia dari API
        </div>
      </section>
    )
  }

  return (
    <section data-testid="wilayah-karakteristik" className="min-w-0" aria-roledescription="carousel" aria-label="Ringkasan per jenis kejadian">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#047D78]">Karakteristik kejadian</div>
          <h2 className="mt-0.5 text-lg font-black text-slate-900 sm:text-xl">Ringkasan per jenis kejadian</h2>
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" data-testid="karakteristik-grid-view">
          {cards.map((c) => (
            <Kartu key={c.id ?? 'semua'} card={c} selected={selected === c.id} onSelect={onSelect} fill total={total} />
          ))}
        </div>
      ) : (
        <div
          ref={track}
          tabIndex={0}
          data-testid="karakteristik-track"
          className="flex cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing select-none"
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
            <Kartu key={c.id ?? 'semua'} card={c} selected={selected === c.id} onSelect={onSelect} total={total} />
          ))}
        </div>
      )}
    </section>
  )
}
